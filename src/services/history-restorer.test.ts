import { describe, expect, it, vi } from 'vitest';
import type { Chapter, Manga } from '../api/client';
import type { ReadingProgress } from '../storage/library-store';
import { restoreHistoryEntries } from './history-restorer';

const history: ReadingProgress[] = [1, 2, 3].map((mangaId) => ({
  mangaId,
  title: `Title ${mangaId}`,
  cover: 'https://ihlv1.xyz/cover.webp',
  chapter: 1,
  page: 0,
  pageCount: 10,
  chapterIndex: 0,
  chapterCount: 0,
  latestChapter: '1.2',
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
    lastChapter: '1.2',
    views: 0,
    submitter: 0,
    groupUploader: 0,
    hidden: 0,
    magazines: '',
  };
}

function chapters(id: number): Chapter[] {
  return [1, 1].map((chapter, index) => ({
    mid: id,
    name: `Title ${id}`,
    chapter,
    content: [`https://ihlv1.xyz/${id}-${index}.webp`],
    time: '',
    views: 0,
  }));
}

describe('history restorer', () => {
  it('restores metadata and exact chapter order with bounded request concurrency', async () => {
    let active = 0;
    let peak = 0;
    const run = async <T>(result: T) => {
      active += 1;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active -= 1;
      return result;
    };
    const result = await restoreHistoryEntries(
      history,
      vi.fn((id: number) => run(manga(id))),
      vi.fn((id: number) => run(chapters(id))),
      2,
    );

    expect(result.failed).toBe(0);
    expect(result.manga).toHaveLength(3);
    expect(result.chapterCatalogs).toHaveLength(3);
    expect(result.chapterCatalogs[0]?.chapters.map((chapter) => chapter.chapter)).toEqual([
      '1.1',
      '1.2',
    ]);
    expect(peak).toBeLessThanOrEqual(2);
  });

  it('keeps successful chapter data when metadata restoration fails', async () => {
    const result = await restoreHistoryEntries(
      [history[0]!],
      vi.fn(async () => {
        throw new Error('metadata failed');
      }),
      vi.fn(async () => chapters(1)),
    );

    expect(result.failed).toBe(1);
    expect(result.manga).toEqual([]);
    expect(result.chapterCatalogs[0]?.chapters).toHaveLength(2);
  });

  it('reports a failure instead of fabricating progress when the saved chapter is missing', async () => {
    const result = await restoreHistoryEntries(
      [{ ...history[0]!, chapter: 9 }],
      vi.fn(async () => manga(1)),
      vi.fn(async () => chapters(1)),
    );

    expect(result.failed).toBe(1);
    expect(result.chapterCatalogs).toEqual([]);
  });
});
