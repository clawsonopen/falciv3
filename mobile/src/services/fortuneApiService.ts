import type { DevSettings } from '../types';
import type { ProfileMemorySnippet } from '../types/memory';
import { generateGeminiTextDirect } from './geminiDirectService';
import { buildFortunePrompt, type CoffeeMode, type FortuneImages, type FortuneMessage as BuilderFortuneMessage, type FortuneReadingType } from './fortunePromptBuilder';

export type FortuneMessage = BuilderFortuneMessage;

interface FortuneRequest {
  sessionId: string;
  devSettings: DevSettings;
  profileId: string;
  profileName: string;
  profileIsSelf?: boolean;
  readingType: FortuneReadingType;
  coffeeMode?: CoffeeMode;
  memorySnippet?: ProfileMemorySnippet | null;
  messages: FortuneMessage[];
  isFollowUp?: boolean;
  images?: FortuneImages;
}

export interface FortuneReplyResult {
  text: string;
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
  'Bu fotoğraf bu fal türü için uygun görünmüyor canım. Uygun fal türünü seçip fotoğrafı yeniden yükleyelim.';

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
  const response = await generateGeminiTextDirect(payload);
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
      suggestedReadingType: { type: 'string', enum: ['coffee', 'palm', 'none'] },
      reason: { type: 'string' },
    },
    required: ['containsCup', 'containsSaucer', 'hasCoffeeGrounds', 'isCoffeeRelevant', 'suggestedReadingType', 'reason'],
  };
  return generateJson<CoffeeClassification>(
    {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text:
                'Bu görseli kahve falı yüzeyi olarak sınıflandır. containsCup = fincan içi net görünüyorsa true. containsSaucer = kahve tabağı veya tabak yüzeyi net görünüyorsa true. Aynı görselde ikisi birden varsa ikisini de true yap. hasCoffeeGrounds = fincan veya tabakta kahve telvesi/kalıntısı/leke/akıntı/damla varsa true; bir damla telve bile true. Tamamen temiz, telvesiz fincan veya tabakta false. isCoffeeRelevant = görsel kahve falıyla alakalıysa true. suggestedReadingType = görsel daha çok avuç içi ise palm, kahveye uygunsa coffee, hiçbiri değilse none.',
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
    { isCoffeeRelevant: false, hasCoffeeGrounds: false, suggestedReadingType: 'none' },
  );
}

async function validateCoffeeImages(images: FortuneImages) {
  const surfaces: Array<'cup' | 'saucer'> = [];
  const usage = emptyUsage();
  let suggestedPalm = false;
  let sawCoffeeSurfaceWithoutGrounds = false;
  for (const slot of ['cup', 'saucer'] as const) {
    const image = images[slot];
    if (!image) continue;
    let result: CoffeeClassification;
    try {
      const classified = await classifyCoffeeImage(image);
      result = classified.parsed;
      addUsage(usage, classified.usage);
    } catch {
      throw jsonPayloadError(PHOTO_RETRY_MESSAGE, usage);
    }
    if (!result.isCoffeeRelevant) {
      suggestedPalm = suggestedPalm || result.suggestedReadingType === 'palm';
      throw jsonPayloadError(
        suggestedPalm
          ? "Bu kare kahve telvesinden çok avuç içi gibi görünüyor. İstersen El Falı'na geçip aynı fotoğrafla devam edebilirsin."
          : 'Bu kare kahve falı için uygun görünmüyor canım. Telveyi net gösteren fincan içi ya da tabak fotoğrafı yüklersen birlikte devam ederiz.',
        usage,
      );
    }
    if (!result.hasCoffeeGrounds) {
      sawCoffeeSurfaceWithoutGrounds = true;
      continue;
    }
    if (result.containsCup && !surfaces.includes('cup')) surfaces.push('cup');
    if (result.containsSaucer && !surfaces.includes('saucer')) surfaces.push('saucer');
  }
  if (!surfaces.length) {
    throw jsonPayloadError(
      sawCoffeeSurfaceWithoutGrounds
        ? 'Bu fincan veya tabakta telve görünmüyor canım. Kahve falı için en azından küçük bir telve izi, damla ya da akıntı görünmeli.'
        : 'Kahve falı için uygun bir fincan içi veya tabak görseli bulamadım canım. Telveyi daha net gösteren bir kareyle yeniden deneyelim.',
      usage,
    );
  }
  return { surfaces, usage };
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

function isHumanHandVisual(result: PalmClassification) {
  return result.visualType === 'human_palm';
}

function isAnimalPawVisual(result: PalmClassification) {
  return ['cat_paw', 'dog_paw', 'rabbit_paw', 'bird_foot', 'reptile_foot', 'animal_paw'].includes(result.visualType || '');
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
  if (!image) throw jsonPayloadError('El falı için fotoğraf gerekli.', usage);
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
      throw jsonPayloadError(`${memorySnippet?.profileName || 'Bu profil'} için pati falı istemiştin fakat ${loadedLabel} yükledin. Lütfen ${expectedLabel} patisi fotoğrafı yükle.`, usage);
    }
    if (expectedSpecies && result.animalSpecies !== expectedSpecies) {
      throw jsonPayloadError(`${memorySnippet?.profileName || 'Bu profil'} için pati falı istemiştin; profil ${expectedLabel} olarak kayıtlı fakat ${speciesTr(result.animalSpecies)} patisi yükledin. Lütfen ${expectedLabel} patisi fotoğrafı yükle.`, usage);
    }
    return { validation: result, usage };
  }
  if (!isHumanHandVisual(result)) {
    throw jsonPayloadError(`El falı istemiştin fakat ${loadedLabel} yükledin. Lütfen avuç içi fotoğrafı yükle.`, usage);
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

function canUseFamilyAddress(devSettings: DevSettings, memorySnippet?: ProfileMemorySnippet | null) {
  const assistantAge = { 'durdane-hanim': 58, 'hikmet-bey': 60, 'bahar-hanim': 34, 'mert-bey': 36, caner: 29 }[devSettings.assistantId || ''];
  const birthDate = memorySnippet?.birthChartData?.birthDate || '';
  const match = birthDate.match(/^(\d{4})-\d{2}-\d{2}$/);
  const profileAge = match ? new Date().getFullYear() - Number(match[1]) : null;
  return Boolean(['durdane-hanim', 'hikmet-bey'].includes(devSettings.assistantId) && assistantAge && profileAge && assistantAge - profileAge >= 10);
}

function sanitizeGenderedAddress(text: string, memorySnippet: ProfileMemorySnippet | null | undefined, devSettings: DevSettings) {
  const feminineTerms: Record<string, string> = { 'güzel kızım': 'güzel evladım', kızım: 'evladım', 'güzel kız': 'güzel evlat' };
  const masculineTerms: Record<string, string> = { 'güzel oğlum': 'güzel evladım', oğlum: 'evladım', 'güzel oğlan': 'güzel evlat' };
  const familyTerms: Record<string, string> = { yavrum: 'canım', evladım: 'canım', 'güzel evladım': 'canım' };
  let replacements: Record<string, string> = {};
  if (memorySnippet?.profileGender === 'erkek') replacements = feminineTerms;
  else if (memorySnippet?.profileGender === 'kadin') replacements = masculineTerms;
  else if (memorySnippet?.profileGender === 'hicbiri' || memorySnippet?.profileGender === 'belirtmek_istemiyorum') replacements = { ...feminineTerms, ...masculineTerms };
  if (!canUseFamilyAddress(devSettings, memorySnippet)) replacements = { ...replacements, ...feminineTerms, ...masculineTerms, ...familyTerms };
  let cleaned = text;
  Object.entries(replacements).forEach(([source, target]) => {
    cleaned = cleaned.replace(new RegExp(source, 'g'), target);
    cleaned = cleaned.replace(new RegExp(source.charAt(0).toLocaleUpperCase('tr-TR') + source.slice(1), 'g'), target.charAt(0).toLocaleUpperCase('tr-TR') + target.slice(1));
  });
  return cleaned;
}

function sanitizeAffectionateRepetition(text: string) {
  return (text || '')
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

function cleanFortuneText(params: {
  text: string;
  closingSentence: string;
  messages: FortuneMessage[];
  memorySnippet?: ProfileMemorySnippet | null;
  devSettings: DevSettings;
  sessionId: string;
  readingType: FortuneReadingType;
}) {
  const lastUserText = [...params.messages].reverse().find((message) => message.role !== 'assistant')?.text || '';
  const aligned = trimMisalignedTail(params.text, lastUserText);
  const noAstroLeak = stripExplicitAstroLeaks(aligned, params.readingType);
  const noPaceLoop = stripUnaskedPaceTheme(noAstroLeak, params.messages);
  const withClosing = appendClosing(noPaceLoop, params.closingSentence);
  const addressed = sanitizeGenderedAddress(withClosing, params.memorySnippet, params.devSettings);
  const nonRomantic = stripRomanticForNonRomanticRelations(addressed, params.memorySnippet);
  const noRepeat = sanitizeAffectionateRepetition(nonRomantic);
  return diversifyTimeNumbers(noRepeat, params.sessionId);
}

function buildContents(params: {
  messages: FortuneMessage[];
  images: FortuneImages;
  isFollowUp?: boolean;
  readingType: FortuneReadingType;
  validatedSurfaces?: Array<'cup' | 'saucer' | 'palm'>;
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
        { text: isPet ? 'Bu evcil hayvan pati görselini inceleyip pati falına devam et. İnsan eli gibi yorumlama.' : 'Bu insan eli/avuç içi görselini inceleyip el falına devam et.' },
        inlineImage(params.images.palm),
      ],
    });
  } else if (params.images.cup || params.images.saucer) {
    const surfaces = params.validatedSurfaces || [];
    const includeCup = Boolean(params.images.cup && (!surfaces.length || surfaces.includes('cup')));
    const includeSaucer = Boolean(params.images.saucer && (!surfaces.length || surfaces.includes('saucer')));
    const promptText =
      surfaces.length === 1 && surfaces[0] === 'cup'
        ? 'Yalnızca fincan içi görselini inceleyip fala devam et.'
        : surfaces.length === 1 && surfaces[0] === 'saucer'
          ? 'Yalnızca kahve tabağı görselini inceleyip fala devam et.'
          : 'Doğrulanmış fincan ve/veya tabak görsellerini inceleyip fala devam et.';
    const parts: Array<Record<string, unknown>> = [{ text: promptText }];
    if (includeCup && params.images.cup) {
      parts.push({ text: 'Fincan içi görseli yüklendi. Bunu fincanın iç yüzeyi, derinliği, kenar akışı ve telve birikimi olarak oku.' });
      parts.push(inlineImage(params.images.cup));
    }
    if (includeSaucer && params.images.saucer) {
      parts.push({ text: 'Kahve tabağı görseli yüklendi. Bunu tabak yüzeyi, yayılma, göllenme ve dış dünya yansıması olarak oku.' });
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
    let palmValidation: PalmClassification | null = null;
    if (!body.isFollowUp && body.readingType === 'coffee' && (body.coffeeMode || 'upload') === 'upload') {
      const result = await validateCoffeeImages(images);
      addUsage(usage, result.usage);
      validatedSurfaces = result.surfaces;
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
      memorySnippet: body.memorySnippet,
      messages: body.messages,
      images,
      isFollowUp: body.isFollowUp,
      validatedSurfaces,
      palmValidation,
    });
    const response = await generateGeminiTextDirect({
      system_instruction: { parts: [{ text: prompt.systemInstruction }] },
      contents: buildContents({
        messages: body.messages,
        images,
        isFollowUp: body.isFollowUp,
        readingType: body.readingType,
        validatedSurfaces: validatedSurfaces || undefined,
        memorySnippet: body.memorySnippet,
      }),
      generationConfig: {
        temperature: Number(body.devSettings.temperature || 0.8),
        maxOutputTokens: body.isFollowUp ? 320 : body.messages.length <= 1 ? 1000 : 430,
      },
    });
    addUsage(usage, response.usage);
    return {
      text: cleanFortuneText({
        text: response.text,
        closingSentence: prompt.closingSentence,
        messages: body.messages,
        memorySnippet: body.memorySnippet,
        devSettings: body.devSettings,
        sessionId: body.sessionId,
        readingType: body.readingType,
      }),
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
