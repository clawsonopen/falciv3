import type { ProfileMemorySnippet } from '../types/memory';
import type { FortuneImages } from './fortunePromptBuilder';
import { generateTogetherTextDirect } from './togetherDirectService';

type GemmaUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

type CoffeeSurface = 'cup' | 'saucer';

type GemmaCoffeeClassification = {
  containsCup?: boolean;
  containsSaucer?: boolean;
  hasCoffeeGrounds?: boolean;
  isCoffeeRelevant?: boolean;
  suggestedReadingType?: 'coffee' | 'palm' | 'none';
  reason?: string;
};

type GemmaPalmClassification = {
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

const PHOTO_RETRY_MESSAGE =
  'Fotoğraf şu an net okunamadı canım. Işığı biraz artırıp telveyi ya da avuç içini daha yakından göstererek yeniden deneyelim.';

function emptyUsage(): GemmaUsage {
  return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
}

function addUsage(total: GemmaUsage, usage?: Partial<GemmaUsage>) {
  total.inputTokens += Number(usage?.inputTokens || 0);
  total.outputTokens += Number(usage?.outputTokens || 0);
  total.totalTokens += Number(usage?.totalTokens || 0);
}

function validationError(message: string, usage: GemmaUsage) {
  const error = new Error(message) as Error & {
    isGemmaImageValidation?: boolean;
    tokenUsage?: GemmaUsage;
    status?: number;
  };
  error.isGemmaImageValidation = true;
  error.status = 422;
  error.tokenUsage = usage;
  return error;
}

function imagePart(imageData: string) {
  return { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageData}` } };
}

function parseJsonObject<T>(text: string, fallback: T): T {
  const trimmed = (text || '').trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidate = fenced || trimmed;
  try {
    return JSON.parse(candidate) as T;
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1)) as T;
      } catch {
        return fallback;
      }
    }
    return fallback;
  }
}

async function classifyCoffeeImageWithGemma(imageData: string) {
  const response = await generateTogetherTextDirect({
    provider: 'together',
    model: 'google/gemma-3n-E4B-it',
    temperature: 0,
    top_p: 0.1,
    max_tokens: 260,
    messages: [
      {
        role: 'system',
        content:
          'Sen katı bir görsel doğrulama sınıflandırıcısın. Yalnızca geçerli JSON döndür. Açıklama, markdown veya fal yorumu yazma.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              'Görseli kahve falı yüzeyi olarak sınıflandır. Fincan içi görünüyorsa containsCup true. Kahve tabağı veya tabak yüzeyi görünüyorsa containsSaucer true. Fincan ya da tabakta kahve telvesi, kalıntı, leke, akıntı veya tek damla telve varsa hasCoffeeGrounds true. Tamamen temiz ve telvesizse false. Fotoğraf kedi, insan yüzü, manzara, eşya, yemek veya kahve falıyla ilgisiz başka bir şeyse isCoffeeRelevant false ve containsCup/containsSaucer/hasCoffeeGrounds false olmalı. Görselde fincan/tabak yoksa kahve telvesi şekli hayal etme. Şu JSON şemasına uy: {"containsCup":boolean,"containsSaucer":boolean,"hasCoffeeGrounds":boolean,"isCoffeeRelevant":boolean,"suggestedReadingType":"coffee"|"palm"|"none","reason":string}',
          },
          imagePart(imageData),
        ],
      },
    ],
  });
  return {
    parsed: parseJsonObject<GemmaCoffeeClassification>(response.text, {
      containsCup: false,
      containsSaucer: false,
      hasCoffeeGrounds: false,
      isCoffeeRelevant: false,
      suggestedReadingType: 'none',
      reason: 'JSON parse edilemedi.',
    }),
    usage: response.usage,
  };
}

async function classifyPalmImageWithGemma(imageData: string) {
  const response = await generateTogetherTextDirect({
    provider: 'together',
    model: 'google/gemma-3n-E4B-it',
    temperature: 0,
    top_p: 0.1,
    max_tokens: 260,
    messages: [
      {
        role: 'system',
        content:
          'Sen katı bir görsel doğrulama sınıflandırıcısın. Yalnızca geçerli JSON döndür. Açıklama, markdown veya fal yorumu yazma.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              'Görseldeki ana nesneyi sınıflandır. İnsan avuç içi, insan el sırtı, kedi patisi, köpek patisi, tavşan patisi, kuş ayağı, sürüngen ayağı, kahve fincanı, kahve tabağı, yüz, manzara, çiçek veya diğer ayrımını yap. İnsan eli için isInnerPalm yalnızca avuç içi görünüyorsa true olsun; el falına yetecek çizgiler görünüyorsa handVisibleEnough true olsun. Şu JSON şemasına uy: {"visualType":"coffee_cup"|"coffee_saucer"|"coffee_cup_and_saucer"|"human_palm"|"human_hand_back"|"cat_paw"|"dog_paw"|"rabbit_paw"|"bird_foot"|"reptile_foot"|"animal_paw"|"insect"|"flower"|"face"|"landscape"|"other","visualLabelTr":string,"animalSpecies":"cat"|"dog"|"rabbit"|"bird"|"reptile"|"other"|"none","confidence":number,"isInnerPalm":boolean,"handVisibleEnough":boolean}',
          },
          imagePart(imageData),
        ],
      },
    ],
  });
  return {
    parsed: parseJsonObject<GemmaPalmClassification>(response.text, {
      visualType: 'other',
      visualLabelTr: 'uygun olmayan bir görsel',
      animalSpecies: 'none',
      confidence: 0,
      isInnerPalm: false,
      handVisibleEnough: false,
    }),
    usage: response.usage,
  };
}

export async function validateGemmaCoffeeImages(images: FortuneImages) {
  const surfaces: CoffeeSurface[] = [];
  const usage = emptyUsage();
  let suggestedPalm = false;
  let sawCoffeeSurfaceWithoutGrounds = false;

  for (const slot of ['cup', 'saucer'] as const) {
    const image = images[slot];
    if (!image) continue;

    let result: GemmaCoffeeClassification;
    try {
      const classified = await classifyCoffeeImageWithGemma(image);
      result = classified.parsed;
      addUsage(usage, classified.usage);
    } catch {
      throw validationError(PHOTO_RETRY_MESSAGE, usage);
    }

    const hasSurface = Boolean(result.containsCup || result.containsSaucer);
    if (!result.isCoffeeRelevant || !hasSurface) {
      suggestedPalm = suggestedPalm || result.suggestedReadingType === 'palm';
      throw validationError(
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
    throw validationError(
      sawCoffeeSurfaceWithoutGrounds
        ? 'Bu fincan veya tabakta telve görünmüyor canım. Kahve falı için en azından küçük bir telve izi, damla ya da akıntı görünmeli.'
        : 'Kahve falı için uygun bir fincan içi veya tabak görseli bulamadım canım. Telveyi daha net gösteren bir kareyle yeniden deneyelim.',
      usage,
    );
  }

  return { surfaces, usage };
}

function normalizePetSpecies(value?: string | null) {
  const text = (value || '').toLocaleLowerCase('tr-TR');
  if (text.includes('kedi') || text.includes('cat')) return 'cat';
  if (text.includes('köpek') || text.includes('kopek') || text.includes('dog')) return 'dog';
  if (text.includes('tavşan') || text.includes('tavsan') || text.includes('rabbit')) return 'rabbit';
  if (text.includes('kuş') || text.includes('kus') || text.includes('bird')) return 'bird';
  if (text.includes('iguana') || text.includes('sürüngen') || text.includes('surungen') || text.includes('reptile')) return 'reptile';
  return null;
}

function speciesTr(value?: string | null, fallback?: string | null) {
  if (value === 'cat') return 'kedi';
  if (value === 'dog') return 'köpek';
  if (value === 'rabbit') return 'tavşan';
  if (value === 'bird') return 'kuş';
  if (value === 'reptile') return 'sürüngen';
  return fallback || 'evcil hayvan';
}

function isAnimalPawVisual(result: GemmaPalmClassification) {
  return ['cat_paw', 'dog_paw', 'rabbit_paw', 'bird_foot', 'reptile_foot', 'animal_paw'].includes(result.visualType || '');
}

export async function validateGemmaPalmImage(images: FortuneImages, memorySnippet?: ProfileMemorySnippet | null) {
  const image = images.palm;
  const usage = emptyUsage();
  if (!image) {
    throw validationError('El falı için avuç içi fotoğrafı yüklemelisin canım.', usage);
  }

  let result: GemmaPalmClassification;
  try {
    const classified = await classifyPalmImageWithGemma(image);
    result = classified.parsed;
    addUsage(usage, classified.usage);
  } catch {
    throw validationError(PHOTO_RETRY_MESSAGE, usage);
  }

  const loadedLabel = result.visualLabelTr || 'uygun olmayan bir görsel';
  const isPet = memorySnippet?.relationshipPrimary === 'evcil_hayvan';
  if (isPet) {
    const expectedSpecies = normalizePetSpecies(memorySnippet?.petSpecies);
    const expectedLabel = speciesTr(expectedSpecies, memorySnippet?.petSpecies);
    if (!isAnimalPawVisual(result)) {
      throw validationError(`${memorySnippet?.profileName || 'Bu profil'} için pati falı istemiştin fakat ${loadedLabel} yükledin. Lütfen ${expectedLabel} patisi fotoğrafı yükle.`, usage);
    }
    if (expectedSpecies && result.animalSpecies !== expectedSpecies) {
      throw validationError(`${memorySnippet?.profileName || 'Bu profil'} için pati falı istemiştin; profil ${expectedLabel} olarak kayıtlı fakat ${speciesTr(result.animalSpecies)} patisi yükledin. Lütfen ${expectedLabel} patisi fotoğrafı yükle.`, usage);
    }
    return { validation: result, usage };
  }

  if (result.visualType !== 'human_palm' || result.isInnerPalm === false || result.handVisibleEnough === false) {
    throw validationError(`El falı istemiştin fakat ${loadedLabel} yükledin. Lütfen avuç içi fotoğrafı yükle.`, usage);
  }

  return { validation: result, usage };
}
