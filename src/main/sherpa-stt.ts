import { app } from 'electron';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { DownloadProgress } from '../shared/types';

/**
 * Offline STT via sherpa-onnx (next-gen Kaldi), using fast CTC models with
 * strong Indic-language coverage (Tamil, Hindi, Telugu, …). Models are
 * downloaded as tar.bz2 archives from the official k2-fsa GitHub release.
 */

export interface SherpaModelDef {
  id: string;
  label: string;
  sizeMB: number;
  note: string;
  kind: 'dolphin' | 'omnilingual';
  archive: string;
  dirName: string;
}

const RELEASES_URL =
  'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models';

export const SHERPA_CATALOG: SherpaModelDef[] = [
  {
    id: 'dolphin-small-int8',
    label: 'Dolphin Small (int8)',
    sizeMB: 239,
    note: 'Fast CTC. 40 languages incl. Tamil, Hindi, Telugu, Marathi.',
    kind: 'dolphin',
    archive: 'sherpa-onnx-dolphin-small-ctc-multi-lang-int8-2025-04-02.tar.bz2',
    dirName: 'sherpa-onnx-dolphin-small-ctc-multi-lang-int8-2025-04-02',
  },
  {
    id: 'omnilingual-300m-int8',
    label: 'Omnilingual ASR 300M (int8)',
    sizeMB: 348,
    note: "Meta's 1600-language model. Fast CTC, auto language ID.",
    kind: 'omnilingual',
    archive:
      'sherpa-onnx-omnilingual-asr-1600-languages-300M-ctc-int8-2025-11-12.tar.bz2',
    dirName: 'sherpa-onnx-omnilingual-asr-1600-languages-300M-ctc-int8-2025-11-12',
  },
];

const IDLE_UNLOAD_MS = 5 * 60 * 1000;

function modelsRoot(): string {
  return join(app.getPath('userData'), 'sherpa-models');
}

export function findSherpaModel(modelId: string): SherpaModelDef | undefined {
  return SHERPA_CATALOG.find((m) => m.id === modelId);
}

export function isSherpaDownloaded(modelId: string): boolean {
  const def = findSherpaModel(modelId);
  if (!def) return false;
  const dir = join(modelsRoot(), def.dirName);
  try {
    return existsSync(join(dir, 'tokens.txt')) && readdirSync(dir).some((f) => f.endsWith('.onnx'));
  } catch {
    return false;
  }
}

export function deleteSherpaModel(modelId: string): void {
  const def = findSherpaModel(modelId);
  if (!def) return;
  rmSync(join(modelsRoot(), def.dirName), { recursive: true, force: true });
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 120_000 }, (err, _stdout, stderr) =>
      err ? reject(new Error(stderr || err.message)) : resolve(),
    );
  });
}

export async function downloadSherpaModel(
  modelId: string,
  onProgress: (p: DownloadProgress) => void,
): Promise<void> {
  const def = findSherpaModel(modelId);
  if (!def) throw new Error(`Unknown model: ${modelId}`);

  const root = modelsRoot();
  mkdirSync(root, { recursive: true });
  const archivePath = join(root, def.archive);

  // Download with progress reporting.
  const res = await fetch(`${RELEASES_URL}/${def.archive}`, {
    signal: AbortSignal.timeout(30 * 60_000),
  });
  if (!res.ok || !res.body) {
    throw new Error(`Download failed (HTTP ${res.status}).`);
  }
  const total = Number(res.headers.get('content-length') ?? 0);
  let received = 0;
  const progressTransform = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      received += chunk.byteLength;
      if (total > 0) {
        onProgress({
          modelId,
          file: def.archive,
          percent: Math.round((received / total) * 100),
        });
      }
      controller.enqueue(chunk);
    },
  });
  await pipeline(
    Readable.fromWeb(res.body.pipeThrough(progressTransform) as never),
    createWriteStream(archivePath),
  );

  // Extract (system tar handles bzip2 on Linux, macOS, and Windows 10+).
  onProgress({ modelId, file: 'extracting…', percent: 100 });
  await run('tar', ['-xjf', archivePath, '-C', root]);
  rmSync(archivePath, { force: true });

  if (!isSherpaDownloaded(modelId)) {
    throw new Error('Extraction failed — model files not found.');
  }
}

// ---------------------------------------------------------------------------
// Recognizer lifecycle: loaded on first use, unloaded after 5 min idle.
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecognizer = any;

let recognizer: AnyRecognizer = null;
let recognizerId = '';
let unloadTimer: NodeJS.Timeout | null = null;

function touch(): void {
  if (unloadTimer) clearTimeout(unloadTimer);
  unloadTimer = setTimeout(() => {
    // Auto-unload: free the native recognizer when idle.
    recognizer = null;
    recognizerId = '';
  }, IDLE_UNLOAD_MS);
}

async function getRecognizer(def: SherpaModelDef): Promise<AnyRecognizer> {
  if (recognizer && recognizerId === def.id) {
    touch();
    return recognizer;
  }
  const mod = await import('sherpa-onnx-node');
  const sherpa = mod.default ?? mod;
  const dir = join(modelsRoot(), def.dirName);
  recognizer = new sherpa.OfflineRecognizer({
    featConfig: { sampleRate: 16000, featureDim: 80 },
    modelConfig: {
      [def.kind]: { model: join(dir, 'model.int8.onnx') },
      tokens: join(dir, 'tokens.txt'),
      numThreads: 2,
      provider: 'cpu',
      debug: 0,
    },
  });
  recognizerId = def.id;
  touch();
  return recognizer;
}

export async function transcribeSherpa(
  modelId: string,
  pcm: Float32Array,
): Promise<string> {
  const def = findSherpaModel(modelId);
  if (!def) throw new Error(`Unknown model: ${modelId}`);
  const rec = await getRecognizer(def);
  const stream = rec.createStream();
  stream.acceptWaveform({ sampleRate: 16000, samples: pcm });
  rec.decode(stream);
  const text = String(rec.getResult(stream).text ?? '').trim();
  touch();
  if (!text) throw new Error('No speech detected.');
  return text;
}
