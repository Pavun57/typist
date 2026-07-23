import { app } from 'electron';
import electronUpdater from 'electron-updater';
import type { UpdateStatus } from '../shared/types';

/**
 * Auto-updates via GitHub Releases (electron-updater). Only active in
 * packaged builds; on Linux only the AppImage is self-updatable (deb users
 * get an "available" notice and update via the package manager / download).
 */

const { autoUpdater } = electronUpdater;

let notify: (s: UpdateStatus) => void = () => {};
let ready = false;

export function initUpdater(onStatus: (s: UpdateStatus) => void): void {
  notify = onStatus;
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => notify({ state: 'checking' }));
  autoUpdater.on('update-available', (info) =>
    notify({ state: 'available', version: info.version }),
  );
  autoUpdater.on('update-not-available', () => notify({ state: 'none' }));
  autoUpdater.on('download-progress', (p) =>
    notify({ state: 'downloading', percent: Math.round(p.percent) }),
  );
  autoUpdater.on('update-downloaded', (info) => {
    ready = true;
    notify({ state: 'ready', version: info.version });
  });
  autoUpdater.on('error', (err) =>
    notify({ state: 'error', message: err.message ?? 'Update check failed.' }),
  );

  void checkForUpdates();
}

export async function checkForUpdates(): Promise<void> {
  if (!app.isPackaged) return;
  try {
    await autoUpdater.checkForUpdates();
  } catch (err) {
    notify({
      state: 'error',
      message: err instanceof Error ? err.message : 'Update check failed.',
    });
  }
}

export function installUpdate(): void {
  if (ready) autoUpdater.quitAndInstall();
}
