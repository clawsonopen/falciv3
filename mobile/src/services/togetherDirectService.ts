import { AGENT_API_URL } from '../config/constants';

type TogetherProxyResponse = {
  ok?: boolean;
  text?: string;
  model?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    rawInputTokens?: number;
    rawOutputTokens?: number;
    rawTotalTokens?: number;
  };
  error?: string;
};

function normalizeUsage(data: TogetherProxyResponse) {
  return {
    inputTokens: Number(data.usage?.inputTokens || data.usage?.rawInputTokens || 0),
    outputTokens: Number(data.usage?.outputTokens || data.usage?.rawOutputTokens || 0),
    totalTokens: Number(data.usage?.totalTokens || data.usage?.rawTotalTokens || 0),
  };
}

export async function generateTogetherTextDirect(payload: Record<string, unknown>, timeoutMs = 60000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${AGENT_API_URL}/together-generate`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = (await response.json().catch(() => ({}))) as TogetherProxyResponse;
    if (!response.ok || !data.ok) {
      const error = new Error(data.error || 'Together yorum yanıtı alınamadı.') as Error & {
        isTogetherError?: boolean;
        status?: number;
      };
      error.isTogetherError = true;
      error.status = response.status;
      throw error;
    }
    if (!data.text?.trim()) {
      const error = new Error('Together boş yanıt döndürdü.') as Error & { isTogetherError?: boolean };
      error.isTogetherError = true;
      throw error;
    }
    return {
      text: data.text.trim(),
      model: data.model || 'google/gemma-3n-E4B-it',
      usage: normalizeUsage(data),
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      const error = new Error('Together yanıtı zamanında alınamadı. Birazdan yeniden deneyelim.') as Error & {
        isTogetherError?: boolean;
      };
      error.isTogetherError = true;
      throw error;
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
