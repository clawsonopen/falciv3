import type { DevSettings } from '../types';
import type { ProfileMemorySnippet } from '../types/memory';
import { PERSONAL_FOLLOW_UP_TOKEN_INSTRUCTION, PERSONAL_INITIAL_READING_TOKEN_INSTRUCTION } from '../config/llmTokenPolicy';
import { FORTUNE_PERSONA_DATA } from './fortunePersonaData';
import { buildSpecificityContext } from './fortuneSpecificityBank';
import { isHealthClosingSentence, sanitizeRestrictedReadingTerms, selectAnimalClosingSentence, userAskedHealthConcern } from './personaClosingService';
import { FOLLOW_UP_CHAT_CONTRACT } from './followUpResponseService';
import { buildAnimalProfileInstructionFromMemory, isAnimalMemorySnippet } from './animalProfilePrompt';
import { formatPromptMemoryPack } from './memoryPromptPackFormatter';
import { formatPetMentionMemoryContext, formatStandardPersonalMemoryContext } from './personalMemoryPromptContext';
import { ensureLoreGraphIndexed, selectLoreCrumbs } from './loreGraphService';

export type FortuneMessage = { role: 'user' | 'assistant'; text: string };
export type CoffeeImageSlot = 'cup' | 'cup2' | 'saucer';
export type CoffeeSurfaceCode = 'fincan' | 'tabak' | 'fincan+tabak';
export type CoffeeImageAnalysis = {
  slot: CoffeeImageSlot;
  label: string;
  surfaceCode: CoffeeSurfaceCode;
  hasCoffeeGrounds: boolean;
  groundsAmount?: 'none' | 'trace' | 'light' | 'visible' | 'heavy';
};
export type FortuneImages = { cup?: string; cup2?: string; saucer?: string; palm?: string };
export type FortuneReadingType = 'coffee' | 'palm';
export type CoffeeMode = 'upload' | 'ai-brew';

type PersonaId = keyof typeof FORTUNE_PERSONA_DATA;
type ClosingTone = keyof (typeof FORTUNE_PERSONA_DATA)[PersonaId]['closingLibrary'];

export function buildCoffeeMultiImageContinuityInstruction(images: FortuneImages) {
  const coffeeImageCount = [images.cup, images.cup2, images.saucer].filter(Boolean).length;
  if (coffeeImageCount < 2) return '';
  return [
    '- Çoklu kahve görseli kuralı: Yüklenen birden fazla fincan/tabak fotoğrafı ayrı kahveler, ayrı fincanlar veya ayrı tabaklar değildir; aynı içilmiş kahvenin, aynı fincanın ve/veya aynı tabağın farklı açılardan çekilmiş kareleri olarak kabul et.',
    '- Kahve görseli 1, Kahve görseli 2 ve Kahve görseli 3 adları yalnızca teknik fotoğraf slotlarıdır. Kullanıcıya görünen yorumda bunları ayrı nesne veya ayrı içilmiş kahve gibi anlatma; "ikinci fincan", "iki fincan kahve", "bir fincan daha" gibi ifadeler kurma.',
    '- Birden fazla kare varsa bunları tek bir okumanın kanıtlarını tamamlayan farklı açılar gibi birleştir; aynı telve akışını ve aynı niyeti farklı yüzey/açı detaylarıyla okuduğunu varsay.',
  ].join('\n');
}

const EXTRA_CLOSING_LIBRARY: Record<string, string[]> = {
  warm: [
    'Bugün kendine biraz alan aç canım; içindeki cevap usul usul netleşecek.',
    'Kalbini sıkıştırma güzelim, doğru olan yol kendini sakin bir yerden belli eder.',
    'Enerjini sade tut tatlım, küçük bir sakinlik bile önünü açabilir.',
    'Kendine nazik davran canım, bu akış yavaş yavaş daha anlaşılır hale gelecek.',
    'İçindeki dengeyi koru güzelim, hayat bazen en güzel cevabı sessizce getirir.',
    'Bir adımı bugün, diğerini yarın at tatlım; ritmini buldukça yol hafifler.',
    'Gönlünü ferah tut canım, bu kapı kapanmaktan çok yön değiştiriyor.',
    'Kendini merkeze al güzelim, oradan bakınca işaretler daha temiz görünür.',
  ],
  hopeful: [
    'Umudunu küçük ama canlı tut güzelim; gökyüzü bazen en iyi haberi yavaş hazırlar.',
    'Bu dönem sana yeni bir ihtimal bırakıyor canım, onu sakince büyüt.',
    'Önünde yumuşak bir açılım var tatlım; yeter ki kendi yolunu daraltma.',
    'İçindeki niyet güçleniyor güzelim, doğru adım yaklaştıkça daha net hissedilecek.',
    'Güzel bir olasılık kendini gösteriyor canım; sen de ona yer aç.',
    'Bu hikayede ışık var tatlım, sadece onu doğru yerden yakalamak gerekiyor.',
    'Gelecek tarafında daha ferah bir kapı görünüyor güzelim; kalbini kapatma.',
    'Niyetini temiz tut canım, yolun devamında seni rahatlatacak bir gelişme var.',
  ],
  mysterious: [
    'Şimdilik işaret burada ince kalıyor güzelim; biraz zaman onu daha okunur yapacak.',
    'Bu enerjinin altında saklı bir detay var canım, sakin kalırsan kendini gösterecek.',
    'Bazı cevaplar düz cümleyle değil, tekrar eden küçük işaretlerle gelir tatlım.',
    'Perde tamamen açılmadı güzelim; ama aralıktan gelen ışık yönü gösteriyor.',
    'Bu konu biraz demlenmek istiyor canım, sezgin onu daha iyi okuyacak.',
    'Sessiz kalan tarafı izle tatlım; asıl mesaj oradan yükseliyor.',
    'Gökyüzü burada tek seferde konuşmuyor güzelim, işareti parça parça verecek.',
    'İçine düşen ilk hisse dikkat et canım, bu kez anahtar orada saklı.',
  ],
  warning: [
    'Bu noktada zemini yokla güzelim; sakin bir kontrol seni gereksiz yorgunluktan korur.',
    'Sınırını net tut canım, herkesin gündemi senin meselen değil.',
    'Biraz gözlemde kal tatlım; hemen tepki vermek bu enerjiyi büyütebilir.',
    'Parlak görünen seçeneği hemen sahiplenme güzelim, önce zeminin sağlamlığını yokla.',
    'Kendini fazla açma canım; bu süreç seçici olunca daha güvenli ilerler.',
    'Bugün zorlamak yerine düzenlemek daha doğru tatlım, enerji bunu söylüyor.',
    'İçini huzursuz eden detayı küçümseme güzelim, orada dikkate değer bir uyarı var.',
    'Adımını küçük tut canım; küçük adım bu dönemde büyük riski azaltır.',
  ],
  soothing: [
    'Nefesini yumuşat canım; beden sakinleşince zihnin de doğru cevaba yaklaşır.',
    'Bugün kendini ikna etmeye çalışma güzelim, sadece biraz dinlen ve toparlan.',
    'İçindeki ağırlığı tek hamlede çözmek zorunda değilsin tatlım; parçalayarak ilerle.',
    'Kalbini dinlendir canım, her şeyi hemen çözmek zorunda değilsin.',
    'Bu duygu geçici güzelim; sen kendi merkezine döndükçe etkisi azalacak.',
    'Bir bardak su, kısa bir yürüyüş, sakin bir nefes; bugün şifa küçük şeylerden gelir.',
    'Kendine güvenli bir alan aç tatlım, cevap orada daha şefkatli duyulur.',
    'Yavaşlamak kaybetmek değil canım; bazen ruhun yolu böyle bulur.',
  ],
};

const ASSISTANT_AGE_FALLBACKS: Record<string, number> = {
  'suzan': 58,
  'teoman': 60,
  'selin': 34,
  'berk': 36,
  arin: 29,
  ayse: 68,
  deniz: 32,
};

function personaId(value?: string): PersonaId {
  return (value && value in FORTUNE_PERSONA_DATA ? value : 'suzan') as PersonaId;
}

function closingLibrary(id: PersonaId) {
  const base = FORTUNE_PERSONA_DATA[id].closingLibrary as Record<string, readonly string[]>;
  const out: Record<string, string[]> = {};
  Object.entries(base).forEach(([tone, options]) => {
    out[tone] = [...options];
  });
  Object.entries(EXTRA_CLOSING_LIBRARY).forEach(([tone, options]) => {
    out[tone] = out[tone] || [];
    options.forEach((sentence) => {
      if (!out[tone].includes(sentence)) out[tone].push(sentence);
    });
  });
  return out;
}

function hashString(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function ageFromBirthDate(value?: string | null) {
  const match = String(value || '').match(/^(\d{4})-\d{2}-\d{2}$/);
  return match ? new Date().getFullYear() - Number(match[1]) : null;
}

function selectClosingTone(messages: FortuneMessage[], library: Record<string, string[]>) {
  const messageText = messages.map((message) => message.text || '').join(' ').toLocaleLowerCase('tr-TR');
  const heuristics: Array<[string, string[]]> = [
    ['warning', ['aldat', 'yalan', 'nazar', 'kavga', 'dikkat', 'dusman', 'engel', 'kork']],
    ['soothing', ['uzgun', 'yorgun', 'bunald', 'kaygi', 'stres', 'yoruld', 'yalniz', 'kirgin']],
    ['hopeful', ['ask', 'kismet', 'evlilik', 'baris', 'para', 'is', 'mujde', 'basari']],
    ['mysterious', ['ruya', 'sezgi', 'enerji', 'gizli', 'sir', 'isaret', 'gece']],
  ];
  const hit = heuristics.find(([tone, keywords]) => library[tone] && keywords.some((keyword) => messageText.includes(keyword)));
  return hit?.[0] || (library.warm ? 'warm' : Object.keys(library)[0] || 'warm');
}

function selectClosingSentence(id: PersonaId, messages: FortuneMessage[], sessionId: string, allowHealthClosing = false, isAnimalProfile = false) {
  const sessionText = messages.map((message) => message.text || '').join(' ');
  const turnCount = messages.filter((message) => (message.text || '').trim()).length;
  if (isAnimalProfile) {
    for (let offset = 0; offset < 6; offset += 1) {
      const closing = selectAnimalClosingSentence({
        assistantId: id,
        seed: `${sessionId}:${turnCount}:${sessionText.slice(-180)}:${offset}`,
      });
      if (closing && !sessionText.includes(closing)) return closing;
    }
    return selectAnimalClosingSentence({
      assistantId: id,
      seed: `${sessionId}:${turnCount}:${sessionText.slice(-180)}:fallback`,
    });
  }
  const library = closingLibrary(id);
  const tone = selectClosingTone(messages, library);
  let options = library[tone] || library.warm || [];
  if (!allowHealthClosing) {
    const nonHealthOptions = options.filter((option) => !isHealthClosingSentence(option));
    if (nonHealthOptions.length) options = nonHealthOptions;
  }
  const userAskedPaceTheme = /\b(telaş|acele|yetiş|yetişem|panik)\b/i.test(sessionText);
  if (!userAskedPaceTheme) {
    const nonPaceOptions = options.filter((option) => !/\b(telaş|acele|yetiş|yetişem|panik|koştur|koşuştur|yük|ağırlık)\b/i.test(option));
    if (nonPaceOptions.length) options = nonPaceOptions;
  }
  const unused = options.filter((option) => !sessionText.includes(option));
  if (unused.length) options = unused;
  if (!options.length) return '';
  return options[hashString(`${sessionId}:${id}:${tone}:${turnCount}`) % options.length];
}

function buildSafetyPolicy() {
  return [
    '## Sağlık ve Finans Sınırları',
    "- Konu taksonomisinde sağlık, enerji, uyku, bel/sırt, hareket ve basit beden uyarıları 'İç Dünya / Ruh hali ve beden' altında değerlendirilir.",
    '- Sağlık temaları yalnızca gündelik beden dengesi, randevu takibi ve genel dikkat diliyle anlatılabilir; teşhis, tedavi, ilaç, doz, beslenme reçetesi, takviye veya spesifik sağlık tavsiyesi üretme.',
    '- İnsan sağlığıyla ilgili endişe, belirti, ağrı, hastalık, ruh sağlığı veya kullanıcı/başka bir insan için sağlık sorusu varsa doktora ya da uygun sağlık uzmanına görünmeyi nazikçe öner.',
    '- Evcil hayvan veya başka bir hayvanın sağlığıyla ilgili endişe, belirti, ağrı, hastalık veya davranış değişikliği soruluyorsa veterinere görünmeyi nazikçe öner.',
    '- "Şunu ye/iç geçer", "kesin geçecek", "kesin iyileşecek" veya benzeri kesin sonuç/tedavi dili kullanma.',
    "- Finans temaları bütçe farkındalığı, yatırımları gözden geçirme, acele karar vermeme, riski dağıtma, 'tüm yumurtaları aynı sepete koymama' ve planlama diliyle anlatılabilir; belirli ürün/varlık için al-sat, borçlanma, kredi veya sigorta tavsiyesi verme.",
    '- Para veya kariyer konusunda kesin kazanç, garanti sonuç ya da kişiye özel finansal karar dili kullanma; olasılık ve dikkat diliyle kal.',
  ].join('\n');
}

function buildAddressPolicy(id: PersonaId, memorySnippet?: ProfileMemorySnippet | null) {
  if (isAnimalMemorySnippet(memorySnippet)) {
    return [
      buildAnimalProfileInstructionFromMemory(memorySnippet),
      'Hitap modu: seçili profil evcil hayvan. Metin boyunca hayvanı üçüncü tekil şahısla anlat; hesap sahibine yalnızca hayvanın sahibi/refakatçisi olarak pratik ve yumuşak öneriler ver.',
      'Cinsiyetli insan hitapları, romantik/evlilik dili ve insan kariyeri dili yasak.',
    ].join('\n');
  }
  const identity = FORTUNE_PERSONA_DATA[id];
  const assistantAge = identity.age || ASSISTANT_AGE_FALLBACKS[id];
  const profileGender = memorySnippet?.profileInfo?.gender || memorySnippet?.profileGender;
  const subjectAge = ageFromBirthDate(memorySnippet?.birthChartData?.birthDate);
  const olderEnough = Boolean(assistantAge && subjectAge && assistantAge - subjectAge >= 10);
  const familyStyleAllowed = ['suzan', 'teoman'].includes(id) && olderEnough;
  const lines = [
    '## Hitap ve Yaş Politikası',
    '- Hitapta profil cinsiyeti ve yaş farkı güvenlik kuralıdır; persona sıcaklığı bu kuralı ezemez.',
    "- 'yavrum', 'kızım', 'oğlum', 'evladım', 'güzel kızım', 'güzel oğlum' gibi aile-büyüğü hitaplarını gereksiz kullanma.",
  ];
  if (assistantAge) lines.push(`- Yorumcu yaşı: yaklaşık ${assistantAge}.`);
  if (subjectAge) lines.push(`- Seçili profil yaşı: yaklaşık ${subjectAge}.`);
  if (['selin', 'berk', 'arin', 'deniz'].includes(id)) {
    lines.push("- Bu yorumcu için 'yavrum', 'kızım', 'oğlum', 'evladım' ve benzeri büyük/ebeveyn hitapları tamamen yasak.");
  } else if (familyStyleAllowed) {
    lines.push("- Aile-büyüğü tonu bu profilden en az 10 yaş büyük görünüyor; yine de 'yavrum' gibi hitapları sık değil, nadiren ve doğal gelirse kullan.");
  } else {
    lines.push("- Aile-büyüğü tonu için yaş farkı yeterli değil veya bilinmiyor; 'yavrum', 'kızım', 'oğlum', 'evladım' kullanma.");
  }
  if (profileGender === 'erkek') lines.push("- Profil erkekse 'kızım' ve 'güzel kızım' kesinlikle yasak.");
  else if (profileGender === 'kadin') lines.push("- Profil kadınsa 'oğlum' ve 'güzel oğlum' kesinlikle yasak.");
  else if (profileGender === 'hicbiri' || profileGender === 'belirtmek_istemiyorum') {
    lines.push('- Profil cinsiyetsiz veya cinsiyet belirtmek istemiyor; tüm cinsiyetli hitaplar yasak.');
  }
  return lines.join('\n');
}

export function buildMemoryContext(profileName: string, memorySnippet: ProfileMemorySnippet | null | undefined, readingType: FortuneReadingType, coffeeMode: CoffeeMode, questionText?: string | null) {
  if (!memorySnippet && !profileName) return '';
  const lines = [
    '## Subject Context',
    `- Bu okuma ${profileName || 'seçili kişi'} için hazırlanıyor.`,
    `- Okuma türü: ${readingType}.`,
    `- Kahve modu: ${coffeeMode}.`,
  ];
  if (coffeeMode === 'ai-brew') {
    lines.push('- Bu modda gerçek fincan veya tabak zorunlu değil; kahve içilmiş gibi sezgisel bir açılış yap.');
    lines.push('- Hafızada tekrar eden temalar varsa bunları ana konu yapmak zorunda değilsin; sadece seçici, düşük sesli ve doğal bir tanışıklık hissi olarak kullan.');
    lines.push('- Bu modda doğum haritası, burç, yükselen, Güneş/Ay burcu veya numeroloji bilgisini açıkça söyleme; bunlar yalnızca arka plan ritmi olabilir.');
  }
  if (!memorySnippet) return lines.join('\n');
  const profileInfo = memorySnippet.profileInfo;
  const birth = memorySnippet.birthChartData;
  lines.push(`- Profil bilgileri: ad=${profileInfo?.displayName || profileName || 'bilinmiyor'}, hesap sahibi mi=${profileInfo?.isAccountOwner ? 'evet' : 'hayır'}, hesap sahibiyle bağ=${profileInfo?.relationshipToAccountOwner || memorySnippet.relationshipLabel || 'bilinmiyor'}.`);
  if (memorySnippet.accountOwnerProfile && !memorySnippet.isSelf) lines.push(`- Hesap sahibi: ${memorySnippet.accountOwnerProfile.displayName}. Okuma yine seçili profil için kalmalı.`);
  if (birth && readingType !== 'coffee' && readingType !== 'palm') {
    const birthBits = [];
    if (birth.birthDate) birthBits.push(`tarih=${birth.birthDate}`);
    if (birth.birthTime && birth.timeKnown) birthBits.push(`saat=${birth.birthTime}`);
    else if (birth.birthDate) birthBits.push('saat=bilinmiyor');
    const location = [birth.cityOrRegion, birth.country].filter(Boolean).join(', ');
    if (location) birthBits.push(`yer=${location}`);
    birthBits.push(`hassasiyet=${birth.chartPrecision || memorySnippet.chartPrecision}`);
    lines.push(`- Doğum/harita verisi: ${birthBits.join('; ')}.`);
  }
  if (memorySnippet.relationshipLabel) lines.push(`- Hesap sahibiyle yakinlik: ${memorySnippet.relationshipLabel}.`);
  if (memorySnippet.relationshipPrimary === 'arkadas' || memorySnippet.relationshipPrimary === 'akraba') {
    lines.push('- Yakınlık arkadaş/akraba sınıfında. Bu profilde aşk, flört, sevgililik veya romantik eşleşme yorumu yapma.');
  }
  if (memorySnippet.profileGender) lines.push(`- Profil cinsiyet bilgisi: ${memorySnippet.profileGender}.`);
  if (memorySnippet.profileGender === 'erkek') lines.push("- Bu profile veya kullanıcıya 'kızım' diye hitap etme; gerekirse 'evladım', 'oğlum' veya ismiyle hitap et.");
  else if (memorySnippet.profileGender === 'kadin') lines.push("- Bu profile veya kullanıcıya 'oğlum' diye hitap etme; gerekirse 'evladım', 'kızım' veya ismiyle hitap et.");
  else if (memorySnippet.profileGender === 'hicbiri' || memorySnippet.profileGender === 'belirtmek_istemiyorum') lines.push("- Bu profil için cinsiyetli hitap kullanma; 'kızım', 'oğlum', 'güzel kızım', 'güzel oğlum' yerine 'evladım', 'canım' veya ismiyle hitap et.");
  if (memorySnippet.relationshipPrimary === 'evcil_hayvan') {
    lines.push(buildAnimalProfileInstructionFromMemory(memorySnippet));
    lines.push('- El okuması seçildiyse insan eli değil, bu hayvanın patisi/ayağı üzerinden yorum beklenir.');
  }
  if (memorySnippet.relationshipPrimary === 'evcil_hayvan') {
    lines.push(`- Bu okuma hesap sahibinin evcil hayvanı ${profileName || memorySnippet.profileName || 'bu profil'} için. Hayvanı üçüncü tekil şahısla anlat; hesap sahibine sahibi/refakatçisi olarak öneri ver.`);
  } else if (memorySnippet.isSelf) lines.push('- Bu profil hesap sahibinin kendisi. Ana anlatımda profil adını kullanma; kullanıcıya tutarlı biçimde sen/siz diye hitap et ve üçüncü tekil şahsa kayma.');
  else lines.push(`- Bu okuma hesap sahibinden farklı biri için. Ana anlatımda gerekirse ${profileName} adını kullan; bu kişiyi üçüncü tekil şahısla anlat, hesap sahibine veya profile sonradan 'sen' diye dönme.`);
  lines.push(`- Seçili profil sabit: bu oturum sadece ${profileName || 'bu profil'} için. Sohbet içinde başka biri geçse bile görseli o kişiye aitmiş gibi yorumlama.`);
  if (memorySnippet.userStatedTopics?.length) lines.push(`- Kullanıcının yazdıklarında tekrar eden konular: ${memorySnippet.userStatedTopics.slice(0, 10).join(', ')}.`);
  if (memorySnippet.userTopicGroups?.length) lines.push(`- Kullanıcının konuştuğu konuların gruplu hafızası: ${memorySnippet.userTopicGroups.slice(0, 10).map((item) => `${item.group || 'Genel'} / ${item.subgroup || 'Diğer'}: ${item.label}`).join('; ')}.`);
  if (memorySnippet.userStatedPeople?.length) lines.push(`- Kullanıcının yazdıklarında öne çıkan kişiler: ${memorySnippet.userStatedPeople.slice(0, 3).join(', ')}.`);
  if (memorySnippet.prominentRelations?.length) lines.push(`- Tekilleştirilmiş öne çıkan ilişkiler: ${memorySnippet.prominentRelations.slice(0, 5).map((item) => `${item.label} (${item.relationship || 'ilgili kişi'})`).join(', ')}.`);
  if (memorySnippet.userStatedPatterns?.length) lines.push(`- Kullanıcının yazdıklarında görülen duygusal kalıplar: ${memorySnippet.userStatedPatterns.slice(0, 3).join(', ')}.`);
  if (memorySnippet.readingTopics?.length) lines.push(`- Önceki okumalarda çıkan düşük öncelikli temalar: ${memorySnippet.readingTopics.slice(0, 3).join(', ')}.`);
  if (memorySnippet.readingTopicGroups?.length) lines.push(`- Okumada daha önce açılmış düşük öncelikli konu hafızası: ${memorySnippet.readingTopicGroups.slice(0, 10).map((item) => `${item.group || 'Genel'} / ${item.subgroup || 'Diğer'}: ${item.label}`).join('; ')}.`);
  if (memorySnippet.readingPeople?.length) lines.push(`- Önceki okumalarda öne çıkan kişiler: ${memorySnippet.readingPeople.slice(0, 3).join(', ')}.`);
  if (memorySnippet.readingPatterns?.length) lines.push(`- Önceki okumalarda görülen kalıplar: ${memorySnippet.readingPatterns.slice(0, 3).join(', ')}.`);
  const promptMemoryPack = formatPromptMemoryPack(memorySnippet);
  if (promptMemoryPack) lines.push(promptMemoryPack);
  const standardMemory = formatStandardPersonalMemoryContext({
    profileName,
    readingLabel: readingType === 'palm' ? 'kişisel el/pati okuması' : 'kişisel kahve yorumu',
    memorySnippet,
    questionText,
    includePromptPack: false,
  });
  if (standardMemory) lines.push(standardMemory);
  const petMention = formatPetMentionMemoryContext(questionText, memorySnippet);
  if (petMention) lines.push(petMention);
  const observations = (memorySnippet.relevantObservations || []).slice(0, 8).map((item) => [item.source === 'user-stated' ? 'kullanıcı' : 'yorum', `${item.group || item.category || 'Genel'} / ${item.subgroup || 'Diğer konuşulanlar'}`, item.title, item.summary].filter(Boolean).join(' | '));
  if (observations.length) lines.push(`- Akıllı seçilmiş olay/olgu hafızası: ${observations.join('; ')}.`);
  lines.push('- Bu hafızayı veri tabanı gibi değil, doğal bir tanışıklık hissi vermek için kullan.');
  lines.push('- Kullanıcının kendi söylediği konular en güçlü sinyaldir; önceki okumada çıkan konular ise düşük öncelikli farkındalık/çeşitlilik sinyalidir.');
  lines.push('- Önceki okumada çıkan bir temayı otomatik ana konu yapma; mevcut görsel, soru veya kullanıcının kendi sözleri desteklemiyorsa o temadan uzaklaş.');
  lines.push('- Aynı profilde yakın zamanda tekrar edilmiş iş, para, ilişki, aile, sağlık veya telaş/yorgunluk temasını yeni ve güçlü bir işaret yoksa yeniden merkeze alma.');
  lines.push('- Sadece ilgiliyse hafızadan yararlan; aynı yanıtta 1-2 dokunuştan fazla yapma.');
  lines.push('- Olay/olgu hafızasını yalnızca mevcut soruyla ilişkiliyse kullan; kullanıcının karşısına ham kayıt gibi dökme.');
  lines.push('- Hafıza, profil veya başka okuma kaynaklarını açıkça anma; bilgiyi ancak cümlenin içine fark ettirmeden yedir.');
  lines.push('- Kahve ve el okumalarında burç, yükselen, Güneş/Ay burcu, doğum haritası veya numeroloji sayısını açıkça söyleme; kullanıcı özellikle sormadıkça bu kaynakları metne taşıma.');
  return lines.join('\n');
}

export function buildFortunePrompt(params: {
  sessionId: string;
  devSettings: DevSettings;
  profileName: string;
  readingType: FortuneReadingType;
  coffeeMode: CoffeeMode;
  focusQuestion?: string | null;
  memorySnippet?: ProfileMemorySnippet | null;
  messages: FortuneMessage[];
  images: FortuneImages;
  isFollowUp?: boolean;
  validatedSurfaces?: Array<'cup' | 'saucer' | 'palm'> | null;
  coffeeImageAnalyses?: CoffeeImageAnalysis[] | null;
  palmValidation?: { isInnerPalm?: boolean; handVisibleEnough?: boolean } | null;
}) {
  const id = personaId(params.devSettings.assistantId);
  const identity = FORTUNE_PERSONA_DATA[id];
  const imageHint = [
    params.images.cup ? 'kullanıcı fincan görseli gönderdi' : '',
    params.images.cup2 ? 'kullanıcı ikinci kahve görseli gönderdi' : '',
    params.images.saucer ? 'kullanıcı tabak görseli gönderdi' : '',
    params.images.palm ? 'kullanıcı avuç içi görseli gönderdi' : '',
  ].filter(Boolean).join(', ') || 'bu turda görsel gelmemiş olabilir';
  const isInitialReading = params.messages.length <= 1;
  const focusQuestion = params.focusQuestion?.replace(/\s+/g, ' ').trim() || '';
  const userHealthContext = userAskedHealthConcern(
    [focusQuestion, ...params.messages.filter((message) => message.role === 'user').map((message) => message.text || '')].join(' '),
  );
  const isAnimalReading = params.memorySnippet?.relationshipPrimary === 'evcil_hayvan';
  const selectedReadingDomain =
    params.readingType === 'palm'
      ? 'el okuması / avuç içi çizgileri'
      : params.coffeeMode === 'ai-brew'
        ? 'kişinin niyetine içilmiş gibi kahve yorumu'
        : 'kahve yorumu / fincan ve tabak';
  const crossDomainGuard =
    params.readingType === 'palm'
      ? '- Bu el okumasında kahve, fincan, telve, tabak, tarot, kart, rune, I Ching veya başka sembolik araç dili kullanma; yorumu avuç içi, el formu ve çizgi akışı üzerinden kur.'
      : '- Bu kahve yorumunda avuç içi, el çizgisi, tarot, kart, rune, I Ching veya başka sembolik araç dili kullanma; yorumu kahve niyeti, fincan/tabak yüzeyi ve telve akışı üzerinden kur.';
  const runtimeRules = [
    '## Runtime Directives',
    `- Bu oturumun okuma türünü öncele: ${selectedReadingDomain}.`,
    `- Yorumcunun ana branşı yalnızca persona geçmişidir: ${identity.primaryDomainLabel}. Seçili okuma türünden farklıysa bu branşın objelerini, yöntemini ve terminolojisini yoruma taşıma.`,
    crossDomainGuard,
    isAnimalReading
      ? '- Seçili profil evcil hayvan. Bu okuma hiçbir noktada insan okuması gibi davranmayacak: kariyer, iş, para kazanma, okul, evlilik, romantik ilişki, insan sosyal çevresi veya yetişkin insan psikolojisi teması kurma.'
      : '',
    isAnimalReading
      ? '- Evcil hayvan profilde yorumu hayvanın mizacı, oyun/uyku düzeni, pati/beden dili, duyuları, ev içi güveni, pencere ve dış dünya merakı, evdeki diğer hayvanlarla ilişkisi ve sahibiyle bağı üzerinden kur.'
      : '',
    `- Bu turda ${imageHint}.`,
    '- Yanıtını başlıksız, sohbet gibi akan düz yazı halinde ver.',
    '- Markdown biçimlendirmesi, yıldızlı vurgu, madde imi, numaralı liste, emoji, ikon veya dekoratif sembol üretme.',
    '- Kullanıcı bir konu/soru yazdıysa bunu kendi aklına gelmiş gibi sahiplenme; "aklıma geldi", "şimdi aklıma geldi" gibi ifadeler kullanma.',
    '- Kullanıcıya görünen metinde hukuken kesin gelecek iddiası kurma; "yorum", "okuma", "sembolik ritüel", "sembolik yorum", "izlenim", "olasılık", "eğilim" dili kullan.',
    '- Kullanıcı "fal", "falcı", "falıma bak" gibi kelimeler kullansa bile yanıtta bu kelimeleri tekrar etme; doğal biçimde "yorum", "okuma", "içgörü", "sembolik ritüel" diline çevir.',
    '- "fal", "falcı", "kehanet", "vaat", "vaad", "geleceği görmek", "gelecek okuması", "gelecek yorumu" ifadeleri kullanıcıya görünen metinde yasak. Bunların yerine bağlama göre "yorum", "okuma", "içgörü", "sembolik yorum", "olasılıkları sezgisel değerlendirme" kullan.',
    userHealthContext
      ? '- Kullanıcı sağlıkla ilgili konu veya soru açtıysa spesifik tıbbi/veteriner tavsiye verme; insan sağlığı endişesinde doktora/uzmana, hayvan sağlığı endişesinde veterinere yönlendir.'
      : '- Kullanıcı sağlıkla ilgili konu veya soru açmadı; ana yorumda sağlık teması, beden uyarısı veya doktor/veteriner yönlendirmesi üretme.',
    '- Kahve için "demlemek/demlenmek" fiilini kullanma; Türk kahvesi yapılır, pişirilir veya kaynatılır.',
    "- Persona içinde kal ama kullanıcıya görünen metinde kendi adını, public label'ını, yorumcu kimliğini veya rol tanıtımını asla yazma. Kendini tanıtma, imza atma, adınla/rolünle başlama; ilk cümle doğrudan yoruma girsin.",
    focusQuestion ? '- Kullanıcının yazdığı konu/soru bu okumanın ana eksenidir; ilk paragraftan itibaren doğrudan bu konuya cevap ver ve görsel yorumunu bu bağlamda şekillendir.' : '',
    focusQuestion ? '- Hafıza, önceki life event/olay dizileri ve önceki okuma temaları yalnızca bu konuyla anlamlı biçimde ilişkiliyse kullanılabilir; sırf seçildi diye alakasız bir olayı yoruma sokma.' : '',
    "- Hitap kişisini metin boyunca sabit tut; üçüncü tekil şahısla başladıysan sonradan 'sen' diline dönme, 'sen' diliyle başladıysan üçüncü şahsa kayma.",
    "- Aynı şefkat hitabını yan yana veya aynı yanıtta sık kullanma; 'canım canım', 'tatlım tatlım', 'güzelim güzelim' gibi ikilemeler kesinlikle yok.",
    '- Giriş bölümünü 1-2 cümlede tut; esas ağırlığı sembolik yoruma ver.',
    isAnimalReading
      ? '- Paragrafları anlam akışına göre ayır: görselden çıkan ana iz, hayvanın duygu/mizaç hattı, oyun-rutin-duyu dünyası, sahibiyle bağ ve uygulanabilir küçük öneri ayrı akabilsin.'
      : '- Paragrafları anlam akışına göre ayır: görselden çıkan ana iz, duygu/ilişki hattı, iş-para/yaşam hattı, yakın gelecek ve öneri ayrı akabilsin.',
    '- Paragrafları TTS için rahat okunacak kısa-orta uzunlukta tut.',
    '- Her paragrafı veya ana düşünceyi tamamlanmış cümlelerle bitir.',
    '- Yorumcu personasıyla konuşurken geçmiş izlerini, bugünkü olasılıkları ve yakın dönem ihtimallerini birlikte dokumalısın; sadece mevcut durum analizi yapıp kalma.',
    "- Yorumda kesin hüküm değil, olasılık dili kullan: 'görünen ihtimal', 'yakına düşen yol', 'bu enerji böyle giderse' gibi ifadelerle konuş.",
    '- Geçmiş, şimdi ve gelecek dengesini koru: önce görselden çıkan geçmiş izi, sonra bugünün olasılıkları, sonra yakın gelecek kapıları ve tavsiye gelsin.',
    '- Bu oturum boyunca sadece seçili profil için yorum hazırla. Kullanıcı mesaj içinde başka biri için yorum isterse aynı görseli o kişiye aitmiş gibi yeniden yorumlama.',
    '- Kullanıcı başka biri için de yorum isterse nazikçe bunun ayrı bir profil ve ayrı bir okuma oturumu gerektirdiğini söyle.',
    '- Profil, hafıza, doğum/harita, numeroloji veya başka okuma verileri yalnızca arka plan sezgisi içindir; kullanıcı özellikle sormadıkça bunların kaynağını metinde söyleme.',
    "- 'Profilinde gördüğüm', 'doğum haritana göre', 'önceki okumanda', 'hafızanda' gibi veri kaynağını göze sokan ifadeler kullanma.",
    "- 'Önceki okumanda şunlar çıkmıştı', 'hafızanda gördüm', 'sana daha önce şu çıkmıştı' gibi hafızayı açık eden cümleler kurma.",
    '- Kahve veya el okumasında astrolojik/numerolojik bilgiyi açıkça etiketleme; burç, yükselen, Güneş/Ay burcu, doğum haritası ve sayı raporu yazma.',
    '- Telaş, koşturma, yetişememe, acele ve günlük yoğunluk temasını kullanıcı özellikle sormadıysa veya görsel/mesaj çok güçlü göstermiyorsa ana konu yapma.',
    isInitialReading ? `- ${PERSONAL_INITIAL_READING_TOKEN_INSTRUCTION}` : `- ${PERSONAL_FOLLOW_UP_TOKEN_INSTRUCTION}`,
    '- Süre belirtirken aynı sayıyı sürekli tekrar etme. Özellikle 3 ve 6 ağırlıklı ama 1-9 arasında çeşitlendirilmiş ifade kullan.',
    '- Son kısımda yeni bir imza kapanış cümlesi üretme; sistem persona kapanışını sonradan ekleyecek.',
    '- Bu oturumda daha önce kullanılan kapanış cümlesinin aynısını veya çok yakın varyasyonunu üretme.',
    '- Kullanıcıya ses tanıma hatalarıyla gelmiş mesajlarda niyeti anlayıp doğal şekilde cevap ver.',
    '- Türkçe karakterleri daima UTF-8 doğru yaz: ç, ğ, ı, İ, ö, ş, ü.',
    '- Bozuk karakter dizileri kullanma.',
  ].filter(Boolean).join('\n');
  const parts = [sanitizeRestrictedReadingTerms(identity.systemBody), runtimeRules, buildAddressPolicy(id, params.memorySnippet), buildSafetyPolicy()];
  if (focusQuestion) {
    parts.push(
      [
        '## Kullanıcı Konusu / Sorusu',
        focusQuestion,
        '- Bu metin user-stated hafıza sinyalidir ve mevcut okumanın ana bağlamıdır.',
        '- Görsel izler ve hafıza yalnızca bu konuya hizmet ettiği ölçüde kullanılmalı.',
      ].join('\n'),
    );
  }
  if (params.devSettings.systemPrompt?.trim()) parts.push(`## Developer Override\n${params.devSettings.systemPrompt.trim()}`);
  const memoryContext = buildMemoryContext(params.profileName, params.memorySnippet, params.readingType, params.coffeeMode, focusQuestion);
  if (memoryContext) parts.push(memoryContext);
  void ensureLoreGraphIndexed();
  const loreCrumbs = selectLoreCrumbs({
    assistantId: id,
    query: [focusQuestion || '', params.readingType, params.profileName].join(' '),
    limit: 2,
  });
  if (loreCrumbs.length) {
    parts.push(`## Lore Graph Crumbs\n${loreCrumbs.map((item) => `- ${item.text}`).join('\n')}`);
  }
  const specificity = buildSpecificityContext({
    sessionId: params.sessionId || 'default-session',
    profileName: params.profileName,
    readingType: params.readingType,
    coffeeMode: params.coffeeMode,
    assistantId: id,
    messages: params.messages,
    focusQuestion,
    memorySnippet: params.memorySnippet,
    isFollowUp: params.isFollowUp,
  });
  parts.push(specificity.text);
  if (params.isFollowUp) {
    parts.push([
      '## Follow-up Yanıt Sözleşmesi',
      FOLLOW_UP_CHAT_CONTRACT,
      `- ${PERSONAL_FOLLOW_UP_TOKEN_INSTRUCTION}`,
    ].join('\n'));
  }
  if (params.validatedSurfaces) {
    const surfaceRules = ['## Görsel Yorum Disiplini', '- Sadece görselde seçilebilir telve/çizgi/lekelerden yorum üret.', '- Emin olmadığın şekli kesinmiş gibi söyleme; belirsizse belirsiz olduğunu belirt.', '- Fincan/tabak üzerindeki üretim desenleri (çiçek, süs, baskı, marka, kabartma) yorum unsuru değildir; bunları sembol sayma.'];
    if (params.readingType === 'palm') {
      surfaceRules.push('## Surface Guard');
      surfaceRules.push('- Bu turda kullanıcı el okuması için insan eli/avuç içi görseli doğrulandı.');
      surfaceRules.push('- Fincan veya tabak görmüş gibi konuşma.');
      surfaceRules.push('- Yorumu avuç içi çizgileri, parmak yerleşimi ve el formu üzerinden kur.');
    } else if (params.validatedSurfaces.length === 1 && params.validatedSurfaces[0] === 'cup') {
      surfaceRules.push('## Surface Guard', '- Bu turda yalnızca fincan içi doğrulandı.', '- Tabak görmüş gibi konuşma.', '- Yorumu fincan içi derinliği, kenar akışı ve iç yüzey üzerinden kur.');
    } else if (params.validatedSurfaces.length === 1 && params.validatedSurfaces[0] === 'saucer') {
      surfaceRules.push('## Surface Guard', '- Bu turda yalnızca kahve tabağı doğrulandı.', '- Fincan görmüş gibi konuşma.', '- Yorumu tabak yüzeyi, yayılma, göllenme ve dış dünya yansıması üzerinden kur.');
    } else if (params.validatedSurfaces.length) {
      surfaceRules.push('## Surface Guard', '- Bu turda fincan içi ve tabak birlikte doğrulandı.', '- Hangi yüzeyi yorumladığını açıkça ayır.');
    }
    const continuity = buildCoffeeMultiImageContinuityInstruction(params.images);
    if (continuity) surfaceRules.push(continuity);
    if (params.coffeeImageAnalyses?.length) {
      surfaceRules.push(
        '## Doğrulanmış Kahve Görselleri',
        ...params.coffeeImageAnalyses.map(
          (item) =>
            `- ${item.label}: ${item.surfaceCode}; telve=${item.hasCoffeeGrounds ? 'var' : 'yok'}; miktar=${item.groundsAmount || 'belirsiz'}.`,
        ),
        '- Slot adı değil, yukarıdaki doğrulanmış yüzey kodu belirleyicidir; tek tabak varsa fincan görmüş gibi, tek fincan varsa tabak görmüş gibi konuşma.',
      );
    }
    parts.push(surfaceRules.join('\n'));
  }
  return {
    assistantId: id,
    systemInstruction: parts.filter(Boolean).join('\n\n'),
    closingSentence: selectClosingSentence(id, params.messages, params.sessionId || 'default-session', userHealthContext, isAnimalReading),
    specificityUsage: specificity.usage,
  };
}
