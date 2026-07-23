export type AppState = 'idle' | 'recording' | 'transcribing' | 'error';

export interface StatePayload {
  state: AppState;
  message?: string;
}

export type SttProviderId = 'sarvam' | 'local';

export interface Settings {
  apiKey: string;
  language: string;
  hotkey: string;
  launchAtLogin: boolean;
  provider: SttProviderId;
  localModel: string;
}

export interface Result {
  ok: boolean;
  message: string;
}

export type RecorderCommand = 'start' | 'stop' | 'cancel';

export interface ModelInfo {
  id: string;
  label: string;
  sizeMB: number;
  note: string;
  engine: 'whisper' | 'sherpa';
  downloaded: boolean;
  active: boolean;
}

export interface SttState {
  provider: SttProviderId;
  localModel: string;
  models: ModelInfo[];
}

export interface DownloadProgress {
  modelId: string;
  file: string;
  percent: number;
}

export type UpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'none'
  | 'error';

export interface UpdateStatus {
  state: UpdateState;
  version?: string;
  percent?: number;
  message?: string;
}

export const LANGUAGES: { code: string; label: string }[] = [
  { code: 'unknown', label: 'Auto-detect' },
  { code: 'en-IN', label: 'English (India)' },
  { code: 'hi-IN', label: 'Hindi' },
  { code: 'bn-IN', label: 'Bengali' },
  { code: 'ta-IN', label: 'Tamil' },
  { code: 'te-IN', label: 'Telugu' },
  { code: 'kn-IN', label: 'Kannada' },
  { code: 'ml-IN', label: 'Malayalam' },
  { code: 'mr-IN', label: 'Marathi' },
  { code: 'gu-IN', label: 'Gujarati' },
  { code: 'pa-IN', label: 'Punjabi' },
  { code: 'od-IN', label: 'Odia' },
];

/** API surface exposed to renderer windows via the preload contextBridge. */
export interface TypistApi {
  getSettings(): Promise<Settings>;
  setSettings(partial: Partial<Settings>): Promise<Settings>;
  validateApiKey(key: string): Promise<Result>;
  setHotkey(accelerator: string): Promise<Result>;
  cancelRecording(): Promise<void>;
  onStateChange(cb: (payload: StatePayload) => void): () => void;
  onRecorderCommand(cb: (cmd: RecorderCommand) => void): () => void;
  sendAudio(buffer: ArrayBuffer): void;
  sendRecorderError(message: string): void;
  getSttState(): Promise<SttState>;
  setSttProvider(provider: SttProviderId, localModel?: string): Promise<void>;
  downloadModel(modelId: string): Promise<Result>;
  deleteModel(modelId: string): Promise<Result>;
  onDownloadProgress(cb: (p: DownloadProgress) => void): () => void;
  checkForUpdates(): Promise<void>;
  installUpdate(): Promise<void>;
  onUpdateStatus(cb: (s: UpdateStatus) => void): () => void;
}
