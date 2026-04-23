import { AGENT_API_URL } from '../config/constants';
import type { DevSettings } from '../types';
import type { ProfileMemorySnippet } from '../types/memory';

export interface FortuneMessage {
  role: 'user' | 'assistant';
  text: string;
}

interface FortuneRequest {
  sessionId: string;
  devSettings: DevSettings;
  profileId: string;
  profileName: string;
  profileIsSelf?: boolean;
  readingType: 'coffee' | 'palm';
  coffeeMode?: 'upload' | 'ai-brew';
  memorySnippet?: ProfileMemorySnippet | null;
  messages: FortuneMessage[];
  images?: {
    cup?: string;
    saucer?: string;
    palm?: string;
  };
}

interface FortuneResponse {
  text: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}

export interface FortuneReplyResult {
  text: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

const FRIENDLY_FALLBACK =
  'Bu fotoğraf bu fal türü için uygun görünmüyor canım. Uygun fal türünü seçip fotoğrafı yeniden yükleyelim.';

function friendlyApiMessage(raw?: string | null) {
  const text = (raw || '').trim();
  if (!text) return FRIENDLY_FALLBACK;

  const looksTechnical =
    /Gemini|HTTP|JSON|RuntimeError|Traceback|candidate|classifier|generateContent|API|token|exception|returned/i.test(
      text,
    );

  return looksTechnical ? FRIENDLY_FALLBACK : text;
}

export async function getFortuneReply(body: FortuneRequest): Promise<FortuneReplyResult> {
  const response = await fetch(`${AGENT_API_URL}/fortune`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => ({}))) as FortuneResponse & {
    error?: string;
    userMessage?: string;
  };

  if (!response.ok) {
    const error = new Error(friendlyApiMessage(data.userMessage || data.error)) as Error & {
      tokenUsage?: FortuneReplyResult['usage'];
      isImageValidation?: boolean;
    };
    error.tokenUsage = {
      inputTokens: Number(data.usage?.inputTokens || 0),
      outputTokens: Number(data.usage?.outputTokens || 0),
      totalTokens: Number(data.usage?.totalTokens || 0),
    };
    error.isImageValidation = /fotograf|fotoğraf|fincan|tabak|avu[cç]|el fali|kahve fali|istemistin fakat/i.test(
      data.userMessage || data.error || '',
    );
    throw error;
  }

  if (!data?.text) {
    throw new Error('Fortune API returned empty text.');
  }
  return {
    text: data.text,
    usage: {
      inputTokens: Number(data.usage?.inputTokens || 0),
      outputTokens: Number(data.usage?.outputTokens || 0),
      totalTokens: Number(data.usage?.totalTokens || 0),
    },
  };
}
