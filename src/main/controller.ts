import type { BrowserWindow } from 'electron';
import type { AppState, StatePayload } from '../shared/types';
import { getSettings } from './settings';
import { transcribePcm } from './sarvam';
import { isDownloaded, transcribeLocal } from './local-stt';
import { pasteText } from './paste';

interface Windows {
  overlay: () => BrowserWindow | null;
  recorder: () => BrowserWindow | null;
  settings: () => BrowserWindow | null;
  openSettings: () => void;
}

let state: AppState = 'idle';
let errorTimer: NodeJS.Timeout | null = null;
let wins: Windows;

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
    if (next === 'error') {
      // Auto-recover to idle after showing the error briefly.
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
  } else if (state === 'idle' || state === 'error') {
    startRecording();
  }
}

export function cancelRecording(): void {
  if (state !== 'recording') return;
  wins.recorder()?.webContents.send('recorder:command', 'cancel');
  setState('idle');
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
    // Hide the overlay and give the WM a moment so keyboard focus returns to
    // the field the user was dictating into before we inject the text.
    wins.overlay()?.hide();
    await new Promise((r) => setTimeout(r, 300));
    await pasteText(transcript);
    setState('idle');
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
