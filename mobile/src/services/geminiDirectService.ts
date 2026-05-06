import { AGENT_API_URL } from '../config/constants';

type GeminiKeyResponse = {
  ok?: boolean;
  apiKey?: string;
  model?: string;
  error?: string;
};

type GeminiGenerateResponse = {
  candidates?: Array<{
    finishReason?: string;
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: {
    message?: string;
  };
};

let cachedKey: { apiKey: string; model: string; fetchedAt: number } | null = null;

async function fetchGeminiKey(timeoutMs = 8000) {
  if (cachedKey && Date.now() - cachedKey.fetchedAt < 10 * 60 * 1000) {
    return cachedKey;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;

  try {
    response = await fetch(`${AGENT_API_URL}/gemini-api-key`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } catch (err: any) {
    const message =
      err?.name === 'AbortError'
        ? 'Yorum anahtarı alınamadı. Anahtar servisi yanıt vermiyor.'
        : 'Yorum anahtarı alınamadı. Anahtar servisine ulaşılamıyor.';
    const error = new Error(message) as Error & { status?: number };
    error.status = 0;
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const data = (await response.json().catch(() => ({}))) as GeminiKeyResponse;
  if (!response.ok || !data.apiKey) {
    const error = new Error(data.error || 'Yorum anahtarı alınamadı.') as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  cachedKey = {
    apiKey: data.apiKey,
    model: data.model || 'gemini-2.5-flash-lite',
    fetchedAt: Date.now(),
  };
  return cachedKey;
}

export async function generateGeminiTextDirect(payload: Record<string, unknown>, timeoutMs = 45000) {
  const { apiKey, model } = await fetchGeminiKey();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = (await response.json().catch(() => ({}))) as GeminiGenerateResponse;
    if (!response.ok) {
      const error = new Error(data.error?.message || 'Yorum yanıtı alınamadı.') as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
    const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
    if (!text) {
      throw new Error('Yorum kapısı boş yanıt döndürdü.');
    }
    return {
      text,
      model,
      finishReason: data.candidates?.[0]?.finishReason || null,
      usage: {
        inputTokens: Number(data.usageMetadata?.promptTokenCount || 0),
        outputTokens: Number(data.usageMetadata?.candidatesTokenCount || 0),
        totalTokens: Number(data.usageMetadata?.totalTokenCount || 0),
      },
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Yorum yanıtı zamanında alınamadı. Birazdan yeniden deneyelim.');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
