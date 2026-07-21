export interface AppUpdateProgress {
  downloaded: number;
  contentLength?: number;
}

export interface AvailableAppUpdate {
  version: string;
  currentVersion: string;
  body?: string;
  date?: string;
  downloadAndInstall: (onProgress: (progress: AppUpdateProgress) => void) => Promise<void>;
}

export class DesktopUpdaterUnavailableError extends Error {
  constructor() {
    super('desktop-updater-unavailable');
    this.name = 'DesktopUpdaterUnavailableError';
  }
}

export async function checkForAppUpdate(): Promise<AvailableAppUpdate | undefined> {
  if (!('__TAURI_INTERNALS__' in window)) throw new DesktopUpdaterUnavailableError();

  const { check } = await import('@tauri-apps/plugin-updater');
  const update = await check({ timeout: 30_000 });
  if (!update) return undefined;

  return {
    version: update.version,
    currentVersion: update.currentVersion,
    body: update.body,
    date: update.date,
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

export async function relaunchAfterUpdate(): Promise<void> {
  const { relaunch } = await import('@tauri-apps/plugin-process');
  await relaunch();
}
