import { describe, expect, it } from 'vitest';
import { detectPageImageMediaType, isBlockedImageDigest, sha256Hex } from './client';

describe('page image filtering', () => {
  it('blocks the translator recruitment image by content digest', () => {
    expect(
      isBlockedImageDigest('c0bb95acdefac920e62af2da8d7eef91521d1782a83f80b1b7f9c04ebd3ca008'),
    ).toBe(true);
  });

  it('calculates stable SHA-256 hex digests', async () => {
    const bytes = new TextEncoder().encode('n-mgram').buffer as ArrayBuffer;
    expect(await sha256Hex(bytes)).toBe(
      'cdb53ae42cf40f56658c43784612003e70b560096342d3091c8c5477b254ed0a',
    );
  });

  it('recognizes image bytes when a CDN sends a generic content type', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const webp = new TextEncoder().encode('RIFF0000WEBP');

    expect(detectPageImageMediaType(png.buffer, 'application/octet-stream')).toBe('image/png');
    expect(detectPageImageMediaType(webp.buffer, null)).toBe('image/webp');
  });

  it('rejects non-image bytes without trusting a generic content type', () => {
    const html = new TextEncoder().encode('<html>not an image</html>');
    expect(detectPageImageMediaType(html.buffer, 'text/html')).toBeUndefined();
  });
});
