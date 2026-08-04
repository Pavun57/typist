import Store from 'electron-store';
import type { MemoryEntry } from '../shared/types';

/**
 * Persistent user facts ("remember my address is …"). Stored unencrypted in
 * memories.json — these are dictated facts, not credentials. Keys are matched
 * case-insensitively; re-remembering an existing key updates its value.
 */

const store = new Store<{ memories: MemoryEntry[] }>({
  name: 'memories',
  defaults: { memories: [] },
});

export function listMemories(): MemoryEntry[] {
  return store.get('memories');
}

export function findMemory(key: string): MemoryEntry | undefined {
  const k = key.trim().toLowerCase();
  return store.get('memories').find((m) => m.key.toLowerCase() === k);
}

export function addMemory(key: string, value: string): void {
  const k = key.trim();
  const v = value.trim();
  if (!k || !v) return;
  const memories = store.get('memories').filter(
    (m) => m.key.toLowerCase() !== k.toLowerCase(),
  );
  memories.push({ key: k, value: v, createdAt: Date.now() });
  store.set('memories', memories);
}

export function deleteMemory(key: string): void {
  const k = key.trim().toLowerCase();
  store.set(
    'memories',
    store.get('memories').filter((m) => m.key.toLowerCase() !== k),
  );
}

export function clearMemories(): void {
  store.set('memories', []);
}
