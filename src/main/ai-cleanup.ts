import type { AiCloudProvider, Result } from '../shared/types';
import { DEFAULT_AI_MODEL } from '../shared/types';

/**
 * Post-transcription AI cleanup via free-tier LLM APIs (Groq / OpenRouter,
 * both OpenAI-compatible). One call does intent detection + transform:
 * prompts meant for an AI get enhanced, messages to humans get grammar-only fixes.
 */

const BASE_PROMPT = `You post-process dictated speech text.

Step 1 — detect the intent of the text:
- PROMPT: an instruction, question, or task meant for an AI assistant (e.g. "write a function that...", "explain quantum computing", "create an image of...").
- MESSAGE: text meant for another person (chat, email, document, note).

Step 2 — transform:
- If PROMPT: rewrite it as a clear, well-structured, detailed prompt. Fix grammar, remove filler words and false starts, add helpful structure and missing context that makes the intent unambiguous. Do not answer the prompt — only improve it.
- If MESSAGE: only fix grammar, spelling, and punctuation. Preserve the speaker's tone (formal, casual, friendly) and meaning. Do not add content.

Rules:
- Output ONLY the final text. No explanations, no labels, no quotes.`;

const SAME_LANGUAGE_RULE = '- Always respond in the same language as the input.';
const TRANSLATE_RULE =
  "- Always respond in English: translate the text into natural, fluent English while preserving the speaker's tone and intent.";

function systemPrompt(translateToEnglish: boolean): string {
  return `${BASE_PROMPT}\n${translateToEnglish ? TRANSLATE_RULE : SAME_LANGUAGE_RULE}`;
}

const ENDPOINTS: Record<AiCloudProvider, string> = {
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  nvidia: 'https://integrate.api.nvidia.com/v1/chat/completions',
};

const MODELS_ENDPOINTS: Record<AiCloudProvider, string> = {
  groq: 'https://api.groq.com/openai/v1/models',
  openrouter: 'https://openrouter.ai/api/v1/models',
  nvidia: 'https://integrate.api.nvidia.com/v1/models',
};

/** Validates an AI provider key against a lightweight endpoint. */
export async function validateAiKey(
  provider: AiCloudProvider,
  apiKey: string,
): Promise<Result> {
  if (!apiKey.trim()) return { ok: false, message: 'API key is empty.' };
  const url =
    provider === 'openrouter'
      ? 'https://openrouter.ai/api/v1/auth/key'
      : MODELS_ENDPOINTS[provider];
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: 'Invalid API key.' };
    }
    if (!res.ok) {
      return { ok: false, message: `Key check failed (HTTP ${res.status}).` };
    }
    return { ok: true, message: 'Key accepted.' };
  } catch {
    return { ok: false, message: 'Network error — could not reach the provider.' };
  }
}

/**
 * Lists available models from the provider. OpenRouter's catalog is filtered
 * to free models; Groq and NVIDIA list the account's models (needs the key).
 */
export async function fetchModels(
  provider: AiCloudProvider,
  apiKey: string,
): Promise<{ id: string; label: string }[]> {
  const needsAuth = provider !== 'openrouter';
  const res = await fetch(MODELS_ENDPOINTS[provider], {
    headers: needsAuth ? { Authorization: `Bearer ${apiKey}` } : {},
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Could not list models (HTTP ${res.status}).`);
  const data = (await res.json()) as {
    data?: { id: string; name?: string }[];
  };
  const models = data.data ?? [];
  if (provider === 'openrouter') {
    return models
      .filter((m) => m.id.endsWith(':free'))
      .map((m) => ({ id: m.id, label: m.name ?? m.id }));
  }
  return models.map((m) => ({ id: m.id, label: m.id }));
}

export async function cleanupText(
  provider: AiCloudProvider,
  apiKey: string,
  model: string,
  text: string,
  translateToEnglish = false,
): Promise<string> {
  const res = await fetch(ENDPOINTS[provider], {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || DEFAULT_AI_MODEL[provider],
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt(translateToEnglish) },
        { role: 'user', content: text },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error(`Invalid ${provider} API key.`);
  }
  if (res.status === 429) {
    throw new Error(`${provider} rate limit hit — try again shortly.`);
  }
  if (!res.ok) {
    throw new Error(`AI cleanup failed (HTTP ${res.status}).`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const cleaned = data.choices?.[0]?.message?.content?.trim();
  // Never return empty — fall back to the raw transcript.
  return cleaned || text;
}
