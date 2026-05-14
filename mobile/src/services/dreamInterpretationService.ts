import type { SubjectProfile, ProfileMemorySnippet } from '../types/memory';
import { generateGeminiTextDirect } from './geminiDirectService';
import { FORTUNE_PERSONA_DATA } from './fortunePersonaData';

type PersonaId = keyof typeof FORTUNE_PERSONA_DATA;

export type DreamChatMessage = {
  role: 'user' | 'assistant';
  text: string;
};

const DREAM_MAX_OUTPUT_TOKENS = 1000;

const DREAM_FORBIDDEN_CLOSING_TERMS =
  /kahve|fincan|telve|tabak|avuç|el falı|el fal|el çizg|tarot|kart|melek kart|rune|i ching|hexagram|doğum haritası|numeroloji/i;

const PERSONA_DREAM_OPENINGS: Record<string, string[]> = {
  'durdane-hanim': [
    'Gel canım, rüyanın ucundan birlikte tutalım. Rüyalar bazen insanın gönlünde sakladığı şeyi usulca kapıya bırakır.',
    'Anlat güzelim, gece sana hangi işareti getirmiş bakalım. Rüyanı ne kadar canlı tarif edersen ben de o kadar temiz okurum.',
  ],
  'hikmet-bey': [
    'Gel evladım, rüya dediğin bazen gündüzün sustuğu yerden konuşur. Sakince anlat, ne gördün, nerede oldun, yanında kim vardı?',
    'Hadi bakalım, gece zihnin sana nasıl bir perde açmış görelim. Rüyanın sahnesini, renklerini ve sende bıraktığı hissi anlat.',
  ],
  'bahar-hanim': [
    'Tatlım, rüyalar bazen bilinçaltının en zarif bildirimidir. Bana sahneyi, duyguyu ve uyandığında üstünde kalan izi anlat.',
    'Gel, bu rüyaya biraz farkındalıkla bakalım. Ne gördüğünü, kimlerin olduğunu ve rüyanın sende nasıl bir his bıraktığını tarif et.',
  ],
  'mert-bey': [
    'Dostum, rüyayı bir zihin haritası gibi birlikte açalım. Olay sırasını, dikkat çeken sembolleri ve uyandığında kalan duyguyu anlat.',
    'Kardeşim, rüyalar bazen zihnin arka planda işlediği dosyaları gösterir. Ne gördün, nerede geçti, en çok hangi sahne aklında kaldı?',
  ],
  caner: [
    'Güzel ruh, rüyanın kapısını yavaşça aralayalım. Bana görüntüleri, hisleri ve uyandığında içinde kalan titreşimi anlat.',
    'Canım, rüyalar bazen iç dünyanın sembollerle konuşan şiiridir. Ne gördüğünü, hangi rengin veya sahnenin seni tuttuğunu tarif et.',
  ],
};

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

function hasTerminalPunctuation(text: string) {
  return /[.!?…][)"'»”’\]]*\s*$/.test(text);
}

function trimIncompleteTail(text: string) {
  const cleaned = text.trim();
  if (!cleaned || hasTerminalPunctuation(cleaned)) return cleaned;
  const lastBoundary = Math.max(cleaned.lastIndexOf('.'), cleaned.lastIndexOf('!'), cleaned.lastIndexOf('?'), cleaned.lastIndexOf('…'));
  if (lastBoundary > cleaned.length * 0.58) return cleaned.slice(0, lastBoundary + 1).trim();
  return cleaned;
}

function cleanGeneratedText(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function selectDreamClosing(params: {
  assistantId: string;
  seed: string;
  usedClosings?: string[];
}) {
  const id = personaId(params.assistantId);
  const library = FORTUNE_PERSONA_DATA[id].closingLibrary as Record<string, readonly string[]>;
  const used = new Set((params.usedClosings || []).map((item) => item.trim()).filter(Boolean));
  const options = Object.values(library)
    .flatMap((items) => [...items])
    .filter((sentence) => sentence && !DREAM_FORBIDDEN_CLOSING_TERMS.test(sentence) && !used.has(sentence));
  if (!options.length) return '';
  return options[hashString(`dream:${id}:${params.seed}:${used.size}`) % options.length];
}

function completeWithDreamClosing(params: {
  text: string;
  assistantId: string;
  seed: string;
  usedClosings?: string[];
  forceClosing?: boolean;
}) {
  const base = trimIncompleteTail(cleanGeneratedText(params.text));
  const shouldClose = params.forceClosing || !hasTerminalPunctuation(base);
  const closing = selectDreamClosing(params);
  if (!closing) return { text: base, closingSentence: '' };
  if (!base) return { text: closing, closingSentence: closing };
  if (!shouldClose && base.includes(closing)) return { text: base, closingSentence: closing };
  return { text: `${base}\n\n${closing}`.trim(), closingSentence: closing };
}

function buildDreamMemoryContext(profileName: string, memorySnippet?: ProfileMemorySnippet | null) {
  const lines = [
    '## Profil ve Hafıza Bağlamı',
    `- Bu rüya yorumu ${profileName || 'seçili kişi'} için yapılıyor.`,
    '- Rüya yorumu kişiye özel bağlamla yapılır; yine de hafızayı ham kayıt gibi açıklama.',
    '- Kullanıcının bu oturumda yazdığı rüya ve sorular birincil sinyaldir; önceki yorumlardan türeyen temalar yalnızca düşük sesli arka plan olabilir.',
  ];
  if (!memorySnippet) return lines.join('\n');
  if (memorySnippet.isSelf) {
    lines.push('- Profil hesap sahibinin kendisi; anlatımı sen/siz dilinde tut ve üçüncü şahsa kayma.');
  } else {
    lines.push(`- Bu okuma hesap sahibinden farklı biri için olabilir. Ana yorum seçili profil olan ${profileName} için sabit kalmalı.`);
  }
  if (memorySnippet.relationshipLabel) lines.push(`- Hesap sahibiyle yakınlık: ${memorySnippet.relationshipLabel}.`);
  if (memorySnippet.profileGender) lines.push(`- Profil cinsiyet bilgisi: ${memorySnippet.profileGender}. Cinsiyetli hitapları buna göre dikkatli kullan.`);
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
      `- Önceki yorumlardan düşük öncelikli temalar: ${memorySnippet.readingTopicGroups
        .slice(0, 6)
        .map((item) => `${item.group || 'Genel'} / ${item.subgroup || 'Diğer'}: ${item.label}`)
        .join('; ')}.`,
    );
  }
  if (memorySnippet.relevantObservations?.length) {
    lines.push(
      `- İlgili olabilecek seçilmiş hafıza: ${memorySnippet.relevantObservations
        .slice(0, 6)
        .map((item) => [item.source === 'user-stated' ? 'kullanıcı' : 'yorum', item.title, item.summary].filter(Boolean).join(' | '))
        .join('; ')}.`,
    );
  }
  return lines.join('\n');
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
      '## Rüya Yorumu Direktifleri',
      `- Bu oturumun alanı rüya yorumu. Falcının ana branşı ${identity.primaryDomainLabel} olsa bile kahve, fincan, telve, el çizgisi, tarot kartı veya doğum haritası objeleriyle yorum yapma.`,
      `- ${params.assistantLabel} personasında kal; kendini tanıtma, sistemden veya yapay zekadan bahsetme.`,
      '- Kullanıcının anlattığı rüya bu oturumun ana kaynağıdır. Rüyada söylenmeyen sahne, kişi veya olay uydurma.',
      '- Sembol dilini psikolojik ve sezgisel oku; kesin kehanet, korkutucu felaket, ölüm, ağır hastalık veya geri dönülmez hüküm verme.',
      '- Sağlık ve finans konularında tanı, tedavi, garanti kazanç veya kesin karar dili kullanma.',
      '- Yanıt başlıksız, listesiz, sohbet gibi akan düz yazı olsun. Markdown, yıldızlı vurgu, emoji, ikon veya dekoratif sembol kullanma.',
      '- Ana rüya yorumunda hedef uzunluk 800-900 token aralığıdır; max 1000 tokenı aşmaya çalışma.',
      '- Soru yanıtlarında önce soruya net cevap ver, sonra rüya bağlamından 1-2 gerekçe ve kısa tavsiye ekle.',
      '- Tüm oturum boyunca seçili profil, rüya metni, ilk yorum ve önceki soru cevap bağlamı korunmalı; başka kişiye kayma.',
      '- Kapanışta yeni imza cümlesi üretme; sistem persona kapanışını sonradan ekleyecek.',
      '- Bu oturumda daha önce kullanılan kapanış cümlelerini veya çok yakın varyasyonlarını tekrar etme.',
      '- Türkçe karakterleri daima doğru UTF-8 yaz: ç, ğ, ı, İ, ö, ş, ü. Bozuk karakter dizileri kullanma.',
      params.usedClosings?.length ? `- Bu oturumda kullanılmış kapanışlar: ${params.usedClosings.join(' | ')}` : '',
    ].filter(Boolean).join('\n'),
    buildDreamMemoryContext(params.profileName, params.memorySnippet),
  ].join('\n\n');
}

export function createDreamOpening(params: {
  assistantId: string;
  profileName: string;
}) {
  const id = personaId(params.assistantId);
  const options = PERSONA_DREAM_OPENINGS[id] || PERSONA_DREAM_OPENINGS['durdane-hanim'];
  return options[hashString(`${id}:${params.profileName}:dream-opening`) % options.length];
}

export async function createDreamInterpretation(params: {
  profile: SubjectProfile;
  assistantId: string;
  assistantLabel: string;
  dreamText: string;
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
    `Rüya metni:\n${params.dreamText}`,
    'Bu rüyayı önce ana duygu, sonra belirgin semboller, sonra kişinin bugünkü iç dünyası ve yakın dönem farkındalığı üzerinden yorumla.',
    'Son paragrafta uygulanabilir, sakin ve persona uyumlu bir öneri ver; kapanış cümlesi üretme.',
  ].join('\n\n');
  const data = await generateGeminiTextDirect(
    {
      system_instruction: { parts: [{ text: systemText }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: {
        temperature: 0.72,
        maxOutputTokens: DREAM_MAX_OUTPUT_TOKENS,
      },
    },
    70000,
  );
  const completed = completeWithDreamClosing({
    text: data.text,
    assistantId: params.assistantId,
    seed: `${params.profile.profileId}:${params.dreamText.slice(0, 180)}`,
    usedClosings: params.usedClosings,
    forceClosing: data.finishReason === 'MAX_TOKENS',
  });
  return { text: completed.text, closingSentence: completed.closingSentence, modelName: data.model, usage: data.usage };
}

export async function createDreamFollowUp(params: {
  profileName: string;
  assistantId: string;
  assistantLabel: string;
  dreamText: string;
  interpretationText: string;
  question: string;
  previousFollowUps?: DreamChatMessage[];
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
    `İlk rüya metni:\n${params.dreamText}`,
    `İlk rüya yorumu:\n${params.interpretationText}`,
    conversation ? `Önceki soru cevaplar:\n${conversation}` : '',
    `Kullanıcının son sorusu:\n${params.question}`,
    'Sadece son soruya cevap ver; ama rüya metni, ilk yorum ve önceki soru cevap bağlamını bozma. 250-450 token aralığında doyurucu ama toparlanmış cevap ver.',
  ].filter(Boolean).join('\n\n');
  const data = await generateGeminiTextDirect(
    {
      system_instruction: { parts: [{ text: systemText }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: DREAM_MAX_OUTPUT_TOKENS,
      },
    },
    70000,
  );
  const completed = completeWithDreamClosing({
    text: data.text,
    assistantId: params.assistantId,
    seed: `${params.profileName}:${params.question}:${params.previousFollowUps?.length || 0}`,
    usedClosings: params.usedClosings,
    forceClosing: data.finishReason === 'MAX_TOKENS',
  });
  return { text: completed.text, closingSentence: completed.closingSentence, modelName: data.model, usage: data.usage };
}
