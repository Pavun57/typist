import Store from 'electron-store';
import { app, safeStorage } from 'electron';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Settings, SttProviderId } from '../shared/types';

const DEFAULT_HOTKEY = 'CommandOrControl+Shift+Space';
const DEFAULT_LOCAL_MODEL = 'onnx-community/whisper-base';

interface Schema {
  apiKeyEnc: string;
  groqApiKeyEnc: string;
  openrouterApiKeyEnc: string;
  nvidiaApiKeyEnc: string;
  language: string;
  hotkey: string;
  launchAtLogin: boolean;
  provider: SttProviderId;
  localModel: string;
  aiProvider: 'none' | 'groq' | 'openrouter' | 'nvidia';
  aiModel: string;
  translateToEnglish: boolean;
}

const store = new Store<Schema>({
  defaults: {
    apiKeyEnc: '',
    groqApiKeyEnc: '',
    openrouterApiKeyEnc: '',
    nvidiaApiKeyEnc: '',
    language: 'unknown',
    hotkey: DEFAULT_HOTKEY,
    launchAtLogin: false,
    provider: 'sarvam',
    localModel: DEFAULT_LOCAL_MODEL,
    aiProvider: 'none',
    aiModel: '',
    translateToEnglish: false,
  },
});

function encrypt(value: string): string {
  if (!value) return '';
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(value).toString('base64');
  }
  // Falls back to plain text when no OS keychain is available (common on Linux
  // without gnome-keyring/kwallet). The key never leaves the local store file.
  return `plain:${value}`;
}

function decrypt(stored: string): string {
  if (!stored) return '';
  if (stored.startsWith('plain:')) return stored.slice('plain:'.length);
  try {
    return safeStorage.decryptString(Buffer.from(stored, 'base64'));
  } catch {
    return '';
  }
}

/**
 * Applies the launch-at-login preference for the current platform.
 * Electron's setLoginItemSettings covers macOS/Windows but is a no-op on
 * Linux, so there we write an XDG autostart .desktop entry ourselves.
 */
export function applyLaunchAtLogin(enable: boolean): void {
  if (process.platform === 'linux') {
    const desktopFile = join(
      app.getPath('home'),
      '.config',
      'autostart',
      'typist.desktop',
    );
    if (enable) {
      mkdirSync(dirname(desktopFile), { recursive: true });
      writeFileSync(
        desktopFile,
        [
          '[Desktop Entry]',
          'Type=Application',
          'Name=Typist',
          `Exec=${process.execPath}`,
          'X-GNOME-Autostart-enabled=true',
          'Comment=Push-to-talk voice typing',
          '',
        ].join('\n'),
      );
    } else {
      rmSync(desktopFile, { force: true });
    }
    return;
  }
  app.setLoginItemSettings({ openAtLogin: enable });
}

export function getSettings(): Settings {
  return {
    apiKey: decrypt(store.get('apiKeyEnc')),
    language: store.get('language'),
    hotkey: store.get('hotkey'),
    launchAtLogin: store.get('launchAtLogin'),
    provider: store.get('provider'),
    localModel: store.get('localModel'),
    aiProvider: store.get('aiProvider'),
    aiModel: store.get('aiModel'),
    groqApiKey: decrypt(store.get('groqApiKeyEnc')),
    openrouterApiKey: decrypt(store.get('openrouterApiKeyEnc')),
    nvidiaApiKey: decrypt(store.get('nvidiaApiKeyEnc')),
    translateToEnglish: store.get('translateToEnglish'),
  };
}

export function setSettings(partial: Partial<Settings>): Settings {
  if (partial.apiKey !== undefined) store.set('apiKeyEnc', encrypt(partial.apiKey));
  if (partial.groqApiKey !== undefined)
    store.set('groqApiKeyEnc', encrypt(partial.groqApiKey));
  if (partial.openrouterApiKey !== undefined)
    store.set('openrouterApiKeyEnc', encrypt(partial.openrouterApiKey));
  if (partial.nvidiaApiKey !== undefined)
    store.set('nvidiaApiKeyEnc', encrypt(partial.nvidiaApiKey));
  if (partial.language !== undefined) store.set('language', partial.language);
  if (partial.hotkey !== undefined) store.set('hotkey', partial.hotkey);
  if (partial.provider !== undefined) store.set('provider', partial.provider);
  if (partial.localModel !== undefined) store.set('localModel', partial.localModel);
  if (partial.aiProvider !== undefined) store.set('aiProvider', partial.aiProvider);
  if (partial.aiModel !== undefined) store.set('aiModel', partial.aiModel);
  if (partial.translateToEnglish !== undefined)
    store.set('translateToEnglish', partial.translateToEnglish);
  if (partial.launchAtLogin !== undefined) {
    store.set('launchAtLogin', partial.launchAtLogin);
    applyLaunchAtLogin(partial.launchAtLogin);
  }
  return getSettings();
}
