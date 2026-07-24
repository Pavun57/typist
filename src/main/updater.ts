import { app, shell } from 'electron';
import electronUpdater from 'electron-updater';
import type { UpdateStatus } from '../shared/types';

/**
 * Auto-updates via GitHub Releases (electron-updater). Only active in
 * packaged builds. Self-update works on Windows, macOS, and Linux AppImage;
 * deb/rpm installs only get a notice plus a link to the Releases page
 * (their updater path needs pkexec/root and is not reliable).
 */

const { autoUpdater } = electronUpdater;

const RELEASES_URL = 'https://github.com/Pavun57/typist/releases/latest';

/** Whether this install can replace itself with a downloaded update. */
const canSelfUpdate =
  process.platform !== 'linux' || !!process.env.APPIMAGE;

let notify: (s: UpdateStatus) => void = () => {};
let ready = false;

export function initUpdater(onStatus: (s: UpdateStatus) => void): void {
  notify = onStatus;
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = canSelfUpdate;
  autoUpdater.autoInstallOnAppQuit = canSelfUpdate;

  autoUpdater.on('checking-for-update', () => notify({ state: 'checking' }));
  autoUpdater.on('update-available', (info) =>
    notify({
      state: 'available',
      version: info.version,
      message: canSelfUpdate
        ? undefined
        : 'This install cannot self-update — download the new package.',
    }),
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
  if (!canSelfUpdate) {
    void shell.openExternal(RELEASES_URL);
    return;
  }
  if (ready) {
    // Let the UI show the "installing" state before the process exits.
    notify({ state: 'installing' });
    setTimeout(() => autoUpdater.quitAndInstall(), 1500);
  }
}
