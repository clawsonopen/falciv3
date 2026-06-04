import type { SubjectProfile, ProfileMemorySnippet } from '../types/memory';
import {
  PERSONAL_FOLLOW_UP_MAX_OUTPUT_TOKENS,
  PERSONAL_FOLLOW_UP_TOKEN_INSTRUCTION,
  PERSONAL_INITIAL_READING_MAX_OUTPUT_TOKENS,
  PERSONAL_INITIAL_READING_TOKEN_INSTRUCTION,
} from '../config/llmTokenPolicy';
import { generateGeminiTextDirect } from './geminiDirectService';
import { FORTUNE_PERSONA_DATA } from './fortunePersonaData';
import {
  appendHealthProfessionalReminder,
  completeWithRememberedPersonaClosing,
  isHealthClosingSentence,
  sanitizePublicReadingLanguage,
  selectAnimalClosingSentence,
  stripPersonaSelfIntroduction,
  userAskedHealthConcern,
} from './personaClosingService';
import { buildAnimalProfileInstructionFromMemory, buildAnimalProfileInstructionFromProfile, isAnimalProfile } from './animalProfilePrompt';
import { formatPromptMemoryPack } from './memoryPromptPackFormatter';
import { formatPetMentionMemoryContext, formatStandardPersonalMemoryContext } from './personalMemoryPromptContext';
import { cleanFollowUpReply, FOLLOW_UP_CHAT_CONTRACT, getSimpleFollowUpReply } from './followUpResponseService';

type PersonaId = keyof typeof FORTUNE_PERSONA_DATA;

export type DreamChatMessage = {
  role: 'user' | 'assistant';
  text: string;
};

const DREAM_MAX_OUTPUT_TOKENS = PERSONAL_INITIAL_READING_MAX_OUTPUT_TOKENS;
const DREAM_FOLLOW_UP_MAX_OUTPUT_TOKENS = PERSONAL_FOLLOW_UP_MAX_OUTPUT_TOKENS;

const DREAM_FORBIDDEN_CLOSING_TERMS =
  /kahve|fincan|telve|tabak|avuç|el okuması|el çizg|tarot|kart|melek kart|rune|i ching|hexagram|doğum haritası|numeroloji/i;

const PERSONA_DREAM_OPENINGS: Record<string, string[]> = {
  'suzan': [
    'Gel canım, rüyanın ucundan birlikte tutalım. Rüyalar bazen insanın gönlünde sakladığı şeyi usulca kapıya bırakır.',
    'Anlat güzelim, gece sana hangi işareti getirmiş bakalım. Rüyanı ne kadar canlı tarif edersen ben de o kadar temiz okurum.',
  ],
  'teoman': [
    'Gel evladım, rüya dediğin bazen gündüzün sustuğu yerden konuşur. Sakince anlat, ne gördün, nerede oldun, yanında kim vardı?',
    'Hadi bakalım, gece zihnin sana nasıl bir perde açmış görelim. Rüyanın sahnesini, renklerini ve sende bıraktığı hissi anlat.',
  ],
  'selin': [
    'Tatlım, rüyalar bazen bilinçaltının en zarif bildirimidir. Bana sahneyi, duyguyu ve uyandığında üstünde kalan izi anlat.',
    'Gel, bu rüyaya biraz farkındalıkla bakalım. Ne gördüğünü, kimlerin olduğunu ve rüyanın sende nasıl bir his bıraktığını tarif et.',
  ],
  'berk': [
    'Dostum, rüyayı bir zihin haritası gibi birlikte açalım. Olay sırasını, dikkat çeken sembolleri ve uyandığında kalan duyguyu anlat.',
    'Kardeşim, rüyalar bazen zihnin arka planda işlediği dosyaları gösterir. Ne gördün, nerede geçti, en çok hangi sahne aklında kaldı?',
  ],
  arin: [
    'Güzel ruh, rüyanın kapısını yavaşça aralayalım. Bana görüntüleri, hisleri ve uyandığında içinde kalan titreşimi anlat.',
    'Canım, rüyalar bazen iç dünyanın sembollerle konuşan şiiridir. Ne gördüğünü, hangi rengin veya sahnenin seni tuttuğunu tarif et.',
  ],
};

const ANIMAL_DREAM_OPENINGS: Record<string, string[]> = {
  'suzan': [
    'Gel canım, bu minik rüya kapısını onun küçük dünyasına uygun şekilde aralayalım. Uykudaki hallerini, çıkardığı küçük sesleri ya da içine doğan sevimli sahneyi anlat.',
    'Anlat güzelim, bu kez geceyi onun küçük dünyasından okuyalım. Belki bir pati kıpırtısı, belki bir pencere merakı, belki de evde saklı tatlı bir bağ vardır.',
  ],
  'teoman': [
    'Hadi bakalım, küçük dostun uyku âlemini yumuşak bir sembol diliyle konuşalım. Ne gördün, nasıl uyudu, hangi ses ya da hareket aklında kaldı?',
    'Gel evladım, hayvanların uykusunda bile evin kalbi atar. Onun minik hallerini anlat, biz de bunu sevgiyle ve sembolik bir dille yorumlayalım.',
  ],
  'selin': [
    'Tatlım, bunu onun küçük evreninden gelen yumuşak bir sembol gibi ele alalım. Uykudaki hali, gün içindeki enerjisi veya içine doğan sahne neydi?',
    'Gel, bu minik uyku izine farkındalıkla bakalım. Hayvanların duyduğu kokular, sesler ve kurduğu bağlar bazen çok zarif bir hikâye anlatır.',
  ],
  'berk': [
    'Dostum, bunu tatlı bir uyku notu gibi açalım. Onun gün içindeki ritmini, uyurken yaptığı hareketleri ya da aklına gelen sevimli sahneyi anlat.',
    'Kardeşim, bu ekran açılsa bile akışı küçük dostunun uykusu, oyunu, kokuları ve evdeki bağı üzerinden doğru yere taşıyalım.',
  ],
  arin: [
    'Güzel ruh, bu kez rüyanın kapısı onun küçük dünyasına aralansın. Uykudaki hali, minik sesleri ya da kalbine düşen sahneyi anlat.',
    'Canım, hayvanların sessiz dünyası bazen rüya gibi parlar. Onun kokularını, ışıklarını ve sevgi bağını yumuşak bir sembol diliyle okuyalım.',
  ],
};

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
  allowHealthClosing?: boolean;
  isAnimalProfile?: boolean;
}) {
  const id = personaId(params.assistantId);
  if (params.isAnimalProfile) {
    return selectAnimalClosingSentence({
      assistantId: id,
      seed: `dream:${params.seed}`,
      usedClosings: params.usedClosings,
    });
  }
  const library = FORTUNE_PERSONA_DATA[id].closingLibrary as Record<string, readonly string[]>;
  const used = new Set((params.usedClosings || []).map((item) => item.trim()).filter(Boolean));
  const options = Object.values(library)
    .flatMap((items) => [...items])
    .filter(
      (sentence) =>
        sentence &&
        !DREAM_FORBIDDEN_CLOSING_TERMS.test(sentence) &&
        !used.has(sentence) &&
        (params.allowHealthClosing || !isHealthClosingSentence(sentence)),
    );
  if (!options.length) return '';
  return options[hashString(`dream:${id}:${params.seed}:${used.size}`) % options.length];
}

function completeWithDreamClosing(params: {
  text: string;
  assistantId: string;
  seed: string;
  usedClosings?: string[];
  forceClosing?: boolean;
  allowHealthClosing?: boolean;
  isAnimalProfile?: boolean;
}) {
  const base = sanitizePublicReadingLanguage(stripPersonaSelfIntroduction(trimIncompleteTail(cleanGeneratedText(params.text))));
  const shouldClose = params.forceClosing || !hasTerminalPunctuation(base);
  const closing = selectDreamClosing(params);
  if (!closing) return { text: base, closingSentence: '' };
  if (!base) return { text: closing, closingSentence: closing };
  if (!shouldClose && base.includes(closing)) return { text: base, closingSentence: closing };
  return { text: `${base}\n\n${closing}`.trim(), closingSentence: closing };
}

function buildDreamMemoryContext(profileName: string, memorySnippet?: ProfileMemorySnippet | null) {
  const isAnimalDream = memorySnippet?.relationshipPrimary === 'evcil_hayvan';
  const lines = [
    '## Profil ve Hafıza Bağlamı',
    isAnimalDream
      ? `- Bu rüya/uyku sembol yorumu ${profileName || 'seçili profil'} adlı evcil hayvan için yapılıyor.`
      : `- Bu rüya yorumu ${profileName || 'seçili kişi'} için yapılıyor.`,
    isAnimalDream
      ? '- Bu akışta anlatılan şey hayvanın kesin iç deneyimi gibi sunulmaz; sahibinin gözlemi, sezgisel sahnesi ve sembolik uyku hali olarak yorumlanır.'
      : '- Rüya yorumu kişiye özel bağlamla yapılır; yine de hafızayı ham kayıt gibi açıklama.',
    isAnimalDream
      ? '- Kullanıcının anlattığı uyku hali, küçük hareket, ses, gün içi sahne veya takip sorusu birincil sinyaldir; insan psikolojisi şablonu kurma.'
      : '- Kullanıcının bu oturumda yazdığı rüya ve sorular birincil sinyaldir; önceki yorumlardan türeyen temalar yalnızca düşük sesli arka plan olabilir.',
  ];
  if (!memorySnippet) return lines.join('\n');
  if (memorySnippet.isSelf) {
    lines.push('- Profil hesap sahibinin kendisi; anlatımı sen/siz dilinde tut ve üçüncü şahsa kayma.');
  } else {
    lines.push(`- Bu okuma hesap sahibinden farklı biri için olabilir. Ana yorum seçili profil olan ${profileName} için sabit kalmalı.`);
  }
  if (memorySnippet.relationshipLabel) lines.push(`- Hesap sahibiyle yakınlık: ${memorySnippet.relationshipLabel}.`);
  const animalContext = buildAnimalProfileInstructionFromMemory(memorySnippet);
  if (animalContext) lines.push(animalContext);
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
  const promptMemoryPack = formatPromptMemoryPack(memorySnippet);
  if (promptMemoryPack) lines.push(promptMemoryPack);
  if (memorySnippet.relevantObservations?.length) {
    lines.push(
      `- İlgili olabilecek seçilmiş hafıza: ${memorySnippet.relevantObservations
        .slice(0, 6)
        .map((item) => [item.source === 'user-stated' ? 'kullanıcı' : 'yorum', item.title, item.summary].filter(Boolean).join(' | '))
        .join('; ')}.`,
    );
  }
  const standardMemory = formatStandardPersonalMemoryContext({
    profileName,
    readingLabel: 'rüya yorumu',
    memorySnippet,
    includePromptPack: false,
  });
  if (standardMemory) lines.push(standardMemory);
  return lines.join('\n');
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
  const isAnimalDream = Boolean(params.isAnimalProfile || params.memorySnippet?.relationshipPrimary === 'evcil_hayvan');
  return [
    identity.systemBody,
    [
      '## Rüya Yorumu Direktifleri',
      `- Bu oturumun alanı rüya yorumu. Yorumcunun ana branşı ${identity.primaryDomainLabel} olsa bile kahve, fincan, telve, el çizgisi, tarot kartı veya doğum haritası objeleriyle yorum yapma.`,
      '- Seçili persona yalnızca ses, hitap ve yorum ritmini belirler; kendini tanıtma, adınla/rolünle başlama, sistemden veya yapay zekadan bahsetme.',
      '- Kullanıcıya görünen metinde yorumcu/persona adı, public label veya rol tanıtımı yazma; doğrudan rüya yorumuna gir.',
      '- Kullanıcıya görünen metinde hukuken kesin gelecek iddiası kurma; "yorum", "okuma", "sembolik ritüel", "sembolik yorum", "izlenim", "olasılık", "eğilim" dili kullan.',
      '- Sağlık ve finans alanlarında spesifik tavsiye verme. İnsan sağlığıyla ilgili endişede doktora/uygun sağlık uzmanına, hayvan sağlığıyla ilgili endişede veterinere görünmeyi nazikçe öner.',
      '- "Şunu ye/iç geçer", "kesin geçecek", "kesin iyileşecek", ilaç/doz/tedavi/beslenme reçetesi veya kesin sonuç dili yasak.',
      '- Kullanıcı bir soru yazdıysa bunu kendi aklına gelmiş gibi sahiplenme; "aklıma geldi", "şimdi aklıma geldi" gibi ifadeler kullanma.',
      '- Hafıza veya önceki okuma kaynağını açık etme; "önceki okumanda", "hafızanda", "sana daha önce çıkmıştı" gibi cümleler kurma.',
      '- Kullanıcının anlattığı rüya bu oturumun ana kaynağıdır. Rüyada söylenmeyen sahne, kişi veya olay uydurma.',
      isAnimalDream
        ? '- Seçili profil evcil hayvansa bu akışı insan rüyası analizi gibi kurma. Hayvanın uyku hali, gün içi izleri, kokular, ince sesler, pencere ziyaretçileri, evdeki diğer hayvanlarla ilişkisi ve insanlarıyla kalp bağı üzerinden sembolik yorumla.'
        : '',
      isAnimalDream
        ? '- Hayvanın kesin olarak ne rüya gördüğünü iddia etme; "sanki", "bu iz", "bu uyku hali", "sembolik olarak" gibi yumuşak olasılık dili kullan. Hayvana insan gibi kariyer, romantik ilişki, evlilik, okul veya insan sosyal çevresi yükleme.'
        : '',
      '- Sembol dilini psikolojik ve sezgisel oku; kesin hüküm, korkutucu felaket, ölüm, ağır hastalık veya geri dönülmez hüküm verme.',
      '- Sağlık ve finans konularında tanı, tedavi, garanti kazanç veya kesin karar dili kullanma.',
      '- Yanıt başlıksız, listesiz, sohbet gibi akan düz yazı olsun. Markdown, yıldızlı vurgu, emoji, ikon veya dekoratif sembol kullanma.',
      `- Ana rüya yorumunda ${PERSONAL_INITIAL_READING_TOKEN_INSTRUCTION}`,
      `- Takip sorularında: ${FOLLOW_UP_CHAT_CONTRACT}`,
      '- Soru yanıtlarında önce soruya net cevap ver, sonra rüya bağlamından 1-2 gerekçe ve kısa tavsiye ekle.',
      '- Tüm oturum boyunca seçili profil, rüya metni, ilk yorum ve önceki soru cevap bağlamı korunmalı; başka kişiye kayma.',
      '- Türkçe karakterleri daima doğru UTF-8 yaz: ç, ğ, ı, İ, ö, ş, ü. Bozuk karakter dizileri kullanma.',
    ].filter(Boolean).join('\n'),
    buildDreamMemoryContext(params.profileName, params.memorySnippet),
  ].join('\n\n');
}

export function createDreamOpening(params: {
  assistantId: string;
  profileName: string;
  isAnimalProfile?: boolean;
}) {
  const id = personaId(params.assistantId);
  const library = params.isAnimalProfile ? ANIMAL_DREAM_OPENINGS : PERSONA_DREAM_OPENINGS;
  const options = library[id] || library['suzan'];
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
    isAnimalProfile: params.profile.relationshipPrimary === 'evcil_hayvan',
  });
  const animalProfile = isAnimalProfile(params.profile);
  const userText = [
    `Profil adı: ${params.profile.displayName}`,
    buildAnimalProfileInstructionFromProfile(params.profile),
    formatPetMentionMemoryContext(params.dreamText, params.memorySnippet),
    animalProfile ? `Uyku/rüya notu:\n${params.dreamText}` : `Rüya metni:\n${params.dreamText}`,
    animalProfile
      ? 'Bunu hayvanın kesin gördüğü rüya gibi değil; sahibinin gözlemi, sezgisel sahnesi ve sembolik uyku hali gibi yorumla. Önce hayvanın uyku/oyun/duyu dünyasını, sonra evdeki bağları ve küçük sosyal dinamikleri, son bölümde de sahibine uygulanabilir yumuşak bir öneriyi işle.'
      : 'Bu rüyayı önce ana duygu, sonra belirgin semboller, sonra kişinin bugünkü iç dünyası ve yakın dönem farkındalığı üzerinden yorumla.',
    animalProfile
      ? 'Pati, kanat, kuyruk, kulak, beden hareketi, pencere merakı, diğer hayvanlarla oyun/kıskançlık/barışma, insanların duymadığı ses ve kokular, sevdiği insanların kalbindeki yeri gibi evcil hayvan dünyasına ait malzemeleri kullan; kapanış cümlesi üretme.'
      : 'Son paragrafta uygulanabilir, sakin ve persona uyumlu bir öneri ver; kapanış cümlesi üretme.',
    PERSONAL_INITIAL_READING_TOKEN_INSTRUCTION,
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
    { usageMode: 'raw' },
  );
  const completed = await completeWithRememberedPersonaClosing({
    text: data.text,
    assistantId: params.assistantId,
    domain: 'dream',
    seed: `${params.profile.profileId}:${params.dreamText.slice(0, 180)}`,
    usedClosings: params.usedClosings,
    allowHealthClosing: userAskedHealthConcern(params.dreamText),
    isAnimalProfile: params.profile.relationshipPrimary === 'evcil_hayvan',
  });
  return {
    text: appendHealthProfessionalReminder(completed.text, {
      userText: params.dreamText,
      isAnimalProfile: params.profile.relationshipPrimary === 'evcil_hayvan',
    }),
    closingSentence: completed.closingSentence,
    modelName: data.model,
    usage: data.usage,
  };
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
  const simpleReply = getSimpleFollowUpReply(params.question);
  if (simpleReply) {
    return {
      text: simpleReply,
      closingSentence: '',
      modelName: 'local-follow-up-reply',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    };
  }
  const systemText = buildBaseSystem({
    assistantId: params.assistantId,
    assistantLabel: params.assistantLabel,
    profileName: params.profileName,
    memorySnippet: params.memorySnippet,
    usedClosings: params.usedClosings,
    isAnimalProfile: params.memorySnippet?.relationshipPrimary === 'evcil_hayvan',
  });
  const isAnimalDream = params.memorySnippet?.relationshipPrimary === 'evcil_hayvan';
  const conversation = (params.previousFollowUps || [])
    .map((message) => `${message.role === 'user' ? 'Kullanıcı' : 'Yorumcu'}: ${message.text}`)
    .join('\n');
  const userText = [
    `Profil adı: ${params.profileName}`,
    buildAnimalProfileInstructionFromMemory(params.memorySnippet),
    isAnimalDream ? `İlk uyku/rüya metni:\n${params.dreamText}` : `İlk rüya metni:\n${params.dreamText}`,
    isAnimalDream ? `İlk uyku/rüya yorumu:\n${params.interpretationText}` : `İlk rüya yorumu:\n${params.interpretationText}`,
    conversation ? `Önceki soru cevaplar:\n${conversation}` : '',
    `Kullanıcının son sorusu:\n${params.question}`,
    formatPetMentionMemoryContext(params.question, params.memorySnippet),
    isAnimalDream
      ? `Sadece son soruya cevap ver; ama evcil hayvanın uyku hali, sembolik ilk yorum ve önceki soru cevap bağlamını bozma. İnsan rüyası/psikolojisi şablonuna kayma. ${PERSONAL_FOLLOW_UP_TOKEN_INSTRUCTION}`
      : `Sadece son soruya cevap ver; ama rüya metni, ilk yorum ve önceki soru cevap bağlamını bozma. ${PERSONAL_FOLLOW_UP_TOKEN_INSTRUCTION}`,
  ].filter(Boolean).join('\n\n');
  const data = await generateGeminiTextDirect(
    {
      system_instruction: { parts: [{ text: systemText }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: DREAM_FOLLOW_UP_MAX_OUTPUT_TOKENS,
      },
    },
    70000,
    { usageMode: 'raw' },
  );
  const completed = await completeWithRememberedPersonaClosing({
    text: data.text,
    assistantId: params.assistantId,
    domain: 'dream',
    seed: `${params.profileName}:${params.question}:${params.previousFollowUps?.length || 0}`,
    usedClosings: params.usedClosings,
    allowHealthClosing: userAskedHealthConcern(params.question),
    isAnimalProfile: params.memorySnippet?.relationshipPrimary === 'evcil_hayvan',
  });
  return {
    text: cleanFollowUpReply(appendHealthProfessionalReminder(completed.text, {
      userText: params.question,
      isAnimalProfile: params.memorySnippet?.relationshipPrimary === 'evcil_hayvan',
    })),
    closingSentence: completed.closingSentence,
    modelName: data.model,
    usage: data.usage,
  };
}
