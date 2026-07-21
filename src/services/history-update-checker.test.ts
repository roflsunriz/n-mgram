import { describe, expect, it, vi } from 'vitest';
import type { Manga } from '../api/client';
import type { ReadingProgress } from '../storage/library-store';
import { checkHistoryUpdates } from './history-update-checker';

const history: ReadingProgress[] = [1, 2, 3].map((mangaId) => ({
  mangaId,
  title: `Title ${mangaId}`,
  cover: '',
  chapter: 1,
  page: 0,
  pageCount: 10,
  latestChapter: 1,
  updatedAt: '2026-07-21T00:00:00.000Z',
}));

function manga(id: number): Manga {
  return {
    id,
    name: `Title ${id}`,
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
    cover: 'https://ihlv1.xyz/cover.webp',
    lastChapter: '2',
    views: 0,
    submitter: 0,
    groupUploader: 0,
    hidden: 0,
    magazines: '',
  };
}

describe('history update checker', () => {
  it('checks every read title and retains successful responses on partial failure', async () => {
    const fetchManga = vi.fn(async (id: number) => {
      if (id === 2) throw new Error('network');
      return manga(id);
    });
    const result = await checkHistoryUpdates(history, fetchManga, 2);
    expect(fetchManga).toHaveBeenCalledTimes(3);
    expect(result.manga.map((item) => item.id).sort()).toEqual([1, 3]);
    expect(result.failed).toBe(1);
  });
});
