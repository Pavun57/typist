import type { MemoryEntry, VoiceAction } from '../shared/types';

/**
 * Offline intent parser used when no AI cleanup provider is configured.
 * Ordered regex rules handle the common voice commands and memory
 * save/recall; anything unrecognized falls through to plain typing.
 * Natural phrasing beyond these patterns requires the AI pass.
 */

/** Pure keystroke commands: whole utterance is a command, nothing typed. */
const COMMAND_RULES: [RegExp, string][] = [
  [/^(press |hit )?(enter|return)$/i, 'enter'],
  [/^(press )?tab$/i, 'tab'],
  [/^(press )?escape$/i, 'escape'],
  [/^undo( that| this)?$/i, 'ctrl+z'],
  [/^redo( that| this)?$/i, 'ctrl+shift+z'],
  [/^(backspace|delete that|scratch that)$/i, 'backspace'],
  [/^select all$/i, 'ctrl+a'],
  [/^copy( that| this)?$/i, 'ctrl+c'],
  [/^paste( that| this)?$/i, 'ctrl+v'],
];

/** Trailing commands: typed text followed by a key. Longest match first. */
const TRAILING_RULES: [RegExp, 'enter' | 'tab' | 'escape'][] = [
  [/[,.\s]*(send (this|it|that|the message)|hit send|hit enter|press enter)\s*[.!?]*$/i, 'enter'],
  [/[,.\s]*(new line|newline|line break)\s*[.!?]*$/i, 'enter'],
  [/[,.\s]*(press |hit )?tab\s*[.!?]*$/i, 'tab'],
];

const REMEMBER_RE =
  /^remember\s+(?:that\s+)?(?:my\s+)?(.+?)\s+is\s+(.+)$/i;

/** "my <key>" references that match a saved memory. */
function substituteMemories(
  text: string,
  memories: MemoryEntry[],
): string | null {
  let out = text;
  let substituted = false;
  for (const m of memories) {
    const re = new RegExp(`\\bmy ${m.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    if (re.test(out)) {
      out = out.replace(re, m.value);
      substituted = true;
    }
  }
  return substituted ? out : null;
}

export function parseFallback(
  transcript: string,
  memories: MemoryEntry[],
): VoiceAction {
  const text = transcript.trim();

  const remember = REMEMBER_RE.exec(text);
  if (remember) {
    return { kind: 'remember', key: remember[1].trim(), value: remember[2].trim() };
  }

  // "type/write my <key>" → recall a saved fact.
  const recall = /^(?:type|write|enter|insert)\s+my\s+(.+?)\s*[.!?]*$/i.exec(text);
  if (recall) {
    return { kind: 'recall', key: recall[1].trim() };
  }

  for (const [re, keys] of COMMAND_RULES) {
    if (re.test(text)) return { kind: 'command', keys };
  }

  for (const [re, then] of TRAILING_RULES) {
    if (re.test(text)) {
      const body = text.replace(re, '').trim();
      if (body) return { kind: 'type', text: body, then };
      // "new line" alone is just an Enter press.
      return { kind: 'command', keys: then };
    }
  }

  // Inline memory references: "send it to my address" → value substituted.
  const substituted = substituteMemories(text, memories);
  if (substituted) return { kind: 'type', text: substituted };

  return { kind: 'type', text };
}
