import { AGENT_API_URL } from '../config/constants';

type OpenAIProxyResponse = {
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
  };
  error?: string;
};

function normalizeUsage(data: OpenAIProxyResponse) {
  return {
    inputTokens: Number(data.usage?.inputTokens || data.usage?.rawInputTokens || 0),
    outputTokens: Number(data.usage?.outputTokens || data.usage?.rawOutputTokens || 0),
    totalTokens: Number(data.usage?.totalTokens || data.usage?.rawTotalTokens || 0),
  };
}

export async function generateOpenAITextDirect(payload: Record<string, unknown>, timeoutMs = 60000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${AGENT_API_URL}/openai-generate`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = (await response.json().catch(() => ({}))) as OpenAIProxyResponse;
    if (!response.ok || !data.ok) {
      const error = new Error(data.error || 'OpenAI yorum yanıtı alınamadı.') as Error & {
        isOpenAIError?: boolean;
        status?: number;
      };
      error.isOpenAIError = true;
      error.status = response.status;
      throw error;
    }
    if (!data.text?.trim()) {
      const error = new Error('OpenAI boş yanıt döndürdü.') as Error & { isOpenAIError?: boolean };
      error.isOpenAIError = true;
      throw error;
    }
    return {
      text: data.text.trim(),
      model: data.model || 'gpt-5-nano',
      finishReason: data.finishReason || null,
      usage: normalizeUsage(data),
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      const error = new Error('OpenAI yanıtı zamanında alınamadı. Birazdan yeniden deneyelim.') as Error & {
        isOpenAIError?: boolean;
      };
      error.isOpenAIError = true;
      throw error;
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
