import Store from 'electron-store';
import { app, safeStorage } from 'electron';
import type { Settings, SttProviderId } from '../shared/types';

const DEFAULT_HOTKEY = 'CommandOrControl+Shift+Space';
const DEFAULT_LOCAL_MODEL = 'onnx-community/whisper-base';

interface Schema {
  apiKeyEnc: string;
  language: string;
  hotkey: string;
  launchAtLogin: boolean;
  provider: SttProviderId;
  localModel: string;
}

const store = new Store<Schema>({
  defaults: {
    apiKeyEnc: '',
    language: 'unknown',
    hotkey: DEFAULT_HOTKEY,
    launchAtLogin: false,
    provider: 'sarvam',
    localModel: DEFAULT_LOCAL_MODEL,
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

export function getSettings(): Settings {
  return {
    apiKey: decrypt(store.get('apiKeyEnc')),
    language: store.get('language'),
    hotkey: store.get('hotkey'),
    launchAtLogin: store.get('launchAtLogin'),
    provider: store.get('provider'),
    localModel: store.get('localModel'),
  };
}

export function setSettings(partial: Partial<Settings>): Settings {
  if (partial.apiKey !== undefined) store.set('apiKeyEnc', encrypt(partial.apiKey));
  if (partial.language !== undefined) store.set('language', partial.language);
  if (partial.hotkey !== undefined) store.set('hotkey', partial.hotkey);
  if (partial.provider !== undefined) store.set('provider', partial.provider);
  if (partial.localModel !== undefined) store.set('localModel', partial.localModel);
  if (partial.launchAtLogin !== undefined) {
    store.set('launchAtLogin', partial.launchAtLogin);
    app.setLoginItemSettings({ openAtLogin: partial.launchAtLogin });
  }
  return getSettings();
}
