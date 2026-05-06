import type { DevSettings } from '../types';
import type { ProfileMemorySnippet } from '../types/memory';
import { FORTUNE_PERSONA_DATA } from './fortunePersonaData';

export type FortuneMessage = { role: 'user' | 'assistant'; text: string };
export type FortuneImages = { cup?: string; saucer?: string; palm?: string };
export type FortuneReadingType = 'coffee' | 'palm';
export type CoffeeMode = 'upload' | 'ai-brew';

type PersonaId = keyof typeof FORTUNE_PERSONA_DATA;
type ClosingTone = keyof (typeof FORTUNE_PERSONA_DATA)[PersonaId]['closingLibrary'];

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
  'durdane-hanim': 58,
  'hikmet-bey': 60,
  'bahar-hanim': 34,
  'mert-bey': 36,
  caner: 29,
};

function personaId(value?: string): PersonaId {
  return (value && value in FORTUNE_PERSONA_DATA ? value : 'durdane-hanim') as PersonaId;
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

function selectClosingSentence(id: PersonaId, messages: FortuneMessage[], sessionId: string) {
  const library = closingLibrary(id);
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
  return options[hashString(`${sessionId}:${id}:${tone}:${turnCount}`) % options.length];
}

function buildSafetyPolicy() {
  return [
    '## Sağlık ve Finans Sınırları',
    "- Konu taksonomisinde sağlık, enerji, uyku, bel/sırt, hareket ve basit beden uyarıları 'İç Dünya / Ruh hali ve beden' altında değerlendirilir.",
    '- Sağlık temaları yalnızca gündelik beden dengesi, dinlenme, hareket, randevu takibi ve genel dikkat diliyle anlatılabilir; teşhis, tedavi, ilaç, doz veya acil durum yönlendirmesi üretme.',
    '- Sağlıkla ilgili ciddi, ani veya uzun süren bir belirti görünürse kullanıcıyı uygun bir uzmana danışmaya nazikçe yönlendir.',
    "- Finans temaları bütçe farkındalığı, yatırımları gözden geçirme, acele karar vermeme, riski dağıtma, 'tüm yumurtaları aynı sepete koymama' ve planlama diliyle anlatılabilir; belirli ürün/varlık için al-sat, borçlanma, kredi veya sigorta tavsiyesi verme.",
    '- Para veya kariyer konusunda kesin kazanç, garanti sonuç ya da kişiye özel finansal karar dili kullanma; olasılık ve dikkat diliyle kal.',
  ].join('\n');
}

function buildAddressPolicy(id: PersonaId, memorySnippet?: ProfileMemorySnippet | null) {
  const identity = FORTUNE_PERSONA_DATA[id];
  const assistantAge = identity.age || ASSISTANT_AGE_FALLBACKS[id];
  const profileGender = memorySnippet?.profileInfo?.gender || memorySnippet?.profileGender;
  const subjectAge = ageFromBirthDate(memorySnippet?.birthChartData?.birthDate);
  const olderEnough = Boolean(assistantAge && subjectAge && assistantAge - subjectAge >= 10);
  const familyStyleAllowed = ['durdane-hanim', 'hikmet-bey'].includes(id) && olderEnough;
  const lines = [
    '## Hitap ve Yaş Politikası',
    '- Hitapta profil cinsiyeti ve yaş farkı güvenlik kuralıdır; persona sıcaklığı bu kuralı ezemez.',
    "- 'yavrum', 'kızım', 'oğlum', 'evladım', 'güzel kızım', 'güzel oğlum' gibi aile-büyüğü hitaplarını gereksiz kullanma.",
  ];
  if (assistantAge) lines.push(`- Falcı yaşı: yaklaşık ${assistantAge}.`);
  if (subjectAge) lines.push(`- Seçili profil yaşı: yaklaşık ${subjectAge}.`);
  if (['bahar-hanim', 'mert-bey', 'caner'].includes(id)) {
    lines.push("- Bu falcı için 'yavrum', 'kızım', 'oğlum', 'evladım' ve benzeri büyük/ebeveyn hitapları tamamen yasak.");
  } else if (familyStyleAllowed) {
    lines.push("- Dürdane/Hikmet bu profilden en az 10 yaş büyük görünüyor; yine de 'yavrum' gibi hitapları sık değil, nadiren ve doğal gelirse kullan.");
  } else {
    lines.push("- Dürdane/Hikmet için yaş farkı yeterli değil veya bilinmiyor; 'yavrum', 'kızım', 'oğlum', 'evladım' kullanma.");
  }
  if (profileGender === 'erkek') lines.push("- Profil erkekse 'kızım' ve 'güzel kızım' kesinlikle yasak.");
  else if (profileGender === 'kadin') lines.push("- Profil kadınsa 'oğlum' ve 'güzel oğlum' kesinlikle yasak.");
  else if (profileGender === 'hicbiri' || profileGender === 'belirtmek_istemiyorum') {
    lines.push('- Profil cinsiyetsiz veya cinsiyet belirtmek istemiyor; tüm cinsiyetli hitaplar yasak.');
  }
  return lines.join('\n');
}

export function buildMemoryContext(profileName: string, memorySnippet: ProfileMemorySnippet | null | undefined, readingType: FortuneReadingType, coffeeMode: CoffeeMode) {
  if (!memorySnippet && !profileName) return '';
  const lines = [
    '## Subject Context',
    `- Bu fal ${profileName || 'seçili kişi'} için bakılıyor.`,
    `- Fal turu: ${readingType}.`,
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
    lines.push(`- Bu profil bir evcil hayvan profili. Tur bilgisi: ${memorySnippet.petSpecies || memorySnippet.relationshipLabel || 'evcil hayvan'}.`);
    lines.push('- El falı seçildiyse insan eli değil, bu hayvanın patisi/ayağı üzerinden yorum beklenir.');
  }
  if (memorySnippet.isSelf) lines.push('- Bu profil hesap sahibinin kendisi. Ana anlatımda profil adını kullanma; kullanıcıya tutarlı biçimde sen/siz diye hitap et ve üçüncü tekil şahsa kayma.');
  else lines.push(`- Bu okuma hesap sahibinden farklı biri için. Ana anlatımda gerekirse ${profileName} adını kullan; bu kişiyi üçüncü tekil şahısla anlat, hesap sahibine veya profile sonradan 'sen' diye dönme.`);
  lines.push(`- Seçili profil sabit: bu oturum sadece ${profileName || 'bu profil'} için. Sohbet içinde başka biri geçse bile görseli o kişiye aitmiş gibi yorumlama.`);
  if (memorySnippet.userStatedTopics?.length) lines.push(`- Kullanıcının yazdıklarında tekrar eden konular: ${memorySnippet.userStatedTopics.slice(0, 10).join(', ')}.`);
  if (memorySnippet.userTopicGroups?.length) lines.push(`- Kullanıcının konuştuğu konuların gruplu hafızası: ${memorySnippet.userTopicGroups.slice(0, 10).map((item) => `${item.group || 'Genel'} / ${item.subgroup || 'Diğer'}: ${item.label}`).join('; ')}.`);
  if (memorySnippet.userStatedPeople?.length) lines.push(`- Kullanıcının yazdıklarında öne çıkan kişiler: ${memorySnippet.userStatedPeople.slice(0, 3).join(', ')}.`);
  if (memorySnippet.prominentRelations?.length) lines.push(`- Tekilleştirilmiş öne çıkan ilişkiler: ${memorySnippet.prominentRelations.slice(0, 5).map((item) => `${item.label} (${item.relationship || 'ilgili kişi'})`).join(', ')}.`);
  if (memorySnippet.userStatedPatterns?.length) lines.push(`- Kullanıcının yazdıklarında görülen duygusal kalıplar: ${memorySnippet.userStatedPatterns.slice(0, 3).join(', ')}.`);
  if (memorySnippet.readingTopics?.length) lines.push(`- Önceki fallarda çıkan düşük öncelikli temalar: ${memorySnippet.readingTopics.slice(0, 3).join(', ')}.`);
  if (memorySnippet.readingTopicGroups?.length) lines.push(`- Falda daha önce açılmış düşük öncelikli konu hafızası: ${memorySnippet.readingTopicGroups.slice(0, 10).map((item) => `${item.group || 'Genel'} / ${item.subgroup || 'Diğer'}: ${item.label}`).join('; ')}.`);
  if (memorySnippet.readingPeople?.length) lines.push(`- Önceki fallarda öne çıkan kişiler: ${memorySnippet.readingPeople.slice(0, 3).join(', ')}.`);
  if (memorySnippet.readingPatterns?.length) lines.push(`- Önceki fallarda görülen kalıplar: ${memorySnippet.readingPatterns.slice(0, 3).join(', ')}.`);
  const observations = (memorySnippet.relevantObservations || []).slice(0, 8).map((item) => [item.source === 'user-stated' ? 'kullanıcı' : 'fal', `${item.group || item.category || 'Genel'} / ${item.subgroup || 'Diğer konuşulanlar'}`, item.title, item.summary].filter(Boolean).join(' | '));
  if (observations.length) lines.push(`- Akıllı seçilmiş olay/olgu hafızası: ${observations.join('; ')}.`);
  lines.push('- Bu hafızayı veri tabanı gibi değil, doğal bir tanışıklık hissi vermek için kullan.');
  lines.push('- Kullanıcının kendi söylediği konular en güçlü sinyaldir; önceki falda çıkan konular ise düşük öncelikli farkındalık/çeşitlilik sinyalidir.');
  lines.push('- Önceki falda çıkan bir temayı otomatik ana konu yapma; mevcut görsel, soru veya kullanıcının kendi sözleri desteklemiyorsa o temadan uzaklaş.');
  lines.push('- Aynı profilde yakın zamanda tekrar edilmiş iş, para, ilişki, aile, sağlık veya telaş/yorgunluk temasını yeni ve güçlü bir işaret yoksa yeniden merkeze alma.');
  lines.push('- Sadece ilgiliyse hafızadan yararlan; aynı yanıtta 1-2 dokunuştan fazla yapma.');
  lines.push('- Olay/olgu hafızasını yalnızca mevcut soruyla ilişkiliyse kullan; kullanıcının karşısına ham kayıt gibi dökme.');
  lines.push('- Hafıza, profil veya başka fal kaynaklarını açıkça anma; bilgiyi ancak cümlenin içine fark ettirmeden yedir.');
  lines.push('- Kahve ve el falında burç, yükselen, Güneş/Ay burcu, doğum haritası veya numeroloji sayısını açıkça söyleme; kullanıcı özellikle sormadıkça bu kaynakları metne taşıma.');
  return lines.join('\n');
}

export function buildFortunePrompt(params: {
  sessionId: string;
  devSettings: DevSettings;
  profileName: string;
  readingType: FortuneReadingType;
  coffeeMode: CoffeeMode;
  memorySnippet?: ProfileMemorySnippet | null;
  messages: FortuneMessage[];
  images: FortuneImages;
  isFollowUp?: boolean;
  validatedSurfaces?: Array<'cup' | 'saucer' | 'palm'> | null;
  palmValidation?: { isInnerPalm?: boolean; handVisibleEnough?: boolean } | null;
}) {
  const id = personaId(params.devSettings.assistantId);
  const identity = FORTUNE_PERSONA_DATA[id];
  const imageHint = [
    params.images.cup ? 'kullanıcı fincan görseli gönderdi' : '',
    params.images.saucer ? 'kullanıcı tabak görseli gönderdi' : '',
    params.images.palm ? 'kullanıcı avuç içi görseli gönderdi' : '',
  ].filter(Boolean).join(', ') || 'bu turda görsel gelmemiş olabilir';
  const isInitialReading = params.messages.length <= 1;
  const selectedReadingDomain =
    params.readingType === 'palm'
      ? 'el falı / avuç içi çizgileri'
      : params.coffeeMode === 'ai-brew'
        ? 'kişinin niyetine içilmiş gibi kahve falı'
        : 'kahve falı / fincan ve tabak';
  const crossDomainGuard =
    params.readingType === 'palm'
      ? '- Bu el falında kahve, fincan, telve, tabak, tarot, kart, rune, I Ching veya başka fal malzemesi dili kullanma; yorumu avuç içi, el formu ve çizgi akışı üzerinden kur.'
      : '- Bu kahve falında avuç içi, el çizgisi, tarot, kart, rune, I Ching veya başka fal malzemesi dili kullanma; yorumu kahve niyeti, fincan/tabak yüzeyi ve telve akışı üzerinden kur.';
  const runtimeRules = [
    '## Runtime Directives',
    `- Bu oturumun fal türünü öncele: ${selectedReadingDomain}.`,
    `- Falcının ana branşı yalnızca persona geçmişidir: ${identity.primaryDomainLabel}. Seçili fal türünden farklıysa bu branşın objelerini, yöntemini ve terminolojisini yoruma taşıma.`,
    crossDomainGuard,
    `- Bu turda ${imageHint}.`,
    '- Yanıtını başlıksız, sohbet gibi akan düz yazı halinde ver.',
    "- Persona içinde kal ama kendini tanıtma; 'ben Dürdane olarak', 'ben Mert olarak', 'ben falcı olarak' gibi kalıplar kullanma.",
    "- Hitap kişisini metin boyunca sabit tut; üçüncü tekil şahısla başladıysan sonradan 'sen' diline dönme, 'sen' diliyle başladıysan üçüncü şahsa kayma.",
    "- Aynı şefkat hitabını yan yana veya aynı yanıtta sık kullanma; 'canım canım', 'tatlım tatlım', 'güzelim güzelim' gibi ikilemeler kesinlikle yok.",
    '- Giriş bölümünü 1-2 cümlede tut; esas ağırlığı fal yorumuna ver.',
    '- Paragrafları anlam akışına göre ayır: görselden çıkan ana iz, duygu/ilişki hattı, iş-para/yaşam hattı, yakın gelecek ve öneri ayrı akabilsin.',
    '- Paragrafları TTS için rahat okunacak kısa-orta uzunlukta tut.',
    '- Her paragrafı veya ana düşünceyi tamamlanmış cümlelerle bitir.',
    '- Falcı gibi konuşurken geçmiş izlerini, bugünkü olasılıkları ve yakın gelecek ihtimallerini birlikte dokumalısın; sadece mevcut durum analizi yapıp kalma.',
    "- Yorumda kesin kehanet değil, olasılık dili kullan: 'görünen ihtimal', 'yakına düşen yol', 'bu enerji böyle giderse' gibi ifadelerle konuş.",
    '- Geçmiş, şimdi ve gelecek dengesini koru: önce görselden çıkan geçmiş izi, sonra bugünün olasılıkları, sonra yakın gelecek kapıları ve tavsiye gelsin.',
    '- Bu oturum boyunca sadece seçili profil için fal bak. Kullanıcı mesaj içinde başka biri için yorum isterse aynı görseli o kişiye aitmiş gibi yeniden yorumlama.',
    '- Kullanıcı başka biri için de yorum isterse nazikçe bunun ayrı bir profil ve ayrı bir fal oturumu gerektirdiğini söyle.',
    '- Profil, hafıza, doğum/harita, numeroloji veya başka fal verileri yalnızca arka plan sezgisi içindir; kullanıcı özellikle sormadıkça bunların kaynağını metinde söyleme.',
    "- 'Profilinde gördüğüm', 'doğum haritana göre', 'önceki falında', 'hafızanda' gibi veri kaynağını göze sokan ifadeler kullanma.",
    '- Kahve veya el falında astrolojik/numerolojik bilgiyi açıkça etiketleme; burç, yükselen, Güneş/Ay burcu, doğum haritası ve sayı raporu yazma.',
    '- Telaş, koşturma, yetişememe, acele ve günlük yoğunluk temasını kullanıcı özellikle sormadıysa veya görsel/mesaj çok güçlü göstermiyorsa ana konu yapma.',
    isInitialReading ? '- Bu ilk ana fal açılışı. Yorumu katmanlı kur; toplam uzunluk hedefi yaklaşık 800-900 token aralığı olsun.' : '- Bu bir follow-up turu. Kullanıcı sorularına verilen yanıtı yaklaşık 300-400 token aralığında tut ve sert kesmeden toparlayarak bitir.',
    '- Süre belirtirken aynı sayıyı sürekli tekrar etme. Özellikle 3 ve 6 ağırlıklı ama 1-9 arasında çeşitlendirilmiş ifade kullan.',
    '- Son kısımda yeni bir imza kapanış cümlesi üretme; sistem persona kapanışını sonradan ekleyecek.',
    '- Bu oturumda daha önce kullanılan kapanış cümlesinin aynısını veya çok yakın varyasyonunu üretme.',
    '- Kullanıcıya ses tanıma hatalarıyla gelmiş mesajlarda niyeti anlayıp doğal şekilde cevap ver.',
    '- Türkçe karakterleri daima UTF-8 doğru yaz: ç, ğ, ı, İ, ö, ş, ü.',
    '- Bozuk karakter dizileri kullanma.',
  ].join('\n');
  const parts = [identity.systemBody, runtimeRules, buildAddressPolicy(id, params.memorySnippet), buildSafetyPolicy()];
  if (params.devSettings.systemPrompt?.trim()) parts.push(`## Developer Override\n${params.devSettings.systemPrompt.trim()}`);
  const memoryContext = buildMemoryContext(params.profileName, params.memorySnippet, params.readingType, params.coffeeMode);
  if (memoryContext) parts.push(memoryContext);
  if (params.isFollowUp) {
    parts.push([
      '## Follow-up Yanıt Sözleşmesi',
      '- Bu tur yeni bir fal açılışı değildir; önceki fal metnini yeniden yazma, özetleme veya kopyalama.',
      '- Yalnızca kullanıcının son mesajındaki soruya doğrudan cevap ver.',
      '- Önceki falı sadece bağlam olarak kullan; görseli veya ana falı baştan yorumlamaya çalışma.',
      '- Yanıtı 2 kısa paragraf olarak ver; kısa geçiştirme yapma, soruya doyurucu biçimde cevap ver.',
      '- İlk paragrafta net yanıtı, ikinci paragrafta fal bağlamından 1-2 gerekçeyi ve uygulanabilir kısa tavsiyeyi ver.',
      '- Yaklaşık 120-170 token içinde tamamla.',
      '- Kullanıcının son mesajında önceki okumanın transkripsiyonu yanlışlıkla varsa onu yok say ve gerçek soruya odaklan.',
    ].join('\n'));
  }
  if (params.validatedSurfaces) {
    const surfaceRules = ['## Görsel Yorum Disiplini', '- Sadece görselde seçilebilir telve/çizgi/lekelerden yorum üret.', '- Emin olmadığın şekli kesinmiş gibi söyleme; belirsizse belirsiz olduğunu belirt.', '- Fincan/tabak üzerindeki üretim desenleri (çiçek, süs, baskı, marka, kabartma) yorum unsuru değildir; bunları fal sembolü sayma.'];
    if (params.readingType === 'palm') {
      surfaceRules.push('## Surface Guard');
      surfaceRules.push('- Bu turda kullanıcı el falı için insan eli/avuç içi görseli doğrulandı.');
      surfaceRules.push('- Fincan veya tabak görmüş gibi konuşma.');
      surfaceRules.push('- Yorumu avuç içi çizgileri, parmak yerleşimi ve el formu üzerinden kur.');
      if (params.palmValidation && (!params.palmValidation.isInnerPalm || !params.palmValidation.handVisibleEnough)) surfaceRules.push('- Doğrulama görselin kısmi veya yeterince net olmayabileceğini söylüyor; bunu kesin hata sayma, yorumu temkinli ve kibar kur.');
    } else if (params.validatedSurfaces.length === 1 && params.validatedSurfaces[0] === 'cup') {
      surfaceRules.push('## Surface Guard', '- Bu turda yalnızca fincan içi doğrulandı.', '- Tabak görmüş gibi konuşma.', '- Yorumu fincan içi derinliği, kenar akışı ve iç yüzey üzerinden kur.');
    } else if (params.validatedSurfaces.length === 1 && params.validatedSurfaces[0] === 'saucer') {
      surfaceRules.push('## Surface Guard', '- Bu turda yalnızca kahve tabağı doğrulandı.', '- Fincan görmüş gibi konuşma.', '- Yorumu tabak yüzeyi, yayılma, göllenme ve dış dünya yansıması üzerinden kur.');
    } else if (params.validatedSurfaces.length) {
      surfaceRules.push('## Surface Guard', '- Bu turda fincan içi ve tabak birlikte doğrulandı.', '- Hangi yüzeyi yorumladığını açıkça ayır.');
    }
    parts.push(surfaceRules.join('\n'));
  }
  return {
    assistantId: id,
    systemInstruction: parts.filter(Boolean).join('\n\n'),
    closingSentence: selectClosingSentence(id, params.messages, params.sessionId || 'default-session'),
  };
}
