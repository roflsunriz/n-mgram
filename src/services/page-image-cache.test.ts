// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolvePageImage } from '../api/client';
import {
  acquirePageImage,
  clearPageImageCache,
  getPageImageCacheStats,
  invalidatePageImageCache,
} from './page-image-cache';

vi.mock('../api/client', () => ({
  resolvePageImage: vi.fn(),
}));

afterEach(async () => {
  await clearPageImageCache();
  vi.clearAllMocks();
});

describe('page image cache', () => {
  it('reuses a resolved image after every viewer has released it', async () => {
    const revoke = vi.fn();
    vi.mocked(resolvePageImage).mockResolvedValue({
      blocked: false,
      source: 'blob:cached',
      byteLength: 1024,
      revoke,
    });

    const first = await acquirePageImage(
      'https://ihlv1.xyz/page.webp',
      new AbortController().signal,
    );
    first.release();
    const second = await acquirePageImage(
      'https://ihlv1.xyz/page.webp',
      new AbortController().signal,
    );

    expect(second.source).toBe('blob:cached');
    expect(resolvePageImage).toHaveBeenCalledOnce();
    expect(revoke).not.toHaveBeenCalled();
    expect(getPageImageCacheStats()).toMatchObject({ entries: 1, inFlight: 0 });
    second.release();
  });

  it('shares one in-flight request between simultaneous viewers', async () => {
    let finish: ((value: { blocked: false; source: string }) => void) | undefined;
    let markStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    vi.mocked(resolvePageImage).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
          markStarted?.();
        }),
    );

    const first = acquirePageImage('https://ihlv1.xyz/shared.webp', new AbortController().signal);
    const second = acquirePageImage('https://ihlv1.xyz/shared.webp', new AbortController().signal);
    await started;
    finish?.({ blocked: false, source: 'blob:shared' });
    const handles = await Promise.all([first, second]);

    expect(resolvePageImage).toHaveBeenCalledOnce();
    handles.forEach((handle) => handle.release());
  });

  it('invalidates a broken decoded image and fetches it again', async () => {
    const firstRevoke = vi.fn();
    vi.mocked(resolvePageImage)
      .mockResolvedValueOnce({ blocked: false, source: 'blob:broken', revoke: firstRevoke })
      .mockResolvedValueOnce({ blocked: false, source: 'blob:fixed' });

    const first = await acquirePageImage(
      'https://ihlv1.xyz/broken.webp',
      new AbortController().signal,
    );
    first.release();
    invalidatePageImageCache('https://ihlv1.xyz/broken.webp');
    const second = await acquirePageImage(
      'https://ihlv1.xyz/broken.webp',
      new AbortController().signal,
    );

    expect(firstRevoke).toHaveBeenCalledOnce();
    expect(second.source).toBe('blob:fixed');
    expect(resolvePageImage).toHaveBeenCalledTimes(2);
    second.release();
  });
});
