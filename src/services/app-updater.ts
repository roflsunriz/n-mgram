import { z } from 'zod';

export interface AppUpdateProgress {
  downloaded: number;
  contentLength?: number;
}

export interface AvailableAppUpdate {
  version: string;
  currentVersion: string;
  body?: string;
  date?: string;
  installKind: 'desktop' | 'android-download';
  downloadAndInstall: (onProgress: (progress: AppUpdateProgress) => void) => Promise<void>;
}

const GitHubReleaseSchema = z.object({
  tag_name: z.string().regex(/^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
  body: z.string().nullish(),
  published_at: z.string().nullish(),
  assets: z.array(
    z.object({
      name: z.string(),
      browser_download_url: z.string().url(),
    }),
  ),
});

const ANDROID_RELEASE_API = 'https://api.github.com/repos/roflsunriz/n-mgram/releases/latest';
const ANDROID_APK_PATH_PREFIX = '/roflsunriz/n-mgram/releases/download/';

export class DesktopUpdaterUnavailableError extends Error {
  constructor() {
    super('desktop-updater-unavailable');
    this.name = 'DesktopUpdaterUnavailableError';
  }
}

export async function checkForAppUpdate(): Promise<AvailableAppUpdate | undefined> {
  if (!('__TAURI_INTERNALS__' in window)) throw new DesktopUpdaterUnavailableError();

  if (isAndroid()) return checkForAndroidUpdate();

  const { check } = await import('@tauri-apps/plugin-updater');
  const update = await check({ timeout: 30_000 });
  if (!update) return undefined;

  return {
    version: update.version,
    currentVersion: update.currentVersion,
    body: update.body,
    date: update.date,
    installKind: 'desktop',
    downloadAndInstall: async (onProgress) => {
      let downloaded = 0;
      let contentLength: number | undefined;
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') contentLength = event.data.contentLength ?? undefined;
        if (event.event === 'Progress') downloaded += event.data.chunkLength;
        onProgress({ downloaded, contentLength });
      });
    },
  };
}

async function checkForAndroidUpdate(): Promise<AvailableAppUpdate | undefined> {
  const [{ fetch }, { getVersion }] = await Promise.all([
    import('@tauri-apps/plugin-http'),
    import('@tauri-apps/api/app'),
  ]);
  const response = await fetch(ANDROID_RELEASE_API, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!response.ok) throw new Error(`GitHub release HTTP ${response.status}`);

  const release = parseAndroidRelease(await response.json());
  const version = release.tag_name.replace(/^v/, '');
  const currentVersion = await getVersion();
  if (compareVersions(version, currentVersion) <= 0) return undefined;

  const asset = release.assets.find((candidate) => /android.*\.apk$/i.test(candidate.name));
  if (!asset || !isTrustedAndroidApkUrl(asset.browser_download_url)) {
    throw new Error('Android APK was not found in the latest release');
  }

  return {
    version,
    currentVersion,
    body: release.body ?? undefined,
    date: release.published_at ?? undefined,
    installKind: 'android-download',
    downloadAndInstall: async () => {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(asset.browser_download_url);
    },
  };
}

function isAndroid() {
  return /Android/i.test(navigator.userAgent);
}

function isTrustedAndroidApkUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'github.com' &&
      url.pathname.startsWith(ANDROID_APK_PATH_PREFIX)
    );
  } catch {
    return false;
  }
}

export function compareVersions(left: string, right: string) {
  const parse = (value: string) =>
    (value.replace(/^v/, '').split('-', 1)[0] ?? '')
      .split('.')
      .map((part) => Number.parseInt(part, 10) || 0);
  const leftParts = parse(left);
  const rightParts = parse(right);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

export function parseAndroidRelease(value: unknown) {
  return GitHubReleaseSchema.parse(value);
}

export async function relaunchAfterUpdate(): Promise<void> {
  const { relaunch } = await import('@tauri-apps/plugin-process');
  await relaunch();
}
