import { AGENT_API_URL } from '../config/constants';

type GeminiProxyResponse = {
  ok?: boolean;
  text?: string;
  model?: string;
  finishReason?: string | null;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    rawInputTokens?: number;
    rawOutputTokens?: number;
    rawTotalTokens?: number;
    tokenSafetyMultiplier?: number;
  };
  error?: string;
  retryAfterSeconds?: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeUsage(data: GeminiProxyResponse) {
  return {
    inputTokens: Number(data.usage?.inputTokens || 0),
    outputTokens: Number(data.usage?.outputTokens || 0),
    totalTokens: Number(data.usage?.totalTokens || 0),
  };
}

function normalizeRawUsage(data: GeminiProxyResponse) {
  return {
    inputTokens: Number(data.usage?.rawInputTokens ?? data.usage?.inputTokens ?? 0),
    outputTokens: Number(data.usage?.rawOutputTokens ?? data.usage?.outputTokens ?? 0),
    totalTokens: Number(data.usage?.rawTotalTokens ?? data.usage?.totalTokens ?? 0),
  };
}

type GeminiUsageMode = 'effective' | 'raw';
type GeminiDirectOptions = {
  usageMode?: GeminiUsageMode;
};

function selectedUsage(data: GeminiProxyResponse, options?: GeminiDirectOptions) {
  return options?.usageMode === 'raw' ? normalizeRawUsage(data) : normalizeUsage(data);
}

async function postGeminiProxy(payload: Record<string, unknown>, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${AGENT_API_URL}/gemini-generate`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = (await response.json().catch(() => ({}))) as GeminiProxyResponse;
    if (!response.ok || !data.ok) {
      const error = new Error(data.error || 'Yorum yanıtı alınamadı.') as Error & {
        status?: number;
        retryAfterSeconds?: number;
      };
      error.status = response.status;
      error.retryAfterSeconds = data.retryAfterSeconds;
      throw error;
    }
    if (!data.text?.trim()) {
      throw new Error('Yorum kapısı boş yanıt döndürdü.');
    }
    return data;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Yorum yanıtı zamanında alınamadı. Birazdan yeniden deneyelim.');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateGeminiTextDirect(payload: Record<string, unknown>, timeoutMs = 45000, options?: GeminiDirectOptions) {
  try {
    const data = await postGeminiProxy(payload, timeoutMs);
    return {
      text: data.text!.trim(),
      model: data.model || 'gemini-2.5-flash-lite',
      finishReason: data.finishReason || null,
      usage: selectedUsage(data, options),
    };
  } catch (err: any) {
    const retryAfterSeconds = Number(err?.retryAfterSeconds || 0);
    if (err?.status === 429 && retryAfterSeconds > 0 && retryAfterSeconds <= 60) {
      await sleep(retryAfterSeconds * 1000);
      const data = await postGeminiProxy(payload, timeoutMs);
      return {
        text: data.text!.trim(),
        model: data.model || 'gemini-2.5-flash-lite',
        finishReason: data.finishReason || null,
        usage: selectedUsage(data, options),
      };
    }
    throw err;
  }
}
