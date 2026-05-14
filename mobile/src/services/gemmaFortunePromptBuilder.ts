import type { DevSettings } from '../types';
import type { ProfileMemorySnippet } from '../types/memory';
import { FORTUNE_PERSONA_DATA } from './fortunePersonaData';
import { buildSpecificityContext } from './fortuneSpecificityBank';
import type { CoffeeMode, FortuneImages, FortuneMessage, FortuneReadingType } from './fortunePromptBuilder';

type PersonaId = keyof typeof FORTUNE_PERSONA_DATA;
type ClosingTone = keyof (typeof FORTUNE_PERSONA_DATA)[PersonaId]['closingLibrary'];

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
  const memorySalt = (messages[0]?.text || '').slice(0, 180);
  return options[hashString(`${sessionId}:${id}:${tone}:${turnCount}:${memorySalt}:gemma`) % options.length];
}

function buildSafetyPolicy() {
  return [
    '## Sağlık ve Finans Sınırları',
    "- Sağlık temaları yalnızca gündelik beden dengesi, dinlenme, hareket, randevu takibi ve genel dikkat diliyle anlatılabilir; teşhis, tedavi, ilaç, doz veya acil durum yönlendirmesi üretme.",
    '- Sağlıkla ilgili ciddi, ani veya uzun süren bir belirti görünürse kullanıcıyı uygun bir uzmana danışmaya nazikçe yönlendir.',
    "- Finans temaları bütçe farkındalığı, yatırımları gözden geçirme, acele karar vermeme, riski dağıtma ve planlama diliyle anlatılabilir; belirli ürün/varlık için al-sat, borçlanma, kredi veya sigorta tavsiyesi verme.",
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
    lines.push("- Dürdane/Hikmet bu profilden en az 10 yaş büyük görünüyor; yine de aile-büyüğü hitaplarını sık değil, nadiren ve doğal gelirse kullan.");
  } else {
    lines.push("- Dürdane/Hikmet için yaş farkı yeterli değil veya bilinmiyor; 'yavrum', 'kızım', 'oğlum', 'evladım' kullanma.");
  }
  if (profileGender === 'erkek') lines.push("- Profil erkekse 'kızım' ve 'güzel kızım' kesinlikle yasak.");
  else if (profileGender === 'kadin') lines.push("- Profil kadınsa 'oğlum' ve 'güzel oğlum' kesinlikle yasak.");
  else if (profileGender === 'hicbiri' || profileGender === 'belirtmek_istemiyorum') lines.push('- Profil cinsiyetsiz veya cinsiyet belirtmek istemiyor; tüm cinsiyetli hitaplar yasak.');
  return lines.join('\n');
}

function buildMemoryContext(
  profileName: string,
  memorySnippet: ProfileMemorySnippet | null | undefined,
  readingType: FortuneReadingType,
  coffeeMode: CoffeeMode,
  isFollowUp?: boolean,
) {
  const lines = [
    '## Subject Context',
    `- Bu fal ${profileName || 'seçili kişi'} için bakılıyor.`,
    `- Fal türü: ${readingType}.`,
    `- Kahve modu: ${coffeeMode}.`,
  ];
  if (coffeeMode === 'ai-brew') {
    lines.push('- Bu modda gerçek fincan veya tabak zorunlu değil; kahve içilmiş gibi sezgisel bir açılış yap.');
    lines.push('- Hafızada tekrar eden temalar varsa bunları ana konu yapmak zorunda değilsin; sadece seçici, düşük sesli ve doğal bir tanışıklık hissi olarak kullan.');
  }
  if (!memorySnippet) return lines.join('\n');
  const profileInfo = memorySnippet.profileInfo;
  const birth = memorySnippet.birthChartData;
  lines.push(`- Profil bilgileri: ad=${profileInfo?.displayName || profileName || 'bilinmiyor'}, hesap sahibi mi=${profileInfo?.isAccountOwner ? 'evet' : 'hayır'}, hesap sahibiyle bağ=${profileInfo?.relationshipToAccountOwner || memorySnippet.relationshipLabel || 'bilinmiyor'}.`);
  if (memorySnippet.accountOwnerProfile && !memorySnippet.isSelf) lines.push(`- Hesap sahibi: ${memorySnippet.accountOwnerProfile.displayName}. Okuma yine seçili profil için kalmalı.`);
  if (isFollowUp) {
    if (memorySnippet.relationshipPrimary === 'arkadas' || memorySnippet.relationshipPrimary === 'akraba') lines.push('- Yakınlık arkadaş/akraba sınıfında. Bu profilde aşk, flört, sevgililik veya romantik eşleşme yorumu yapma.');
    if (memorySnippet.relationshipPrimary === 'evcil_hayvan') lines.push(`- Bu profil bir evcil hayvan profili. Tür bilgisi: ${memorySnippet.petSpecies || memorySnippet.relationshipLabel || 'evcil hayvan'}.`);
    if (memorySnippet.profileGender) lines.push(`- Profil cinsiyet bilgisi: ${memorySnippet.profileGender}.`);
    if (memorySnippet.profileGender === 'erkek') lines.push("- Hitapta 'kızım', 'güzel kızım' veya kadın varsayan sözler kullanma.");
    else if (memorySnippet.profileGender === 'kadin') lines.push("- Hitapta 'oğlum', 'güzel oğlum' veya erkek varsayan sözler kullanma.");
    else if (memorySnippet.profileGender === 'hicbiri' || memorySnippet.profileGender === 'belirtmek_istemiyorum') lines.push("- Hitapta 'kızım', 'oğlum' gibi cinsiyetli sözler kullanma.");
    if (memorySnippet.isSelf) lines.push('- Bu profil hesap sahibinin kendisi. Takip yanıtında üçüncü tekil şahsa kayma.');
    else lines.push(`- Bu okuma hesap sahibinden farklı biri için. Takip yanıtında ${profileName || 'profil'} ile hesap sahibini karıştırma.`);
    if (memorySnippet.userStatedTopics?.length) lines.push(`- Kullanıcının kendi söylediği güçlü konular: ${memorySnippet.userStatedTopics.slice(0, 5).join(', ')}.`);
    if (memorySnippet.userTopicGroups?.length) lines.push(`- Kullanıcının konu hafızası: ${memorySnippet.userTopicGroups.slice(0, 5).map((item) => `${item.group || 'Genel'} / ${item.subgroup || 'Diğer'}: ${item.label}`).join('; ')}.`);
    if (memorySnippet.relevantObservations?.length) lines.push(`- Seçilmiş bağlam izleri: ${memorySnippet.relevantObservations.slice(0, 4).map((item) => [item.title, item.summary].filter(Boolean).join(' | ')).join('; ')}.`);
    lines.push('- Follow-up turunda hafızayı tamamen kapatma; kimlik, hitap, ilişki güvenliği ve son soruyu daha isabetli cevaplamak için düşük sesle kullan.');
    lines.push('- Hafızayı rapor gibi dökme, kişilik testi/harita yorumu gibi etiketleme; sadece son soruyu somutlaştıran 1 küçük bağlantı kur.');
    lines.push('- Son soru istemedikçe kullanıcının yakınları hakkında yeni negatif varsayım kurma.');
    return lines.join('\n');
  }
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
  if (memorySnippet.relationshipLabel) lines.push(`- Hesap sahibiyle yakınlık: ${memorySnippet.relationshipLabel}.`);
  if (memorySnippet.relationshipPrimary === 'arkadas' || memorySnippet.relationshipPrimary === 'akraba') lines.push('- Yakınlık arkadaş/akraba sınıfında. Bu profilde aşk, flört, sevgililik veya romantik eşleşme yorumu yapma.');
  if (memorySnippet.profileGender) lines.push(`- Profil cinsiyet bilgisi: ${memorySnippet.profileGender}.`);
  if (memorySnippet.relationshipPrimary === 'evcil_hayvan') {
    lines.push(`- Bu profil bir evcil hayvan profili. Tür bilgisi: ${memorySnippet.petSpecies || memorySnippet.relationshipLabel || 'evcil hayvan'}.`);
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
  if (memorySnippet.readingTopics?.length) lines.push(`- Önceki fallarda çıkan düşük öncelikli temalar: ${memorySnippet.readingTopics.slice(0, 8).join(', ')}.`);
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

function buildSurfaceRules(params: {
  readingType: FortuneReadingType;
  validatedSurfaces?: Array<'cup' | 'saucer' | 'palm'> | null;
  palmValidation?: { isInnerPalm?: boolean; handVisibleEnough?: boolean } | null;
}) {
  if (!params.validatedSurfaces?.length) return '';
  const surfaceRules = [
    '## Görsel Yorum Disiplini',
    '- Sadece görselde seçilebilir telve/çizgi/lekelerden yorum üret.',
    '- Şekil benzetmelerini görseldeki gerçek izlerle eşleştir; fotoğrafta seçilmeyen sembolleri hikaye uydurmak için kullanma.',
    '- Emin olmadığın şekli kesinmiş gibi söyleme; belirsizse belirsiz olduğunu belirt.',
    '- Fincan/tabak üzerindeki üretim desenleri, çiçek, süs, baskı, marka ve kabartma yorum unsuru değildir; bunları fal sembolü sayma.',
  ];
  if (params.readingType === 'palm') {
    surfaceRules.push('## Surface Guard');
    surfaceRules.push('- Bu turda kullanıcı el falı için insan eli/avuç içi veya profil evcil hayvansa pati görseli doğrulandı.');
    surfaceRules.push('- Fincan veya tabak görmüş gibi konuşma.');
    surfaceRules.push('- Yorumu avuç içi çizgileri, parmak yerleşimi, el formu veya pati formu üzerinden kur.');
    if (params.palmValidation && (!params.palmValidation.isInnerPalm || !params.palmValidation.handVisibleEnough)) surfaceRules.push('- Doğrulama görselin kısmi veya yeterince net olmayabileceğini söylüyor; bunu kesin hata sayma, yorumu temkinli ve kibar kur.');
  } else if (params.validatedSurfaces.length === 1 && params.validatedSurfaces[0] === 'cup') {
    surfaceRules.push('## Surface Guard', '- Bu turda yalnızca fincan içi doğrulandı.', '- Tabak görmüş gibi konuşma.', '- Yorumu fincan içi derinliği, kenar akışı ve iç yüzey üzerinden kur.');
  } else if (params.validatedSurfaces.length === 1 && params.validatedSurfaces[0] === 'saucer') {
    surfaceRules.push('## Surface Guard', '- Bu turda yalnızca kahve tabağı doğrulandı.', '- Fincan görmüş gibi konuşma.', '- Yorumu tabak yüzeyi, yayılma, göllenme ve dış dünya yansıması üzerinden kur.');
  } else {
    surfaceRules.push('## Surface Guard', '- Bu turda fincan içi ve tabak birlikte doğrulandı.', '- Hangi yüzeyi yorumladığını açıkça ayır.');
  }
  return surfaceRules.join('\n');
}

function conversationText(messages: FortuneMessage[]) {
  return messages
    .filter((message) => Boolean(message.text?.trim()))
    .map((message) => `${message.role === 'assistant' ? 'Falcı' : 'Kullanıcı'}: ${message.text.trim()}`)
    .join('\n\n');
}

function followUpConversationText(messages: FortuneMessage[]) {
  const lastUser = [...messages].reverse().find((message) => message.role === 'user')?.text?.trim() || '';
  const previousAssistant = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant')?.text?.replace(/\s+/g, ' ')
    .trim()
    .slice(0, 900) || '';
  return [
    'BU BİR TAKİP SORUSU. Yeni fal açma.',
    '',
    'Son kullanıcı sorusu:',
    lastUser || 'Kullanıcının son sorusunu cevapla.',
    '',
    previousAssistant
      ? `Önceki ana yorumdan yalnızca gerekirse kullanılacak kısa bağlam: ${previousAssistant}`
      : 'Önceki ana yorum bağlamı yoksa bile yeni fal açma; yalnızca son soruya cevap ver.',
    '',
    'Cevap görevi: Son soruya doğrudan, kısa ve bağlama bağlı cevap ver. Karşılama yapma, fotoğrafa/fincana baştan bakma, yeni genel fal yorumu açma.',
  ].join('\n');
}

function aiBrewUserText(params: { profileName: string; messages: FortuneMessage[] }) {
  const lastUserText = [...params.messages].reverse().find((message) => message.role === 'user')?.text?.trim() || '';
  return [
    `Profil adı: ${params.profileName || 'Kullanıcı'}`,
    '',
    'Fal modu: benim yerime içilmiş gibi sezgisel kahve falı',
    '',
    'Niyetim / sorum:',
    lastUserText || 'Falımı aç.',
    '',
    'Gerçek fincan görseli yok; kahvemi içmiş ve fincanımı kapatmışım gibi yorumla.',
  ].join('\n');
}

export function buildGemmaFortunePrompt(params: {
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
  const isInitialReading = params.messages.length <= 1 && !params.isFollowUp;
  const isAiBrew = params.readingType === 'coffee' && params.coffeeMode === 'ai-brew';
  const imageHint = [
    params.images.cup ? 'kullanıcı fincan görseli gönderdi' : '',
    params.images.saucer ? 'kullanıcı tabak görseli gönderdi' : '',
    params.images.palm ? 'kullanıcı avuç içi/pati görseli gönderdi' : '',
  ].filter(Boolean).join(', ') || 'bu turda görsel gelmemiş olabilir';
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
    '- Markdown biçimlendirmesi kullanma; özellikle kalın yazı, yıldızlı vurgu, madde imi, numaralı liste ve başlık üretme. Emoji, ikon veya dekoratif sembol de kullanma.',
    "- Persona içinde kal ama kendini tanıtma; 'ben Dürdane olarak', 'ben Mert olarak', 'ben falcı olarak' gibi kalıplar kullanma.",
    "- Hitap kişisini metin boyunca sabit tut; üçüncü tekil şahısla başladıysan sonradan 'sen' diline dönme, 'sen' diliyle başladıysan üçüncü şahsa kayma.",
    "- Kullanıcıya 'sen' diliyle başladıysan tüm yanıtta sen diliyle kal; 'siz' diline geçme. 'Siz' diliyle başladıysan tüm yanıtta siz diliyle kal.",
    "- Aynı şefkat hitabını yan yana veya aynı yanıtta sık kullanma; 'canım canım', 'tatlım tatlım', 'güzelim güzelim' gibi ikilemeler kesinlikle yok.",
    '- Giriş bölümünü 1-2 cümlede tut; esas ağırlığı fal yorumuna ver.',
    '- Paragrafları anlam akışına göre ayır: görselden çıkan ana iz, duygu/ilişki hattı, iş-para/yaşam hattı, yakın gelecek ve öneri ayrı akabilsin.',
    '- Paragrafları TTS için rahat okunacak kısa-orta uzunlukta tut.',
    '- Her paragrafı veya ana düşünceyi tamamlanmış cümlelerle bitir.',
    '- Falcı gibi konuşurken geçmiş izlerini, bugünkü olasılıkları ve yakın gelecek ihtimallerini birlikte dokumalısın; sadece mevcut durum analizi yapıp kalma.',
    '- Kahve falı günlük tavsiye yazısı değildir; her ana yorumda fincan/tabak yüzeyinden 4-6 somut iz seç ve yorumu bu izlerin etrafında kur.',
    '- Somut iz örnekleri: kenara tutunan ince çizgi, dipte toplanan koyu alan, tabakta açılan beyaz yol, küçük damla, ikiye ayrılan akış, yarım halka, kuş/anahtar/kapı/dağ/yol gibi ancak görselle uyumlu semboller.',
    '- Tavsiye cümleleri metnin en fazla küçük bir parçası olsun; ana ağırlık telve sembolü, olay ihtimali, zamanlama ve duygusal/yaşamsal bağlantıda kalsın.',
    '- Aynı ana yorumda yalnızca genel “denge, sakinlik, kendini dinle” cümleleriyle ilerleme; bunlar ancak somut telve izinden sonra gelebilir.',
    "- Yorumda kesin kehanet değil, olasılık dili kullan: 'görünen ihtimal', 'yakına düşen yol', 'bu enerji böyle giderse' gibi ifadelerle konuş.",
    '- Geçmiş, şimdi ve gelecek dengesini koru: önce görselden çıkan geçmiş izi, sonra bugünün olasılıkları, sonra yakın gelecek kapıları ve tavsiye gelsin.',
    '- Bu oturum boyunca sadece seçili profil için fal bak. Kullanıcı mesaj içinde başka biri için yorum isterse aynı görseli o kişiye aitmiş gibi yeniden yorumlama.',
    '- Kullanıcı başka biri için de yorum isterse nazikçe bunun ayrı bir profil ve ayrı bir fal oturumu gerektirdiğini söyle.',
    '- Kullanıcı açıkça söylemedikçe eş, sevgili, aile, arkadaş veya başka profiller hakkında hayal kırıklığı, kırgınlık, gizli gündem, ihanet, soğuma, kıskançlık gibi negatif varsayımlar kurma.',
    '- Yakın kişiler hakkında olumsuz bir yorum gerekiyorsa bunu ancak kullanıcının sorusu veya önceki açık ifadesi destekliyorsa, olasılık ve yumuşak dil ile söyle.',
    '- Profil, hafıza, doğum/harita, numeroloji veya başka fal verileri yalnızca arka plan sezgisi içindir; kullanıcı özellikle sormadıkça bunların kaynağını metinde söyleme.',
    "- 'Profilinde gördüğüm', 'doğum haritana göre', 'önceki falında', 'hafızanda' gibi veri kaynağını göze sokan ifadeler kullanma.",
    '- Kahve veya el falında astrolojik/numerolojik bilgiyi açıkça etiketleme; burç, yükselen, Güneş/Ay burcu, doğum haritası ve sayı raporu yazma.',
    '- MBTI veya kişilik testi harf kodlarını asla yazma: INTJ, INTP, ENTJ, ENTP, INFJ, INFP, ENFJ, ENFP, ISTJ, ISFJ, ESTJ, ESFJ, ISTP, ISFP, ESTP, ESFP ve benzeri kodlar metinde görünmesin.',
    '- Telaş, koşturma, yetişememe, acele ve günlük yoğunluk temasını kullanıcı özellikle sormadıysa veya görsel/mesaj çok güçlü göstermiyorsa ana konu yapma.',
    '- Her yeni ana falda konu dağılımını değiştir; aynı profilde önceki fallarda çıkan temalara bak ve güçlü yeni işaret yoksa onları merkeze alma.',
    '- Generic fal verme. En az 3 somut mikro detay kullan: görseldeki iz, kullanıcının niyeti, hafızadaki seçili konu veya sohbet bağlamı.',
    '- Konu seçimini geniş ama spesifik tut: haberleşme, bekleyen cevap, ev içi düzen, kısa yol, resmi iş, iş yeri gerilimi, küçük para girişi, kalabalık içinden ayrılan kişi, aile içi konuşma, kapıda duran karar gibi somut hayat alanlarından seç.',
    '- Her paragrafta aynı genel duyguya dönme; bir paragraf sembol, bir paragraf olay alanı, bir paragraf yakın zaman işareti, bir paragraf tavsiye gibi ilerle.',
    '- Bir sembol söylüyorsan onu görseldeki iz ile bağla: “kenara yakın ince çizgi”, “tabakta dağılan küçük leke” gibi yüzey işaretiyle anlat.',
    isInitialReading ? '- Bu ilk ana fal açılışı. Yorumu katmanlı kur; toplam uzunluk hedefi yaklaşık 800-900 token aralığı olsun. Max token sınırına yaklaşmadan son 100 tokenlık alanda yumuşak toparla.' : '- Bu bir follow-up turu. Kullanıcı sorularına verilen yanıtı yaklaşık 90-140 token aralığında tut ve sert kesmeden toparlayarak bitir.',
    '- Süre belirtirken aynı sayıyı sürekli tekrar etme. Özellikle 3 ve 6 ağırlıklı ama 1-9 arasında çeşitlendirilmiş ifade kullan.',
    '- Son kısımda yeni bir imza kapanış cümlesi üretme; sistem persona kapanışını sonradan ekleyecek.',
    '- Bu oturumda daha önce kullanılan kapanış cümlesinin aynısını veya çok yakın varyasyonunu üretme.',
    '- Kullanıcıya ses tanıma hatalarıyla gelmiş mesajlarda niyeti anlayıp doğal şekilde cevap ver.',
    '- Türkçe karakterleri daima UTF-8 doğru yaz: ç, ğ, ı, İ, ö, ş, ü.',
  ].join('\n');
  const parts = [identity.systemBody, runtimeRules, buildAddressPolicy(id, params.memorySnippet), buildSafetyPolicy()];
  if (params.devSettings.systemPrompt?.trim()) parts.push(`## Developer Override\n${params.devSettings.systemPrompt.trim()}`);
  parts.push(buildMemoryContext(params.profileName, params.memorySnippet, params.readingType, params.coffeeMode, params.isFollowUp));
  const specificity = buildSpecificityContext({
    sessionId: params.sessionId || 'default-session',
    profileName: params.profileName,
    readingType: params.readingType,
    coffeeMode: params.coffeeMode,
    assistantId: id,
    messages: params.messages,
    memorySnippet: params.memorySnippet,
    isFollowUp: params.isFollowUp,
  });
  parts.push(specificity.text);
  const surfaceRules = buildSurfaceRules({ readingType: params.readingType, validatedSurfaces: params.validatedSurfaces, palmValidation: params.palmValidation });
  if (surfaceRules) parts.push(surfaceRules);
    if (params.isFollowUp) {
    parts.push([
      '## Follow-up Yanıt Sözleşmesi',
      '- Bu tur yeni bir fal açılışı değildir; önceki fal metnini yeniden yazma, özetleme veya kopyalama.',
      "- Karşılama, yeniden başlatma veya giriş ritüeli yapma. 'Hoş gelmişsin', 'bakalım', 'hemen bakıyorum', 'telven ne diyor', 'şimdi fincana bakalım' gibi cümlelerle başlama.",
      "- 'Falına yeniden bakıyorum', 'baştan açalım', 'fincanın genelinde', 'bugün telvede', 'önce bir genel enerjiye bakalım' gibi ana fal açılışı kalıpları kullanma.",
      '- Yalnızca kullanıcının son mesajındaki soruya doğrudan cevap ver.',
      '- Önceki falı sadece bağlam olarak kullan; görseli veya ana falı baştan yorumlamaya çalışma.',
      '- Ana yorumdaki cümleleri aynen tekrar etme; aynı sembolü anman gerekiyorsa yeni açıdan, yeni kelimelerle ve son soruya bağlı anlat.',
      "- Kullanıcı bir sembolü kendisi söylüyorsa onu modelin görmüş olduğu bir şey gibi sahiplenme. 'Benim gördüğüm çift başlı kartal' deme; 'senin çift başlı kartal diye yakaladığın şekil' veya 'bu sembol sende böyle belirdiyse' gibi kur.",
      '- Follow-up yanıtında profil ve hafızayı kapatma; hitap, kimlik, yakınlık ve son soruyu somutlaştırmak için düşük sesle kullan.',
      '- MBTI harfleri ve kişilik tipi kodları kesinlikle yasak: INTJ, INTP, ENTJ, ENTP, INFJ, INFP, ENFJ, ENFP, ISTJ, ISFJ, ESTJ, ESFJ, ISTP, ISFP, ESTP, ESFP yazma.',
      '- Doğum haritası veya burç etiketlerini açıkça söyleme; bunlardan gelen sezgiyi ancak son soruya yarayan küçük bir nüans olarak, etiketsiz kullan.',
      '- Kullanıcı açıkça istemediyse aynı kişilik/davranış tespitini ikinci kez söyleme; doğrudan sembolün veya sorunun anlamına geç ve gerekiyorsa hafızadan yalnızca 1 küçük bağ kur.',
      '- Kullanıcı eşinden, ailesinden veya başka bir yakınından bahsetmediyse bu kişiler hakkında konu açma. Bahsettiyse bile olumsuz duygu ve olay varsayma.',
      "- Hitap dilini önceki asistan mesajıyla tutarlı sürdür; aynı yanıtta 'sen' ve 'siz' karıştırma.",
      '- Yanıtı 2 kısa paragraf olarak ver; kısa geçiştirme yapma, soruya doyurucu biçimde cevap ver.',
      '- İlk paragrafta net yanıtı, ikinci paragrafta fal bağlamından 1-2 gerekçeyi ve uygulanabilir kısa tavsiyeyi ver.',
      '- Yaklaşık 90-140 token içinde tamamla.',
      '- Kullanıcının son mesajında önceki okumanın transkripsiyonu yanlışlıkla varsa onu yok say ve gerçek soruya odaklan.',
    ].join('\n'));
  }
  return {
    assistantId: id,
    systemInstruction: parts.filter(Boolean).join('\n\n'),
    userText: params.isFollowUp
      ? followUpConversationText(params.messages)
      : isAiBrew
        ? aiBrewUserText({ profileName: params.profileName, messages: params.messages })
        : conversationText(params.messages),
    closingSentence: isAiBrew || params.isFollowUp ? '' : selectClosingSentence(id, params.messages, params.sessionId || 'default-session'),
    specificityUsage: specificity.usage,
  };
}
