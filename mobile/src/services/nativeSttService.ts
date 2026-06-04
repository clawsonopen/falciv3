// Statik import kaldırıldı, dinamik olarak yüklenecek
let NativeModule: any = null;
try {
  NativeModule = require('expo-speech-recognition').ExpoSpeechRecognitionModule;
} catch (e) {
  console.log('Ses tanıma modülü yüklenemedi (Muhtemelen iOS Expo Go veya eksik build).');
}

const ExpoSpeechRecognitionModule = NativeModule || null;

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
  return collapseDuplicateTranscript(text.replace(/\s+/g, ' ').trim());
}

function collapseDuplicateTranscript(text: string): string {
  const words = text.split(' ').filter(Boolean);
  if (words.length < 4 || words.length % 2 !== 0) return text;
  const half = words.length / 2;
  const left = words.slice(0, half).join(' ').toLocaleLowerCase('tr-TR');
  const right = words.slice(half).join(' ').toLocaleLowerCase('tr-TR');
  return left === right ? words.slice(0, half).join(' ') : text;
}

function buildCombinedTranscript(): string {
  const parts = [...finalizedSegments];
  if (liveSegment) parts.push(liveSegment);
  return normalize(parts.join(' '));
}

function finalizedText(): string {
  return normalize(finalizedSegments.join(' '));
}

function liveTextFromRecognizer(text: string): string {
  const normalized = normalize(text);
  const finalized = finalizedText();
  if (!finalized) return normalized;
  if (normalized === finalized || finalized.endsWith(normalized)) return '';
  if (normalized.startsWith(finalized)) return normalize(normalized.slice(finalized.length));
  return normalized;
}

function pushFinalizedSegment(text: string): void {
  const normalized = normalize(text);
  if (!normalized) return;
  const finalized = finalizedText();
  if (finalized) {
    if (normalized === finalized || finalized.endsWith(normalized)) return;
    if (normalized.startsWith(finalized)) {
      const rest = normalize(normalized.slice(finalized.length));
      if (rest) finalizedSegments.push(rest);
      return;
    }
  }
  const lastFinal = finalizedSegments[finalizedSegments.length - 1];
  if (normalized === lastFinal) return;
  if (lastFinal && normalized.startsWith(lastFinal)) {
    finalizedSegments[finalizedSegments.length - 1] = normalized;
    return;
  }
  finalizedSegments.push(normalized);
}

// STT'nin kullanılabilir olup olmadığını kontrol eden yardımcı fonksiyon
export function isSTTAvailable(): boolean {
  try {
    return !!(ExpoSpeechRecognitionModule && typeof ExpoSpeechRecognitionModule.isRecognitionAvailable === 'function' && ExpoSpeechRecognitionModule.isRecognitionAvailable());
  } catch {
    return false;
  }
}

export async function startNativeRecording(
  onTranscribe: (text: string) => void,
  onError?: (errorCode: string, message?: string) => void,
): Promise<void> {
  if (isNativeRecording) return;
  
  if (!ExpoSpeechRecognitionModule) {
    throw new Error('Ses tanıma modülü bu cihazda yüklü değil. (iOS Expo Go kısıtlaması olabilir)');
  }

  if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
    throw new Error('Bu cihazda ses tanıma özelliği şu an kullanılamıyor.');
  }

  latestTranscript = '';
  finalizedSegments = [];
  liveSegment = '';

  try {
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Mikrofon izni verilmedi.');
    }

    subscriptions.push(
      ExpoSpeechRecognitionModule.addListener('result', (event: any) => {
        const text = normalize(event.results?.[0]?.transcript ?? '');
        if (!text || /^\[.*\]$/.test(text)) return;
        if (event.isFinal) {
          pushFinalizedSegment(text);
          liveSegment = '';
        } else {
          liveSegment = liveTextFromRecognizer(text);
        }
        latestTranscript = buildCombinedTranscript();
        onTranscribe(latestTranscript);
      }),
    );

    subscriptions.push(
      ExpoSpeechRecognitionModule.addListener('error', (event: any) => {
        console.warn('Native STT hatası:', event.error, event.message);
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
    console.log('Ses tanıma başlatıldı.');
  } catch (err: any) {
    console.error('STT Başlatma Hatası:', err);
    throw err;
  }
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
  if (!isNativeRecording || !ExpoSpeechRecognitionModule) return;
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
