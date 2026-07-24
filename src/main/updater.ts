import { app } from 'electron';
import electronUpdater from 'electron-updater';
import { createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { UpdateStatus } from '../shared/types';

/**
 * Auto-updates via GitHub Releases (electron-updater). Only active in
 * packaged builds. Self-update works on Windows, macOS, and Linux AppImage.
 * deb installs update by downloading the new .deb and installing it with
 * `pkexec dpkg -i` (the only step that needs admin rights).
 */

const { autoUpdater } = electronUpdater;

const RELEASE_DOWNLOAD =
  'https://github.com/Pavun57/typist/releases/download';

/** Whether this install can replace itself via electron-updater. */
const canSelfUpdate =
  process.platform !== 'linux' || !!process.env.APPIMAGE;

let notify: (s: UpdateStatus) => void = () => {};
let ready = false;
let pendingVersion = '';

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 300_000 }, (err, _stdout, stderr) =>
      err ? reject(new Error(stderr || err.message)) : resolve(),
    );
  });
}

async function downloadFile(
  url: string,
  dest: string,
  onPercent: (p: number) => void,
): Promise<void> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15 * 60_000) });
  if (!res.ok || !res.body) throw new Error(`Download failed (HTTP ${res.status}).`);
  const total = Number(res.headers.get('content-length') ?? 0);
  let received = 0;
  const progress = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      received += chunk.byteLength;
      if (total > 0) onPercent(Math.round((received / total) * 100));
      controller.enqueue(chunk);
    },
  });
  await pipeline(
    Readable.fromWeb(res.body.pipeThrough(progress) as never),
    createWriteStream(dest),
  );
}

export function initUpdater(onStatus: (s: UpdateStatus) => void): void {
  notify = onStatus;
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = canSelfUpdate;
  autoUpdater.autoInstallOnAppQuit = canSelfUpdate;

  autoUpdater.on('checking-for-update', () => notify({ state: 'checking' }));
  autoUpdater.on('update-available', (info) => {
    pendingVersion = info.version;
    notify({
      state: 'available',
      version: info.version,
      message: canSelfUpdate
        ? undefined
        : `Update ${info.version} available — click Update now (may ask for your password).`,
    });
  });
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

export async function installUpdate(): Promise<void> {
  if (!canSelfUpdate) {
    // deb install: download the new package and install it via pkexec.
    if (!pendingVersion) return;
    try {
      const file = `typist_${pendingVersion}_amd64.deb`;
      const dest = join(app.getPath('temp'), file);
      notify({ state: 'downloading', percent: 0 });
      await downloadFile(
        `${RELEASE_DOWNLOAD}/v${pendingVersion}/${file}`,
        dest,
        (percent) => notify({ state: 'downloading', percent }),
      );
      notify({ state: 'installing' });
      await run('pkexec', ['dpkg', '-i', dest]);
      app.relaunch();
      app.exit(0);
    } catch (err) {
      notify({
        state: 'error',
        message: `Update failed: ${err instanceof Error ? err.message : String(err)} — install policykit-1 or update manually from GitHub.`,
      });
    }
    return;
  }
  if (ready) {
    // Let the UI show the "installing" state before the process exits.
    notify({ state: 'installing' });
    setTimeout(() => autoUpdater.quitAndInstall(), 1500);
  }
}
