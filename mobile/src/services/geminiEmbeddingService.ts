export const GEMINI_EMBEDDING_MODEL = 'local-hash-embedding-recovery';

export function stableTextHash(text: string) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export async function embedGeminiText(text: string, _timeoutMs = 30000, _taskType = 'RETRIEVAL_DOCUMENT') {
  const dimensions = 96;
  const vector = Array.from({ length: dimensions }, () => 0);
  const tokens = text
    .toLocaleLowerCase('tr-TR')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  for (const token of tokens) {
    const bucket = parseInt(stableTextHash(token).slice(0, 8), 16) % dimensions;
    vector[bucket] += 1;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return {
    model: GEMINI_EMBEDDING_MODEL,
    embedding: vector.map((value) => value / norm),
  };
}
