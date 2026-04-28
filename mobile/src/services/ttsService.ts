import * as Speech from 'expo-speech';

interface ReaderState {
  chunks: string[];
  index: number;
  speaking: boolean;
  token: number;
  stopRequested: boolean;
  chunkBoundaryCharIndex: number;
}

const state: ReaderState = {
  chunks: [],
  index: 0,
  speaking: false,
  token: 0,
  stopRequested: false,
  chunkBoundaryCharIndex: 0,
};

function splitTextIntoChunks(text: string, maxLen = 220): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const sentences = normalized.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if (!sentence) continue;
    if (!current) {
      current = sentence;
      continue;
    }
    if ((current + ' ' + sentence).length <= maxLen) {
      current += ` ${sentence}`;
    } else {
      chunks.push(current);
      current = sentence;
    }
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : [normalized];
}

async function speakChunk(text: string, onBoundary?: (charIndex: number) => void): Promise<void> {
  const voices = await Speech.getAvailableVoicesAsync().catch(() => []);
  const trVoice = voices.find((v) => (v.language || '').toLowerCase().startsWith('tr'));

  const speakOnce = (opts: { language?: string; voice?: string }) =>
    new Promise<void>((resolve, reject) => {
      Speech.speak(text, {
        ...opts,
        rate: 0.95,
        pitch: 1.0,
        onBoundary: (ev: any) => {
          const idx = typeof ev?.charIndex === 'number' ? ev.charIndex : 0;
          onBoundary?.(idx);
        },
        onDone: () => resolve(),
        onStopped: () => resolve(),
        onError: (err) => reject(err),
      });
    });

  try {
    await speakOnce({
      language: trVoice ? trVoice.language : 'tr-TR',
      voice: trVoice?.identifier,
    });
  } catch {
    await speakOnce({});
  }
}

export function prepareAssistantSpeech(text: string): void {
  state.chunks = splitTextIntoChunks(text);
  state.index = 0;
  state.stopRequested = false;
  state.chunkBoundaryCharIndex = 0;
}

export function stopAssistantSpeech(): void {
  state.stopRequested = true;
  state.speaking = false;
  state.token += 1;
  Speech.stop();
}

export function isAssistantSpeaking(): boolean {
  return state.speaking;
}

export async function startOrResumeAssistantSpeech(
  onChunkStart?: (chunkIndex: number) => void,
): Promise<void> {
  if (state.speaking) return;
  if (!state.chunks.length || state.index >= state.chunks.length) return;

  state.speaking = true;
  state.stopRequested = false;
  const token = ++state.token;

  try {
    while (state.index < state.chunks.length && token === state.token) {
      onChunkStart?.(state.index);
      const chunk = state.chunks[state.index];
      state.chunkBoundaryCharIndex = 0;
      await speakChunk(chunk, (charIndex) => {
        if (charIndex > state.chunkBoundaryCharIndex) {
          state.chunkBoundaryCharIndex = charIndex;
        }
      });
      if (state.stopRequested || token !== state.token) {
        if (state.chunkBoundaryCharIndex > 0 && state.chunkBoundaryCharIndex < chunk.length) {
          const remaining = chunk.slice(state.chunkBoundaryCharIndex).trim();
          if (remaining) {
            state.chunks[state.index] = remaining;
          } else {
            state.index += 1;
          }
        }
        break;
      }
      state.index += 1;
    }
  } finally {
    state.speaking = false;
    state.chunkBoundaryCharIndex = 0;
  }
}

export function getAssistantSpeechProgress() {
  return {
    currentChunk: state.index,
    totalChunks: state.chunks.length,
    finished: state.chunks.length > 0 && state.index >= state.chunks.length,
  };
}
