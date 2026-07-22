import { describe, expect, it, vi } from 'vitest';
import type { Chapter } from '../api/client';
import { acquirePageImage } from './page-image-cache';
import { getChapterEdgePageUrls, prefetchChapterEdges } from './chapter-edge-prefetch';

vi.mock('./page-image-cache', () => ({ acquirePageImage: vi.fn() }));

function chapter(number: number, pages: string[]): Chapter {
  return {
    mid: 1,
    name: '作品',
    chapter: number,
    content: pages,
    time: '',
    views: 0,
  };
}

describe('chapter edge prefetch', () => {
  it('selects up to the first eight pages of the oldest and newest chapters', () => {
    const chapters = [
      chapter(8, ['8-1', '8-2', '8-3']),
      chapter(1, ['1-1', '1-2', '1-3']),
      chapter(4, ['4-1', '4-2']),
    ];

    expect(getChapterEdgePageUrls(chapters)).toEqual(['1-1', '1-2', '1-3', '8-1', '8-2', '8-3']);
  });

  it('deduplicates a single chapter and releases every prefetched cache reference', async () => {
    const releaseFirst = vi.fn();
    const releaseSecond = vi.fn();
    const releaseThird = vi.fn();
    vi.mocked(acquirePageImage)
      .mockResolvedValueOnce({ blocked: false, source: 'cached-1', release: releaseFirst })
      .mockResolvedValueOnce({ blocked: false, source: 'cached-2', release: releaseSecond })
      .mockResolvedValueOnce({ blocked: false, source: 'cached-3', release: releaseThird });

    await prefetchChapterEdges([chapter(1, ['same-1', 'same-2', 'same-3'])]);

    expect(acquirePageImage).toHaveBeenCalledTimes(3);
    expect(vi.mocked(acquirePageImage).mock.calls.map(([url]) => url)).toEqual([
      'same-1',
      'same-2',
      'same-3',
    ]);
    expect(releaseFirst).toHaveBeenCalledOnce();
    expect(releaseSecond).toHaveBeenCalledOnce();
    expect(releaseThird).toHaveBeenCalledOnce();
  });
});
