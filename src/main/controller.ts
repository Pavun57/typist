import type { BrowserWindow } from 'electron';
import type { AppContext, AppState, StatePayload, VoiceAction } from '../shared/types';
import { getSettings } from './settings';
import { transcribePcm } from './sarvam';
import { isDownloaded, transcribeLocal } from './local-stt';
import { resolveVoiceAction } from './ai-cleanup';
import { parseFallback } from './commands';
import { addMemory, findMemory, listMemories } from './memory';
import { detectActiveApp } from './active-window';
import { pasteText, pressKeys } from './paste';

interface Windows {
  overlay: () => BrowserWindow | null;
  recorder: () => BrowserWindow | null;
  settings: () => BrowserWindow | null;
  openSettings: () => void;
}

let state: AppState = 'idle';
let errorTimer: NodeJS.Timeout | null = null;
let wins: Windows;
/** Focused app captured when the hotkey was pressed (before transcription). */
let activeApp: AppContext | null = null;

function broadcast(payload: StatePayload): void {
  for (const get of [wins.overlay, wins.settings]) {
    get()?.webContents.send('state:changed', payload);
  }
}

export function getState(): AppState {
  return state;
}

export function setState(next: AppState, message?: string): void {
  state = next;
  if (errorTimer) {
    clearTimeout(errorTimer);
    errorTimer = null;
  }
  const overlay = wins.overlay();
  if (next === 'idle') {
    overlay?.hide();
  } else {
    if (overlay && !overlay.isVisible()) overlay.showInactive();
    if (next === 'error' || next === 'done') {
      // Auto-recover to idle after showing the result briefly.
      errorTimer = setTimeout(() => setState('idle'), 3000);
    }
  }
  broadcast({ state: next, message });
}

function startRecording(): void {
  const { provider, apiKey, localModel } = getSettings();
  if (provider === 'sarvam' && !apiKey) {
    setState('error', 'Add your Sarvam API key first.');
    wins.openSettings();
    return;
  }
  if (provider === 'local' && !isDownloaded(localModel)) {
    setState('error', 'Download a local model in Settings first.');
    wins.openSettings();
    return;
  }
  // Capture the dictation target now, while it still has focus. Never throws.
  activeApp = null;
  void detectActiveApp().then((app) => {
    activeApp = app;
  });
  wins.recorder()?.webContents.send('recorder:command', 'start');
  setState('recording');
}

function stopRecording(): void {
  wins.recorder()?.webContents.send('recorder:command', 'stop');
  setState('transcribing');
}

/** Hotkey toggle: idle → recording → stop & transcribe. Ignored mid-transcribe. */
export function toggleRecording(): void {
  if (state === 'recording') {
    stopRecording();
  } else if (state === 'idle' || state === 'error' || state === 'done') {
    startRecording();
  }
}

export function cancelRecording(): void {
  if (state !== 'recording') return;
  wins.recorder()?.webContents.send('recorder:command', 'cancel');
  setState('idle');
}

/**
 * Resolves the transcript into a VoiceAction: the AI pass when a provider is
 * configured (with app context + memories for formatting and substitution),
 * otherwise the offline regex parser. Fail-open: an AI error falls back to
 * the raw transcript, and the error is surfaced.
 */
async function resolveAction(
  transcript: string,
): Promise<{ action: VoiceAction; cleanupError: string }> {
  const { aiProvider, aiModel, groqApiKey, openrouterApiKey, nvidiaApiKey, translateToEnglish } =
    getSettings();

  if (aiProvider === 'none') {
    return { action: parseFallback(transcript, listMemories()), cleanupError: '' };
  }

  const aiKey =
    aiProvider === 'groq'
      ? groqApiKey
      : aiProvider === 'nvidia'
        ? nvidiaApiKey
        : openrouterApiKey;
  if (!aiKey) {
    const name =
      aiProvider === 'groq' ? 'Groq' : aiProvider === 'nvidia' ? 'NVIDIA' : 'OpenRouter';
    return {
      action: parseFallback(transcript, listMemories()),
      cleanupError: `Add your ${name} API key in Settings — used raw transcript.`,
    };
  }

  setState('polishing');
  try {
    const action = await resolveVoiceAction(aiProvider, aiKey, aiModel, transcript, {
      translateToEnglish,
      context: activeApp,
      memories: listMemories(),
    });
    return { action, cleanupError: '' };
  } catch (err) {
    return {
      action: { kind: 'type', text: transcript },
      cleanupError: err instanceof Error ? err.message : 'AI cleanup failed.',
    };
  }
}

/**
 * Newlines survive only in email/document apps, where paragraphs are wanted.
 * Everywhere else the transcript is flattened — a newline would be typed as
 * Enter, which sends half-finished messages in chat apps.
 */
function formatForContext(text: string): string {
  if (activeApp?.bucket === 'email' || activeApp?.bucket === 'document') {
    return text.replace(/[^\S\n]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }
  return text.replace(/\s+/g, ' ').trim();
}

/** `buffer` is 16 kHz mono float32 PCM captured by the recorder window. */
export async function onAudio(buffer: ArrayBuffer): Promise<void> {
  if (state !== 'transcribing') return; // stale audio after a cancel
  try {
    const { provider, apiKey, localModel, language } = getSettings();
    const pcm = new Float32Array(buffer);
    const transcript =
      provider === 'local'
        ? await transcribeLocal(localModel, pcm, language)
        : await transcribePcm(apiKey, pcm, language);

    const { action, cleanupError } = await resolveAction(transcript);

    // Hide the overlay and give the WM a moment so keyboard focus returns to
    // the field the user was dictating into before we inject anything.
    wins.overlay()?.hide();
    await new Promise((r) => setTimeout(r, 300));

    switch (action.kind) {
      case 'type':
        await pasteText(formatForContext(action.text), action.then);
        break;
      case 'command':
        await pressKeys(action.keys);
        break;
      case 'remember':
        addMemory(action.key, action.value);
        break;
      case 'recall': {
        const memory = findMemory(action.key);
        if (!memory) {
          setState('error', `No memory saved for "${action.key}".`);
          return;
        }
        await pasteText(memory.value);
        break;
      }
    }

    const doneMessage =
      action.kind === 'remember'
        ? `Remembered: ${action.key}`
        : action.kind === 'command'
          ? 'Done.'
          : undefined;
    if (cleanupError) {
      setState('error', `${cleanupError} (raw transcript was used)`);
    } else if (doneMessage) {
      setState('done', doneMessage);
    } else {
      setState('idle');
    }
  } catch (err) {
    setState('error', err instanceof Error ? err.message : 'Transcription failed.');
  }
}

export function onRecorderError(message: string): void {
  setState('error', message);
}

export function initController(windows: Windows): void {
  wins = windows;
}
