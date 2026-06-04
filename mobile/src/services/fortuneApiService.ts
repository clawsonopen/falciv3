import type { DevSettings } from '../types';
import type { ProfileMemorySnippet } from '../types/memory';
import { generateGeminiTextDirect } from './geminiDirectService';
import { PERSONAL_FOLLOW_UP_MAX_OUTPUT_TOKENS, PERSONAL_INITIAL_READING_MAX_OUTPUT_TOKENS } from '../config/llmTokenPolicy';
import type { SpecificityUsage } from './fortuneSpecificityBank';
import {
  buildFortunePrompt,
  buildCoffeeMultiImageContinuityInstruction,
  type CoffeeImageAnalysis,
  type CoffeeImageSlot,
  type CoffeeMode,
  type FortuneImages,
  type FortuneMessage as BuilderFortuneMessage,
  type FortuneReadingType,
} from './fortunePromptBuilder';
import {
  appendHealthProfessionalReminder,
  sanitizeGenderedAddress,
  sanitizePublicReadingLanguage,
  stripPersonaSelfIntroduction,
} from './personaClosingService';
import { cleanFollowUpReply, getSimpleFollowUpReply } from './followUpResponseService';

export type FortuneMessage = BuilderFortuneMessage;

interface FortuneRequest {
  sessionId: string;
  devSettings: DevSettings;
  profileId: string;
  profileName: string;
  profileIsSelf?: boolean;
  readingType: FortuneReadingType;
  coffeeMode?: CoffeeMode;
  focusQuestion?: string | null;
  memorySnippet?: ProfileMemorySnippet | null;
  messages: FortuneMessage[];
  isFollowUp?: boolean;
  images?: FortuneImages;
}

export interface FortuneReplyResult {
  text: string;
  modelName?: string;
  specificityUsage?: SpecificityUsage;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

type GeminiUsage = FortuneReplyResult['usage'];

const PHOTO_RETRY_MESSAGE =
  'Fotoğraf şu an net okunamadı canım. Işığı biraz artırıp telveyi ya da avuç içini daha yakından göstererek yeniden deneyelim.';
const FRIENDLY_FALLBACK =
  'Bu fotoğraf bu okuma türü için uygun görünmüyor canım. Uygun okuma türünü seçip fotoğrafı yeniden yükleyelim.';
const SURFACE_INITIAL_MIN_OUTPUT_TOKENS: Partial<Record<FortuneReadingType, number>> = {
  coffee: 900,
  palm: 750,
};
const SURFACE_INITIAL_EXPAND_MAX_OUTPUT_TOKENS: Partial<Record<FortuneReadingType, number>> = {
  coffee: 1700,
  palm: 1400,
};

function emptyUsage(): GeminiUsage {
  return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
}

function addUsage(total: GeminiUsage, usage?: Partial<GeminiUsage>) {
  total.inputTokens += Number(usage?.inputTokens || 0);
  total.outputTokens += Number(usage?.outputTokens || 0);
  total.totalTokens += Number(usage?.totalTokens || 0);
}

function friendlyApiMessage(raw?: string | null) {
  const text = (raw || '').trim();
  if (!text) return FRIENDLY_FALLBACK;
  const looksTechnical =
    /Gemini|HTTP|JSON|RuntimeError|Traceback|candidate|generateContent|API|token|exception|returned/i.test(text);
  return looksTechnical ? FRIENDLY_FALLBACK : text;
}

function jsonPayloadError(message: string, usage: GeminiUsage) {
  const error = new Error(message) as Error & {
    tokenUsage?: GeminiUsage;
    isImageValidation?: boolean;
    status?: number;
  };
  error.status = 422;
  error.tokenUsage = usage;
  error.isImageValidation = true;
  return error;
}

function inlineImage(base64: string) {
  return { inline_data: { mime_type: 'image/jpeg', data: base64 } };
}

async function generateJson<T>(payload: Record<string, unknown>, fallback: T): Promise<{ parsed: T; usage: GeminiUsage }> {
  const response = await generateGeminiTextDirect(payload, 45000, { usageMode: 'raw' });
  try {
    return { parsed: JSON.parse(response.text) as T, usage: response.usage };
  } catch {
    return { parsed: fallback, usage: response.usage };
  }
}

type CoffeeClassification = {
  containsCup?: boolean;
  containsSaucer?: boolean;
  hasCoffeeGrounds?: boolean;
  isCoffeeRelevant?: boolean;
  groundsAmount?: 'none' | 'trace' | 'light' | 'visible' | 'heavy';
  confidence?: number;
  suggestedReadingType?: 'coffee' | 'palm' | 'none';
  reason?: string;
};

type PalmClassification = {
  visualType?:
    | 'coffee_cup'
    | 'coffee_saucer'
    | 'coffee_cup_and_saucer'
    | 'human_palm'
    | 'human_hand_back'
    | 'cat_paw'
    | 'dog_paw'
    | 'rabbit_paw'
    | 'bird_foot'
    | 'reptile_foot'
    | 'animal_paw'
    | 'insect'
    | 'flower'
    | 'face'
    | 'landscape'
    | 'other';
  visualLabelTr?: string;
  animalSpecies?: 'cat' | 'dog' | 'rabbit' | 'bird' | 'reptile' | 'other' | 'none';
  confidence?: number;
  isInnerPalm?: boolean;
  handVisibleEnough?: boolean;
};

async function classifyCoffeeImage(imageData: string) {
  const schema = {
    type: 'object',
    properties: {
      containsCup: { type: 'boolean' },
      containsSaucer: { type: 'boolean' },
      hasCoffeeGrounds: { type: 'boolean' },
      isCoffeeRelevant: { type: 'boolean' },
      groundsAmount: { type: 'string', enum: ['none', 'trace', 'light', 'visible', 'heavy'] },
      confidence: { type: 'number' },
      suggestedReadingType: { type: 'string', enum: ['coffee', 'palm', 'none'] },
      reason: { type: 'string' },
    },
    required: ['containsCup', 'containsSaucer', 'hasCoffeeGrounds', 'isCoffeeRelevant', 'groundsAmount', 'confidence', 'suggestedReadingType', 'reason'],
  };
  return generateJson<CoffeeClassification>(
    {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text:
                'Bu görseli kahve yorumu yüzeyi olarak sınıflandır. Görsel hangi teknik yükleme alanından gelirse gelsin fincan, tabak veya fincan+tabak olabilir; yükleme alanı adına göre karar verme. containsCup = fincanın içi, fincan kenarı veya fincan gövdesi yorumlanabilir biçimde görünüyorsa true. containsSaucer = kahve tabağı veya tabak yüzeyi görünüyorsa true; tabakta desen, baskı, marka, çiçek veya süs olması containsSaucer değerini false yapmaz. Aynı görselde fincan ve tabak birlikte varsa ikisini de true yap. hasCoffeeGrounds = fincan veya tabakta kahve telvesi/kalıntısı/leke/akıntı/damla varsa true; bir damla telve bile true. groundsAmount = none, trace, light, visible veya heavy. Işık, açı, gölge, kadraj veya hafif bulanıklık yüzünden tamamen emin olamasan bile fincan/tabak/telve seçiliyorsa kahveye uygun kabul et ve en yakın yüzeyi seç. Desen, baskı veya süsleri telve sayma ama tabak yüzeyi olarak kabul et. Tamamen temiz, telvesiz fincan veya tabakta hasCoffeeGrounds false ve groundsAmount none. isCoffeeRelevant = fincan, tabak veya telve görüyorsan true. confidence = sınıflandırma güvenin 0 ile 1 arasında. suggestedReadingType = görsel açıkça avuç içi ise palm, kahve yüzeyi varsa coffee, hiçbiri değilse none.',
            },
            inlineImage(imageData),
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 100,
        responseMimeType: 'application/json',
        responseJsonSchema: schema,
      },
    },
    { isCoffeeRelevant: false, hasCoffeeGrounds: false, groundsAmount: 'none', confidence: 0, suggestedReadingType: 'none' },
  );
}

const COFFEE_SLOT_LABELS: Record<CoffeeImageSlot, string> = {
  cup: 'Kahve görseli 1',
  cup2: 'Kahve görseli 2',
  saucer: 'Kahve görseli 3',
};

function coffeeSurfaceCode(result: CoffeeClassification): CoffeeImageAnalysis['surfaceCode'] | null {
  if (result.containsCup && result.containsSaucer) return 'fincan+tabak';
  if (result.containsCup) return 'fincan';
  if (result.containsSaucer) return 'tabak';
  return null;
}

function addSurfaceFromCode(surfaces: Array<'cup' | 'saucer'>, surfaceCode: CoffeeImageAnalysis['surfaceCode']) {
  if ((surfaceCode === 'fincan' || surfaceCode === 'fincan+tabak') && !surfaces.includes('cup')) surfaces.push('cup');
  if ((surfaceCode === 'tabak' || surfaceCode === 'fincan+tabak') && !surfaces.includes('saucer')) surfaces.push('saucer');
}

async function validateCoffeeImages(images: FortuneImages) {
  const surfaces: Array<'cup' | 'saucer'> = [];
  const analyses: CoffeeImageAnalysis[] = [];
  const usage = emptyUsage();
  let suggestedPalm = false;
  const rejectedLabels: string[] = [];
  const groundlessLabels: string[] = [];
  const clearlyGroundlessLabels: string[] = [];
  let invalidReason = '';
  let loadedCoffeeImageCount = 0;
  for (const slot of ['cup', 'cup2', 'saucer'] as const) {
    const image = images[slot];
    if (!image) continue;
    loadedCoffeeImageCount += 1;
    let result: CoffeeClassification;
    try {
      const classified = await classifyCoffeeImage(image);
      result = classified.parsed;
      addUsage(usage, classified.usage);
    } catch {
      throw jsonPayloadError(PHOTO_RETRY_MESSAGE, usage);
    }
    let surfaceCode = coffeeSurfaceCode(result);
    const hasGrounds =
      Boolean(result.hasCoffeeGrounds) ||
      Boolean(result.groundsAmount && result.groundsAmount !== 'none');
    const isCoffeeRelevant = Boolean(result.isCoffeeRelevant || surfaceCode || hasGrounds);
    if (!isCoffeeRelevant) {
      suggestedPalm = suggestedPalm || result.suggestedReadingType === 'palm';
      rejectedLabels.push(COFFEE_SLOT_LABELS[slot]);
      invalidReason ||= `${COFFEE_SLOT_LABELS[slot]} kahve yorumu için uygun görünmedi.`;
      continue;
    }
    if (!surfaceCode && hasGrounds && isCoffeeRelevant && result.suggestedReadingType !== 'palm') {
      surfaceCode = 'fincan+tabak';
    }
    if (!surfaceCode) {
      rejectedLabels.push(COFFEE_SLOT_LABELS[slot]);
      invalidReason ||= `${COFFEE_SLOT_LABELS[slot]} fincan, tabak veya fincan+tabak olarak okunamadı.`;
      continue;
    }
    if (!hasGrounds) {
      groundlessLabels.push(COFFEE_SLOT_LABELS[slot]);
      clearlyGroundlessLabels.push(COFFEE_SLOT_LABELS[slot]);
      continue;
    }
    analyses.push({
      slot,
      label: COFFEE_SLOT_LABELS[slot],
      surfaceCode,
      hasCoffeeGrounds: hasGrounds,
      groundsAmount: hasGrounds ? result.groundsAmount || 'visible' : 'none',
    });
    addSurfaceFromCode(surfaces, surfaceCode);
  }
  if (!loadedCoffeeImageCount) {
    throw jsonPayloadError('Kahve yorumu için en az bir telveli kahve görseli yükle.', usage);
  }
  if (rejectedLabels.length) {
    throw jsonPayloadError(
      suggestedPalm
        ? 'Bu görsel kahve telvesinden çok avuç içi gibi görünüyor; kahve yorumu için telveli fincan veya tabak fotoğrafı yükle.'
        : `${rejectedLabels.join(', ')} telveli fincan veya tabak içermiyor. Kahve yorumu için en az bir telve izi görünen fincan ya da tabak fotoğrafını yeniden yükle.`,
      usage,
    );
  }
  if (groundlessLabels.length) {
    throw jsonPayloadError(
      `${groundlessLabels.join(', ')} telvesiz/temiz görünüyor. Kahve yorumu için fincan veya tabakta telve izi, damla, akıntı ya da kalıntı görünen fotoğraf yükle.`,
      usage,
    );
  }
  if (!analyses.length && (invalidReason || suggestedPalm)) {
    throw jsonPayloadError(
      suggestedPalm
        ? 'Bu kare kahve telvesinden çok avuç içi gibi görünüyor; el okuması için ayrı akışa geçebilirsin.'
        : `${invalidReason || 'Lütfen telveyi gösteren uygun kahve görselleri yükle.'}`,
      usage,
    );
  }
  if (!analyses.length && clearlyGroundlessLabels.length) {
    throw jsonPayloadError(
      `${clearlyGroundlessLabels.join(', ')} telvesiz/temiz görünüyor; kahve yorumu için telve izi, damla, akıntı veya kalıntı görünen fotoğraf yükle.`,
      usage,
    );
  }
  if (!surfaces.length) {
    throw jsonPayloadError(
      'Kahve yorumu için uygun bir telveli fincan veya tabak görseli bulamadım. Telveyi daha net gösteren bir kareyle yeniden deneyelim.',
      usage,
    );
  }
  return { surfaces, analyses, usage };
}

async function classifyPalmImage(imageData: string) {
  const schema = {
    type: 'object',
    properties: {
      visualType: {
        type: 'string',
        enum: ['coffee_cup', 'coffee_saucer', 'coffee_cup_and_saucer', 'human_palm', 'human_hand_back', 'cat_paw', 'dog_paw', 'rabbit_paw', 'bird_foot', 'reptile_foot', 'animal_paw', 'insect', 'flower', 'face', 'landscape', 'other'],
      },
      visualLabelTr: { type: 'string' },
      animalSpecies: { type: 'string', enum: ['cat', 'dog', 'rabbit', 'bird', 'reptile', 'other', 'none'] },
      confidence: { type: 'number' },
      isInnerPalm: { type: 'boolean' },
      handVisibleEnough: { type: 'boolean' },
    },
    required: ['visualType', 'visualLabelTr', 'animalSpecies', 'confidence', 'isInnerPalm', 'handVisibleEnough'],
  };
  return generateJson<PalmClassification>(
    {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text:
                "Görseldeki ana nesneyi Türkçe etiketle ve sınıflandır. Kahve fincanı/telvesi, kahve tabağı/telve tabağı, insan avuç içi, insan el sırtı, kedi patisi, köpek patisi, tavşan patisi, kuş ayağı, sürüngen/iguana ayağı, böcek, çiçek gibi ayrımları yap. İnsan eli için isInnerPalm avuç içi görünüyorsa true, handVisibleEnough çizgiler/fotoğraf yorumlamaya yeterliyse true olsun. visualLabelTr kısa ve doğal olsun: 'kahve fincanı', 'fincan tabağı', 'insan avuç içi', 'kedi patisi' gibi.",
            },
            inlineImage(imageData),
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 120,
        responseMimeType: 'application/json',
        responseJsonSchema: schema,
      },
    },
    { visualType: 'other', visualLabelTr: 'uygun olmayan bir görsel', animalSpecies: 'none', confidence: 0 },
  );
}

function isHumanPalmVisual(result: PalmClassification) {
  return result.visualType === 'human_palm' && result.isInnerPalm === true;
}

function isAnimalPawVisual(result: PalmClassification) {
  return ['cat_paw', 'dog_paw', 'rabbit_paw', 'bird_foot', 'reptile_foot', 'animal_paw'].includes(result.visualType || '');
}

function isClearlyDifferentPetSpecies(result: PalmClassification, expectedSpecies: string | null) {
  if (!expectedSpecies || !result.animalSpecies || result.animalSpecies === 'none' || result.animalSpecies === 'other') {
    return false;
  }
  if (result.visualType === 'animal_paw') return false;
  return result.animalSpecies !== expectedSpecies && Number(result.confidence || 0) >= 0.78;
}

function normalizePetSpecies(value?: string | null) {
  const text = (value || '').toLocaleLowerCase('tr-TR');
  if (text.includes('kedi') || text.includes('cat')) return 'cat';
  if (text.includes('köpek') || text.includes('kopek') || text.includes('dog')) return 'dog';
  if (text.includes('tavşan') || text.includes('tavsan') || text.includes('rabbit')) return 'rabbit';
  if (text.includes('kuş') || text.includes('kus') || text.includes('bird') || text.includes('kanarya') || text.includes('papağan')) return 'bird';
  if (text.includes('iguana') || text.includes('sürüngen') || text.includes('surungen') || text.includes('reptile')) return 'reptile';
  return null;
}

function speciesTr(species?: string | null, fallback?: string | null) {
  return {
    cat: 'kedi',
    dog: 'köpek',
    rabbit: 'tavşan',
    bird: 'kuş',
    reptile: 'iguana/sürüngen',
    other: 'evcil hayvan',
  }[species || ''] || fallback || 'evcil hayvan';
}

async function validatePalmImage(images: FortuneImages, memorySnippet?: ProfileMemorySnippet | null) {
  const image = images.palm;
  const usage = emptyUsage();
  if (!image) throw jsonPayloadError('El/pati okuması için fotoğraf gerekli.', usage);
  let result: PalmClassification;
  try {
    const classified = await classifyPalmImage(image);
    result = classified.parsed;
    addUsage(usage, classified.usage);
  } catch {
    throw jsonPayloadError(PHOTO_RETRY_MESSAGE, usage);
  }
  const loadedLabel = result.visualLabelTr || 'uygun olmayan bir görsel';
  const isPet = memorySnippet?.relationshipPrimary === 'evcil_hayvan';
  if (isPet) {
    const expectedSpecies = normalizePetSpecies(memorySnippet?.petSpecies);
    const expectedLabel = speciesTr(expectedSpecies, memorySnippet?.petSpecies);
    if (!isAnimalPawVisual(result)) {
      throw jsonPayloadError(`${memorySnippet?.profileName || 'Bu profil'} için pati okuması istemiştin fakat ${loadedLabel} yükledin. Pati okumasında yalnızca hayvan patisi fotoğrafı kabul edilir; patinin net göründüğü bir ${expectedLabel} fotoğrafıyla yeniden deneyelim.`, usage);
    }
    return { validation: result, usage };
  }
  if (!isHumanPalmVisual(result)) {
    throw jsonPayloadError(`El okuması için yalnızca insan avuç içi kabul edilir; el sırtı, dış yüz veya başka bir görsel yüklenirse okuyamam. Avuç içi çizgilerinin seçildiği net bir fotoğrafla yeniden deneyelim.`, usage);
  }
  return { validation: result, usage };
}

function trimMisalignedTail(text: string, questionText: string) {
  const tail = (text || '').trim().split(/(?<=[.!?])\s+/).slice(-2).join(' ').toLocaleLowerCase('tr-TR');
  const question = (questionText || '').toLocaleLowerCase('tr-TR');
  const mismatch =
    (/(para|finans|kariyer|iş|is|borç|maaş)/.test(question) && /(aşk|sevgili|flört|evlilik)/.test(tail)) ||
    (/(aşk|ask|ilişki|sevgili|evlilik)/.test(question) && /(yatırım|borç|maaş|kredi)/.test(tail)) ||
    (/(sağlık|saglik|uyku|beden|hast)/.test(question) && /(bolluk|bereket|kazanç|yatırım)/.test(tail));
  if (!mismatch) return text;
  const sentences = (text || '').trim().split(/(?<=[.!?])\s+/);
  return sentences.length > 1 ? sentences.slice(0, -1).join(' ').trim() : text;
}

function appendClosing(text: string, closingSentence: string) {
  let cleaned = (text || '').trim();
  if (!closingSentence) return cleaned;
  if (!cleaned) return closingSentence;
  if (cleaned.endsWith(closingSentence)) return cleaned;
  if (!/[.!?]$/.test(cleaned)) cleaned += '.';
  return `${cleaned} ${closingSentence}`;
}

function completeWithRememberedPersonaClosing(params: {
  text: string;
  closingSentence: string;
  messages: FortuneMessage[];
}) {
  const sessionText = params.messages.map((message) => message.text || '').join(' ');
  if (!params.closingSentence || sessionText.includes(params.closingSentence)) return (params.text || '').trim();
  return appendClosing(params.text, params.closingSentence);
}

function sanitizeAffectionateRepetition(text: string) {
  return (text || '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\b(?:INTJ|INTP|ENTJ|ENTP|INFJ|INFP|ENFJ|ENFP|ISTJ|ISFJ|ESTJ|ESFJ|ISTP|ISFP|ESTP|ESFP)\b/gi, 'bu kişilik izi')
    .replace(/\b(canım|tatlım|güzelim|evladım|yavrum)([\s,;:]+\1\b)+/giu, '$1')
    .replace(/\b(canım|tatlım|güzelim|evladım|yavrum),?\s+([^.?!]{0,80}?)\b\1\b/giu, '$1, $2')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function stripRomanticForNonRomanticRelations(text: string, memorySnippet?: ProfileMemorySnippet | null) {
  if (memorySnippet?.relationshipPrimary !== 'arkadas' && memorySnippet?.relationshipPrimary !== 'akraba') return text;
  const kept = text.split(/(?<=[.!?])\s+/).filter((sentence) => sentence && !/\b(aşk|sevgili|flört|romantik|evlilik|ilişki)\b/i.test(sentence));
  return kept.length ? kept.join(' ') : 'Bu profil için duygusal denge, aile ve sosyal çevre odaklı yorumla devam edelim.';
}

function diversifyTimeNumbers(text: string, sessionId: string) {
  const weighted = [3, 3, 3, 6, 6, 6, 4, 4, 5, 5, 2, 7, 1, 8, 9];
  let seenThree = 0;
  const seed = Math.max(1, Array.from(`${sessionId}:${text.length}`).reduce((sum, ch) => sum + ch.charCodeAt(0), 0));
  return text.replace(/\b([1-9])\s+(gün|hafta|ay|vakit|gece|saat)\b/gi, (match, num, unit) => {
    if (num !== '3') return match;
    seenThree += 1;
    if (seenThree <= 1) return match;
    const pick = weighted[(seed + seenThree) % weighted.length] || 4;
    return `${pick === 3 ? 4 : pick} ${unit}`;
  });
}

function stripExplicitAstroLeaks(text: string, readingType: FortuneReadingType) {
  if (readingType !== 'coffee' && readingType !== 'palm') return text;
  const sentences = (text || '').trim().split(/(?<=[.!?])\s+/);
  const kept = sentences.filter(
    (sentence) =>
      !/\b(burç|burcu|yükselen|yukselen|doğum haritası|dogum haritasi|güneş burcu|gunes burcu|ay burcu)\b/i.test(
        sentence,
      ),
  );
  return kept.length >= Math.max(2, Math.floor(sentences.length * 0.45)) ? kept.join(' ').trim() : text;
}

function stripUnaskedPaceTheme(text: string, messages: FortuneMessage[]) {
  const sessionText = messages.map((message) => message.text || '').join(' ');
  if (/\b(telaş|acele|yetiş|yetişem|panik|koştur|koşuştur)\b/i.test(sessionText)) return text;
  const sentences = (text || '').trim().split(/(?<=[.!?])\s+/);
  const kept = sentences.filter((sentence) => !/\b(telaş|acele|yetiş|yetişem|panik|koştur|koşuştur)\b/i.test(sentence));
  return kept.length >= Math.max(2, Math.floor(sentences.length * 0.55)) ? kept.join(' ').trim() : text;
}

function stripFollowUpReopeners(text: string) {
  const sentences = (text || '').trim().split(/(?<=[.!?])\s+/).filter(Boolean);
  if (!sentences.length) return text;
  const openerPattern =
    /\b(hoş\s*geldin|hoş\s*gelmişsin|bakalım|bakıyorum|hemen\s+bak|telven|fincanına\s+bak|yorumuna\s+bak|yeniden\s+bak|baştan\s+aç|genel\s+enerji)\b/i;
  while (sentences.length > 1 && openerPattern.test(sentences[0])) {
    sentences.shift();
  }
  return sentences.join(' ').trim() || text;
}

function looksLikeImageRetryRequest(text: string, readingType: FortuneReadingType) {
  const normalized = (text || '').toLocaleLowerCase('tr-TR');
  const asksUpload = /\b(fotoğraf|görsel|yükle|gönder)\b/.test(normalized);
  if (!asksUpload) return false;
  if (readingType === 'coffee') {
    return /\b(telve|fincan|tabak|kahve)\b/.test(normalized);
  }
  return /\b(avuç|el|pati|ayak)\b/.test(normalized);
}

function compactImageRetryReply(text: string, readingType: FortuneReadingType) {
  if (!looksLikeImageRetryRequest(text, readingType)) return text;
  const sentences = (text || '').trim().split(/(?<=[.!?])\s+/).filter(Boolean);
  const useful = sentences.filter((sentence) =>
    /\b(fotoğraf|görsel|yükle|gönder|telve|fincan|tabak|avuç|pati|ayak)\b/i.test(sentence),
  );
  return (useful.length ? useful : sentences).slice(0, 2).join(' ').trim() || text;
}

function shouldExpandInitialSurfaceReading(params: {
  readingType: FortuneReadingType;
  coffeeMode?: CoffeeMode;
  isFollowUp?: boolean;
  outputTokens: number;
  text: string;
}) {
  if (params.isFollowUp) return false;
  if (params.readingType === 'coffee' && (params.coffeeMode || 'upload') !== 'upload') return false;
  const minTokens = SURFACE_INITIAL_MIN_OUTPUT_TOKENS[params.readingType];
  if (!minTokens) return false;
  const paragraphCount = (params.text || '').split(/\n\s*\n/).filter((part) => part.trim().length > 40).length;
  return params.outputTokens > 0 && (params.outputTokens < minTokens || paragraphCount < 5);
}

async function expandShortInitialSurfaceReading(params: {
  prompt: string;
  draftText: string;
  readingType: FortuneReadingType;
  devSettings: DevSettings;
}) {
  const target = params.readingType === 'coffee' ? '1400-1700' : '1000-1400';
  return generateGeminiTextDirect(
    {
      system_instruction: {
        parts: [
          {
            text:
              `${params.prompt}\n\n` +
              'Internal length repair: Aşağıdaki ilk taslak kullanıcı için kısa kaldı. Aynı dili, aynı persona sesini ve aynı görsel kanıt mantığını koruyarak metni baştan yaz. ' +
              `Metni ${target} ham Gemini output token aralığına yaklaştır; tekrar, liste, başlık, markdown ve yeni kesin iddia üretme. ` +
              'Önceki metindeki somut gözlemleri koru, geçişleri doğal uzat, geçmiş-şimdi-yakın dönem ve uygulanabilir öneri dengesini tamamla.',
          },
        ],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: `İlk kısa taslak:\n${params.draftText}` }],
        },
      ],
      generationConfig: {
        temperature: Number(params.devSettings.temperature || 0.8),
        maxOutputTokens: SURFACE_INITIAL_EXPAND_MAX_OUTPUT_TOKENS[params.readingType] || PERSONAL_INITIAL_READING_MAX_OUTPUT_TOKENS,
      },
    },
    45000,
    { usageMode: 'raw' },
  );
}

function cleanFortuneText(params: {
  text: string;
  closingSentence: string;
  messages: FortuneMessage[];
  memorySnippet?: ProfileMemorySnippet | null;
  devSettings: DevSettings;
  sessionId: string;
  readingType: FortuneReadingType;
  isFollowUp?: boolean;
  focusQuestion?: string | null;
}) {
  const lastUserText = [...params.messages].reverse().find((message) => message.role !== 'assistant')?.text || '';
  const userHealthSource = [params.focusQuestion || '', lastUserText].join(' ');
  const aligned = trimMisalignedTail(params.text, lastUserText);
  const noAstroLeak = stripExplicitAstroLeaks(aligned, params.readingType);
  const noPaceLoop = stripUnaskedPaceTheme(noAstroLeak, params.messages);
  const noReopener = params.isFollowUp ? stripFollowUpReopeners(noPaceLoop) : noPaceLoop;
  const retryCompact = compactImageRetryReply(noReopener, params.readingType);
  const withClosing = looksLikeImageRetryRequest(retryCompact, params.readingType)
    ? retryCompact
    : completeWithRememberedPersonaClosing({
        text: retryCompact,
        closingSentence: params.closingSentence,
        messages: params.messages,
      });
  const addressed = sanitizeGenderedAddress(withClosing, {
    assistantId: params.devSettings.assistantId,
    memorySnippet: params.memorySnippet,
  });
  const nonRomantic = stripRomanticForNonRomanticRelations(addressed, params.memorySnippet);
  const noRepeat = sanitizeAffectionateRepetition(nonRomantic);
  const publicSafe = sanitizePublicReadingLanguage(stripPersonaSelfIntroduction(noRepeat));
  const healthSafe = appendHealthProfessionalReminder(publicSafe, {
    userText: userHealthSource,
    isAnimalProfile: params.memorySnippet?.relationshipPrimary === 'evcil_hayvan',
  });
  return diversifyTimeNumbers(healthSafe, params.sessionId);
}

function buildContents(params: {
  messages: FortuneMessage[];
  images: FortuneImages;
  isFollowUp?: boolean;
  readingType: FortuneReadingType;
  validatedSurfaces?: Array<'cup' | 'saucer' | 'palm'>;
  coffeeImageAnalyses?: CoffeeImageAnalysis[] | null;
  memorySnippet?: ProfileMemorySnippet | null;
}) {
  const contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = params.messages
    .filter((message) => message.text?.trim())
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.text.trim() }],
    }));
  if (params.isFollowUp) return contents;
  if (params.readingType === 'palm' && params.images.palm) {
    const isPet = params.memorySnippet?.relationshipPrimary === 'evcil_hayvan';
    contents.unshift({
      role: 'user',
      parts: [
        { text: isPet ? 'Bu evcil hayvan pati görselini inceleyip pati okumasına devam et. İnsan eli gibi yorumlama.' : 'Bu insan eli/avuç içi görselini inceleyip el okumasına devam et.' },
        inlineImage(params.images.palm),
      ],
    });
  } else if (params.images.cup || params.images.cup2 || params.images.saucer) {
    const surfaces = params.validatedSurfaces || [];
    const validSlots = new Set((params.coffeeImageAnalyses || []).map((item) => item.slot));
    const hasSlotAudit = validSlots.size > 0;
    const includeCup = Boolean(params.images.cup && (hasSlotAudit ? validSlots.has('cup') : !surfaces.length || surfaces.includes('cup')));
    const includeCup2 = Boolean(params.images.cup2 && (hasSlotAudit ? validSlots.has('cup2') : !surfaces.length || surfaces.includes('cup') || surfaces.includes('saucer')));
    const includeSaucer = Boolean(params.images.saucer && (hasSlotAudit ? validSlots.has('saucer') : !surfaces.length || surfaces.includes('saucer')));
    const promptText =
      surfaces.length === 1 && surfaces[0] === 'cup'
        ? 'Yalnızca fincan içi görselini inceleyip yoruma devam et.'
        : surfaces.length === 1 && surfaces[0] === 'saucer'
          ? 'Yalnızca kahve tabağı görselini inceleyip yoruma devam et.'
          : surfaces.length
            ? 'Doğrulanmış fincan ve/veya tabak görsellerini inceleyip yoruma devam et.'
            : 'Yüklenen kahve görsellerini doğrudan inceleyip yoruma devam et; teknik slot adlarına göre değil, görselde ne görüyorsan ona göre oku.';
    const parts: Array<Record<string, unknown>> = [{ text: [promptText, buildCoffeeMultiImageContinuityInstruction(params.images)].filter(Boolean).join('\n') }];
    if (includeCup && params.images.cup) {
      parts.push({ text: 'Kahve görseli 1 yüklendi. Bu teknik slot fincan, tabak veya fincan+tabak olabilir; doğrulanmış yüzeye göre oku.' });
      parts.push(inlineImage(params.images.cup));
    }
    if (includeCup2 && params.images.cup2) {
      parts.push({ text: 'Kahve görseli 2 yüklendi. Bu aynı kahvenin farklı açısı olabilir; ayrı kahve ya da ikinci fincan gibi anlatma.' });
      parts.push(inlineImage(params.images.cup2));
    }
    if (includeSaucer && params.images.saucer) {
      parts.push({ text: 'Kahve görseli 3 yüklendi. Bu teknik slot fincan, tabak veya fincan+tabak olabilir; doğrulanmış yüzeye göre oku.' });
      parts.push(inlineImage(params.images.saucer));
    }
    contents.unshift({ role: 'user', parts });
  }
  return contents;
}

export async function getFortuneReply(body: FortuneRequest): Promise<FortuneReplyResult> {
  const usage = emptyUsage();
  const images = body.images || {};
  try {
    let validatedSurfaces: Array<'cup' | 'saucer' | 'palm'> | null = null;
    let coffeeImageAnalyses: CoffeeImageAnalysis[] | null = null;
    let palmValidation: PalmClassification | null = null;
    if (!body.isFollowUp && body.readingType === 'coffee' && (body.coffeeMode || 'upload') === 'upload') {
      const result = await validateCoffeeImages(images);
      addUsage(usage, result.usage);
      validatedSurfaces = result.surfaces;
      coffeeImageAnalyses = result.analyses;
    } else if (!body.isFollowUp && body.readingType === 'palm') {
      const result = await validatePalmImage(images, body.memorySnippet);
      addUsage(usage, result.usage);
      validatedSurfaces = ['palm'];
      palmValidation = result.validation;
    }
    const prompt = buildFortunePrompt({
      sessionId: body.sessionId,
      devSettings: body.devSettings,
      profileName: body.profileName,
      readingType: body.readingType,
      coffeeMode: body.coffeeMode || 'upload',
      focusQuestion: body.focusQuestion,
      memorySnippet: body.memorySnippet,
      messages: body.messages,
      images,
      isFollowUp: body.isFollowUp,
      validatedSurfaces,
      coffeeImageAnalyses,
      palmValidation,
    });
    const response = await generateGeminiTextDirect(
      {
        system_instruction: { parts: [{ text: prompt.systemInstruction }] },
        contents: buildContents({
          messages: body.messages,
          images,
          isFollowUp: body.isFollowUp,
          readingType: body.readingType,
          validatedSurfaces: validatedSurfaces || undefined,
          coffeeImageAnalyses,
          memorySnippet: body.memorySnippet,
        }),
        generationConfig: {
          temperature: Number(body.devSettings.temperature || 0.8),
          maxOutputTokens: body.isFollowUp ? PERSONAL_FOLLOW_UP_MAX_OUTPUT_TOKENS : PERSONAL_INITIAL_READING_MAX_OUTPUT_TOKENS,
        },
      },
      45000,
      { usageMode: 'raw' },
    );
    addUsage(usage, response.usage);
    let rawReplyText = response.text;
    let modelName = response.model;
    if (
      !looksLikeImageRetryRequest(response.text, body.readingType) &&
      shouldExpandInitialSurfaceReading({
        readingType: body.readingType,
        coffeeMode: body.coffeeMode || 'upload',
        isFollowUp: body.isFollowUp,
        outputTokens: response.usage.outputTokens,
        text: response.text,
      })
    ) {
      const expanded = await expandShortInitialSurfaceReading({
        prompt: prompt.systemInstruction,
        draftText: response.text,
        readingType: body.readingType,
        devSettings: body.devSettings,
      });
      addUsage(usage, expanded.usage);
      rawReplyText = expanded.text;
      modelName = expanded.model || modelName;
    }
    const simpleFollowUp = body.isFollowUp
      ? getSimpleFollowUpReply([...body.messages].reverse().find((message) => message.role === 'user')?.text || '')
      : '';
    const responseText = simpleFollowUp || (body.isFollowUp ? cleanFollowUpReply(rawReplyText) : rawReplyText);
    return {
      text: cleanFortuneText({
        text: responseText,
        closingSentence: prompt.closingSentence,
        messages: body.messages,
        memorySnippet: body.memorySnippet,
        devSettings: body.devSettings,
        sessionId: body.sessionId,
        readingType: body.readingType,
        isFollowUp: body.isFollowUp,
        focusQuestion: body.focusQuestion,
      }),
      modelName,
      specificityUsage: prompt.specificityUsage,
      usage,
    };
  } catch (err: any) {
    if (err?.isImageValidation) throw err;
    const error = new Error(friendlyApiMessage(err?.message)) as Error & {
      tokenUsage?: GeminiUsage;
      isImageValidation?: boolean;
      status?: number;
    };
    error.status = err?.status;
    error.tokenUsage = usage;
    throw error;
  }
}
