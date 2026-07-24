import { ipcMain, type BrowserWindow } from 'electron';
import type {
  AiCloudProvider,
  DownloadProgress,
  Result,
  Settings,
  SttProviderId,
  SttState,
} from '../shared/types';
import { getSettings, setSettings } from './settings';
import { validateApiKey } from './sarvam';
import { registerHotkey } from './hotkey';
import {
  deleteModel,
  downloadModel,
  isDownloaded,
  listModels,
} from './local-stt';
import { checkForUpdates, installUpdate } from './updater';
import { fetchModels, validateAiKey } from './ai-cleanup';
import {
  cancelRecording,
  onAudio,
  onRecorderError,
  toggleRecording,
} from './controller';

let settingsWin: () => BrowserWindow | null = () => null;

export function forwardDownloadProgress(p: DownloadProgress): void {
  settingsWin()?.webContents.send('stt:download-progress', p);
}

export function registerIpc(getSettingsWin: () => BrowserWindow | null): void {
  settingsWin = getSettingsWin;

  ipcMain.handle('settings:get', (): Settings => getSettings());

  ipcMain.handle('settings:set', (_e, partial: Partial<Settings>): Settings => {
    return setSettings(partial);
  });

  ipcMain.handle('apikey:validate', (_e, key: string): Promise<Result> => {
    return validateApiKey(key);
  });

  ipcMain.handle('hotkey:set', (_e, accelerator: string): Result => {
    const result = registerHotkey(accelerator, toggleRecording);
    if (result.ok) setSettings({ hotkey: accelerator });
    return result;
  });

  ipcMain.handle('stt:get-state', (): SttState => {
    const { provider, localModel } = getSettings();
    return { provider, localModel, models: listModels(localModel) };
  });

  ipcMain.handle(
    'stt:set-provider',
    (_e, provider: SttProviderId, localModel?: string): void => {
      setSettings({
        provider,
        ...(localModel ? { localModel } : {}),
      });
    },
  );

  ipcMain.handle(
    'stt:download-model',
    async (_e, modelId: string): Promise<Result> => {
      try {
        await downloadModel(modelId, forwardDownloadProgress);
        return { ok: true, message: 'Model downloaded.' };
      } catch (err) {
        return {
          ok: false,
          message: `Download failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
  );

  ipcMain.handle('stt:delete-model', (_e, modelId: string): Result => {
    try {
      deleteModel(modelId);
      return { ok: true, message: isDownloaded(modelId) ? 'Delete failed.' : 'Model deleted.' };
    } catch (err) {
      return {
        ok: false,
        message: `Delete failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  });

  ipcMain.handle('update:check', (): Promise<void> => checkForUpdates());
  ipcMain.handle('update:install', (): void => installUpdate());

  ipcMain.handle(
    'ai:validate',
    (_e, provider: AiCloudProvider, key: string): Promise<Result> =>
      validateAiKey(provider, key),
  );

  ipcMain.handle('ai:models', (_e, provider: AiCloudProvider) => {
    const { groqApiKey, openrouterApiKey, nvidiaApiKey } = getSettings();
    const key =
      provider === 'groq'
        ? groqApiKey
        : provider === 'nvidia'
          ? nvidiaApiKey
          : openrouterApiKey;
    return fetchModels(provider, key);
  });

  ipcMain.handle('recording:cancel', (): void => {
    cancelRecording();
  });

  ipcMain.on('recorder:audio', (_e, buffer: ArrayBuffer) => {
    void onAudio(buffer);
  });

  ipcMain.on('recorder:error', (_e, message: string) => {
    onRecorderError(message);
  });
}
