import { useState } from 'react';
import type { MessageKey } from '../i18n';
import {
  checkForAppUpdate,
  DesktopUpdaterUnavailableError,
  relaunchAfterUpdate,
  type AvailableAppUpdate,
} from '../services/app-updater';
import { DownloadIcon } from './icons';

interface Props {
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
  checkUpdate?: () => Promise<AvailableAppUpdate | undefined>;
  relaunch?: () => Promise<void>;
}

type UpdateState =
  'idle' | 'checking' | 'available' | 'current' | 'downloading' | 'external' | 'error';

export function AppUpdaterPanel({
  t,
  checkUpdate = checkForAppUpdate,
  relaunch = relaunchAfterUpdate,
}: Props) {
  const [state, setState] = useState<UpdateState>('idle');
  const [update, setUpdate] = useState<AvailableAppUpdate>();
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string>();

  const check = async () => {
    setState('checking');
    setError(undefined);
    try {
      const available = await checkUpdate();
      setUpdate(available);
      setState(available ? 'available' : 'current');
    } catch (caught: unknown) {
      setError(
        caught instanceof DesktopUpdaterUnavailableError
          ? t('updaterDesktopOnly')
          : caught instanceof Error
            ? caught.message
            : String(caught),
      );
      setState('error');
    }
  };

  const install = async () => {
    if (!update) return;
    setState('downloading');
    setError(undefined);
    setProgress(0);
    try {
      if (update.installKind === 'android-download') {
        await update.downloadAndInstall(() => undefined);
        setState('external');
        return;
      }
      await update.downloadAndInstall(({ downloaded, contentLength }) => {
        if (contentLength && contentLength > 0)
          setProgress(Math.min(100, Math.round((downloaded / contentLength) * 100)));
      });
      await relaunch();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setState('error');
    }
  };

  return (
    <section className="dashboard-panel standalone-panel app-updater-panel">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">APP UPDATE</p>
          <h2>{t('appUpdate')}</h2>
        </div>
        <DownloadIcon />
      </div>
      <p className="app-update-description">{t('appUpdateHint')}</p>

      {state === 'available' && update && (
        <div className="available-update" role="status">
          <strong>{t('appUpdateAvailable', { version: update.version })}</strong>
          <small>
            {t('appUpdateVersionChange', {
              current: update.currentVersion,
              next: update.version,
            })}
          </small>
          {update.body && <p>{update.body}</p>}
        </div>
      )}
      {state === 'current' && <p className="app-update-result">{t('appUpToDate')}</p>}
      {state === 'external' && (
        <p className="app-update-result" role="status">
          {t('androidUpdateOpened')}
        </p>
      )}
      {state === 'error' && error && (
        <p className="update-check-error app-update-error" role="alert">
          {t('appUpdateFailed', { error })}
        </p>
      )}
      {state === 'downloading' && (
        <div className="app-update-progress" role="progressbar" aria-valuenow={progress}>
          <span style={{ width: `${progress}%` }} />
          <small>{t('downloadingUpdate', { progress })}</small>
        </div>
      )}

      <div className="app-update-actions">
        {state === 'available' ? (
          <button type="button" data-testid="install-app-update" onClick={() => void install()}>
            {update?.installKind === 'android-download'
              ? t('downloadAndroidUpdate')
              : t('installAndRestart')}
          </button>
        ) : (
          <button
            type="button"
            data-testid="check-app-update"
            disabled={state === 'checking' || state === 'downloading'}
            onClick={() => void check()}
          >
            {state === 'checking' ? t('checkingAppUpdate') : t('checkAppUpdate')}
          </button>
        )}
      </div>
    </section>
  );
}
