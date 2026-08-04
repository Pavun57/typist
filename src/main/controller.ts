import type { BrowserWindow } from 'electron';
import { app } from 'electron';
import { appendFileSync } from 'node:fs';
import { readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { AppContext, AppState, StatePayload, VoiceAction } from '../shared/types';
import { getSettings } from './settings';
import { transcribePcm } from './sarvam';
import { isDownloaded, transcribeLocal } from './local-stt';
import { resolveVoiceAction, solveWithVision } from './ai-cleanup';
import { parseFallback, wantsScreen } from './commands';
import { addMemory, findMemory, listMemories } from './memory';
import { detectActiveApp } from './active-window';
import { captureScreenToFile } from './screen';
import { detectAgentCli, solveWithAgentCli } from './agent-cli';
import { copyToClipboard, pasteText, pressKeys } from './paste';

/** Diagnostic trail for voice-action resolution — userData/debug.log. */
function dbg(message: string): void {
  try {
    appendFileSync(
      join(app.getPath('userData'), 'debug.log'),
      `[${new Date().toISOString()}] ${message}\n`,
    );
  } catch {
    // logging must never break dictation
  }
}

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
 * Resolves the transcript into a VoiceAction.
 *
 * Commands and memory are deterministic — the regex parser runs FIRST and
 * short-circuits remember/recall/pure-command intents, so they work the same
 * on every AI model (small free-tier models can't be trusted to emit the JSON
 * action contract). The AI pass only polishes the *text* of a type action;
 * a trailing command it strips ("send this") is re-attached afterwards.
 * Fail-open: an AI error falls back to the raw transcript, surfaced as an error.
 */
async function resolveAction(
  transcript: string,
): Promise<{ action: VoiceAction; cleanupError: string }> {
  const memories = listMemories();
  const parsed = parseFallback(transcript, memories);

  // Deterministic intents never need the AI pass.
  if (parsed.kind !== 'type') {
    return { action: parsed, cleanupError: '' };
  }

  const { aiProvider, aiModel, groqApiKey, openrouterApiKey, nvidiaApiKey, translateToEnglish } =
    getSettings();

  if (aiProvider === 'none') {
    return { action: parsed, cleanupError: '' };
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
      action: parsed,
      cleanupError: `Add your ${name} API key in Settings — used raw transcript.`,
    };
  }

  setState('polishing');
  try {
    // parsed.text has any trailing command phrase already stripped.
    const action = await resolveVoiceAction(aiProvider, aiKey, aiModel, parsed.text, {
      translateToEnglish,
      context: activeApp,
      memories,
    });
    // The regex already decided this dictation ends with a key press — the AI
    // must not talk us out of it.
    if (action.kind === 'type' && parsed.then && !action.then) {
      action.then = parsed.then;
    }
    return { action, cleanupError: '' };
  } catch (err) {
    return {
      action: { kind: 'type', text: parsed.text, then: parsed.then },
      cleanupError: err instanceof Error ? err.message : 'AI cleanup failed.',
    };
  }
}

/**
 * Newlines survive only in email/document/code apps, where paragraphs are
 * wanted. Everywhere else the transcript is flattened — a newline would be
 * typed as Enter, which sends half-finished messages in chat apps and
 * executes partial input in terminals.
 */
function formatForContext(text: string): string {
  if (
    activeApp?.bucket === 'email' ||
    activeApp?.bucket === 'document' ||
    activeApp?.bucket === 'code'
  ) {
    return text.replace(/[^\S\n]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Screen-aware coding help ("solve this", "fix this error"): capture the
 * screen and get an answer — preferring a locally installed coding agent
 * (Claude Code / Codex CLI, which read the screenshot file themselves, no
 * API key needed), falling back to the cloud vision model. Into terminals
 * the answer goes on the clipboard (typed newlines would execute partial
 * input); into editors it is typed directly. Returns true when the flow ran
 * (even if it errored); false means "fall back to normal dictation".
 */
async function tryScreenSolve(transcript: string): Promise<boolean> {
  const { aiProvider, aiModel, agentCli, groqApiKey, openrouterApiKey, nvidiaApiKey } =
    getSettings();
  const agent = agentCli === 'cloud' ? null : detectAgentCli(agentCli);
  const aiKey =
    aiProvider === 'groq'
      ? groqApiKey
      : aiProvider === 'nvidia'
        ? nvidiaApiKey
        : openrouterApiKey;
  const canCloud = aiProvider !== 'none' && !!aiKey;
  if (!agent && !canCloud) return false;

  const agentName =
    agent?.cli === 'claude' ? 'Claude Code' : agent?.cli === 'codex' ? 'Codex' : null;
  setState('polishing', agentName ? `Asking ${agentName}…` : undefined);
  const shot = await captureScreenToFile();
  if (!shot) {
    dbg('screen-solve: no working capture tool, falling back to text flow');
    return false;
  }

  let answer: string | null = null;
  let engine = '';
  let solveError = '';

  // 1. Local coding agent (Claude Code / Codex) — sees the file itself.
  if (agent) {
    try {
      answer = await solveWithAgentCli(agent, transcript, shot);
      engine = agent.cli;
    } catch (err) {
      solveError = err instanceof Error ? err.message : String(err);
      dbg(`screen-solve: ${agent.cli} failed (${solveError.slice(0, 200)})`);
    }
  }

  // 2. Cloud vision fallback.
  if (!answer && canCloud) {
    try {
      const image = await readFile(shot, 'base64');
      answer = await solveWithVision(aiProvider, aiKey, aiModel, transcript, image);
      engine = aiProvider;
    } catch (err) {
      solveError = err instanceof Error ? err.message : String(err);
    }
  }

  void unlink(shot).catch(() => {});

  if (!answer) {
    setState(
      'error',
      solveError ||
        'No coding assistant available — install Claude Code/Codex, or add an AI key in Settings.',
    );
    return true;
  }

  dbg(
    `screen-solve engine=${engine} transcript=${JSON.stringify(transcript)} bucket=${activeApp?.bucket ?? 'unknown'} answer=${JSON.stringify(answer.slice(0, 200))}`,
  );
  wins.overlay()?.hide();
  await new Promise((r) => setTimeout(r, 300));
  if (activeApp?.bucket === 'terminal') {
    await copyToClipboard(answer);
    try {
      const tool = await pressKeys('ctrl+v');
      dbg(`pasted answer via ${tool}`);
      setState('done', 'Answer pasted.');
    } catch {
      setState('done', 'Answer copied — press Ctrl+V to paste it.');
    }
  } else {
    await pasteText(answer);
    setState('idle');
  }
  return true;
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

    // Explicit screen-help requests ("solve this", "fix this error") take a
    // screenshot and go to a vision model instead of the normal flow.
    if (wantsScreen(transcript) && (await tryScreenSolve(transcript))) return;

    const { action, cleanupError } = await resolveAction(transcript);
    dbg(`transcript=${JSON.stringify(transcript)} action=${JSON.stringify(action)}`);

    // Hide the overlay and give the WM a moment so keyboard focus returns to
    // the field the user was dictating into before we inject anything.
    wins.overlay()?.hide();
    await new Promise((r) => setTimeout(r, 300));

    switch (action.kind) {
      case 'type': {
        await pasteText(formatForContext(action.text));
        if (action.then) {
          // Let the target app settle after the text lands before the keypress.
          await new Promise((r) => setTimeout(r, 100));
          const tool = await pressKeys(action.then);
          dbg(`pressed ${action.then} via ${tool}`);
        }
        break;
      }
      case 'command': {
        const tool = await pressKeys(action.keys);
        dbg(`pressed ${action.keys} via ${tool}`);
        break;
      }
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
