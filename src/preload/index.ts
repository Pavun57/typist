import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type {
  DownloadProgress,
  RecorderCommand,
  Settings,
  StatePayload,
  SttProviderId,
  TypistApi,
  UpdateStatus,
} from '../shared/types';

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_e: IpcRendererEvent, payload: T) => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api: TypistApi = {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (partial: Partial<Settings>) =>
    ipcRenderer.invoke('settings:set', partial),
  validateApiKey: (key: string) => ipcRenderer.invoke('apikey:validate', key),
  setHotkey: (accelerator: string) =>
    ipcRenderer.invoke('hotkey:set', accelerator),
  cancelRecording: () => ipcRenderer.invoke('recording:cancel'),
  onStateChange: (cb) => subscribe<StatePayload>('state:changed', cb),
  onRecorderCommand: (cb) => subscribe<RecorderCommand>('recorder:command', cb),
  sendAudio: (buffer: ArrayBuffer) => ipcRenderer.send('recorder:audio', buffer),
  sendRecorderError: (message: string) =>
    ipcRenderer.send('recorder:error', message),
  getSttState: () => ipcRenderer.invoke('stt:get-state'),
  setSttProvider: (provider: SttProviderId, localModel?: string) =>
    ipcRenderer.invoke('stt:set-provider', provider, localModel),
  downloadModel: (modelId: string) =>
    ipcRenderer.invoke('stt:download-model', modelId),
  deleteModel: (modelId: string) =>
    ipcRenderer.invoke('stt:delete-model', modelId),
  onDownloadProgress: (cb) =>
    subscribe<DownloadProgress>('stt:download-progress', cb),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateStatus: (cb) => subscribe<UpdateStatus>('update:status', cb),
};

contextBridge.exposeInMainWorld('typist', api);
