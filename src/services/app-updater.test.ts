import { describe, expect, it } from 'vitest';
import { compareVersions, parseAndroidRelease } from './app-updater';

describe('compareVersions', () => {
  it('compares SemVer-like release versions numerically', () => {
    expect(compareVersions('0.2.0', '0.1.9')).toBe(1);
    expect(compareVersions('0.1.0', '0.1.0')).toBe(0);
    expect(compareVersions('v0.1.9', '0.2.0')).toBe(-1);
  });

  it('treats missing numeric components as zero', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
    expect(compareVersions('1.2.1', '1.2')).toBe(1);
  });
});

describe('parseAndroidRelease', () => {
  it('accepts the release fields used by the Android updater', () => {
    expect(
      parseAndroidRelease({
        tag_name: 'v0.2.0',
        body: null,
        published_at: '2026-07-21T00:00:00Z',
        assets: [
          {
            name: 'n-mgram-v0.2.0-android.apk',
            browser_download_url:
              'https://github.com/roflsunriz/n-mgram/releases/download/v0.2.0/n-mgram-v0.2.0-android.apk',
          },
        ],
      }).tag_name,
    ).toBe('v0.2.0');
  });

  it('rejects malformed release metadata', () => {
    expect(() =>
      parseAndroidRelease({
        tag_name: 'latest',
        assets: [{ name: 'app.apk', browser_download_url: 'not-a-url' }],
      }),
    ).toThrow();
  });
});
