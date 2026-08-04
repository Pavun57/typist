import { execFile } from 'node:child_process';
import type { AppBucket, AppContext } from '../shared/types';

/**
 * Best-effort detection of the app the user is dictating into, used to pick
 * formatting (paragraphs for email, single line for chat, literal for code
 * editors). There is no standard Wayland API for this — xdotool only sees
 * XWayland windows — so every failure path returns null (context 'unknown')
 * and dictation proceeds with generic formatting.
 */

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 3000 }, (err, stdout) =>
      err ? reject(err) : resolve(stdout.trim()),
    );
  });
}

async function detectLinux(): Promise<{ app: string; title: string } | null> {
  // xdotool covers X11 and XWayland clients under Wayland.
  try {
    const [app, title] = await Promise.all([
      run('xdotool', ['getactivewindow', 'getwindowclassname']),
      run('xdotool', ['getactivewindow', 'getwindowname']).catch(() => ''),
    ]);
    if (app) return { app, title };
  } catch {
    // fall through
  }
  // kdotool (KDE Wayland) exposes the active window's app id.
  try {
    const app = await run('kdotool', ['getactivewindow', 'getwindowclassname']);
    if (app) return { app, title: '' };
  } catch {
    // fall through
  }
  return null;
}

async function detectMac(): Promise<{ app: string; title: string } | null> {
  try {
    const app = await run('osascript', [
      '-e',
      'tell application "System Events" to get name of first application process whose frontmost is true',
    ]);
    const title = await run('osascript', [
      '-e',
      'tell application "System Events" to get name of front window of (first application process whose frontmost is true)',
    ]).catch(() => '');
    return app ? { app, title } : null;
  } catch {
    return null;
  }
}

const WIN32_SCRIPT = `
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class FG {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
}
"@
$h = [FG]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder 512
[void][FG]::GetWindowText($h, $sb, 512)
[void][FG]::GetWindowThreadProcessId($h, [ref]$pid)
$proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
Write-Output ($proc.ProcessName + "|" + $sb.ToString())
`;

async function detectWindows(): Promise<{ app: string; title: string } | null> {
  try {
    const out = await run('powershell', ['-NoProfile', '-Command', WIN32_SCRIPT]);
    const [app, ...rest] = out.split('|');
    return app ? { app, title: rest.join('|') } : null;
  } catch {
    return null;
  }
}

const BUCKET_RULES: [AppBucket, RegExp][] = [
  ['email', /mail|gmail|outlook|thunderbird|mailspring|geary|evolution/i],
  ['chat', /whatsapp|telegram|slack|discord|signal|element|teams|messages|chat/i],
  ['terminal', /claude|codex|konsole|alacritty|kitty|wezterm|gnome-terminal|gnome-console|kgx|iterm|warp|terminator|tilix|xterm|terminal|shell|zsh|bash|powershell|cmd\.exe|windows terminal/i],
  ['code', /code|cursor|vim|neovim|emacs|idea|pycharm|webstorm|fleet|sublime|zed|studio|kate|kwrite|gedit|notepad/i],
  ['document', /libreoffice|writer|notion|obsidian|figma|docs|word|pages|notes/i],
  ['browser', /chrome|firefox|edge|brave|safari|vivaldi|opera|arc|zen/i],
];

function classify(app: string, title: string): AppBucket {
  const haystack = `${app} ${title}`;
  for (const [bucket, re] of BUCKET_RULES) {
    if (re.test(haystack)) return bucket;
  }
  return 'unknown';
}

/** Detects the focused app once per dictation. Never throws. */
export async function detectActiveApp(): Promise<AppContext | null> {
  const detected =
    process.platform === 'linux'
      ? await detectLinux()
      : process.platform === 'darwin'
        ? await detectMac()
        : await detectWindows();
  if (!detected) return null;
  return { ...detected, bucket: classify(detected.app, detected.title) };
}
