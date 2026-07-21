import { describe, expect, it } from 'vitest';
import { isBlockedImageDigest, sha256Hex } from './client';

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
});
