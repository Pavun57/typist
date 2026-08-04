export type AppState =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'polishing'
  | 'done'
  | 'error';

export interface StatePayload {
  state: AppState;
  message?: string;
}

export type SttProviderId = 'sarvam' | 'local';

export type AiProviderId = 'none' | 'groq' | 'openrouter' | 'nvidia';

/** AI cleanup providers (excludes 'none'). */
export type AiCloudProvider = Exclude<AiProviderId, 'none'>;

export interface Settings {
  apiKey: string;
  language: string;
  hotkey: string;
  launchAtLogin: boolean;
  provider: SttProviderId;
  localModel: string;
  aiProvider: AiProviderId;
  aiModel: string;
  groqApiKey: string;
  openrouterApiKey: string;
  nvidiaApiKey: string;
  translateToEnglish: boolean;
}

/** Free-tier models per AI cleanup provider (suggestions; custom IDs allowed). */
export const AI_MODELS: Record<AiCloudProvider, { id: string; label: string }[]> = {
  groq: [
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (free tier)' },
    { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant (free tier)' },
    { id: 'gemma2-9b-it', label: 'Gemma 2 9B (free tier)' },
  ],
  openrouter: [
    {
      id: 'meta-llama/llama-3.3-70b-instruct:free',
      label: 'Llama 3.3 70B (free)',
    },
    { id: 'google/gemma-3-27b-it:free', label: 'Gemma 3 27B (free)' },
    { id: 'qwen/qwen3-32b:free', label: 'Qwen3 32B (free)' },
  ],
  nvidia: [
    { id: 'meta/llama-3.3-70b-instruct', label: 'Llama 3.3 70B (free tier)' },
    { id: 'meta/llama-3.1-8b-instruct', label: 'Llama 3.1 8B (free tier)' },
    { id: 'google/gemma-2-9b-it', label: 'Gemma 2 9B (free tier)' },
  ],
};

export const DEFAULT_AI_MODEL: Record<AiCloudProvider, string> = {
  groq: 'llama-3.3-70b-versatile',
  openrouter: 'meta-llama/llama-3.3-70b-instruct:free',
  nvidia: 'meta/llama-3.3-70b-instruct',
};

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

/**
 * What a dictation should do after transcription. Resolved by the AI cleanup
 * pass, or by the regex fallback parser when no AI provider is configured.
 */
export type VoiceAction =
  /** Type text at the cursor; optionally press a key afterwards (e.g. send). */
  | { kind: 'type'; text: string; then?: 'enter' | 'tab' | 'escape' }
  /** Press keys only (e.g. "undo that" → ctrl+z). xdotool-style combo string. */
  | { kind: 'command'; keys: string }
  /** Store a user fact ("remember my address is …"). Nothing is typed. */
  | { kind: 'remember'; key: string; value: string }
  /** Recall a stored fact. Only produced by the fallback parser — the AI pass
   *  substitutes memories inline and returns 'type' instead. */
  | { kind: 'recall'; key: string };

export interface MemoryEntry {
  key: string;
  value: string;
  createdAt: number;
}

/** Formatting bucket the focused app falls into. */
export type AppBucket =
  | 'email'
  | 'chat'
  | 'code'
  | 'terminal'
  | 'document'
  | 'browser'
  | 'unknown';

export interface AppContext {
  /** Raw app identifier (WM_CLASS / process name). */
  app: string;
  /** Window title, when available. */
  title: string;
  bucket: AppBucket;
}

export type UpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'installing'
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
  validateAiKey(provider: AiCloudProvider, key: string): Promise<Result>;
  fetchAiModels(
    provider: AiCloudProvider,
  ): Promise<{ id: string; label: string }[]>;
  getMemories(): Promise<MemoryEntry[]>;
  deleteMemory(key: string): Promise<void>;
  clearMemories(): Promise<void>;
}
