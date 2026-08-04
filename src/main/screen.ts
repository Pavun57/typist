import { app } from 'electron';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

/**
 * Screen capture for screen-aware coding help ("solve this", "fix this
 * error"). Captures the ACTIVE window where possible (better context, less
 * privacy exposure), falling back to the full screen. Returns the PNG path —
 * the caller owns deleting it. Never throws; capture failure returns null.
 */

const BIN_DIRS = ['/usr/bin', '/usr/local/bin', '/bin', '/snap/bin'];

function has(cmd: string): boolean {
  return BIN_DIRS.some((dir) => existsSync(join(dir, cmd)));
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 15_000 }, (err) =>
      err ? reject(err ?? new Error('capture failed')) : resolve(),
    );
  });
}

const WIN_PS_SCRIPT = `
Add-Type -AssemblyName System.Windows.Forms,System.Drawing
$b = [System.Windows.Forms.SystemInformation]::VirtualScreen
$bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($b.Left, $b.Top, 0, 0, $bmp.Size)
$bmp.Save('__DEST__', [System.Drawing.Imaging.ImageFormat]::Png)
`;

/** Candidate capture commands, best first for the current platform. */
function captureCommands(dest: string): [string, string[]][] {
  if (process.platform === 'darwin') {
    return [['screencapture', ['-x', dest]]];
  }
  if (process.platform === 'win32') {
    const script = WIN_PS_SCRIPT.replace('__DEST__', dest.replace(/'/g, "''"));
    return [['powershell', ['-NoProfile', '-Command', script]]];
  }
  // Linux: spectacle covers KDE (incl. Wayland), gnome-screenshot GNOME.
  return [
    ['spectacle', ['-b', '-n', '-a', '-o', dest]], // active window, no GUI
    ['gnome-screenshot', ['-w', '-f', dest]], // active window
    ['spectacle', ['-b', '-n', '-f', '-o', dest]], // full screen fallback
    ['gnome-screenshot', ['-f', dest]],
    ['grim', [dest]], // wlroots
    ['import', ['-window', 'root', dest]], // ImageMagick, X11
  ];
}

/**
 * Captures the screen to a PNG file and returns its path (caller deletes).
 * Never throws; returns null when no capture tool works.
 */
export async function captureScreenToFile(): Promise<string | null> {
  const dest = join(app.getPath('temp'), `typist-shot-${Date.now()}.png`);
  for (const [cmd, args] of captureCommands(dest)) {
    if (!has(cmd)) continue;
    try {
      await run(cmd, args);
      if (existsSync(dest)) return dest;
    } catch {
      // try the next tool
    }
  }
  return null;
}
