import type { Result } from '../shared/types';

const STT_URL = 'https://api.sarvam.ai/speech-to-text';
const MODEL = 'saarika:v2.5';

export class SarvamError extends Error {}

/**
 * Transcribes a 16 kHz mono WAV buffer with Sarvam STT.
 * language 'unknown' lets Sarvam auto-detect among supported languages.
 */
export async function transcribe(
  apiKey: string,
  wav: Buffer,
  language: string,
): Promise<string> {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(wav)], { type: 'audio/wav' }), 'audio.wav');
  form.append('model', MODEL);
  form.append('language_code', language || 'unknown');

  let res: Response;
  try {
    res = await fetch(STT_URL, {
      method: 'POST',
      headers: { 'api-subscription-key': apiKey },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new SarvamError('Could not reach Sarvam (network error or timeout).');
  }

  if (res.status === 401 || res.status === 403) {
    throw new SarvamError('Invalid Sarvam API key. Fix it in Settings.');
  }
  if (res.status === 429) {
    throw new SarvamError('Rate limited by Sarvam. Try again in a moment.');
  }
  if (!res.ok) {
    throw new SarvamError(`Sarvam request failed (HTTP ${res.status}).`);
  }

  const data = (await res.json()) as { transcript?: string };
  const transcript = data.transcript?.trim();
  if (!transcript) throw new SarvamError('No speech detected.');
  return transcript;
}

/**
 * Lightweight key check: POST with no file. Sarvam answers 4xx for a missing
 * file; a 401/403 specifically means the key itself was rejected.
 */
export async function validateApiKey(apiKey: string): Promise<Result> {
  if (!apiKey.trim()) return { ok: false, message: 'API key is empty.' };
  try {
    const res = await fetch(STT_URL, {
      method: 'POST',
      headers: { 'api-subscription-key': apiKey },
      body: new FormData(),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: 'Invalid API key.' };
    }
    return { ok: true, message: 'Key accepted by Sarvam.' };
  } catch {
    return { ok: false, message: 'Could not reach Sarvam (network error).' };
  }
}
