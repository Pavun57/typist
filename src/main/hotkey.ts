import { globalShortcut } from 'electron';
import type { Result } from '../shared/types';

export function registerHotkey(accelerator: string, onToggle: () => void): Result {
  globalShortcut.unregisterAll();
  try {
    const ok = globalShortcut.register(accelerator, onToggle);
    if (!ok) {
      return {
        ok: false,
        message: `"${accelerator}" is already taken by another app.`,
      };
    }
    return { ok: true, message: 'Hotkey registered.' };
  } catch {
    return { ok: false, message: `"${accelerator}" is not a valid accelerator.` };
  }
}

export function unregisterHotkeys(): void {
  globalShortcut.unregisterAll();
}
