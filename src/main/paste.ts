import { clipboard } from 'electron';
import { execFile } from 'node:child_process';

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

async function isInstalled(cmd: string): Promise<boolean> {
  try {
    await run('which', [cmd]);
    return true;
  } catch {
    return false;
  }
}

const isWayland = (): boolean =>
  process.platform === 'linux' &&
  (process.env.XDG_SESSION_TYPE === 'wayland' || !!process.env.WAYLAND_DISPLAY);

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
 * Inserts `text` at the cursor of the currently focused field.
 * The transcript is left on the clipboard afterwards (per design), so the
 * user can always paste manually if keystroke injection is unavailable.
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
