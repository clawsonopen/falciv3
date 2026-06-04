import { AGENT_API_URL } from '../config/constants';

export const GEMINI_EMBEDDING_MODEL = 'gemini-embedding-2';

type GeminiEmbeddingUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  rawInputTokens?: number;
  rawOutputTokens?: number;
  rawTotalTokens?: number;
  tokenSafetyMultiplier?: number;
};

type GeminiEmbeddingResponse = {
  ok?: boolean;
  model?: string;
  provider?: string;
  embedding?: number[];
  usage?: GeminiEmbeddingUsage;
  error?: string;
  retryAfterSeconds?: number;
};

export function stableTextHash(text: string) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export async function embedGeminiText(text: string, timeoutMs = 30000, taskType = 'RETRIEVAL_DOCUMENT') {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Embedding metni boş.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${AGENT_API_URL}/gemini-embed`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: trimmed,
        model: GEMINI_EMBEDDING_MODEL,
        taskType,
      }),
      signal: controller.signal,
    });
    const data = (await response.json().catch(() => ({}))) as GeminiEmbeddingResponse;
    if (!response.ok || !data.ok) {
      const error = new Error(data.error || 'Gemini embedding yanıtı alınamadı.') as Error & {
        status?: number;
        retryAfterSeconds?: number;
      };
      error.status = response.status;
      error.retryAfterSeconds = data.retryAfterSeconds;
      throw error;
    }
    const embedding = (data.embedding || []).map((value) => Number(value)).filter((value) => Number.isFinite(value));
    if (!embedding.length) {
      throw new Error('Gemini embedding yanıtı boş döndü.');
    }
    return {
      model: data.model || GEMINI_EMBEDDING_MODEL,
      embedding,
      usage: data.usage,
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Gemini embedding yanıtı zamanında alınamadı.');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
