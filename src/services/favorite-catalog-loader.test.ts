import { describe, expect, it, vi } from 'vitest';
import type { Manga } from '../api/client';
import { loadFavoriteCatalog } from './favorite-catalog-loader';

const manga = (id: number) => ({ id, name: `Manga ${id}` }) as Manga;

describe('favorite catalog loader', () => {
  it('loads favorites with bounded concurrency and counts failures', async () => {
    let active = 0;
    let peak = 0;
    const fetchManga = vi.fn(async (id: number) => {
      active += 1;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active -= 1;
      if (id === 3) throw new Error('failed');
      return manga(id);
    });

    const result = await loadFavoriteCatalog([1, 2, 3, 4], fetchManga, 2);

    expect(result.manga.map((item) => item.id).sort()).toEqual([1, 2, 4]);
    expect(result.failed).toBe(1);
    expect(peak).toBeLessThanOrEqual(2);
  });
});
