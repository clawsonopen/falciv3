// ============================================================
// FALCI - Configuration Constants
// ============================================================

import type { DevSettings } from '../types';

export const APP_NAME = 'Falcı Ailesi Sezuşgiller';

/** Agent backend API base URL */
export const AGENT_API_URL = 'http://192.168.1.76:8080';

export const FORTUNE_MODELS = [
  { provider: 'gemini', name: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
  { provider: 'openai', name: 'gpt-5-nano', label: 'GPT-5 nano' },
  { provider: 'together', name: 'google/gemma-3n-E4B-it', label: 'Gemma 3n E4B' },
  { provider: 'publicai', name: 'utter-project/EuroLLM-22B-Instruct-2512', label: 'EuroLLM 22B' },
] as const;

/** Image compression settings */
export const IMAGE_MAX_DIMENSION = 768;
export const IMAGE_QUALITY = 0.5; // JPEG quality 0-1

/** Default session duration in seconds (legacy) */
export const DEFAULT_SESSION_DURATION = 300;

/** Wind-down warning threshold in seconds (legacy) */
export const WIND_DOWN_THRESHOLD = 30;

type AssistantPreset = {
  id: string;
  label: string;
  specialty: string;
  tagline: string;
  ttsVoiceName: string;
  ttsInstructions: string;
};

/** Available assistant personas */
export const AVAILABLE_ASSISTANTS: AssistantPreset[] = [
  {
    id: 'durdane-hanim',
    label: 'Dürdane Hanım',
    specialty: 'Kahve Falı',
    tagline: 'Anaç, mahalleli, sıcak ve telveden hikâye çıkarır.',
    ttsVoiceName: 'Gacrux',
    ttsInstructions:
      'Olgun, sıcak, sevecen ve anaç bir Türk kadını gibi konuş. ' +
      'Yavaş, ölçülü ve güven veren bir tempoda kal. ' +
      'Mahalle sıcaklığı olan, biraz dominant ama yumuşak bir ses kullan.',
  },
  {
    id: 'hikmet-bey',
    label: 'Hikmet Bey',
    specialty: 'El Falı',
    tagline: 'Babacan, felsefi ve psikolojik derinliği olan bir yorumcu.',
    ttsVoiceName: 'Kore',
    ttsInstructions:
      'Olgun, sakin ve babacan bir erkek sesiyle konuş. ' +
      'Bir öğretmen gibi toparlayıcı, yumuşak ve güven veren bir ton kullan. ' +
      'Acele etme; her cümleyi net ve sıcak kur.',
  },
  {
    id: 'bahar-hanim',
    label: 'Bahar Hanım',
    specialty: 'Astro Falı',
    tagline: 'Modern astrolog, farkındalık dili yüksek, daha rafine bir enerji.',
    ttsVoiceName: 'Aoede',
    ttsInstructions:
      'Modern, zarif ve enerjisi yüksek bir Türk kadını gibi konuş. ' +
      'Rasyonel ama mistik bir denge kur. ' +
      'Akıcı, temiz ve biraz influencer gibi parlayan bir ton kullan.',
  },
  {
    id: 'mert-bey',
    label: 'Mert Bey',
    specialty: 'Hibrit Modern Yorum',
    tagline: 'Analitik ama sıcak; dost gibi konuşur, yormadan toparlar.',
    ttsVoiceName: 'Zephyr',
    ttsInstructions:
      'Modern, doğal ve sıcak bir Türk erkek sesiyle konuş. ' +
      'Kahve masası sohbeti gibi rahat, akıcı ve yormayan bir ton kullan. ' +
      'Asla vaaz verir gibi değil, yakın bir dost gibi duyul.',
  },
  {
    id: 'caner',
    label: 'Caner',
    specialty: 'Tarot',
    tagline: 'Melankolik, sanatsal, sezgisel ve yumuşak bir tarot enerjisi.',
    ttsVoiceName: 'Leda',
    ttsInstructions:
      'Yumuşak, akışkan ve hafif melankolik bir tonla konuş. ' +
      'Sezgisel, güvenli ve sarıp sarmalayan bir ritim kullan. ' +
      'Cümleler şiir gibi aksın ama anlaşılır ve sıcak kalsın.',
  },
];

export function getAssistantPreset(assistantId: string): AssistantPreset {
  return AVAILABLE_ASSISTANTS.find((assistant) => assistant.id === assistantId) || AVAILABLE_ASSISTANTS[0];
}

export function getAssistantLabel(assistantId: string): string {
  return getAssistantPreset(assistantId).label;
}

export function applyAssistantPreset(
  settings: DevSettings,
  assistantId: string,
): DevSettings {
  const preset = getAssistantPreset(assistantId);
  return {
    ...settings,
    assistantId: preset.id,
    ttsVoiceName: preset.ttsVoiceName,
    ttsInstructions: preset.ttsInstructions,
  };
}

/** Default dev settings */
export const DEFAULT_DEV_SETTINGS: DevSettings = {
  modelProvider: 'gemini',
  modelName: 'gemini-2.5-flash-lite',
  assistantId: 'durdane-hanim',
  temperature: 0.8,
  thinkingBudget: 0,
  ttsInstructions: getAssistantPreset('durdane-hanim').ttsInstructions,
  ttsVoiceName: getAssistantPreset('durdane-hanim').ttsVoiceName,
  systemPrompt:
    'Bu alan geliştirici override içindir. Boş bırakılırsa seçilen assistant identity dosyası ana sistem talimatı olarak kullanılır. ' +
    'Override verirsen mevcut persona davranışını tamamen bozma; sadece ek kısıt veya deney ayarı ekle.',
  inputPrice: 0.1,
  outputPrice: 0.4,
};

/** Available TTS voices (for future persona expansion) */
export const AVAILABLE_VOICES = [
  { id: 'Gacrux', label: 'Gacrux (Mature, confident)' },
  { id: 'Kore', label: 'Kore (Warm, gentle)' },
  { id: 'Aoede', label: 'Aoede (Bright, expressive)' },
  { id: 'Leda', label: 'Leda (Calm, soothing)' },
  { id: 'Zephyr', label: 'Zephyr (Soft, breathy)' },
  { id: 'Puck', label: 'Puck (Energetic, playful)' },
];
