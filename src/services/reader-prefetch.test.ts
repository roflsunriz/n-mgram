import { describe, expect, it, vi } from 'vitest';
import type { Chapter } from '../api/client';
import { acquirePageImage } from './page-image-cache';
import { getReaderPrefetchPlan, prefetchReaderPages } from './reader-prefetch';

vi.mock('./page-image-cache', () => ({ acquirePageImage: vi.fn() }));

function chapter(number: number, prefix: string, pageCount: number): Chapter {
  return {
    mid: 1,
    name: '作品',
    chapter: number,
    content: Array.from({ length: pageCount }, (_, index) => `${prefix}-${index}`),
    time: '',
    views: 0,
  };
}

describe('reader prefetch', () => {
  it('prioritizes the reading position, chapter boundary, then fills adjacent chapters', () => {
    const plan = getReaderPrefetchPlan(
      [
        chapter(1, 'previous', 10),
        chapter(2, 'current', 30),
        chapter(3, 'next', 15),
        chapter(4, 'following', 15),
      ],
      1,
      10,
    );

    expect(plan.slice(0, 16)).toEqual(
      Array.from({ length: 16 }, (_, index) => `current-${index + 10}`),
    );
    expect(plan.slice(16, 20)).toEqual(['current-6', 'current-7', 'current-8', 'current-9']);
    expect(plan.slice(20, 32)).toEqual(Array.from({ length: 12 }, (_, index) => `next-${index}`));
    expect(plan.slice(-8)).toEqual(
      Array.from({ length: 8 }, (_, index) => `previous-${9 - index}`),
    );
    expect(new Set(plan).size).toBe(plan.length);
  });

  it('uses six bounded workers and releases every prefetched image', async () => {
    const pending: Array<() => void> = [];
    const releases: Array<ReturnType<typeof vi.fn>> = [];
    vi.mocked(acquirePageImage).mockImplementation(
      () =>
        new Promise((resolve) => {
          const release = vi.fn();
          releases.push(release);
          pending.push(() => resolve({ blocked: false, source: 'cached', release }));
        }),
    );

    const prefetch = prefetchReaderPages(
      [chapter(1, 'current', 10)],
      0,
      0,
      new AbortController().signal,
    );
    await vi.waitFor(() => expect(acquirePageImage).toHaveBeenCalledTimes(6));

    while (vi.mocked(acquirePageImage).mock.calls.length < 10 || pending.length > 0) {
      pending.splice(0).forEach((finish) => finish());
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    await prefetch;

    expect(acquirePageImage).toHaveBeenCalledTimes(10);
    expect(releases).toHaveLength(10);
    expect(releases.every((release) => release.mock.calls.length === 1)).toBe(true);
    expect(
      vi
        .mocked(acquirePageImage)
        .mock.calls.every(([, , options]) =>
          expect.objectContaining({ priority: 'prefetch' }).asymmetricMatch(options),
        ),
    ).toBe(true);
  });
});
