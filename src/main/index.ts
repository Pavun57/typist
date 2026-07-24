import { app, BrowserWindow, Menu, nativeImage, session, Tray } from 'electron';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import {
  createOverlayWindow,
  createRecorderWindow,
  createSettingsWindow,
  setQuitting,
} from './windows';
import { applyLaunchAtLogin, getSettings } from './settings';
import { registerHotkey, unregisterHotkeys } from './hotkey';
import { initController, toggleRecording } from './controller';
import { registerIpc } from './ipc';
import { checkForUpdates, initUpdater } from './updater';

let settingsWin: BrowserWindow | null = null;
let overlayWin: BrowserWindow | null = null;
let recorderWin: BrowserWindow | null = null;
let tray: Tray | null = null;
let hotkeyPaused = false;

function openSettings(): void {
  if (!settingsWin) return;
  settingsWin.show();
  settingsWin.focus();
}

/** Tray icon: the app mic logo (falls back to a generated red dot). */
function trayIcon(): Electron.NativeImage {
  const iconPath = join(app.getAppPath(), 'resources', 'icon.png');
  if (existsSync(iconPath)) {
    return nativeImage.createFromPath(iconPath).resize({ width: 22, height: 22 });
  }
  const size = 16;
  const radius = 6;
  const center = size / 2;
  const buf = Buffer.alloc(size * size * 4); // BGRA
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - center;
      const dy = y + 0.5 - center;
      if (dx * dx + dy * dy <= radius * radius) {
        const i = (y * size + x) * 4;
        buf[i] = 60; // B
        buf[i + 1] = 60; // G
        buf[i + 2] = 240; // R
        buf[i + 3] = 255; // A
      }
    }
  }
  return nativeImage.createFromBitmap(buf, { width: size, height: size });
}

function rebuildTrayMenu(): void {
  if (!tray) return;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open Settings', click: openSettings },
      { label: 'Check for Updates', click: () => void checkForUpdates() },
      {
        label: hotkeyPaused ? 'Resume Hotkey' : 'Pause Hotkey',
        click: () => {
          hotkeyPaused = !hotkeyPaused;
          if (hotkeyPaused) {
            unregisterHotkeys();
          } else {
            registerHotkey(getSettings().hotkey, toggleRecording);
          }
          rebuildTrayMenu();
        },
      },
      { type: 'separator' },
      { label: 'Quit', click: () => app.exit(0) },
    ]),
  );
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', openSettings);

  void app.whenReady().then(() => {
    // Auto-grant microphone access to our own windows (no remote content is
    // ever loaded); deny everything else by default.
    session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
      cb(permission === 'media');
    });

    settingsWin = createSettingsWindow();
    overlayWin = createOverlayWindow();
    recorderWin = createRecorderWindow();

    initController({
      overlay: () => overlayWin,
      recorder: () => recorderWin,
      settings: () => settingsWin,
      openSettings,
    });
    registerIpc(() => settingsWin);
    initUpdater((status) => {
      settingsWin?.webContents.send('update:status', status);
      if (status.state === 'ready' || status.state === 'available') openSettings();
    });

    registerHotkey(getSettings().hotkey, toggleRecording);
    // Re-apply the login-item preference (survives updates/reinstalls).
    applyLaunchAtLogin(getSettings().launchAtLogin);

    tray = new Tray(trayIcon());
    tray.setToolTip('Typist — push-to-talk dictation');
    rebuildTrayMenu();

    // First-run onboarding: no API key yet → open settings with a hint.
    if (!getSettings().apiKey) openSettings();
  });

  // Tray app: keep running when all windows are closed.
  app.on('window-all-closed', () => {});
  app.on('before-quit', () => setQuitting(true));
  app.on('will-quit', unregisterHotkeys);
}
