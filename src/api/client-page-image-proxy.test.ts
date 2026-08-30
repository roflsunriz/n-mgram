// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolvePageImage } from './client';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('browser development page images', () => {
  it('loads a validated image through the same-origin proxy and exposes a blob URL', async () => {
    vi.stubEnv('MODE', 'development');
    vi.stubEnv('DEV', true);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const fetchMock = vi.fn(
      async () => new Response(png, { headers: { 'Content-Type': 'image/png' } }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:page-image');
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    const result = await resolvePageImage(
      'https://ihlv1.xyz/chapter/page.webp',
      new AbortController().signal,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/__n-mgram-image?url=https%3A%2F%2Fihlv1.xyz%2Fchapter%2Fpage.webp',
      expect.objectContaining({ headers: { Accept: 'image/*' } }),
    );
    expect(createObjectUrl).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      blocked: false,
      source: 'blob:page-image',
      byteLength: png.byteLength,
    });

    result.revoke?.();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:page-image');
  });
});
