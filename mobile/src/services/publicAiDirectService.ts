import { AGENT_API_URL } from '../config/constants';

type PublicAiProxyResponse = {
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

function normalizeUsage(data: PublicAiProxyResponse) {
  return {
    inputTokens: Number(data.usage?.inputTokens || data.usage?.rawInputTokens || 0),
    outputTokens: Number(data.usage?.outputTokens || data.usage?.rawOutputTokens || 0),
    totalTokens: Number(data.usage?.totalTokens || data.usage?.rawTotalTokens || 0),
  };
}

export async function generatePublicAiTextDirect(payload: Record<string, unknown>, timeoutMs = 75000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${AGENT_API_URL}/publicai-generate`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = (await response.json().catch(() => ({}))) as PublicAiProxyResponse;
    if (!response.ok || !data.ok) {
      const error = new Error(data.error || 'PublicAI yorum yanıtı alınamadı.') as Error & {
        isPublicAiError?: boolean;
        status?: number;
      };
      error.isPublicAiError = true;
      error.status = response.status;
      throw error;
    }
    if (!data.text?.trim()) {
      const error = new Error('PublicAI boş yanıt döndürdü.') as Error & { isPublicAiError?: boolean };
      error.isPublicAiError = true;
      throw error;
    }
    return {
      text: data.text.trim(),
      model: data.model || 'utter-project/EuroLLM-22B-Instruct-2512',
      usage: normalizeUsage(data),
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      const error = new Error('PublicAI yanıtı zamanında alınamadı. Birazdan yeniden deneyelim.') as Error & {
        isPublicAiError?: boolean;
      };
      error.isPublicAiError = true;
      throw error;
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
