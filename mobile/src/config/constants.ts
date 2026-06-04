// ============================================================
// FALCI - Configuration Constants
// ============================================================

import type { DevSettings } from '../types';

export const APP_NAME = 'Ruhbaz';

declare const process: { env?: Record<string, string | undefined> } | undefined;

/** Agent backend API base URL */
export const AGENT_API_URL =
  process?.env?.EXPO_PUBLIC_AGENT_API_URL?.replace(/\/+$/, '') || 'http://127.0.0.1:8080';

/** Image compression settings */
export const IMAGE_MAX_DIMENSION = 768;
export const IMAGE_QUALITY = 0.5; // JPEG quality 0-1
export const WIND_DOWN_THRESHOLD = 10;

type AssistantPreset = {
  id: string;
  label: string;
  specialty: string;
  tagline: string;
  ttsVoiceName: string;
  ttsInstructions: string;
};

const ASSISTANT_ID_ALIASES: Record<string, string> = {
  'durdane-hanim': 'suzan',
  'hikmet-bey': 'teoman',
  'bahar-hanim': 'selin',
  'mert-bey': 'berk',
  caner: 'arin',
};

export function normalizeAssistantId(assistantId?: string | null): string {
  if (!assistantId) return 'suzan';
  return ASSISTANT_ID_ALIASES[assistantId] || assistantId;
}

/** Available assistant personas */
export const AVAILABLE_ASSISTANTS: AssistantPreset[] = [
  {
    id: 'suzan',
    label: 'Suzan',
    specialty: 'Kahve Yorumu',
    tagline: 'Anaç, dobra, koruyucu ve telveden hikâye çıkarır.',
    ttsVoiceName: 'Gacrux',
    ttsInstructions:
      'Olgun, sıcak, sevecen ve anaç bir Türk kadını gibi konuş. ' +
      'Yavaş, ölçülü ve güven veren bir tempoda kal. ' +
      'Mahalle sıcaklığı olan, biraz dominant ama yumuşak bir ses kullan.',
  },
  {
    id: 'teoman',
    label: 'Teoman',
    specialty: 'El Okuması',
    tagline: 'Babacan, felsefi ve psikolojik derinliği olan bir yorumcu.',
    ttsVoiceName: 'Kore',
    ttsInstructions:
      'Olgun, sakin ve babacan bir erkek sesiyle konuş. ' +
      'Bir öğretmen gibi toparlayıcı, yumuşak ve güven veren bir ton kullan. ' +
      'Acele etme; her cümleyi net ve sıcak kur.',
  },
  {
    id: 'selin',
    label: 'Selin',
    specialty: 'Astroloji Yorumu',
    tagline: 'Modern astrolog, farkındalık dili yüksek, daha rafine bir enerji.',
    ttsVoiceName: 'Aoede',
    ttsInstructions:
      'Modern, zarif ve enerjisi yüksek bir Türk kadını gibi konuş. ' +
      'Rasyonel ama mistik bir denge kur. ' +
      'Akıcı, temiz ve biraz influencer gibi parlayan bir ton kullan.',
  },
  {
    id: 'berk',
    label: 'Berk',
    specialty: 'Hibrit Modern Yorum',
    tagline: 'Analitik ama sıcak; dost gibi konuşur, yormadan toparlar.',
    ttsVoiceName: 'Zephyr',
    ttsInstructions:
      'Modern, doğal ve sıcak bir Türk erkek sesiyle konuş. ' +
      'Kahve masası sohbeti gibi rahat, akıcı ve yormayan bir ton kullan. ' +
      'Asla vaaz verir gibi değil, yakın bir dost gibi duyul.',
  },
  {
    id: 'arin',
    label: 'Arın',
    specialty: 'Tarot',
    tagline: 'Melankolik, sanatsal, sezgisel ve yumuşak bir tarot enerjisi.',
    ttsVoiceName: 'Leda',
    ttsInstructions:
      'Yumuşak, akışkan ve hafif melankolik bir tonla konuş. ' +
      'Sezgisel, güvenli ve sarıp sarmalayan bir ritim kullan. ' +
      'Cümleler şiir gibi aksın ama anlaşılır ve sıcak kalsın.',
  },
  {
    id: 'ayse',
    label: 'Ayşe',
    specialty: 'Doğa ve Şefkat Bilgeliği',
    tagline: 'Toprak, sabır, bereket ve şefkat dilinden konuşur.',
    ttsVoiceName: 'Kore',
    ttsInstructions:
      'Yaşça olgun, çok sakin, şefkatli ve bilge bir Türk kadını gibi konuş. ' +
      'Acele etme; doğa, sabır ve iç huzur hissini sesinde taşı. ' +
      'Yumuşak ama sağlam bir güven duygusu ver.',
  },
  {
    id: 'deniz',
    label: 'Deniz',
    specialty: 'Sosyal Dinamik Okuması',
    tagline: 'Kıpır kıpır, sezgisel, dedikoducu kanka enerjisiyle sosyal alt metni okur.',
    ttsVoiceName: 'Puck',
    ttsInstructions:
      'Enerjik, zeki, feminen ve samimi bir Türkçe konuşma tonu kullan. ' +
      'Yakın arkadaş gibi kıvrak, eğlenceli ve net ol. ' +
      'Kırılgan konularda hızını düşürüp şefkatli kal.',
  },
];

export function getAssistantPreset(assistantId: string): AssistantPreset {
  const normalizedId = normalizeAssistantId(assistantId);
  return AVAILABLE_ASSISTANTS.find((assistant) => assistant.id === normalizedId) || AVAILABLE_ASSISTANTS[0];
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
  assistantId: 'suzan',
  temperature: 0.8,
  thinkingBudget: 0,
  ttsInstructions: getAssistantPreset('suzan').ttsInstructions,
  ttsVoiceName: getAssistantPreset('suzan').ttsVoiceName,
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
