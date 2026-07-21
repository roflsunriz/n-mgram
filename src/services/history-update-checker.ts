import { getManga, type Manga } from '../api/client';
import type { ReadingProgress } from '../storage/library-store';

export interface HistoryUpdateCheckResult {
  manga: Manga[];
  failed: number;
}

export async function checkHistoryUpdates(
  history: readonly ReadingProgress[],
  fetchManga: (id: number) => Promise<Manga> = getManga,
  concurrency = 3,
): Promise<HistoryUpdateCheckResult> {
  const manga: Manga[] = [];
  let failed = 0;
  let cursor = 0;
  const workerCount = Math.min(Math.max(1, concurrency), history.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < history.length) {
        const entry = history[cursor];
        cursor += 1;
        if (!entry) continue;
        try {
          manga.push(await fetchManga(entry.mangaId));
        } catch {
          failed += 1;
        }
      }
    }),
  );

  return { manga, failed };
}
