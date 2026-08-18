import { getChapters, getManga, type Chapter, type Manga } from '../api/client';
import { findChapterNumberIndex, restoreTruncatedChapterNumbers } from '../api/chapter-number';
import type { ReadingProgress } from '../storage/library-store';

export interface RestoredHistoryChapterCatalog {
  mangaId: number;
  chapters: Chapter[];
}

export interface HistoryRestorationResult {
  manga: Manga[];
  chapterCatalogs: RestoredHistoryChapterCatalog[];
  failed: number;
}

export async function restoreHistoryEntries(
  history: readonly ReadingProgress[],
  fetchManga: (id: number) => Promise<Manga> = getManga,
  fetchChapters: (id: number) => Promise<Chapter[]> = getChapters,
  concurrency = 2,
): Promise<HistoryRestorationResult> {
  const manga: Manga[] = [];
  const chapterCatalogs: RestoredHistoryChapterCatalog[] = [];
  let failed = 0;
  let cursor = 0;
  const workerCount = Math.min(Math.max(1, concurrency), history.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < history.length) {
        const entry = history[cursor];
        cursor += 1;
        if (!entry) continue;

        let restoredManga: Manga | undefined;
        let entryFailed = false;
        try {
          restoredManga = await fetchManga(entry.mangaId);
          manga.push(restoredManga);
        } catch {
          entryFailed = true;
        }

        try {
          const chapters = await fetchChapters(entry.mangaId);
          const restoredChapters = restoreTruncatedChapterNumbers(
            chapters,
            restoredManga?.lastChapter ?? entry.latestChapter,
          );
          if (findChapterNumberIndex(restoredChapters, entry.chapter) < 0) {
            entryFailed = true;
          } else {
            chapterCatalogs.push({ mangaId: entry.mangaId, chapters: restoredChapters });
          }
        } catch {
          entryFailed = true;
        }

        if (entryFailed) failed += 1;
      }
    }),
  );

  return { manga, chapterCatalogs, failed };
}
