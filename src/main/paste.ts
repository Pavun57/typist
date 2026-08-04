import { app, clipboard } from 'electron';
import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Text insertion.
 *
 * macOS/Windows: clipboard + simulated Cmd/Ctrl+V via nut.js.
 * Linux: nut.js (XTest) can't reach Wayland-native windows, so external tools
 * are used instead — wtype / ydotool on Wayland, xdotool on X11 — with direct
 * keystroke typing of the transcript as a fallback when no paste tool works.
 */

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 15_000 }, (err) =>
      err ? reject(err) : resolve(),
    );
  });
}

const BIN_DIRS = ['/usr/bin', '/usr/local/bin', '/bin', '/snap/bin'];

/**
 * PATH can be unreliable when the app is launched from a non-session context
 * (IDE terminal, autostart), so check the usual bin dirs before `which`.
 */
async function isInstalled(cmd: string): Promise<boolean> {
  if (BIN_DIRS.some((dir) => existsSync(join(dir, cmd)))) return true;
  try {
    await run('which', [cmd]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Session env vars are equally unreliable from non-session launchers, so the
 * compositor socket is checked too.
 */
const isWayland = (): boolean => {
  if (process.platform !== 'linux') return false;
  if (process.env.XDG_SESSION_TYPE === 'wayland' || process.env.WAYLAND_DISPLAY) {
    return true;
  }
  const uid = process.getuid?.() ?? 1000;
  return existsSync(`/run/user/${uid}/wayland-0`);
};

/** Both socket layouts: 1.x daemon (/run/user) and 0.1.x daemon (/tmp). */
function ydotoolSockets(): string[] {
  const uid = process.getuid?.() ?? 1000;
  return [`/run/user/${uid}/.ydotool_socket`, '/tmp/.ydotool_socket'];
}

/**
 * ydotool needs its daemon (ydotoold) listening on a user socket. On distros
 * that package it separately (Ubuntu noble) users often install only the
 * client, so keystrokes silently fall back to less reliable tools. If the
 * daemon binary exists but isn't running, start it — it's per-user, no root.
 * Returns true if a daemon start was attempted (caller should wait a beat).
 */
export function ensureTypingTools(): boolean {
  if (process.platform !== 'linux') return false;
  if (ydotoolSockets().some(existsSync)) return false;
  if (!BIN_DIRS.some((dir) => existsSync(join(dir, 'ydotoold')))) return false;
  try {
    const child = spawn('ydotoold', [], { detached: true, stdio: 'ignore' });
    child.on('error', () => {}); // binary vanished — nothing to start
    child.unref();
    return true;
  } catch {
    return false;
  }
}

/** Paste keystroke (Ctrl+V) commands, best first for the current session. */
function pasteCommands(): [string, string[]][] {
  const wtype: [string, string[]] = ['wtype', ['-M', 'ctrl', '-k', 'v', '-m', 'ctrl']];
  const ydotool: [string, string[]] = ['ydotool', ['key', '29:1', '47:1', '47:0', '29:0']];
  const xdotool: [string, string[]] = ['xdotool', ['key', 'ctrl+v']];
  return isWayland()
    ? [wtype, ydotool, xdotool]
    : [xdotool, ydotool, wtype];
}

/** Direct text-typing commands, best first for the current session. */
function typeCommands(text: string): [string, string[]][] {
  const wtype: [string, string[]] = ['wtype', ['--', text]];
  const ydotool: [string, string[]] = ['ydotool', ['type', '--', text]];
  const xdotool: [string, string[]] = ['xdotool', ['type', '--', text]];
  return isWayland()
    ? [wtype, ydotool, xdotool]
    : [xdotool, ydotool, wtype];
}

async function linuxPasteKeystroke(): Promise<boolean> {
  for (const [cmd, args] of pasteCommands()) {
    if (!(await isInstalled(cmd))) continue;
    try {
      await run(cmd, args);
      return true;
    } catch {
      // tool present but failed (e.g. wtype on GNOME) — try the next one
    }
  }
  return false;
}

async function linuxTypeText(text: string): Promise<boolean> {
  for (const [cmd, args] of typeCommands(text)) {
    if (!(await isInstalled(cmd))) continue;
    try {
      await run(cmd, args);
      return true;
    } catch {
      // try next
    }
  }
  return false;
}

/**
 * Under Wayland, Electron (XWayland) writes only the X11 clipboard — the
 * Wayland clipboard keeps its old content, so a following Ctrl+V pastes
 * stale text. wl-copy sets the real Wayland clipboard.
 */
async function waylandClipboardWrite(text: string): Promise<boolean> {
  if (!(await isInstalled('wl-copy'))) return false;
  try {
    await run('wl-copy', ['--', text]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Copies text to the real clipboard (Wayland clipboard included) without
 * typing anything — used for multi-line answers headed to a terminal/CLI,
 * where typing newlines would execute partial input.
 */
export async function copyToClipboard(text: string): Promise<void> {
  clipboard.writeText(text);
  if (process.platform === 'linux' && isWayland()) {
    await waylandClipboardWrite(text);
  }
}

async function linuxInsert(text: string): Promise<void> {
  // Direct typing is primary (fast, no clipboard dependency).
  // The Electron clipboard copy is only a manual Ctrl+V fallback.
  clipboard.writeText(text);
  // Give the OS a beat so the hotkey release doesn't swallow the input.
  await new Promise((r) => setTimeout(r, 150));

  if (await linuxTypeText(text)) return;

  // Fallback: clipboard paste. Under Wayland the real clipboard must be set
  // via wl-copy — Electron (XWayland) only writes the X11 clipboard.
  if (isWayland()) await waylandClipboardWrite(text);
  if (await linuxPasteKeystroke()) return;

  throw new Error(
    isWayland()
      ? 'Could not type into the focused window (transcript is on your clipboard — press Ctrl+V). Install ydotool and wl-clipboard: "sudo apt install ydotool wl-clipboard".'
      : 'Could not type into the focused window (transcript is on your clipboard — press Ctrl+V). Install xdotool: "sudo apt install xdotool".',
  );
}

async function nutJsPasteKeystroke(): Promise<void> {
  const { keyboard, Key } = await import('@nut-tree-fork/nut-js');
  const mod = process.platform === 'darwin' ? Key.LeftCmd : Key.LeftControl;
  await keyboard.pressKey(mod);
  await keyboard.pressKey(Key.V);
  await keyboard.releaseKey(Key.V);
  await keyboard.releaseKey(mod);
}

/**
 * Key presses for voice commands ("send this" → Enter, "undo that" → Ctrl+Z).
 * Combos are xdotool-style: 'enter', 'ctrl+z', 'ctrl+shift+z', 'backspace'.
 *
 * On Wayland, ydotool is tried FIRST: it emits raw evdev keycodes, which are
 * deterministic. wtype maps keysyms through a temporary keymap update that
 * misfires on some compositors (on KWin an Enter can land as stray digits).
 */

interface Combo {
  mods: string[]; // 'ctrl' | 'shift' | 'alt'
  key: string; // normalized: 'enter' | 'tab' | 'escape' | 'backspace' | letter
}

const KEY_ALIASES: Record<string, string> = {
  return: 'enter',
  esc: 'escape',
  delete: 'backspace',
  del: 'backspace',
  space: 'space',
};

function parseCombo(combo: string): Combo | null {
  const parts = combo.toLowerCase().split('+').map((p) => p.trim());
  const key = KEY_ALIASES[parts[parts.length - 1]] ?? parts[parts.length - 1];
  const mods = parts.slice(0, -1).filter((m) => ['ctrl', 'shift', 'alt'].includes(m));
  if (!key || !/^[a-z0-9]+$/.test(key)) return null;
  return { mods, key };
}

/** xkbcommon keysym names for wtype / xdotool. */
const XKB_KEY: Record<string, string> = {
  enter: 'Return',
  tab: 'Tab',
  escape: 'Escape',
  backspace: 'BackSpace',
  space: 'space',
};

/** Linux input-event scan codes for ydotool / the uinput helper. */
const SCAN_CODE: Record<string, number> = {
  enter: 28,
  tab: 15,
  escape: 1,
  backspace: 14,
  space: 57,
  a: 30, c: 46, v: 47, x: 45, z: 44, y: 21,
};
const MOD_SCAN_CODE: Record<string, number> = { ctrl: 29, shift: 42, alt: 56 };

/** ydotool-style event sequence: mods down, key press+release, mods up. */
function keySeq(c: Combo): string[] {
  const seq: string[] = [];
  for (const m of c.mods) seq.push(`${MOD_SCAN_CODE[m]}:1`);
  const code = SCAN_CODE[c.key];
  if (code === undefined) return [];
  seq.push(`${code}:1`, `${code}:0`);
  for (const m of [...c.mods].reverse()) seq.push(`${MOD_SCAN_CODE[m]}:0`);
  return seq;
}

/**
 * Our own uinput injector (resources/uinput-keys.py): creates a fresh virtual
 * keyboard per press. First choice because it has no daemon and no keymap
 * hacks — the two failure modes behind mangled keypresses on KWin Wayland.
 */
function uinputScript(): string {
  const p = join(app.getAppPath(), 'resources', 'uinput-keys.py');
  return app.isPackaged ? p.replace('app.asar', 'app.asar.unpacked') : p;
}

function xdotoolCombo(c: Combo): string {
  const key = XKB_KEY[c.key] ?? c.key;
  return [...c.mods, key].join('+');
}

type KeyAttempt = { label: string; cmd: string; args: string[] };

async function linuxPressKeys(c: Combo): Promise<string | null> {
  // wtype is deliberately absent: it injects keys through a temporary keymap
  // rewrite that lands as garbage on KWin (an Enter arrives as stray digits).
  // Text *typing* via wtype is unaffected.
  const seq = keySeq(c);
  const attempts: KeyAttempt[] = [
    { label: 'uinput', cmd: 'python3', args: [uinputScript(), ...seq] },
    { label: 'ydotool', cmd: 'ydotool', args: ['key', ...seq] },
    { label: 'xdotool', cmd: 'xdotool', args: ['key', xdotoolCombo(c)] },
  ];
  const ordered = isWayland()
    ? attempts
    : [attempts[2], attempts[0], attempts[1]]; // X11: xdotool first
  for (const { label, cmd, args } of ordered) {
    if (args.length === 0 || !(await isInstalled(cmd))) continue;
    if (label === 'uinput' && !existsSync(uinputScript())) continue;
    try {
      await run(cmd, args);
      return label;
    } catch {
      // tool present but failed — try the next one
    }
  }
  return null;
}

async function nutJsPressKeys(c: Combo): Promise<void> {
  const { keyboard, Key } = await import('@nut-tree-fork/nut-js');
  const modKey: Record<string, number> = {
    ctrl: process.platform === 'darwin' ? Key.LeftCmd : Key.LeftControl,
    shift: Key.LeftShift,
    alt: Key.LeftAlt,
  };
  const named: Record<string, number> = {
    enter: Key.Enter,
    tab: Key.Tab,
    escape: Key.Escape,
    backspace: Key.Backspace,
    space: Key.Space,
  };
  const keyCode =
    named[c.key] ??
    (Key as unknown as Record<string, number>)[c.key.toUpperCase()];
  if (keyCode === undefined) throw new Error(`Unsupported key: ${c.key}`);
  for (const m of c.mods) await keyboard.pressKey(modKey[m]);
  await keyboard.pressKey(keyCode);
  await keyboard.releaseKey(keyCode);
  for (const m of [...c.mods].reverse()) await keyboard.releaseKey(modKey[m]);
}

/**
 * Presses a key combo in the currently focused window (voice commands).
 * Returns the tool that performed the press ('ydotool', 'wtype', …).
 */
export async function pressKeys(combo: string): Promise<string> {
  const parsed = parseCombo(combo);
  if (!parsed) throw new Error(`Unsupported key combo: ${combo}`);
  // Give the OS a beat so the hotkey release doesn't swallow the input.
  await new Promise((r) => setTimeout(r, 150));
  if (process.platform === 'linux') {
    // If the user just installed ydotoold, start it now rather than waiting
    // for the next app launch, and give the socket a moment to appear.
    if (ensureTypingTools()) {
      await new Promise((r) => setTimeout(r, 600));
    }
    const tool = await linuxPressKeys(parsed);
    if (tool) return tool;
    throw new Error(
      isWayland()
        ? 'Could not press keys in the focused window. Install the ydotool daemon: "sudo apt install ydotoold" (then dictate again — it starts automatically).'
        : 'Could not press keys in the focused window. Install xdotool: "sudo apt install xdotool".',
    );
  }
  await nutJsPressKeys(parsed);
  return 'nutjs';
}

/**
 * Inserts `text` at the cursor of the currently focused field.
 * The transcript is left on the clipboard afterwards (per design), so the
 * user can always paste manually if keystroke injection is unavailable.
 * Trailing key presses (e.g. Enter to send) are done by the caller via
 * pressKeys so they can be logged separately.
 */
export async function pasteText(text: string): Promise<void> {
  if (process.platform === 'linux') {
    await linuxInsert(text);
    return;
  }
  clipboard.writeText(text);
  await new Promise((r) => setTimeout(r, 150));
  await nutJsPasteKeystroke();
}
