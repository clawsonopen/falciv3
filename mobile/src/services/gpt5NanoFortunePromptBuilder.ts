import type { DevSettings } from '../types';
import type { ProfileMemorySnippet } from '../types/memory';
import { FORTUNE_PERSONA_DATA } from './fortunePersonaData';
import { buildGemmaFortunePrompt } from './gemmaFortunePromptBuilder';
import type { CoffeeMode, FortuneImages, FortuneMessage, FortuneReadingType } from './fortunePromptBuilder';

type PersonaId = keyof typeof FORTUNE_PERSONA_DATA;
type ClosingTone = keyof (typeof FORTUNE_PERSONA_DATA)[PersonaId]['closingLibrary'];

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

function selectClosingTone(messages: FortuneMessage[], library: Record<string, string[]>) {
  const messageText = messages.map((message) => message.text || '').join(' ').toLocaleLowerCase('tr-TR');
  const heuristics: Array<[ClosingTone, string[]]> = [
    ['warning', ['aldat', 'yalan', 'nazar', 'kavga', 'dikkat', 'düşman', 'engel', 'kork']],
    ['soothing', ['üzgün', 'yorgun', 'bunald', 'kaygı', 'stres', 'yoruld', 'yalnız', 'kırgın']],
    ['hopeful', ['aşk', 'kısmet', 'evlilik', 'barış', 'para', 'iş', 'müjde', 'başarı']],
    ['mysterious', ['rüya', 'sezgi', 'enerji', 'gizli', 'sır', 'işaret', 'gece']],
  ];
  const hit = heuristics.find(([tone, keywords]) => library[tone] && keywords.some((keyword) => messageText.includes(keyword)));
  return hit?.[0] || (library.warm ? 'warm' : (Object.keys(library)[0] as ClosingTone) || 'warm');
}

function selectClosingSentence(id: PersonaId, messages: FortuneMessage[], sessionId: string) {
  const library = FORTUNE_PERSONA_DATA[id].closingLibrary as Record<string, string[]>;
  const tone = selectClosingTone(messages, library);
  let options = library[tone] || library.warm || [];
  const sessionText = messages.map((message) => message.text || '').join(' ');
  const userAskedPaceTheme = /\b(telaş|acele|yetiş|yetişem|panik)\b/i.test(sessionText);
  if (!userAskedPaceTheme) {
    const nonPaceOptions = options.filter((option) => !/\b(telaş|acele|yetiş|yetişem|panik|koştur|koşuştur|yük|ağırlık)\b/i.test(option));
    if (nonPaceOptions.length) options = nonPaceOptions;
  }
  const unused = options.filter((option) => !sessionText.includes(option));
  if (unused.length) options = unused;
  if (!options.length) return '';
  const turnCount = messages.filter((message) => (message.text || '').trim()).length;
  const memorySalt = [
    ...((messages[0]?.text || '').match(/\b[\p{L}]{4,}\b/giu) || []).slice(0, 16),
    String(messages.length),
  ].join(':');
  return options[hashString(`${sessionId}:${id}:${tone}:${turnCount}:${memorySalt}:gpt5nano`) % options.length];
}

function userPromptForAiBrew(params: { profileName: string; messages: FortuneMessage[] }) {
  const lastUserText = [...params.messages].reverse().find((message) => message.role === 'user')?.text?.trim() || '';
  return [
    `Profil adı: ${params.profileName || 'Kullanıcı'}`,
    '',
    'Fal modu: benim yerime içilmiş gibi sezgisel kahve falı',
    '',
    'Niyetim / sorum:',
    lastUserText || 'Falımı aç.',
    '',
    'Dürdane Hanım olarak benim için kahve falı bak. Gerçek fincan görseli yok; kahvemi içmiş ve fincanımı kapatmışım gibi yorumla.',
  ].join('\n');
}

function buildMemoryLines(profileName: string, memorySnippet: ProfileMemorySnippet | null | undefined, readingType: FortuneReadingType, coffeeMode: CoffeeMode) {
  const lines = [
    `Bu fal ${profileName || 'seçili kişi'} için bakılıyor.`,
    `Fal türü: ${readingType === 'palm' ? 'el falı / pati falı' : coffeeMode === 'ai-brew' ? 'benim yerime iç kahve falı' : 'kahve falı'}.`,
  ];
  if (!memorySnippet) return lines;

  const profileInfo = memorySnippet.profileInfo;
  const birth = memorySnippet.birthChartData;
  lines.push(`Profil: ad=${profileInfo?.displayName || profileName || 'bilinmiyor'}, hesap sahibi mi=${profileInfo?.isAccountOwner ? 'evet' : 'hayır'}, yakınlık=${profileInfo?.relationshipToAccountOwner || memorySnippet.relationshipLabel || 'bilinmiyor'}.`);
  if (birth?.birthDate) lines.push(`Doğum bilgisi arka plan sezgisi olarak mevcut: tarih=${birth.birthDate}${birth.timeKnown && birth.birthTime ? `, saat=${birth.birthTime}` : ''}.`);
  if (memorySnippet.relationshipPrimary === 'arkadas' || memorySnippet.relationshipPrimary === 'akraba') {
    lines.push('Yakınlık arkadaş/akraba sınıfında; romantik aşk, flört veya sevgililik yorumu yapma.');
  }
  if (memorySnippet.relationshipPrimary === 'evcil_hayvan') {
    lines.push(`Bu profil bir evcil hayvan profili. Tür bilgisi: ${memorySnippet.petSpecies || memorySnippet.relationshipLabel || 'evcil hayvan'}.`);
  }
  if (memorySnippet.profileGender) lines.push(`Profil cinsiyet bilgisi: ${memorySnippet.profileGender}. Hitapları buna göre güvenli seç.`);
  if (memorySnippet.isSelf) {
    lines.push('Bu profil hesap sahibinin kendisi; ana anlatımda üçüncü tekil şahsa kayma.');
  } else {
    lines.push(`Bu okuma hesap sahibinden farklı biri için. Gerekirse ${profileName || 'profil'} adını kullan ve anlatımı karıştırma.`);
  }
  if (memorySnippet.userStatedTopics?.length) lines.push(`Kullanıcının söylediği tekrar eden konular: ${memorySnippet.userStatedTopics.slice(0, 8).join(', ')}.`);
  if (memorySnippet.userTopicGroups?.length) lines.push(`Gruplu konu hafızası: ${memorySnippet.userTopicGroups.slice(0, 8).map((item) => `${item.group || 'Genel'} / ${item.subgroup || 'Diğer'}: ${item.label}`).join('; ')}.`);
  if (memorySnippet.prominentRelations?.length) lines.push(`Öne çıkan ilişkiler: ${memorySnippet.prominentRelations.slice(0, 5).map((item) => `${item.label} (${item.relationship || 'ilgili kişi'})`).join(', ')}.`);
  if (memorySnippet.relevantObservations?.length) {
    lines.push(`Seçilmiş hafıza izleri: ${memorySnippet.relevantObservations.slice(0, 6).map((item) => [item.title, item.summary].filter(Boolean).join(' | ')).join('; ')}.`);
  }
  lines.push('Hafızayı kayıt gibi açıklama; sadece doğal tanışıklık hissi olarak kullan.');
  return lines;
}

function gpt5NanoPersonaPrompt() {
  return [
    "Sen Dürdane Hanım'sın. Türkçe konuşan, sıcak, sezgili, mahalle kültürünü bilen ama kullanıcıyı korkutmayan bir kahve falı yorumcususun.",
    '',
    'Kullanıcıya kahve falı bakıyorsun. Bu testte gerçek fincan görseli yok; kullanıcı kahvesini içmiş ve fincanı kapatmış gibi, niyet üzerinden sezgisel kahve falı açıyorsun.',
    '',
    'Asla sistem, model, yapay zeka, prompt, API, kural veya teknik altyapıdan bahsetme. Tamamen karakterin içinde kal.',
    '',
    'Sesin:',
    '- Anaç, samimi, doğal ve Türkçe konuşma diline yakın olsun.',
    '- Kullanıcıya ara sıra “canım”, “evladım”, “güzelim” gibi sıcak hitaplarla seslenebilirsin ama abartma.',
    '- Düz yazı yaz. Başlık, madde listesi, rapor dili kullanma.',
    '- Fal gibi konuş ama kesin kehanet verme. “Görünen ihtimal”, “yakına düşen yol”, “bu enerji böyle giderse” gibi olasılık dili kullan.',
    '- Ölüm, ağır hastalık, büyük kaza, felaket, kesin ayrılık veya kesin kötü haber söyleme.',
    '- Finans ve sağlık konularında kesin tavsiye verme; sadece dikkat, denge ve uzman desteği dili kullan.',
    '',
    'Yorum yapısı:',
    '- Kısa, sıcak bir giriş yap.',
    '- Kahve falı sembolleri varmış gibi ama çok uydurma durmayacak şekilde fincan/telve dili kullan.',
    '- Geçmişten gelen bir iz, bugünkü enerji, yakın gelecek ve tavsiye akışını kur.',
    '- Kullanıcının niyetine veya sorusuna doğal şekilde bağlan.',
    '- 4-6 kısa paragraf yaz.',
    '- Türkçe karakterleri doğru UTF-8 kullan: ç, ğ, ı, İ, ö, ş, ü.',
  ].join('\n');
}

function dataImage(base64: string) {
  return `data:image/jpeg;base64,${base64}`;
}

function buildUserContent(params: {
  text: string;
  images: FortuneImages;
  readingType: FortuneReadingType;
  coffeeMode: CoffeeMode;
  isFollowUp?: boolean;
}) {
  const content: Array<Record<string, unknown>> = [{ type: 'input_text', text: params.text }];
  if (params.isFollowUp) return content;
  if (params.coffeeMode === 'ai-brew') return content;
  if (params.readingType === 'palm' && params.images.palm) {
    content.push({ type: 'input_image', image_url: dataImage(params.images.palm), detail: 'auto' });
    return content;
  }
  if (params.readingType === 'coffee' && params.coffeeMode === 'upload') {
    if (params.images.cup) {
      content.push({ type: 'input_text', text: 'Fincan içi görseli yüklendi. Bunu fincanın iç yüzeyi, derinliği, kenar akışı ve telve birikimi olarak oku.' });
      content.push({ type: 'input_image', image_url: dataImage(params.images.cup), detail: 'auto' });
    }
    if (params.images.saucer) {
      content.push({ type: 'input_text', text: 'Kahve tabağı görseli yüklendi. Bunu tabak yüzeyi, yayılma, göllenme ve dış dünya yansıması olarak oku.' });
      content.push({ type: 'input_image', image_url: dataImage(params.images.saucer), detail: 'auto' });
    }
  }
  return content;
}

export function buildGpt5NanoFortunePrompt(params: {
  sessionId: string;
  devSettings: DevSettings;
  profileName: string;
  readingType: FortuneReadingType;
  coffeeMode: CoffeeMode;
  memorySnippet?: ProfileMemorySnippet | null;
  messages: FortuneMessage[];
  images: FortuneImages;
  isFollowUp?: boolean;
}) {
  const id = personaId(params.devSettings.assistantId);
  const equivalentPrompt = buildGemmaFortunePrompt({
    sessionId: params.sessionId,
    devSettings: params.devSettings,
    profileName: params.profileName,
    readingType: params.readingType,
    coffeeMode: params.coffeeMode,
    memorySnippet: params.memorySnippet,
    messages: params.messages,
    images: params.images,
    isFollowUp: params.isFollowUp,
  });
  const isAiBrew = params.readingType === 'coffee' && params.coffeeMode === 'ai-brew';
  const selectedReadingDomain =
    params.readingType === 'palm'
      ? 'el falı / avuç içi çizgileri'
      : params.coffeeMode === 'ai-brew'
        ? 'kişinin niyetine içilmiş gibi kahve falı'
        : 'kahve falı / fincan ve tabak';
  const developerMessage = [
    equivalentPrompt.systemInstruction,
    '## GPT-5 nano Deney Hattı',
    `Bu ayrı OpenAI prompt builder çıktısıdır. Seçili model: ${params.devSettings.modelName}.`,
    `Bu oturumun fal türü: ${selectedReadingDomain}.`,
    'Tamamen karakterin içinde kal; sistem, model, yapay zeka, prompt, API veya teknik altyapıdan bahsetme.',
    'Yanıtı başlıksız, maddesiz ve sohbet gibi akan düz yazı halinde ver.',
    'Markdown biçimlendirmesi, yıldızlı vurgu, madde imi, numaralı liste, emoji, ikon veya dekoratif sembol üretme.',
    'Giriş bölümünü kısa tut; esas ağırlığı fal yorumuna ver.',
    'Geçmiş izi, bugünkü enerji, yakın gelecek ve tavsiye akışını birlikte kur.',
    'Kesin kehanet verme; görünen ihtimal, yakına düşen yol ve bu enerji böyle giderse gibi olasılık dili kullan.',
    'Ölüm, ağır hastalık, büyük kaza, felaket, kesin ayrılık veya korkutucu hüküm üretme.',
    'Sağlık ve finans konularında tanı, tedavi, yatırım, kredi veya al-sat tavsiyesi verme; dikkat ve denge diliyle kal.',
    params.isFollowUp
      ? 'Bu bir takip sorusu. Önceki falı yeniden yazma; son kullanıcı sorusuna en fazla 2 kısa paragrafta cevap ver.'
      : 'Bu ilk ana fal açılışı. En fazla 4 kısa paragraf yaz; görsel varsa seçilebilir izlerden konuş, görsel yoksa niyet üzerinden sezgisel kahve falı aç.',
    params.coffeeMode === 'ai-brew'
      ? 'Bu oturum Benim yerime iç modunda. Gerçek görsel bekleme, fotoğraf isteme, yanlış görsel yüklendi deme, kullanıcıdan yeniden fotoğraf seçmesini isteme.'
      : '',
    params.readingType === 'coffee' && params.coffeeMode === 'upload'
      ? 'Bu oturum fotoğraflı kahve falı modunda. Görsel geldiyse uygun kabul et ve yorumla; yalnızca teknik olarak hiç görsel yoksa nazikçe eksik görsel bilgisini söyle.'
      : '',
    params.readingType === 'palm'
      ? 'Bu oturum el / pati falı modunda. Görsel geldiyse uygun kabul et ve yorumla; modelden ayrı bir görsel doğrulama yapması beklenmiyor.'
      : '',
    'Bu GPT-5 nano hattında Gemini görsel validasyonu yoktur. Yanlış görsel denemesi, validasyon borcu veya eski fotoğraf hatası varmış gibi konuşma.',
    'Türkçe karakterleri daima doğru UTF-8 kullan: ç, ğ, ı, İ, ö, ş, ü.',
    params.devSettings.systemPrompt?.trim() ? `## Developer Override\n${params.devSettings.systemPrompt.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const conversationText = equivalentPrompt.userText;

  const input = [
    {
      role: 'user',
      content: buildUserContent({
        text: conversationText,
        images: params.images,
        readingType: params.readingType,
        coffeeMode: params.coffeeMode,
        isFollowUp: params.isFollowUp,
      }),
    },
  ];

  return {
    developerMessage,
    input,
    closingSentence: equivalentPrompt.closingSentence || (isAiBrew ? '' : selectClosingSentence(id, params.messages, params.sessionId || 'default-session')),
    specificityUsage: equivalentPrompt.specificityUsage,
  };
}
