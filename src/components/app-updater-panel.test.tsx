// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../i18n';
import type { AvailableAppUpdate } from '../services/app-updater';
import { AppUpdaterPanel } from './app-updater-panel';

afterEach(cleanup);

describe('AppUpdaterPanel', () => {
  it('renders the updater controls in English', () => {
    render(<AppUpdaterPanel t={createTranslator('en')} />);
    expect(screen.getByText('Application update')).toBeTruthy();
    expect(screen.getByText('Check for app updates')).toBeTruthy();
  });

  it('reports when the installed version is current', async () => {
    render(
      <AppUpdaterPanel t={createTranslator('ja')} checkUpdate={vi.fn(async () => undefined)} />,
    );
    fireEvent.click(screen.getByTestId('check-app-update'));
    await waitFor(() => expect(screen.getByText('最新バージョンです。')).toBeTruthy());
  });

  it('downloads an available update and relaunches the app', async () => {
    const downloadAndInstall = vi.fn(async (onProgress) =>
      onProgress({ downloaded: 100, contentLength: 100 }),
    );
    const relaunch = vi.fn(async () => undefined);
    const update: AvailableAppUpdate = {
      version: '0.2.0',
      currentVersion: '0.1.0',
      body: '更新内容',
      installKind: 'desktop',
      downloadAndInstall,
    };
    render(
      <AppUpdaterPanel
        t={createTranslator('ja')}
        checkUpdate={vi.fn(async () => update)}
        relaunch={relaunch}
      />,
    );
    fireEvent.click(screen.getByTestId('check-app-update'));
    await waitFor(() => expect(screen.getByText('バージョン 0.2.0 を利用できます。')).toBeTruthy());
    fireEvent.click(screen.getByTestId('install-app-update'));
    await waitFor(() => expect(downloadAndInstall).toHaveBeenCalledOnce());
    expect(relaunch).toHaveBeenCalledOnce();
  });

  it('opens an Android APK without relaunching the current process', async () => {
    const downloadAndInstall = vi.fn(async () => undefined);
    const relaunch = vi.fn(async () => undefined);
    const update: AvailableAppUpdate = {
      version: '0.2.0',
      currentVersion: '0.1.0',
      installKind: 'android-download',
      downloadAndInstall,
    };
    render(
      <AppUpdaterPanel
        t={createTranslator('ja')}
        checkUpdate={vi.fn(async () => update)}
        relaunch={relaunch}
      />,
    );

    fireEvent.click(screen.getByTestId('check-app-update'));
    await waitFor(() => expect(screen.getByText('APKをダウンロード')).toBeTruthy());
    fireEvent.click(screen.getByTestId('install-app-update'));
    await waitFor(() => expect(downloadAndInstall).toHaveBeenCalledOnce());
    expect(relaunch).not.toHaveBeenCalled();
    expect(screen.getByText(/ブラウザでAPKを開きました/)).toBeTruthy();
  });
});
