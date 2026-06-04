import type { SubjectProfile, ProfileMemorySnippet } from '../types/memory';
import { TAROT_CARDS, type TarotCard } from '../data/divinationData';
import { TAROT_TR_NAMES } from '../data/tarotNamesTR';
import { getTarotSpread, type TarotSpread } from '../data/tarotSpreads';
import {
  PERSONAL_FOLLOW_UP_MAX_OUTPUT_TOKENS,
  PERSONAL_FOLLOW_UP_TOKEN_INSTRUCTION,
  PERSONAL_INITIAL_READING_MAX_OUTPUT_TOKENS,
  PERSONAL_INITIAL_READING_TOKEN_INSTRUCTION,
} from '../config/llmTokenPolicy';
import { FORTUNE_PERSONA_DATA } from './fortunePersonaData';
import { generateGeminiTextDirect } from './geminiDirectService';
import {
  appendHealthProfessionalReminder,
  sanitizeGenderedAddress,
  sanitizePublicReadingLanguage,
  selectRememberedPersonaClosingSentence,
  stripPersonaSelfIntroduction,
  userAskedHealthConcern,
} from './personaClosingService';
import { buildAnimalProfileInstructionFromMemory, buildAnimalProfileInstructionFromProfile } from './animalProfilePrompt';
import { formatPromptMemoryPack } from './memoryPromptPackFormatter';
import { formatPetMentionMemoryContext, formatStandardPersonalMemoryContext } from './personalMemoryPromptContext';
import { cleanFollowUpReply, FOLLOW_UP_CHAT_CONTRACT } from './followUpResponseService';

type PersonaId = keyof typeof FORTUNE_PERSONA_DATA;

export type DrawnTarotCard = {
  id: string;
  positionNo: number;
  positionTitle: string;
  positionMeaning: string;
  guideQuestion: string;
  cardName: string;
  cardNameTr: string;
  orientation: 'upright' | 'reversed';
  meaning: string;
  advice: string;
};

export type TarotFollowUpMessage = {
  role: 'user' | 'assistant';
  text: string;
};

const TAROT_MAX_OUTPUT_TOKENS = PERSONAL_INITIAL_READING_MAX_OUTPUT_TOKENS;
const TAROT_FOLLOW_UP_MAX_OUTPUT_TOKENS = PERSONAL_FOLLOW_UP_MAX_OUTPUT_TOKENS;
function personaId(value?: string): PersonaId {
  return (value && value in FORTUNE_PERSONA_DATA ? value : 'suzan') as PersonaId;
}

function hashString(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function cleanGeneratedText(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripTarotDomainLeaks(text: string) {
  let out = cleanGeneratedText(text)
    .replace(/\belindeki\s+fincan\b/gi, 'önündeki açılım')
    .replace(/\bfincan(?:ın|daki|da|dan|ı|a)?\b/gi, 'açılım')
    .replace(/\btelve(?:nin|leri|lerde|lerden|yi|ye|de|den)?\b/gi, 'kartların izi')
    .replace(/\bkahve(?:nin|si|de|den|ye|yi)?\b/gi, 'tarot')
    .replace(/\bkahve yorumu\b/gi, 'tarot açılımı')
    .replace(/\bel okuması\b/gi, 'tarot açılımı')
    .replace(/\bavuç içi\b/gi, 'kart dizilimi')
    .replace(/\bel çizgileri?\b/gi, 'kartların sembolleri')
    .replace(/\btabak(?:ta|tan|taki|ı|a)?\b/gi, 'açılım')
    .replace(/\s{2,}/g, ' ')
    .replace(/ \n/g, '\n')
    .trim();
  return out;
}

function hasTerminalPunctuation(text: string) {
  return /[.!?…][)"'»”’\]]*\s*$/.test(text);
}

function trimIncompleteTail(text: string) {
  const cleaned = stripTarotDomainLeaks(text);
  if (!cleaned || hasTerminalPunctuation(cleaned)) return cleaned;
  const lastBoundary = Math.max(cleaned.lastIndexOf('.'), cleaned.lastIndexOf('!'), cleaned.lastIndexOf('?'), cleaned.lastIndexOf('…'));
  if (lastBoundary > cleaned.length * 0.58) return cleaned.slice(0, lastBoundary + 1).trim();
  return cleaned;
}

async function completeWithTarotClosing(params: {
  text: string;
  assistantId: string;
  seed: string;
  usedClosings?: string[];
  forceClosing?: boolean;
  allowHealthClosing?: boolean;
  isAnimalProfile?: boolean;
}) {
  const base = sanitizePublicReadingLanguage(stripPersonaSelfIntroduction(trimIncompleteTail(params.text)));
  if (!params.forceClosing && hasTerminalPunctuation(base)) return { text: base, closingSentence: '' };
  const closing = await selectRememberedPersonaClosingSentence({
    assistantId: params.assistantId,
    domain: 'tarot',
    seed: `${params.seed}:${base.slice(-160)}`,
    allowHealthClosing: params.allowHealthClosing,
    isAnimalProfile: params.isAnimalProfile,
    usedClosings: params.usedClosings,
  });
  if (!closing) return { text: base, closingSentence: '' };
  if (!base) return { text: closing, closingSentence: closing };
  if (base.includes(closing)) return { text: base, closingSentence: closing };
  return { text: `${base}\n\n${closing}`.trim(), closingSentence: closing };
}

function seededRandom(seed: string) {
  let state = hashString(seed) || 1;
  return () => {
    state = Math.imul(1664525, state) + 1013904223;
    return (state >>> 0) / 4294967296;
  };
}

export function drawTarotSpreadCards(params: {
  spreadId: string;
  profileId: string;
  assistantId: string;
  nonce?: number;
}) {
  const spread = getTarotSpread(params.spreadId);
  const random = seededRandom(`${params.profileId}:${params.assistantId}:${spread.id}:${params.nonce || Date.now()}`);
  const deck = [...TAROT_CARDS];
  const drawn = spread.positions.map((position) => {
    const index = Math.floor(random() * deck.length);
    const card = deck.splice(index, 1)[0] as TarotCard;
    return {
      position,
      card,
      reverseScore: random(),
    };
  });
  const cardCount = drawn.length;
  const maxReversedCount = cardCount <= 1 ? cardCount : Math.max(1, Math.floor(cardCount / 3));
  const reversedIds = new Set(
    drawn
      .filter((item) => item.reverseScore >= 0.5)
      .sort((a, b) => b.reverseScore - a.reverseScore)
      .slice(0, maxReversedCount)
      .map((item) => item.position.no),
  );
  const out: DrawnTarotCard[] = [];
  drawn.forEach(({ position, card }) => {
    const reversed = reversedIds.has(position.no);
    out.push({
      id: `${position.no}-${card.name}-${reversed ? 'rev' : 'up'}`,
      positionNo: position.no,
      positionTitle: position.title,
      positionMeaning: position.meaning,
      guideQuestion: position.guideQuestion,
      cardName: card.name,
      cardNameTr: TAROT_TR_NAMES[card.name] || card.name,
      orientation: reversed ? 'reversed' : 'upright',
      meaning: reversed ? card.reversed : card.upright,
      advice: reversed ? card.adviceReversed : card.advice,
    });
  });
  return { spread, cards: out };
}

function memoryContext(profileName: string, memorySnippet?: ProfileMemorySnippet | null, isAnimalProfile = false) {
  const lines = [
    '## Profil ve Hafıza Bağlamı',
    isAnimalProfile || memorySnippet?.relationshipPrimary === 'evcil_hayvan'
      ? `- Bu tarot açılımı ${profileName || 'seçili profil'} adlı evcil hayvan için yapılıyor.`
      : `- Bu tarot açılımı ${profileName || 'seçili kişi'} için yapılıyor.`,
    '- Kullanıcının bu oturumda sorduğu soru ve takip soruları birincil sinyaldir.',
    '- Önceki yorumlardan türeyen temalar düşük öncelikli arka plan olarak kalmalı; mevcut spread ve soru desteklemiyorsa ana konu yapılmamalı.',
    '- Hafızadaki olay/life event kayıtlarını yalnızca mevcut soru veya kartların akışıyla gerçekten ilişkiliyse kullan; alakasız bir kaydı yoruma zorla sokma.',
  ];
  if (!memorySnippet) return lines.join('\n');
  if (memorySnippet.isSelf) {
    lines.push('- Profil hesap sahibinin kendisi; anlatımda sen/siz dili tutarlı olsun.');
  } else {
    lines.push(`- Okuma hesap sahibinden farklı biri için olabilir; seçili profil olan ${profileName} sabit kalmalı.`);
  }
  if (memorySnippet.relationshipLabel) lines.push(`- Hesap sahibiyle yakınlık: ${memorySnippet.relationshipLabel}.`);
  const animalContext = buildAnimalProfileInstructionFromMemory(memorySnippet);
  if (animalContext) lines.push(animalContext);
  if (memorySnippet.profileGender) lines.push(`- Profil cinsiyet bilgisi: ${memorySnippet.profileGender}; hitapları buna göre seç.`);
  if (memorySnippet.userStatedTopics?.length) {
    lines.push(`- Kullanıcının kendi söylediği güçlü konular: ${memorySnippet.userStatedTopics.slice(0, 8).join(', ')}.`);
  }
  if (memorySnippet.userTopicGroups?.length) {
    lines.push(
      `- Kullanıcının soru/sohbet hafızası: ${memorySnippet.userTopicGroups
        .slice(0, 8)
        .map((item) => `${item.group || 'Genel'} / ${item.subgroup || 'Diğer'}: ${item.label}`)
        .join('; ')}.`,
    );
  }
  if (memorySnippet.readingTopicGroups?.length) {
    lines.push(
      `- Önceki okumalardan düşük öncelikli temalar: ${memorySnippet.readingTopicGroups
        .slice(0, 6)
        .map((item) => `${item.group || 'Genel'} / ${item.subgroup || 'Diğer'}: ${item.label}`)
        .join('; ')}.`,
    );
  }
  const promptMemoryPack = formatPromptMemoryPack(memorySnippet);
  if (promptMemoryPack) lines.push(promptMemoryPack);
  const standardMemory = formatStandardPersonalMemoryContext({
    profileName,
    readingLabel: 'kişisel tarot',
    memorySnippet,
    includePromptPack: false,
  });
  if (standardMemory) lines.push(standardMemory);
  return lines.join('\n');
}

function cardContext(cards: DrawnTarotCard[]) {
  return cards
    .map((card) =>
      [
        `${card.positionNo}. ${card.positionTitle}`,
        `Pozisyon anlamı: ${card.positionMeaning}`,
        `Rehber soru: ${card.guideQuestion}`,
        `Kart: ${card.cardNameTr} / ${card.cardName} (${card.orientation === 'reversed' ? 'ters' : 'düz'})`,
        `Kart anlamı: ${card.meaning}`,
        `Kart önerisi: ${card.advice}`,
      ].join('\n'),
    )
    .join('\n\n');
}

function buildBaseSystem(params: {
  assistantId: string;
  assistantLabel: string;
  profileName: string;
  memorySnippet?: ProfileMemorySnippet | null;
  usedClosings?: string[];
  isAnimalProfile?: boolean;
}) {
  const id = personaId(params.assistantId);
  const identity = FORTUNE_PERSONA_DATA[id];
  const isAnimalTarot = Boolean(params.isAnimalProfile || params.memorySnippet?.relationshipPrimary === 'evcil_hayvan');
  return [
    identity.systemBody,
    [
      '## Tarot Direktifleri',
      '- Bu oturum tarot açılımıdır. Seçili persona yalnızca ses, hitap ve yorum ritmini belirler.',
      "- Kullanıcıya görünen metinde hiçbir yorumcu/persona adı, public label veya rol tanıtımı yazma.",
      '- Kendini tanıtma, imza atma, adınla/rolünle başlama; ilk cümle doğrudan yoruma başlasın.',
      '- Kullanıcıya görünen metinde hukuken kesin gelecek iddiası kurma; "yorum", "okuma", "sembolik ritüel", "sembolik yorum", "izlenim", "olasılık", "eğilim" dili kullan.',
      '- Sağlık ve finans alanlarında spesifik tavsiye verme. İnsan sağlığıyla ilgili endişede doktora/uygun sağlık uzmanına, hayvan sağlığıyla ilgili endişede veterinere görünmeyi nazikçe öner.',
      '- "Şunu ye/iç geçer", "kesin geçecek", "kesin iyileşecek", ilaç/doz/tedavi/beslenme reçetesi veya kesin sonuç dili yasak.',
      '- Kullanıcı bir konu/soru yazdıysa bunu kendi aklına gelmiş gibi sahiplenme; "aklıma geldi", "şimdi aklıma geldi" gibi ifadeler kullanma.',
      '- Hafıza veya önceki okuma kaynağını açık etme; "önceki okumanda", "hafızanda", "sana daha önce çıkmıştı" gibi cümleler kurma.',
      '- Kahve, fincan, telve, tabak, el, avuç, el çizgisi, doğum haritası, numeroloji veya rüya yorumu objeleriyle yorum yapma.',
      "- Persona geçmişinde kahve, el okuması veya başka alanlar geçse bile bunları tamamen yok say; sadece tarot kartları, kart dizilimi, pozisyonlar ve semboller üzerinden konuş.",
      "- 'elindeki fincan', 'kahvenin telvesi', 'telve gibi', 'avuç çizgin', 'tabakta görünen' ve benzeri benzetmeler kesinlikle yasak.",
      '- Tüm personalar tarot okurken tarot dışı sembolik araçlara metafor olarak bile değinmez.',
      '- Her kartı üç katmanla yorumla: kartın tarot anlamı, spread içindeki pozisyon anlamı, pozisyona ait rehber soru.',
      '- Seçilen deste kartların görsel atmosferini belirler; kart adlarını, pozisyonları ve anlam çekirdeğini değiştirme, yalnızca yorum tonuna hafifçe yansıt.',
      '- Kullanıcının niyeti/sorusu varsa bu oturumun ana eksenidir; yanıtın ilk paragrafında o soruyu açıkça ele al ve tüm açılımı o soru bağlamında yorumla.',
      '- Kullanıcı soru/niyet yazdıysa genel tarot yorumu yapıp soruyu sona bırakma; kartları sorunun cevabına hizmet edecek şekilde bağla.',
      isAnimalTarot
        ? '- Seçili profil evcil hayvansa tarot açılımını insan hayatı şablonuna çevirme. Kartları hayvanın mizacı, oyun ve dinlenme düzeni, ev içi güveni, duyuları, pencere/dış dünya merakı, evdeki diğer hayvanlarla ilişkisi ve sahibiyle bağı üzerinden yorumla.'
        : '',
      isAnimalTarot
        ? '- Evcil hayvan profilde kariyer, iş, okul, evlilik, romantik ilişki, insan sosyal çevresi, para kazanma veya yetişkin insan psikolojisi teması kurma. Hesap sahibine yalnızca hayvanın sahibi/refakatçisi olarak pratik ve yumuşak öneriler ver.'
        : '',
      '- Hafıza ve önceki yaşam olayı sinyalleri soruya hizmet etmiyorsa sessiz kalsın; spread ile ilgisiz bir anıyı ana temaya çevirme.',
      '- Kartların dizilim içindeki ilişkisini kur; tek tek kart listesi gibi kopuk anlatma.',
      '- Kesin hüküm, korkutucu felaket, ölüm, ağır hastalık veya garanti finans dili kullanma.',
      '- Yanıt başlıksız, listesiz, sohbet gibi akan düz yazı olsun. Markdown, yıldızlı vurgu, emoji, ikon veya dekoratif sembol kullanma.',
      `- Ana açılım yorumunda ${PERSONAL_INITIAL_READING_TOKEN_INSTRUCTION}`,
      '- Takip sorularında önce son soruya cevap ver, sonra kart ve pozisyon bağlamından gerekçe ekle.',
      '- Oturum boyunca aynı spread, aynı kartlar ve aynı profil bağlamı korunmalı.',
      '- Kapanışta yeni imza cümlesi üretme; sistem persona kapanışını sonradan ekleyecek.',
      params.usedClosings?.length ? `- Bu oturumda kullanılmış kapanışlar: ${params.usedClosings.join(' | ')}` : '',
      '- Türkçe karakterleri daima doğru UTF-8 yaz: ç, ğ, ı, İ, ö, ş, ü.',
    ].filter(Boolean).join('\n'),
    memoryContext(params.profileName, params.memorySnippet, isAnimalTarot),
  ].join('\n\n');
}

export async function createPersonalTarotReading(params: {
  profile: SubjectProfile;
  assistantId: string;
  assistantLabel: string;
  spread: TarotSpread;
  cards: DrawnTarotCard[];
  deckName?: string;
  question?: string;
  memorySnippet?: ProfileMemorySnippet | null;
  usedClosings?: string[];
}) {
  const systemText = buildBaseSystem({
    assistantId: params.assistantId,
    assistantLabel: params.assistantLabel,
    profileName: params.profile.displayName,
    memorySnippet: params.memorySnippet,
    usedClosings: params.usedClosings,
    isAnimalProfile: params.profile.relationshipPrimary === 'evcil_hayvan',
  });
  const userText = [
    `Profil adı: ${params.profile.displayName}`,
    buildAnimalProfileInstructionFromProfile(params.profile),
    `Açılım: ${params.spread.title}`,
    `Deste: ${params.deckName || 'Rider-Waite Klasik'}`,
    `Açılım amacı: ${params.spread.purpose}`,
    params.question
      ? [
          `KULLANICININ ANA SORUSU / NİYETİ: ${params.question}`,
          formatPetMentionMemoryContext(params.question, params.memorySnippet),
          'Bu soru ana bağlamdır. İlk paragrafta doğrudan bu soruya dön; sonra kartları tek tek değil, bu sorunun cevabını kuracak şekilde pozisyonlarıyla birlikte işle.',
        ].filter(Boolean).join('\n')
      : 'Kullanıcı genel bir tarot açılımı istedi.',
    `Kartlar ve pozisyonlar:\n${cardContext(params.cards)}`,
    params.profile.relationshipPrimary === 'evcil_hayvan'
      ? 'Yorumu önce hayvanın genel enerjisi ve güven/oyun ritmiyle başlat; sonra kart ilişkilerini ev içi davranış, duyular, diğer hayvanlarla minik sosyal dinamikler ve sahibiyle bağı üzerinden işle. Son bölümde sahibine uygulanabilir, yumuşak bir gözlem önerisi ver.'
      : 'Yorumu önce açılımın genel enerjisiyle başlat, sonra önemli kart ilişkilerini pozisyon bağlamında işle, son bölümde uygulanabilir bir yön ve yumuşak toparlama ver.',
    PERSONAL_INITIAL_READING_TOKEN_INSTRUCTION,
  ].join('\n\n');
  const data = await generateGeminiTextDirect(
    {
      system_instruction: { parts: [{ text: systemText }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: {
        temperature: 0.74,
        maxOutputTokens: TAROT_MAX_OUTPUT_TOKENS,
      },
    },
    70000,
    { usageMode: 'raw' },
  );
  const completed = await completeWithTarotClosing({
    text: data.text,
    assistantId: params.assistantId,
    seed: `${params.profile.profileId}:${params.spread.id}:${params.cards.map((card) => card.id).join('|')}`,
    usedClosings: params.usedClosings,
    forceClosing: true,
    allowHealthClosing: userAskedHealthConcern(params.question),
    isAnimalProfile: params.profile.relationshipPrimary === 'evcil_hayvan',
  });
  return {
    text: sanitizeGenderedAddress(
      appendHealthProfessionalReminder(completed.text, {
        userText: params.question,
        isAnimalProfile: params.profile.relationshipPrimary === 'evcil_hayvan',
      }),
      {
        assistantId: params.assistantId,
        memorySnippet: params.memorySnippet,
        isAnimalProfile: params.profile.relationshipPrimary === 'evcil_hayvan',
      },
    ),
    closingSentence: completed.closingSentence,
    modelName: data.model,
    usage: data.usage,
  };
}

export async function createPersonalTarotFollowUp(params: {
  profileName: string;
  assistantId: string;
  assistantLabel: string;
  spread: TarotSpread;
  cards: DrawnTarotCard[];
  deckName?: string;
  readingText: string;
  question: string;
  previousFollowUps?: TarotFollowUpMessage[];
  memorySnippet?: ProfileMemorySnippet | null;
  usedClosings?: string[];
}) {
  const systemText = [
    buildBaseSystem({
      assistantId: params.assistantId,
      assistantLabel: params.assistantLabel,
      profileName: params.profileName,
      memorySnippet: params.memorySnippet,
      usedClosings: params.usedClosings,
      isAnimalProfile: params.memorySnippet?.relationshipPrimary === 'evcil_hayvan',
    }),
    FOLLOW_UP_CHAT_CONTRACT,
  ].join('\n');
  const conversation = (params.previousFollowUps || [])
    .map((message) => `${message.role === 'user' ? 'Kullanıcı' : 'Yorumcu'}: ${message.text}`)
    .join('\n');
  const userText = [
    `Profil adı: ${params.profileName}`,
    buildAnimalProfileInstructionFromMemory(params.memorySnippet),
    `Açılım: ${params.spread.title}`,
    `Deste: ${params.deckName || 'Rider-Waite Klasik'}`,
    `Kartlar ve pozisyonlar:\n${cardContext(params.cards)}`,
    `İlk yorum:\n${params.readingText}`,
    conversation ? `Önceki soru cevaplar:\n${conversation}` : '',
    `Kullanıcının son sorusu:\n${params.question}`,
    formatPetMentionMemoryContext(params.question, params.memorySnippet),
    params.memorySnippet?.relationshipPrimary === 'evcil_hayvan'
      ? `Sadece son soruya cevap ver; ama aynı kartlar, aynı spread ve evcil hayvan bağlamı korunmalı. İnsan hayatı şablonuna kayma. ${PERSONAL_FOLLOW_UP_TOKEN_INSTRUCTION}`
      : `Sadece son soruya cevap ver; ama aynı kartlar, aynı spread ve önceki bağlam korunmalı. ${PERSONAL_FOLLOW_UP_TOKEN_INSTRUCTION}`,
  ].filter(Boolean).join('\n\n');
  const data = await generateGeminiTextDirect(
    {
      system_instruction: { parts: [{ text: systemText }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: TAROT_FOLLOW_UP_MAX_OUTPUT_TOKENS,
      },
    },
    70000,
    { usageMode: 'raw' },
  );
  const completed = await completeWithTarotClosing({
    text: data.text,
    assistantId: params.assistantId,
    seed: `${params.profileName}:${params.spread.id}:${params.question}:${params.previousFollowUps?.length || 0}`,
    usedClosings: params.usedClosings,
    forceClosing: true,
    allowHealthClosing: userAskedHealthConcern(params.question),
    isAnimalProfile: params.memorySnippet?.relationshipPrimary === 'evcil_hayvan',
  });
  return {
    text: sanitizeGenderedAddress(
      appendHealthProfessionalReminder(cleanFollowUpReply(completed.text), {
        userText: params.question,
        isAnimalProfile: params.memorySnippet?.relationshipPrimary === 'evcil_hayvan',
      }),
      { assistantId: params.assistantId, memorySnippet: params.memorySnippet },
    ),
    closingSentence: completed.closingSentence,
    modelName: data.model,
    usage: data.usage,
  };
}
