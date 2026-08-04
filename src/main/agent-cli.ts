import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, unlink } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AgentCliPreference, AgentStatus } from '../shared/types';

/**
 * Local coding agents (Claude Code, Codex CLI) used for screen-aware coding
 * help. The CLIs read the screenshot file with their own tools, so no vision
 * API key is needed. Detection covers the common install locations because
 * PATH is unreliable when the app is launched outside a login session.
 */

export type AgentCli = 'claude' | 'codex';

export interface AgentCliInfo {
  cli: AgentCli;
  path: string;
}

const SEARCH_DIRS = [
  join(homedir(), '.local', 'bin'),
  join(homedir(), '.claude', 'local'),
  join(homedir(), 'go', 'bin'),
  '/usr/local/bin',
  '/usr/bin',
  '/bin',
  '/snap/bin',
];

/** Prefers Claude Code, then Codex. Returns the full binary path. */
export function detectAgentCli(preference?: string): AgentCliInfo | null {
  const order =
    preference === 'claude' || preference === 'codex'
      ? [preference as AgentCli]
      : (['claude', 'codex'] as const);
  for (const cli of order) {
    for (const dir of SEARCH_DIRS) {
      const p = join(dir, cli);
      if (existsSync(p)) return { cli, path: p };
    }
  }
  return null;
}

/** Detection results for the Settings UI (no preference applied). */
export function agentStatus(preference: AgentCliPreference): AgentStatus {
  const find = (cli: AgentCli): { found: boolean; path: string } => {
    for (const dir of SEARCH_DIRS) {
      const p = join(dir, cli);
      if (existsSync(p)) return { found: true, path: p };
    }
    return { found: false, path: '' };
  };
  return { claude: find('claude'), codex: find('codex'), preference };
}

function buildPrompt(imagePath: string, request: string): string {
  return [
    `The screenshot at ${imagePath} shows the user's screen — read it with your file/image tools.`,
    `The user's spoken request: "${request}".`,
    'Solve the problem visible on the screen.',
    'If the answer is code, output ONLY the code, ready to paste — no markdown fences, no explanation, unless the user asked for one.',
    'If the answer is a diagnosis or instruction, be brief and concrete (2-4 sentences).',
    'Never describe the screenshot back or narrate your steps.',
  ].join('\n');
}

const TIMEOUT_MS = 180_000;
const MAX_BUFFER = 16 * 1024 * 1024;

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      cmd,
      args,
      { timeout: TIMEOUT_MS, maxBuffer: MAX_BUFFER, cwd: homedir() },
      (err, stdout, stderr) =>
        err
          ? reject(new Error(stderr?.trim() || err.message))
          : resolve(stdout.trim()),
    );
  });
}

/**
 * Solves a screen problem with a local agent CLI. The agent reads the
 * screenshot at imagePath itself; only the final answer text is returned.
 */
export async function solveWithAgentCli(
  agent: AgentCliInfo,
  request: string,
  imagePath: string,
): Promise<string> {
  const prompt = buildPrompt(imagePath, request);

  if (agent.cli === 'claude') {
    // -p: headless print mode; Read lets it open the screenshot.
    const out = await run(agent.path, ['-p', prompt, '--allowedTools', 'Read']);
    if (!out) throw new Error('Claude Code returned an empty answer.');
    return out;
  }

  // Codex CLI: non-interactive exec, image attached, clean output via file.
  const outFile = join(
    tmpdir(),
    `typist-codex-${process.pid}-${Math.floor(Math.random() * 1e9)}.txt`,
  );
  try {
    const stdout = await run(agent.path, [
      'exec',
      '--skip-git-repo-check',
      '-i',
      imagePath,
      '--output-last-message',
      outFile,
      prompt,
    ]);
    let answer = '';
    if (existsSync(outFile)) {
      answer = (await readFile(outFile, 'utf8')).trim();
    }
    if (!answer) answer = stdout;
    if (!answer) throw new Error('Codex returned an empty answer.');
    return answer;
  } finally {
    void unlink(outFile).catch(() => {});
  }
}
