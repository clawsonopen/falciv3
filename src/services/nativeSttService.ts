import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

let isNativeRecording = false;
let latestTranscript = '';
let subscriptions: Array<{ remove: () => void }> = [];

function normalize(text: string): string {
  return text.trim();
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

  const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Native STT microphone permission not granted.');
  }

  subscriptions.push(
    ExpoSpeechRecognitionModule.addListener('result', (event) => {
      const text = normalize(event.results?.[0]?.transcript ?? '');
      if (!text || /^\[.*\]$/.test(text)) return;
      latestTranscript = text;
      onTranscribe(text);
    }),
  );

  subscriptions.push(
    ExpoSpeechRecognitionModule.addListener('error', (event) => {
      console.warn('Native STT error:', event.error, event.message);
      onError?.(event.error ?? 'unknown', event.message);
    }),
  );

  ExpoSpeechRecognitionModule.start({
    lang: 'tr-TR',
    interimResults: true,
    continuous: true,
  });
  isNativeRecording = true;
  console.log('Native STT started.');
}

export function getLatestNativeTranscript(): string {
  return latestTranscript;
}

export function resetNativeTranscript(): void {
  latestTranscript = '';
}

export async function stopNativeRecording(): Promise<void> {
  if (!isNativeRecording) return;
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
  isNativeRecording = false;
  latestTranscript = '';
}
