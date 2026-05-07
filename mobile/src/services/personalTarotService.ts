import type { SubjectProfile, ProfileMemorySnippet } from '../types/memory';
import { TAROT_CARDS, type TarotCard } from '../data/divinationData';
import { TAROT_TR_NAMES } from '../data/tarotNamesTR';
import { getTarotSpread, type TarotSpread } from '../data/tarotSpreads';
import { FORTUNE_PERSONA_DATA } from './fortunePersonaData';
import { generateGeminiTextDirect } from './geminiDirectService';

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

const TAROT_MAX_OUTPUT_TOKENS = 1400;
const TAROT_FOLLOW_UP_MAX_OUTPUT_TOKENS = 900;
const TAROT_FORBIDDEN_CLOSING_TERMS = /kahve|fincan|telve|tabak|avuç|el falı|el fal|el çizg|doğum haritası|numeroloji|rüya yorumu/i;

function personaId(value?: string): PersonaId {
  return (value && value in FORTUNE_PERSONA_DATA ? value : 'durdane-hanim') as PersonaId;
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

const PERSONA_NAME_PATTERNS: Array<[RegExp, string]> = [
  [/\bCaner(?:'in|'le|'den|'e)?\b/g, 'Caner'],
  [/\bBahar Hanım(?:'ın|'la|'dan|'a)?\b/g, 'Bahar Hanım'],
  [/\bDürdane Hanım(?:'ın|'la|'dan|'a)?\b/g, 'Dürdane Hanım'],
  [/\bHikmet Bey(?:'in|'le|'den|'e)?\b/g, 'Hikmet Bey'],
  [/\bMert Bey(?:'in|'le|'den|'e)?\b/g, 'Mert Bey'],
];

function stripTarotDomainLeaks(text: string, assistantLabel?: string) {
  let out = cleanGeneratedText(text)
    .replace(/\belindeki\s+fincan\b/gi, 'önündeki açılım')
    .replace(/\bfincan(?:ın|daki|da|dan|ı|a)?\b/gi, 'açılım')
    .replace(/\btelve(?:nin|leri|lerde|lerden|yi|ye|de|den)?\b/gi, 'kartların izi')
    .replace(/\bkahve(?:nin|si|de|den|ye|yi)?\b/gi, 'tarot')
    .replace(/\bkahve falı\b/gi, 'tarot açılımı')
    .replace(/\bel falı\b/gi, 'tarot açılımı')
    .replace(/\bavuç içi\b/gi, 'kart dizilimi')
    .replace(/\bel çizgileri?\b/gi, 'kartların sembolleri')
    .replace(/\btabak(?:ta|tan|taki|ı|a)?\b/gi, 'açılım')
    .replace(/\s{2,}/g, ' ')
    .replace(/ \n/g, '\n')
    .trim();
  if (assistantLabel) {
    PERSONA_NAME_PATTERNS.forEach(([pattern, name]) => {
      if (name !== assistantLabel) out = out.replace(pattern, assistantLabel);
    });
  }
  return out;
}

function hasTerminalPunctuation(text: string) {
  return /[.!?…][)"'»”’\]]*\s*$/.test(text);
}

function trimIncompleteTail(text: string, assistantLabel?: string) {
  const cleaned = stripTarotDomainLeaks(text, assistantLabel);
  if (!cleaned || hasTerminalPunctuation(cleaned)) return cleaned;
  const lastBoundary = Math.max(cleaned.lastIndexOf('.'), cleaned.lastIndexOf('!'), cleaned.lastIndexOf('?'), cleaned.lastIndexOf('…'));
  if (lastBoundary > cleaned.length * 0.58) return cleaned.slice(0, lastBoundary + 1).trim();
  return cleaned;
}

function selectTarotClosing(params: { assistantId: string; seed: string; usedClosings?: string[] }) {
  const id = personaId(params.assistantId);
  const used = new Set((params.usedClosings || []).map((item) => item.trim()).filter(Boolean));
  const library = FORTUNE_PERSONA_DATA[id].closingLibrary as Record<string, readonly string[]>;
  const options = Object.values(library)
    .flatMap((items) => [...items])
    .filter((sentence) => sentence && !TAROT_FORBIDDEN_CLOSING_TERMS.test(sentence) && !used.has(sentence));
  if (!options.length) return '';
  return options[hashString(`tarot:${id}:${params.seed}:${used.size}`) % options.length];
}

function completeWithTarotClosing(params: {
  text: string;
  assistantId: string;
  seed: string;
  usedClosings?: string[];
  forceClosing?: boolean;
  assistantLabel?: string;
}) {
  const base = trimIncompleteTail(params.text, params.assistantLabel);
  const closing = selectTarotClosing(params);
  if (!closing) return { text: base, closingSentence: '' };
  if (!base) return { text: closing, closingSentence: closing };
  if (!params.forceClosing && hasTerminalPunctuation(base)) return { text: base, closingSentence: '' };
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
  const out: DrawnTarotCard[] = [];
  spread.positions.forEach((position) => {
    const index = Math.floor(random() * deck.length);
    const card = deck.splice(index, 1)[0] as TarotCard;
    const reversed = random() >= 0.5;
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

function memoryContext(profileName: string, memorySnippet?: ProfileMemorySnippet | null) {
  const lines = [
    '## Profil ve Hafıza Bağlamı',
    `- Bu tarot açılımı ${profileName || 'seçili kişi'} için yapılıyor.`,
    '- Kullanıcının bu oturumda sorduğu soru ve takip soruları birincil sinyaldir.',
    '- Önceki yorumlardan türeyen temalar düşük öncelikli arka plan olarak kalmalı; mevcut spread ve soru desteklemiyorsa ana konu yapılmamalı.',
  ];
  if (!memorySnippet) return lines.join('\n');
  if (memorySnippet.isSelf) {
    lines.push('- Profil hesap sahibinin kendisi; anlatımda sen/siz dili tutarlı olsun.');
  } else {
    lines.push(`- Okuma hesap sahibinden farklı biri için olabilir; seçili profil olan ${profileName} sabit kalmalı.`);
  }
  if (memorySnippet.relationshipLabel) lines.push(`- Hesap sahibiyle yakınlık: ${memorySnippet.relationshipLabel}.`);
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
}) {
  const id = personaId(params.assistantId);
  const identity = FORTUNE_PERSONA_DATA[id];
  return [
    identity.systemBody,
    [
      '## Tarot Direktifleri',
      `- Bu oturum tarot açılımıdır. ${params.assistantLabel} personasında kal; persona yalnızca ses, hitap ve yorum ritmini belirler.`,
      `- Seçilen ve konuşan falcı sadece ${params.assistantLabel}. Başka falcı/persona adı anma.`,
      `- "Caner dedi", "Bahar Hanım olarak", "Dürdane'ye göre" gibi seçilen falcı dışında isim kaymaları yasak. Gerekirse hiç isim kullanmadan doğrudan yoruma gir.`,
      '- Kahve, fincan, telve, tabak, el, avuç, el çizgisi, doğum haritası, numeroloji veya rüya yorumu objeleriyle yorum yapma.',
      "- Persona geçmişinde kahve, el falı veya başka alanlar geçse bile bunları tamamen yok say; sadece tarot kartları, kart dizilimi, pozisyonlar ve semboller üzerinden konuş.",
      "- 'elindeki fincan', 'kahvenin telvesi', 'telve gibi', 'avuç çizgin', 'tabakta görünen' ve benzeri benzetmeler kesinlikle yasak.",
      "- Caner dahil tüm personalar tarot okurken tarot dışı fal malzemesine metafor olarak bile değinmez.",
      '- Her kartı üç katmanla yorumla: kartın tarot anlamı, spread içindeki pozisyon anlamı, pozisyona ait rehber soru.',
      '- Kullanıcının niyeti/sorusu varsa bu oturumun ana eksenidir; yanıtın ilk paragrafında o soruyu açıkça ele al ve tüm açılımı o soru bağlamında yorumla.',
      '- Kullanıcı soru/niyet yazdıysa genel tarot yorumu yapıp soruyu sona bırakma; kartları sorunun cevabına hizmet edecek şekilde bağla.',
      '- Kartların dizilim içindeki ilişkisini kur; tek tek kart listesi gibi kopuk anlatma.',
      '- Kesin kehanet, korkutucu felaket, ölüm, ağır hastalık veya garanti finans dili kullanma.',
      '- Yanıt başlıksız, listesiz, sohbet gibi akan düz yazı olsun.',
      '- Ana açılım yorumunda hedef uzunluk spread büyüklüğüne göre doyurucu olsun; 1 kart kısa, 10 kart kapsamlı ama nefessiz olmasın.',
      '- Takip sorularında önce son soruya cevap ver, sonra kart ve pozisyon bağlamından gerekçe ekle.',
      '- Oturum boyunca aynı spread, aynı kartlar ve aynı profil bağlamı korunmalı.',
      '- Kapanışta yeni imza cümlesi üretme; sistem persona kapanışını sonradan ekleyecek.',
      params.usedClosings?.length ? `- Bu oturumda kullanılmış kapanışlar: ${params.usedClosings.join(' | ')}` : '',
      '- Türkçe karakterleri daima doğru UTF-8 yaz: ç, ğ, ı, İ, ö, ş, ü.',
    ].filter(Boolean).join('\n'),
    memoryContext(params.profileName, params.memorySnippet),
  ].join('\n\n');
}

export async function createPersonalTarotReading(params: {
  profile: SubjectProfile;
  assistantId: string;
  assistantLabel: string;
  spread: TarotSpread;
  cards: DrawnTarotCard[];
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
  });
  const userText = [
    `Profil adı: ${params.profile.displayName}`,
    `Açılım: ${params.spread.title}`,
    `Açılım amacı: ${params.spread.purpose}`,
    params.question
      ? [
          `KULLANICININ ANA SORUSU / NİYETİ: ${params.question}`,
          'Bu soru ana bağlamdır. İlk paragrafta doğrudan bu soruya dön; sonra kartları tek tek değil, bu sorunun cevabını kuracak şekilde pozisyonlarıyla birlikte işle.',
        ].join('\n')
      : 'Kullanıcı genel bir tarot açılımı istedi.',
    `Kartlar ve pozisyonlar:\n${cardContext(params.cards)}`,
    'Yorumu önce açılımın genel enerjisiyle başlat, sonra önemli kart ilişkilerini pozisyon bağlamında işle, son bölümde uygulanabilir bir yön ve yumuşak toparlama ver.',
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
  );
  const completed = completeWithTarotClosing({
    text: data.text,
    assistantId: params.assistantId,
    assistantLabel: params.assistantLabel,
    seed: `${params.profile.profileId}:${params.spread.id}:${params.cards.map((card) => card.id).join('|')}`,
    usedClosings: params.usedClosings,
    forceClosing: true,
  });
  return { text: completed.text, closingSentence: completed.closingSentence, modelName: data.model, usage: data.usage };
}

export async function createPersonalTarotFollowUp(params: {
  profileName: string;
  assistantId: string;
  assistantLabel: string;
  spread: TarotSpread;
  cards: DrawnTarotCard[];
  readingText: string;
  question: string;
  previousFollowUps?: TarotFollowUpMessage[];
  memorySnippet?: ProfileMemorySnippet | null;
  usedClosings?: string[];
}) {
  const systemText = buildBaseSystem({
    assistantId: params.assistantId,
    assistantLabel: params.assistantLabel,
    profileName: params.profileName,
    memorySnippet: params.memorySnippet,
    usedClosings: params.usedClosings,
  });
  const conversation = (params.previousFollowUps || [])
    .map((message) => `${message.role === 'user' ? 'Kullanıcı' : params.assistantLabel}: ${message.text}`)
    .join('\n');
  const userText = [
    `Profil adı: ${params.profileName}`,
    `Açılım: ${params.spread.title}`,
    `Kartlar ve pozisyonlar:\n${cardContext(params.cards)}`,
    `İlk yorum:\n${params.readingText}`,
    conversation ? `Önceki soru cevaplar:\n${conversation}` : '',
    `Kullanıcının son sorusu:\n${params.question}`,
    'Sadece son soruya cevap ver; ama aynı kartlar, aynı spread ve önceki bağlam korunmalı. 250-450 token aralığında toparlanmış ama doyurucu yanıt ver.',
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
  );
  const completed = completeWithTarotClosing({
    text: data.text,
    assistantId: params.assistantId,
    seed: `${params.profileName}:${params.spread.id}:${params.question}:${params.previousFollowUps?.length || 0}`,
    usedClosings: params.usedClosings,
    forceClosing: true,
  });
  return { text: completed.text, closingSentence: completed.closingSentence, modelName: data.model, usage: data.usage };
}
