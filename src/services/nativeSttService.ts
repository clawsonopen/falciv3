import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

let isNativeRecording = false;
let latestTranscript = '';
let subscriptions: Array<{ remove: () => void }> = [];
let finalizedSegments: string[] = [];
let liveSegment = '';
const STT_START_OPTIONS = {
  lang: 'tr-TR',
  interimResults: true,
  continuous: true,
  maxAlternatives: 1,
  androidIntentOptions: {
    EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 60000,
    EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 60000,
    EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: 60000,
  },
} as const;

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function buildCombinedTranscript(): string {
  const parts = [...finalizedSegments];
  if (liveSegment) parts.push(liveSegment);
  return normalize(parts.join(' '));
}

function pushFinalizedSegment(text: string): void {
  const normalized = normalize(text);
  if (!normalized) return;
  const lastFinal = finalizedSegments[finalizedSegments.length - 1];
  if (normalized === lastFinal) return;
  finalizedSegments.push(normalized);
}

export async function startNativeRecording(
  onTranscribe: (text: string) => void,
  onError?: (errorCode: string, message?: string) => void,
): Promise<void> {
  if (isNativeRecording) return;
  if (!ExpoSpeechRecognitionModule || typeof ExpoSpeechRecognitionModule.start !== 'function') {
    throw new Error('Native STT module not linked. Rebuild the Android dev client.');
  }
  if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
    throw new Error('Native speech recognition is not available on this device.');
  }

  latestTranscript = '';
  finalizedSegments = [];
  liveSegment = '';

  const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Native STT microphone permission not granted.');
  }

  subscriptions.push(
    ExpoSpeechRecognitionModule.addListener('result', (event) => {
      const text = normalize(event.results?.[0]?.transcript ?? '');
      if (!text || /^\[.*\]$/.test(text)) return;
      if (event.isFinal) {
        pushFinalizedSegment(text);
        liveSegment = '';
      } else {
        if (liveSegment && text !== liveSegment) {
          const growsForward = text.startsWith(liveSegment);
          if (!growsForward) pushFinalizedSegment(liveSegment);
        }
        liveSegment = text;
      }
      latestTranscript = buildCombinedTranscript();
      onTranscribe(latestTranscript);
    }),
  );

  subscriptions.push(
    ExpoSpeechRecognitionModule.addListener('error', (event) => {
      console.warn('Native STT error:', event.error, event.message);
      if (event.error === 'no-speech' && liveSegment) {
        pushFinalizedSegment(liveSegment);
        liveSegment = '';
        latestTranscript = buildCombinedTranscript();
        onTranscribe(latestTranscript);
      }
      onError?.(event.error ?? 'unknown', event.message);
    }),
  );

  ExpoSpeechRecognitionModule.start(STT_START_OPTIONS);
  isNativeRecording = true;
  console.log('Native STT started.');
}

export function getLatestNativeTranscript(): string {
  return latestTranscript;
}

export function resetNativeTranscript(): void {
  latestTranscript = '';
  finalizedSegments = [];
  liveSegment = '';
}

export async function stopNativeRecording(): Promise<void> {
  if (!isNativeRecording) return;
  isNativeRecording = false;
  try {
    ExpoSpeechRecognitionModule.stop();
    ExpoSpeechRecognitionModule.abort();
  } catch {
    // no-op
  }
  for (const subscription of subscriptions) {
    try {
      subscription.remove();
    } catch {
      // no-op
    }
  }
  subscriptions = [];
  latestTranscript = buildCombinedTranscript();
  finalizedSegments = [];
  liveSegment = '';
}
