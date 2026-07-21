import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Manga } from '../api/client';
import {
  clearHistory,
  getHistory,
  getProgress,
  getProgressPercentage,
  hasCompleteHistoryMetadata,
  hasNewChapter,
  loadLibrary,
  removeHistory,
  saveProgress,
  toggleFavorite,
  updateHistoryCatalog,
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
    expect(toggleFavorite(7)).toEqual([7]);
    expect(toggleFavorite(7)).toEqual([]);
  });

  it('saves a complete history entry and restores reading progress', () => {
    saveProgress(progress);
    expect(getProgress(7)).toMatchObject(progress);
    expect(getHistory()).toHaveLength(1);
  });

  it('calculates progress using the current page and page count', () => {
    const entry = { ...progress, updatedAt: '2026-07-21T00:00:00.000Z' };
    expect(getProgressPercentage(entry)).toBe(50);
    expect(getProgressPercentage({ ...entry, page: 9 })).toBe(100);
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
    expect(updated).toMatchObject({ latestChapter: 5, cover: manga.cover });
    expect(updated?.updatedAt).toBe(before?.updatedAt);
    expect(library.lastUpdateCheckAt).toBeTruthy();
    expect(updated && hasNewChapter(updated)).toBe(true);
  });

  it('deletes a history entry without deleting its favorite', () => {
    toggleFavorite(7);
    saveProgress(progress);
    expect(removeHistory(7)).toEqual([]);
    expect(loadLibrary().favorites).toEqual([7]);
  });

  it('clears all history without deleting favorites', () => {
    toggleFavorite(7);
    saveProgress(progress);
    saveProgress({ ...progress, mangaId: 8, title: '別の作品' });
    expect(clearHistory()).toEqual([]);
    expect(getHistory()).toEqual([]);
    expect(loadLibrary().favorites).toEqual([7]);
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
      version: 2,
      favorites: [7],
      history: { 7: { mangaId: 7, chapter: 3, page: 11, pageCount: 0 } },
    });
    expect(JSON.parse(localStorage.getItem('n-mgram.library') ?? '{}').version).toBe(2);
  });

  it('recovers from incompatible data', () => {
    localStorage.setItem('n-mgram.library', '{"version":0}');
    expect(loadLibrary()).toEqual({ version: 2, favorites: [], history: {} });
  });
});
