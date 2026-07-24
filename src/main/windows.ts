import { BrowserWindow, screen } from 'electron';
import { join } from 'node:path';

const devServerUrl = process.env['ELECTRON_RENDERER_URL'];
const PRELOAD = join(import.meta.dirname, '../preload/index.mjs');

let quitting = false;

/** Called from main on before-quit so the settings window can really close. */
export function setQuitting(value: boolean): void {
  quitting = value;
}

function load(win: BrowserWindow, page: string): void {
  if (devServerUrl) {
    void win.loadURL(`${devServerUrl}/${page}/index.html`);
  } else {
    void win.loadFile(join(import.meta.dirname, `../renderer/${page}/index.html`));
  }
}

const baseWebPrefs = {
  preload: PRELOAD,
  contextIsolation: true,
  // ESM preload scripts require an unsandboxed renderer; no remote content is
  // ever loaded, so context isolation still guards the bridge.
  sandbox: false,
};

export function createSettingsWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 560,
    height: 780,
    autoHideMenuBar: true,
    show: false,
    title: 'Typist',
    icon: join(import.meta.dirname, '../../resources/icon.png'),
    webPreferences: baseWebPrefs,
  });
  win.once('ready-to-show', () => win.show());
  win.on('close', (e) => {
    // Tray app: closing the window hides it instead of quitting.
    if (!quitting) {
      e.preventDefault();
      win.hide();
    }
  });
  load(win, 'settings');
  return win;
}

export function createOverlayWindow(): BrowserWindow {
  const { workAreaSize } = screen.getPrimaryDisplay();
  const width = 380;
  const win = new BrowserWindow({
    width,
    height: 76,
    x: Math.round((workAreaSize.width - width) / 2),
    y: workAreaSize.height - 150,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    // Notification-type windows are never given keyboard focus by KWin —
    // critical so the pill doesn't steal focus from the field being dictated into.
    type: 'notification',
    show: false,
    webPreferences: baseWebPrefs,
  });
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  load(win, 'overlay');
  return win;
}

export function createRecorderWindow(): BrowserWindow {
  const win = new BrowserWindow({
    show: false,
    webPreferences: baseWebPrefs,
  });
  load(win, 'recorder');
  return win;
}
