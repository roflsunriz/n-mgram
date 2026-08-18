import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Manga } from '../api/client';
import {
  clearHistory,
  getHistory,
  getProgress,
  getProgressPercentage,
  hasCompleteHistoryMetadata,
  hasCompleteMangaProgress,
  hasNewChapter,
  loadLibrary,
  removeHistory,
  saveProgress,
  toggleFavorite,
  updateHistoryCatalog,
  updateHistoryChapterCatalogs,
  type ReadingProgress,
} from './library-store';

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

const progress: Omit<ReadingProgress, 'updatedAt'> = {
  mangaId: 7,
  title: '読んだ作品',
  cover: 'https://ihlv1.xyz/cover.webp',
  chapter: 3,
  page: 4,
  pageCount: 10,
  chapterIndex: 2,
  chapterCount: 5,
  latestChapter: 3,
};

const manga: Manga = {
  id: 7,
  name: '読んだ作品',
  slug: '',
  authors: '',
  transGroup: '',
  artists: '',
  released: 0,
  otherName: '',
  genres: '',
  description: '',
  mStatus: 2,
  lastUpdate: '',
  post: '',
  cover: 'https://ihlv1.xyz/new-cover.webp',
  lastChapter: '5',
  views: 0,
  submitter: 0,
  groupUploader: 0,
  hidden: 0,
  magazines: '',
};

describe('library store', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage());
  });

  it('toggles favorites without duplicates', () => {
    expect(toggleFavorite(manga)).toEqual([{ mangaId: 7, title: '読んだ作品' }]);
    expect(toggleFavorite(manga)).toEqual([]);
  });

  it('saves a complete history entry and restores reading progress', () => {
    saveProgress(progress);
    expect(getProgress(7)).toMatchObject(progress);
    expect(getHistory()).toHaveLength(1);
  });

  it('calculates progress using the chapter order and current page within the whole manga', () => {
    const entry = { ...progress, updatedAt: '2026-07-21T00:00:00.000Z' };
    expect(getProgressPercentage(entry)).toBe(50);
    expect(getProgressPercentage({ ...entry, chapter: 4, chapterIndex: 3, chapterCount: 10 })).toBe(
      35,
    );
    expect(getProgressPercentage({ ...entry, page: 9, chapterIndex: 4, chapterCount: 5 })).toBe(
      100,
    );
    expect(getProgressPercentage({ ...entry, chapterCount: 0 })).toBe(0);
    expect(hasCompleteMangaProgress(entry)).toBe(true);
    expect(hasCompleteMangaProgress({ ...entry, chapterIndex: 5 })).toBe(false);
  });

  it('identifies migrated history that still needs real title and cover metadata', () => {
    const entry = { ...progress, updatedAt: '2026-07-21T00:00:00.000Z' };
    expect(hasCompleteHistoryMetadata(entry)).toBe(true);
    expect(hasCompleteHistoryMetadata({ ...entry, title: '', cover: '' })).toBe(false);
  });

  it('updates the known latest chapter without changing the read date', () => {
    saveProgress(progress);
    const before = getProgress(7);
    const library = updateHistoryCatalog([manga], true);
    const updated = library.history['7'];
    expect(updated).toMatchObject({ latestChapter: '5', cover: manga.cover, chapterCount: 0 });
    expect(updated?.updatedAt).toBe(before?.updatedAt);
    expect(library.lastUpdateCheckAt).toBeTruthy();
    expect(updated && hasNewChapter(updated)).toBe(true);
  });

  it('keeps the exact chapter count when catalog metadata has no newer chapter', () => {
    saveProgress({ ...progress, latestChapter: '5' });
    updateHistoryCatalog([manga]);

    expect(getProgress(7)).toMatchObject({ latestChapter: '5', chapterCount: 5 });
  });

  it('updates whole-manga progress from actual chapter order including decimal labels', () => {
    saveProgress({ ...progress, chapter: '1.2', chapterIndex: 0, chapterCount: 1 });
    const updated = updateHistoryChapterCatalogs([
      { mangaId: 7, chapters: [{ chapter: '1.01' }, { chapter: '1.2' }, { chapter: 3 }] },
    ]);

    expect(updated[0]).toMatchObject({ chapterIndex: 1, chapterCount: 3 });
  });

  it('deletes a history entry without deleting its favorite', () => {
    toggleFavorite(manga);
    saveProgress(progress);
    expect(removeHistory(7)).toEqual([]);
    expect(loadLibrary().favorites).toEqual([{ mangaId: 7, title: '読んだ作品' }]);
  });

  it('keeps decimal chapter labels exact in reading history', () => {
    saveProgress({ ...progress, chapter: '1.01', latestChapter: '1.2' });

    expect(getProgress(7)).toMatchObject({ chapter: '1.01', latestChapter: '1.2' });
    expect(hasNewChapter(getProgress(7)!)).toBe(true);
  });

  it('clears all history without deleting favorites', () => {
    toggleFavorite(manga);
    saveProgress(progress);
    saveProgress({ ...progress, mangaId: 8, title: '別の作品' });
    expect(clearHistory()).toEqual([]);
    expect(getHistory()).toEqual([]);
    expect(loadLibrary().favorites).toEqual([{ mangaId: 7, title: '読んだ作品' }]);
  });

  it('migrates version 1 progress without discarding favorites or read position', () => {
    localStorage.setItem(
      'n-mgram.library',
      JSON.stringify({
        version: 1,
        favorites: [7],
        progress: {
          7: { mangaId: 7, chapter: 3, page: 11, updatedAt: '2026-07-20T12:00:00.000Z' },
        },
      }),
    );
    expect(loadLibrary()).toMatchObject({
      version: 4,
      favorites: [{ mangaId: 7, title: '' }],
      history: {
        7: {
          mangaId: 7,
          chapter: 3,
          page: 11,
          pageCount: 0,
          chapterIndex: 0,
          chapterCount: 0,
        },
      },
    });
    expect(JSON.parse(localStorage.getItem('n-mgram.library') ?? '{}').version).toBe(4);
  });

  it('migrates version 2 favorite IDs and uses known history titles', () => {
    localStorage.setItem(
      'n-mgram.library',
      JSON.stringify({
        version: 2,
        favorites: [7],
        history: {
          7: { ...progress, updatedAt: '2026-07-20T12:00:00.000Z' },
        },
      }),
    );
    expect(loadLibrary().favorites).toEqual([{ mangaId: 7, title: '読んだ作品' }]);
  });

  it('migrates version 3 history for one-time exact chapter-order restoration', () => {
    const version3Progress = {
      mangaId: progress.mangaId,
      title: progress.title,
      cover: progress.cover,
      chapter: progress.chapter,
      page: progress.page,
      pageCount: progress.pageCount,
      latestChapter: progress.latestChapter,
    };
    localStorage.setItem(
      'n-mgram.library',
      JSON.stringify({
        version: 3,
        favorites: [{ mangaId: 7, title: '読んだ作品' }],
        history: {
          7: { ...version3Progress, updatedAt: '2026-07-20T12:00:00.000Z' },
        },
      }),
    );

    expect(loadLibrary()).toMatchObject({
      version: 4,
      history: { 7: { chapterIndex: 0, chapterCount: 0 } },
    });
  });

  it('fills a migrated favorite title from catalog metadata', () => {
    localStorage.setItem(
      'n-mgram.library',
      JSON.stringify({ version: 2, favorites: [7], history: {} }),
    );
    loadLibrary();
    expect(updateHistoryCatalog([manga]).favorites).toEqual([{ mangaId: 7, title: '読んだ作品' }]);
  });

  it('recovers from incompatible data', () => {
    localStorage.setItem('n-mgram.library', '{"version":0}');
    expect(loadLibrary()).toEqual({ version: 4, favorites: [], history: {} });
  });
});
