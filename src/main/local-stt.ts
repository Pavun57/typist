import { app } from 'electron';
import { existsSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { DownloadProgress, ModelInfo } from '../shared/types';
import {
  SHERPA_CATALOG,
  deleteSherpaModel,
  downloadSherpaModel,
  findSherpaModel,
  isSherpaDownloaded,
  transcribeSherpa,
} from './sherpa-stt';

/**
 * Local on-device STT: Whisper ONNX models (@huggingface/transformers) and
 * sherpa-onnx CTC models (Dolphin / Omnilingual). Models are downloaded on
 * demand, can be deleted from the UI, and auto-unload after 5 minutes idle.
 */

export const MODEL_CATALOG: Omit<ModelInfo, 'downloaded' | 'active'>[] = [
  {
    id: 'onnx-community/whisper-base',
    label: 'Whisper Base',
    sizeMB: 300,
    note: 'Fastest, good accuracy. 99 languages.',
    engine: 'whisper',
  },
  {
    id: 'onnx-community/whisper-small',
    label: 'Whisper Small',
    sizeMB: 980,
    note: 'Balanced speed and accuracy. 99 languages.',
    engine: 'whisper',
  },
  {
    id: 'onnx-community/whisper-large-v3-turbo',
    label: 'Whisper Large v3 Turbo',
    sizeMB: 3200,
    note: 'Best Whisper accuracy, still fast. 99 languages.',
    engine: 'whisper',
  },
  ...SHERPA_CATALOG.map((m) => ({
    id: m.id,
    label: m.label,
    sizeMB: m.sizeMB,
    note: m.note,
    engine: 'sherpa' as const,
  })),
];

/** Our BCP-47 codes → Whisper's full language names. */
const WHISPER_LANG: Record<string, string> = {
  'en-IN': 'english',
  'hi-IN': 'hindi',
  'bn-IN': 'bengali',
  'ta-IN': 'tamil',
  'te-IN': 'telugu',
  'kn-IN': 'kannada',
  'ml-IN': 'malayalam',
  'mr-IN': 'marathi',
  'gu-IN': 'gujarati',
  'pa-IN': 'punjabi',
  'od-IN': 'oriya',
};

const IDLE_UNLOAD_MS = 5 * 60 * 1000;

function cacheDir(): string {
  return join(app.getPath('userData'), 'stt-models');
}

/** transformers.js v3 stores models flat as <cacheDir>/<org>/<name>. */
function modelDir(modelId: string): string {
  return join(cacheDir(), modelId);
}

export function isDownloaded(modelId: string): boolean {
  if (findSherpaModel(modelId)) return isSherpaDownloaded(modelId);
  const dir = join(modelDir(modelId), 'onnx');
  try {
    // A complete download always includes the onnx weights directory.
    return existsSync(dir) && readdirSync(dir).length > 0;
  } catch {
    return false;
  }
}

export function listModels(activeModel: string): ModelInfo[] {
  return MODEL_CATALOG.map((m) => ({
    ...m,
    downloaded: isDownloaded(m.id),
    active: m.id === activeModel,
  }));
}

export function deleteModel(modelId: string): void {
  if (findSherpaModel(modelId)) {
    deleteSherpaModel(modelId);
    return;
  }
  rmSync(modelDir(modelId), { recursive: true, force: true });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPipeline = any;

let pipe: AnyPipeline = null;
let loadedModel = '';
let loadPromise: Promise<AnyPipeline> | null = null;
let unloadTimer: NodeJS.Timeout | null = null;

function touch(): void {
  if (unloadTimer) clearTimeout(unloadTimer);
  unloadTimer = setTimeout(() => {
    // Auto-unload: free the model memory when not used for a while.
    void pipe?.dispose?.();
    pipe = null;
    loadedModel = '';
  }, IDLE_UNLOAD_MS);
}

async function getPipeline(
  modelId: string,
  onProgress?: (p: DownloadProgress) => void,
): Promise<AnyPipeline> {
  if (pipe && loadedModel === modelId) {
    touch();
    return pipe;
  }
  loadPromise ??= (async () => {
    const { pipeline, env } = await import('@huggingface/transformers');
    env.cacheDir = cacheDir();
    const p = await pipeline('automatic-speech-recognition', modelId, {
      progress_callback: (info: {
        status: string;
        file?: string;
        progress?: number;
      }) => {
        if (info.status === 'progress' && onProgress) {
          onProgress({
            modelId,
            file: info.file ?? '',
            percent: Math.round(info.progress ?? 0),
          });
        }
      },
    });
    // Loading a different model replaces the old one in memory.
    if (pipe) await pipe.dispose?.();
    pipe = p;
    loadedModel = modelId;
    return p;
  })();
  try {
    const p = await loadPromise;
    touch();
    return p;
  } finally {
    loadPromise = null;
  }
}

/** Downloads the model weights (loads the pipeline once, then unloads). */
export async function downloadModel(
  modelId: string,
  onProgress: (p: DownloadProgress) => void,
): Promise<void> {
  if (findSherpaModel(modelId)) {
    await downloadSherpaModel(modelId, onProgress);
    return;
  }
  await getPipeline(modelId, onProgress);
}

export async function transcribeLocal(
  modelId: string,
  pcm: Float32Array,
  language: string,
): Promise<string> {
  if (findSherpaModel(modelId)) {
    // sherpa CTC models do language ID themselves.
    return transcribeSherpa(modelId, pcm);
  }
  const p = await getPipeline(modelId);
  const options: Record<string, unknown> = {
    chunk_length_s: 30,
    return_timestamps: false,
  };
  const whisperLang = WHISPER_LANG[language];
  if (whisperLang) options.language = whisperLang;
  const out = (await p(pcm, options)) as { text?: string };
  const text = out.text?.trim();
  if (!text) throw new Error('No speech detected.');
  touch();
  return text;
}
