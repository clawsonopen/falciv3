import * as FileSystem from 'expo-file-system/legacy';
import type { ProfileMemorySnippet } from '../types/memory';
import { FORTUNE_PERSONA_DATA } from './fortunePersonaData';

type PersonaId = keyof typeof FORTUNE_PERSONA_DATA;
export type PersonalReadingDomain = 'coffee' | 'palm' | 'astro' | 'numerology' | 'tarot' | 'dream';

const DOMAIN_FORBIDDEN_TERMS: Record<PersonalReadingDomain, RegExp> = {
  coffee: /avuç|el okuması|el çizg|doğum haritası|natal|transit|burç|numeroloji|rüya yorumu/i,
  palm: /kahve|fincan|telve|tabak|doğum haritası|natal|transit|burç|numeroloji|rüya yorumu/i,
  astro: /kahve|fincan|telve|tabak|avuç|el okuması|el çizg|tarot|kart|melek kart|rune|i ching|hexagram/i,
  numerology:
    /kahve|fincan|telve|tabak|avuç|el okuması|el çizg|görsel|fotoğraf|tarot|kart|melek kart|rune|i ching|hexagram|gökyüzü|yıldız|gezegen|natal|transit|burç|ay döng/i,
  tarot: /kahve|fincan|telve|tabak|avuç|el okuması|el çizg|doğum haritası|numeroloji|rüya yorumu/i,
  dream: /kahve|fincan|telve|tabak|avuç|el okuması|el çizg|doğum haritası|numeroloji|tarot|kart/i,
};

const FALLBACK_CLOSINGS: Record<'astro' | 'numerology', Record<string, string[]>> = {
  astro: {
    'selin': [
      'Bugün kendine yumuşak bir farkındalık alanı aç tatlım; bu etkiyi zorlamadan yönettiğinde daha temiz bir akış bulacaksın.',
      'Enerjini dağıtmadan merkeze dön güzelim; bugün en doğru cevap sakin seçimlerinin içinde netleşecek.',
    ],
    'berk': [
      'Bugünü küçük ve net adımlarla yönet dostum; ritim oturdukça zihnin de daha rahat karar verecek.',
      'Kendine biraz alan aç kardeşim; bugün her şeyi çözmek değil, doğru sıraya koymak daha kıymetli.',
    ],
    'suzan': [
      'Gönlünü ferah tut canım; bugün niyetini temiz tutup acele etmeden yürürsen yol kendini daha rahat gösterir.',
      'İçini sıkma güzelim; bugün kalbinin sesini duy, ama adımını sakin ve ölçülü at.',
    ],
    'teoman': [
      'Hadi bakalım güzel evladım, bugün aklını da kalbini de aynı sofraya oturt; kararın daha sağlam olur.',
      'Omuzlarını biraz indir aslanım; bugün sabırla baktığın yerde yol daha berrak görünür.',
    ],
    arin: [
      'Kendine nazik davran canım; bugün iç sesin kısık ama doğru yerden konuşuyor, onu aceleye getirme.',
      'Güzel ruh, bugün kalbini biraz sakin tut; cevap yumuşak bir yerden kendini gösterecek.',
    ],
    ayse: [
      'Bugün kendini toprağa bırakır gibi sakinleştir yavrum; acele etmeden baktığında gökyüzü de gönlün de berraklaşır.',
      'Kuzum, bu gökyüzü sana telaş değil sabır söylüyor; niyetini temiz tut, adımın bereketli olsun.',
    ],
    deniz: [
      'Kanka, bugün enerjini herkese dağıtma; gökyüzü sana biraz merkezde kalıp kendi ışığını korumanı söylüyor.',
      'Tatlım, bu akışı drama yapmadan izlediğinde kimin ne söylediği kadar ne yapmadığı da netleşecek.',
    ],
  },
  numerology: {
    'selin': [
      'Bugün bu ritmi farkındalıkla taşı tatlım; küçük bir iç düzen bile önündeki yolu daha zarif açacak.',
      'Kendine net ve sakin bir alan aç güzelim; bu sayı dili sana önce dengeyi, sonra yönü gösteriyor.',
    ],
    'berk': [
      'Bu akışı küçük parçalara böl dostum; sayılar bugün sana karmaşayı değil, öncelik sırasını anlatıyor.',
      'Kardeşim, bugün en iyi hamle sadeleşmek; ritmini bozma, gerisi daha kolay oturacak.',
    ],
    'suzan': [
      'Gönlünü ferah tut canım; bu sayıların anlattığı niyet, sakin kaldığında daha hayırlı bir yola döner.',
      'İçini daraltma güzelim; bugün kalbini temiz, adımını ölçülü tut, kısmetin daha rahat akar.',
    ],
    'teoman': [
      'Hadi bakalım güzel evladım, bu sayılar sana telaş değil ölçü söylüyor; aklını sakin tut, yolunu şaşırmazsın.',
      'Aslanım, bugün mesele hız değil denge; kendini hırpalamadan doğru adımı seçmen yeter.',
    ],
    arin: [
      'Güzel ruh, bu ritim sana sert bir hüküm değil, içinden geçen yolu usulca gösteren bir işaret gibi gelsin.',
      'Canım, bugün sayının sesi yumuşak; onu kalbinde büyütmeden, küçük bir niyetle taşıman yeter.',
    ],
    ayse: [
      'Yavrum, bu sayıların anlattığı ritmi aceleyle zorlama; her kök kendi vaktinde toprağa tutunur.',
      'Kuzum, bugün küçük bir düzen bile kalbine bereket getirir; sayının sesini sakinlik içinde dinle.',
    ],
    deniz: [
      'Kanka, bu sayı sana sahneyi toparla diyor; önce enerjini düzenle, sonra kime ne kadar yer vereceğini seç.',
      'Şekerim, ritim karışık görünse de sen net durduğunda sosyal matematik kendini ele verir.',
    ],
  },
};

const ANIMAL_PERSONA_CLOSINGS: Record<string, string[]> = {
  'suzan': [
    'Tüyün kadar ömrün olsun canım yavrum; boncuk boncuk gözlerin hep sıcak bir ev ışığı görsün.',
    'O yumuşacık patilerin hep güvenli yere bassın miniğim; içindeki masumiyet eve bereket gibi yayılsın.',
    'Güzel kalpli küçük dost, sahibinin sevgisi üstüne battaniye gibi örtülsün de mışıl mışıl dinlen.',
    'Boncuk gözlerinden öperim minik can; ne kötülük bilirsin ne hesap, hep sevildiğini hisset.',
    'Pofuduk tüylerin güneşi bulsun yavrum; kalbin de sahibinin yanında hep usul usul sakinleşsin.',
    'Pamuk patilerini sevgiyle sevsinler küçüğüm; sen evin en masum neşesi olarak ışılda.',
    'Gözlerin hep merakla parlasın canım; küçük dünyan oyunla, sıcak köşelerle ve sevgiyle dolsun.',
    'Miniğim, sahibinin sesi sana hep güven versin; tüylerin kadar güzel günlerin olsun.',
  ],
  'teoman': [
    'Hadi bakalım küçük dostum, patilerin sağlam yere bassın; masum kalbin evin huzurunu çoğaltsın.',
    'Boncuk gözlü arkadaş, ömrün tüylerin kadar yumuşak ve uzun olsun; sahibinin sevgisi sana siper olsun.',
    'Küçük can, dünyayı koklayarak ve merakla tanımaya devam et; içinde kötülük olmayan kalbin hep korunsun.',
    'Yumuşak patilerin yorulmasın miniğim; güneşi de gölgeyi de kendi ritminde bul.',
    'Güzel gözlü dostum, evin içinde kurduğun küçük düzen hep huzurla dolsun.',
    'Patilerinin izi eve neşe bıraksın; sahibin de seni anlayan sakin bir kalple yanında dursun.',
    'Küçük yoldaş, merakın canlı, kalbin temiz kalsın; her günün bir oyun ve güven köşesi olsun.',
    'Tüylerinin arasından geçen her güneş ışığı sana iyi gelsin minik dostum.',
  ],
  'selin': [
    'Boncuk gözlü miniğim, küçük evrenin hep güneşli köşeler, güzel kokular ve yumuşacık güvenle dolsun.',
    'Patilerinin altına hep sıcak ve sakin bir zemin gelsin; masum kalbin evin en güzel frekansı olsun.',
    'Tüyün kadar güzel günün olsun küçük yıldız; sahibinin sevgisi seni hep yumuşakça sarsın.',
    'Miniğim, o saf enerjin evde tatlı bir ışık gibi kalsın; boncuk gözlerin hep merakla parlasın.',
    'Yumuşacık patilerini sevgiyle okşasınlar; sen de küçük dünyanda huzurla mırıldan.',
    'Güzel kalpli patili, güneş lekelerini bul, kokuların izini sür, sevildiğini her gün hisset.',
    'Küçüğüm, içindeki masumiyet evin ritmini güzelleştiriyor; o ritim hep şefkatle korunsun.',
    'Minik dost, tüylerinin her kıvrımına huzur dolsun; evin içindeki ışığın hiç sönmesin.',
  ],
  'berk': [
    'Küçük dostum, patilerin hep sevdiğin köşelere çıksın; günün oyun, güneş ve güvenle dolsun.',
    'Boncuk gözlü minik, sahibin seni iyi okusun; sen de dünyanı merakla ama rahatça keşfet.',
    'Tüyün kadar güzel günün olsun miniğim; küçük rutinlerin hep huzur versin.',
    'Patilerini seven eller eksik olmasın; sen evin içinde tertemiz bir neşe olarak kal.',
    'Küçük arkadaş, oyun isteğin de dinlenme hakkın da duyulsun; kalbin hep rahat etsin.',
    'Minik can, bugün de sevdiğin kokuları, sıcak yerleri ve güvenli alanları bul.',
    'Güzel gözlü dost, masum enerjin evi toparlayan küçük bir ışık gibi parlasın.',
    'Yumuşak patilerin yorulmasın; sahibinle arandaki bağ sakin sakin güçlensin.',
  ],
  arin: [
    'Boncuk gözlü küçük ruh, tüylerinin arasına hep güneş düşsün; masum kalbin usul usul parlasın.',
    'Miniğim, patilerin evin sessiz şiiri gibi; her adımın sevgiye ve güvene varsın.',
    'Güzel gözlerinden öperim küçük dost; içinde kötülük olmayan o dünya hep korunmuş kalsın.',
    'Tüyün kadar yumuşak günlerin olsun; sahibinin sevgisi sana ince bir şarkı gibi eşlik etsin.',
    'Küçük kalbin evde usul bir ışık yakıyor; o ışık hep sıcak, hep sakin kalsın.',
    'Yumuşacık patilerin güneş lekelerine bassın minik can; her günün küçük bir huzur resmi olsun.',
    'Boncuk gözlerin geceyi bile tatlı yapıyor; sen hep sevildiğini bilerek uykuya dal.',
    'Küçüğüm, merakın rüzgar gibi hafif, kalbin pamuk gibi temiz kalsın.',
  ],
  ayse: [
    'Küçük canın huzuru evin bereketine karışsın; patileri güvenle, kalbi sevgiyle dolsun.',
    'Miniğim, her günün sıcak bir köşe, yumuşak bir ses ve güvenli bir ritimle geçsin.',
    'Güzel kalpli küçük dost, sevildiğini bilerek dinlen; evin ışığı üstüne usulca düşsün.',
    'Boncuk gözlü yavrum, kokladığın her köşe güvenli, dinlendiğin her yer sıcacık olsun.',
    'Patilerinin bastığı yere huzur düşsün küçük can; sahibinin sevgisi sana ocak sıcaklığı versin.',
    'Tüylerinin arasına güneş dolsun miniğim, kalbin de evin ritmiyle usul usul sakinleşsin.',
    'Küçük dost, oyun isteğin de dinlenme hakkın da duyulsun; evin bereketi seninle çoğalsın.',
    'Güzel can, sevildiğini bilerek mışıl mışıl uyu; yumuşak dünyan hep korunmuş kalsın.',
  ],
  deniz: [
    'Küçük yıldız, patilerin neşeyle gezsin; evin içindeki bütün sevgi sana güzelce değsin.',
    'Canım minik dost, merakın tatlı kalsın, kalbin de hep güvenli bir köşede dinlensin.',
    'Boncuk gözlü küçük enerji, bugün de sevildiğini bilerek oyununa ve uykuna dön.',
    'Minik sahne yıldızı, evin bütün ilgisi üstüne yumuşacık düşsün; patilerin keyifle dolaşsın.',
    'Küçük tatlım, mırıldanman ya da kuyruk sallaman evin en güzel haberi gibi kalsın.',
    'Canım patili, bugün de kokuları takip et, güneşi kap, sevildiğini bilerek dinlen.',
    'Boncuk gözlü minik, sosyal sahnen evin salonuysa başrol sensin; huzurun hiç eksilmesin.',
    'Küçük enerji, oyununu oyna, uykunu al, sahibinin kalbinde yerin zaten kocaman.',
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

const PERSONAL_CLOSING_HISTORY_LIMIT = 30;
const DATA_DIR = `${FileSystem.documentDirectory}falci-data/`;
const PERSONAL_CLOSING_HISTORY_FILE = `${DATA_DIR}personal-closing-history.json`;

type PersonalClosingHistoryFile = {
  schemaVersion: 1;
  byAssistant: Record<string, string[]>;
};

function defaultClosingHistory(): PersonalClosingHistoryFile {
  return { schemaVersion: 1, byAssistant: {} };
}

async function readPersonalClosingHistory(): Promise<PersonalClosingHistoryFile> {
  try {
    const info = await FileSystem.getInfoAsync(PERSONAL_CLOSING_HISTORY_FILE);
    if (!info.exists) return defaultClosingHistory();
    const parsed = JSON.parse(await FileSystem.readAsStringAsync(PERSONAL_CLOSING_HISTORY_FILE)) as Partial<PersonalClosingHistoryFile>;
    return {
      schemaVersion: 1,
      byAssistant: parsed.byAssistant && typeof parsed.byAssistant === 'object' ? parsed.byAssistant : {},
    };
  } catch {
    return defaultClosingHistory();
  }
}

async function writePersonalClosingHistory(history: PersonalClosingHistoryFile) {
  await FileSystem.makeDirectoryAsync(DATA_DIR, { intermediates: true }).catch(() => {});
  await FileSystem.writeAsStringAsync(PERSONAL_CLOSING_HISTORY_FILE, JSON.stringify(history, null, 2));
}

async function rememberPersonalClosing(assistantId: string, closing: string) {
  const sentence = closing.trim();
  if (!sentence) return;
  const id = personaId(assistantId);
  const history = await readPersonalClosingHistory();
  const recent = history.byAssistant[id] || [];
  history.byAssistant[id] = [sentence, ...recent.filter((item) => item !== sentence)].slice(0, PERSONAL_CLOSING_HISTORY_LIMIT);
  await writePersonalClosingHistory(history);
}

export async function getRecentPersonalClosings(assistantId: string) {
  const id = personaId(assistantId);
  const history = await readPersonalClosingHistory();
  return (history.byAssistant[id] || []).slice(0, PERSONAL_CLOSING_HISTORY_LIMIT);
}

const HEALTH_CLOSING_TERMS =
  /\b(sağlık|saglik|sağlığ|saglig|beden|bedeni|bedenin|bedensel|ruh sağlığı|hasta|hastalık|hastalik|rahatsız|rahatsiz|ağrı|agri|acı|aci|sancı|sanci|ateş|ates|öksür|oksur|uyku|uykusuz|iyileş|iyiles|şifa|sifa|doktor|uzman|veteriner|ilaç|ilac|doz|tedavi)\b/iu;

const HEALTH_CONCERN_TERMS =
  /\b(sağlık|saglik|hasta|hastalık|hastalik|rahatsız|rahatsiz|ağrı|agri|acı|aci|sancı|sanci|ateş|ates|kusma|ishal|kan|nefes|öksür|oksur|uyku|uykusuz|yemiyor|içmiyor|icmiyor|iyileş|iyiles|tedavi|ilaç|ilac|doz|veteriner|doktor|psikolog|psikiyatrist|terapi|anksiyete|depresyon)\b/iu;

const ANIMAL_HEALTH_TERMS =
  /\b(kedi|kedim|köpek|kopek|köpeğim|kopegim|kuş|kus|kuşum|kusum|tavşan|tavsan|hayvan|pati|veteriner)\b/iu;

export function userAskedHealthConcern(userText?: string | null) {
  return HEALTH_CONCERN_TERMS.test((userText || '').toLocaleLowerCase('tr-TR'));
}

export function userAskedAnimalHealthConcern(userText?: string | null, isAnimalProfile?: boolean) {
  const text = (userText || '').toLocaleLowerCase('tr-TR');
  return userAskedHealthConcern(text) && (Boolean(isAnimalProfile) || ANIMAL_HEALTH_TERMS.test(text));
}

export function isHealthClosingSentence(sentence: string) {
  return HEALTH_CLOSING_TERMS.test((sentence || '').toLocaleLowerCase('tr-TR'));
}

function safeClosingOptions(id: PersonaId, domain: PersonalReadingDomain, allowHealthClosing = false) {
  const forbidden = DOMAIN_FORBIDDEN_TERMS[domain];
  const library = FORTUNE_PERSONA_DATA[id].closingLibrary as Record<string, readonly string[]>;
  const options = Object.values(library)
    .flatMap((items) => [...items])
    .filter(
      (sentence) =>
        sentence &&
        !forbidden.test(sentence.toLocaleLowerCase('tr-TR')) &&
        (allowHealthClosing || !isHealthClosingSentence(sentence)),
    );
  const fallbackByDomain = domain === 'astro' || domain === 'numerology' ? FALLBACK_CLOSINGS[domain] : null;
  const fallback = fallbackByDomain ? fallbackByDomain[id] || fallbackByDomain['suzan'] : [];
  return options.length ? options : fallback;
}

export function selectPersonaClosingSentence(params: {
  assistantId: string;
  domain: PersonalReadingDomain;
  seed: string;
  allowHealthClosing?: boolean;
  usedClosings?: string[];
}) {
  const id = personaId(params.assistantId);
  const options = safeClosingOptions(id, params.domain, params.allowHealthClosing);
  const used = new Set((params.usedClosings || []).map((item) => item.trim()).filter(Boolean));
  const available = options.filter((option) => !used.has(option));
  const pool = available.length ? available : options;
  if (!pool.length) return '';
  return pool[hashString(`${params.domain}:${id}:${params.seed}:${used.size}`) % pool.length] || '';
}

export function selectAnimalClosingSentence(params: {
  assistantId: string;
  seed: string;
  usedClosings?: string[];
}) {
  const id = personaId(params.assistantId);
  const used = new Set((params.usedClosings || []).map((item) => item.trim()).filter(Boolean));
  const options = (ANIMAL_PERSONA_CLOSINGS[id] || ANIMAL_PERSONA_CLOSINGS['suzan']).filter((sentence) => !used.has(sentence));
  const pool = options.length ? options : ANIMAL_PERSONA_CLOSINGS[id] || ANIMAL_PERSONA_CLOSINGS['suzan'];
  return pool[hashString(`animal:${id}:${params.seed}:${used.size}`) % pool.length] || '';
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

const PACE_REPLACEMENTS = [
  'gündelik yoğunluk',
  'sıkışık tempo',
  'zaman baskısı',
  'üst üste gelen işler',
  'zihinsel kalabalık',
  'günlük ritim',
  'hareketli gündem',
  'yoğun gün akışı',
  'iç sıkışıklığı',
  'dağınık program',
  'hızlı akış',
  'biriken işler',
  'günün ağırlığı',
  'düşünce yoğunluğu',
  'planların sıkışması',
  'gündem kalabalığı',
  'zihin yorgunluğu',
  'sorumluluk yükü',
  'aynı anda gelen işler',
  'nefes alanı ihtiyacı',
  'yoğun iletişim trafiği',
  'düzen arayışı',
  'ritim bozulması',
  'günün sıkışıklığı',
  'akışın hızlanması',
  'program yoğunluğu',
  'dikkat dağınıklığı',
  'iç gerilim',
  'toparlanma ihtiyacı',
  'denge arayışı',
];

const TURKISH_MALFORMED_WORD_FIXES: Array<[RegExp, string]> = [
  [/\byoğunlukede\b/giu, 'yoğunlukta'],
  [/\byoğunlukta?de\b/giu, 'yoğunlukta'],
  [/\byoğunluk[niı]\b/giu, 'yoğunluk'],
  [/\byoğunlukın\b/giu, 'yoğunluğun'],
  [/\byorgunlukede\b/giu, 'yorgunlukta'],
  [/\btelaşede\b/giu, 'telaşta'],
  [/\bsakinlikede\b/giu, 'sakinlikte'],
  [/\bhuzurede\b/giu, 'huzurda'],
  [/\benerjiede\b/giu, 'enerjide'],
  [/\britimede\b/giu, 'ritimde'],
  [/\bdengedede\b/giu, 'dengede'],
  [/\bdengede de\b/giu, 'dengede'],
];

const HUMAN_HEALTH_REMINDERS = [
  'Sağlıkla ilgili bir endişe varsa bunu korkmadan ama ertelemeden bir doktora ya da uygun bir sağlık uzmanına danışman en doğrusu olur.',
  'Bu konu bedene veya ruh sağlığına dokunuyorsa, içini rahatlatmak için bir doktordan ya da uygun bir sağlık uzmanından görüş almak iyi olur.',
  'Sağlık tarafında aklında soru işareti kaldıysa bunu kendi kendine yorumlamadan bir doktora ya da uygun bir sağlık uzmanına göstermen daha doğru olur.',
  'Belirti, ağrı veya uzun süren bir rahatsızlık varsa en sağlıklı adım bir doktora ya da uygun bir sağlık uzmanına danışmak olur.',
  'Bu okuma tıbbi bir değerlendirme yerine geçmez; sağlıkla ilgili bir kaygın varsa bir doktora ya da uygun bir sağlık uzmanına görünmen iyi olur.',
  'İçini kurcalayan bir sağlık konusu varsa bunu büyütmeden ama ertelemeden bir doktora ya da uygun bir sağlık uzmanına taşıman en güvenlisi olur.',
  'Bedensel veya ruhsal bir belirti söz konusuysa net cevap için bir doktora ya da uygun bir sağlık uzmanına danışmanı öneririm.',
  'Sağlık konusunda emin olmak istiyorsan en doğru pusula bir doktorun ya da uygun bir sağlık uzmanının değerlendirmesi olur.',
  'Bu alanda kesin konuşmak doğru olmaz; sağlıkla ilgili endişen varsa bir doktora ya da uygun bir sağlık uzmanına danışman iyi olur.',
  'Kendini ya da bir yakınını ilgilendiren sağlık sorusunda, sakin kalıp bir doktordan ya da uygun bir sağlık uzmanından destek almak en sağlam yol olur.',
];

const ANIMAL_HEALTH_REMINDERS = [
  'Sağlıkla ilgili bir endişe varsa bunu korkmadan ama ertelemeden bir veterinere danışman en doğrusu olur.',
  'Patili dostunla ilgili bir belirti ya da davranış değişikliği varsa, içini rahatlatmak için bir veteriner görüşü almak iyi olur.',
  'Hayvan sağlığı konusunda net değerlendirme için en güvenli yol bir veterinere danışmak olur.',
  'Yememe, halsizlik, ağrı ya da alışılmadık bir hal görüyorsan bunu ertelemeden bir veterinere göstermen iyi olur.',
  'Bu okuma veteriner değerlendirmesi yerine geçmez; sağlıkla ilgili kaygın varsa bir veterinere görünmek en doğru adım olur.',
  'Patili dostunun sağlığı konusunda aklında soru işareti kaldıysa, bunu bir veterinerle paylaşman en güvenlisi olur.',
  'Hayvanlarda küçük görünen belirtiler bile önemli olabilir; korkmadan ama geciktirmeden bir veterinere danışmanı öneririm.',
  'Bu konuda kesin konuşmak doğru olmaz; hayvan sağlığıyla ilgili endişede veteriner kontrolü en sağlam yol olur.',
  'Pati, iştah, enerji ya da davranış değişikliği gibi bir durum varsa bir veterinerin değerlendirmesi en doğru rehber olur.',
  'Can dostunun sağlığı için sezgiyle yetinmeden bir veterinere danışmak iyi olur; böylece için de daha rahat eder.',
];

function replacePaceFixation(text: string) {
  let index = 0;
  return (text || '').replace(/\b(telaş(?:ı|ın|ını|ının|ında|ından|ınla|tan|a|lı|sız)?|koşuşturma(?:sı|sını|sının|sında|sından|nın|dan|ya|lı)?|koşturma(?:sı|sını|sının|sında|sından|nın|dan|ya|lı)?|koştur(?:up|uyor|uyorsun|uyorum|mak|ma)|koşuştur(?:up|uyor|uyorsun|uyorum|mak|ma))\b/giu, () => {
    const replacement = PACE_REPLACEMENTS[index % PACE_REPLACEMENTS.length] || 'günlük ritim';
    index += 1;
    return replacement;
  });
}

const PERSONA_SELF_INTRO_NAME_PATTERN = String.raw`(?:suzan(?:\s+han[ıi]m)?|teoman(?:\s+bey|\s+amca)?|selin(?:\s+han[ıi]m)?|berk(?:\s+bey)?|ar[ıi]n|ay[şs]e|deniz|d[üu]rdane(?:\s+han[ıi]m)?|hikmet(?:\s+bey|\s+amca)?|bahar(?:\s+han[ıi]m)?|mert(?:\s+bey)?|caner)`;
const PERSONA_SELF_INTRO_ROLE_PATTERN = String.raw`(?:yorumcu|astrolog|astrolo[gğ]|numerolog|numerolo[gğ]|tarot\s+yorumcusu|kahve\s+yorumcusu|kahve\s+fal[ıi]\s+yorumcusu|el\s+yorumcusu|rehber)`;
const PERSONA_SELF_INTRO_HINT_PATTERN =
  /\b(?:ben|olarak|adlı|isimli|diye|bilinirim|buradayım|yorumcu|astrolog|astrolo[gğ]|numerolog|numerolo[gğ]|tarot|kahve|rehber)\b/iu;

function stripLeadingSentenceIfPersonaIntro(text: string) {
  const firstSentence = text.match(/^\s*([^.!?\n]{0,220}[.!?])\s*/u);
  if (!firstSentence) return text;
  const sentence = firstSentence[1] || '';
  const hasPersonaName = new RegExp(String.raw`\b${PERSONA_SELF_INTRO_NAME_PATTERN}\b`, 'iu').test(sentence);
  if (!hasPersonaName || !PERSONA_SELF_INTRO_HINT_PATTERN.test(sentence)) return text;
  return text.slice(firstSentence[0].length).trim();
}

export function stripPersonaSelfIntroduction(text: string) {
  let cleaned = (text || '').trim();
  const name = PERSONA_SELF_INTRO_NAME_PATTERN;
  const role = PERSONA_SELF_INTRO_ROLE_PATTERN;
  const introGreeting = String.raw`(?:(?:merhaba|selam|hoş\s+geldin|hoş\s+geldiniz)[,!\s-]*)?`;
  const personaSuffix = String.raw`(?:(?:\s*['’]?\s*(?:im|ım|um|üm|yim|yım|yum|yüm))|\s+olarak|\s+adlı\s+${role}|\s+isimli\s+${role}|\s+diye\s+bilinirim|\s+buradayım)?`;

  cleaned = cleaned
    .replace(new RegExp(String.raw`^\s*${introGreeting}ben\s+${name}${personaSuffix}(?:[,.;:!?]\s*|\s+-\s*|\s+)`, 'iu'), '')
    .replace(new RegExp(String.raw`^\s*${introGreeting}${name}${personaSuffix}(?:[,.;:!?]\s*|\s+-\s*)`, 'iu'), '')
    .replace(new RegExp(String.raw`^\s*${introGreeting}${name}(?:\s+(?:olarak|burada|buradayım)|\s*['’]?den)\b[^.!?\n]{0,160}[.!?]\s*`, 'iu'), '')
    .replace(new RegExp(String.raw`^\s*ben\s+(?:bir\s+)?${role}(?:\s*(?:im|ım|um|üm|yim|yım|yum|yüm))?(?:[,.;:!?]\s*|\s+-\s*|\s+)`, 'iu'), '')
    .replace(new RegExp(String.raw`^\s*[^.!?\n]{0,140}\bben\s+${name}\b[^.!?\n]*[.!?]\s*`, 'iu'), '')
    .replace(new RegExp(String.raw`^\s*[^.!?\n]{0,140}\b${name}\s+olarak\b[^.!?\n]*[.!?]\s*`, 'iu'), '');

  return stripLeadingSentenceIfPersonaIntro(cleaned)
    .replace(new RegExp(String.raw`(?:\n|\s)*(?:[-–—]\s*)?${name}\s*$`, 'iu'), '')
    .replace(new RegExp(String.raw`\b${name}\s+olarak\b`, 'giu'), '')
    .replace(new RegExp(String.raw`\bben\s+${name}\b`, 'giu'), '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function sanitizeRestrictedReadingTerms(text: string) {
  return (text || '')
    .replace(/\bfalcı(?:n|yım|yız|sı|sın|lar|ya|dan|da)?\b/giu, 'yorumcu')
    .replace(/\bfal(?:ım|ın|ı|in|ına|ına|ımda|ında|ımdan|ından|dan|da|cı|cılar|cıya|cıdan|cıda)?\b/giu, 'yorum')
    .replace(/\bkehanet(?:im|in|i|ler|leri|te|ten)?\b/giu, 'sembolik yorum')
    .replace(/\bgeleceğ(?:i|ini|e)\s+(?:görmek|görme|okumak|okuma|bilmek|bilirim|biliyorum)\b/giu, 'olasılıkları sezgisel yorumlamak')
    .replace(/\bgelecek\s+(?:okuması|yorumu|analizi|öngörüsü)\b/giu, 'sembolik içgörü')
    .replace(/\b(?:vaat|vaad)\s+ed(?:er|iyor|iyorum|eceğim|eceğiz|en|ilmez)\b/giu, 'sunar')
    .replace(/\b(?:vaat|vaad)(?:im|in|i|ler|leri|te|ten)?\b/giu, 'söz');
}

export function sanitizePublicReadingLanguage(text: string) {
  const fixedMalformedWords = TURKISH_MALFORMED_WORD_FIXES.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    text || '',
  );
  const withoutSelfIntroduction = stripPersonaSelfIntroduction(fixedMalformedWords);
  const withoutMemoryDisclosure = withoutSelfIntroduction
    .split(/(?<=[.!?])\s+/)
    .filter(
      (sentence) =>
        !/\b(?:önceki|geçen|eski)\s+(?:fal|yorum|okuma)(?:ında|ında|dan|larda|larda)?\b/iu.test(sentence) &&
        !/\b(?:hafızanda|hafızamda|hatırlıyorum|hatırımdaki|kayıtlarda|profilinde\s+gördüğüm)\b/iu.test(sentence) &&
        !/\bsana\s+daha\s+önce\s+[^.!?]{0,80}\b(?:çıkmıştı|görünmüştü|gelmişti)\b/iu.test(sentence),
    )
    .join(' ');
  return sanitizeRestrictedReadingTerms(replacePaceFixation(withoutMemoryDisclosure))
    .replace(/\b(?:INTJ|INTP|ENTJ|ENTP|INFJ|INFP|ENFJ|ENFP|ISTJ|ISFJ|ESTJ|ESFJ|ISTP|ISFP|ESTP|ESFP)\b/giu, 'bu kişilik izi')
    .replace(/\bMBTI\s+(?:sonucu|tipi|kişilik\s+tipi)\b/giu, 'kişilik eğilimi')
    .replace(/\b(?:kişilik|uyumluluk|bağlanma|değerler|stresle\s+başa\s+çıkma)\s+testi\s+sonucu\b/giu, 'kişisel eğilim')
    .replace(/\b[A-ZÇĞİÖŞÜ]{4,}\b/gu, (word) => {
      const lower = word.toLocaleLowerCase('tr-TR');
      return lower.charAt(0).toLocaleUpperCase('tr-TR') + lower.slice(1);
    })
    .replace(/\b(?:şimdi\s+)?akl[ıi]ma\s+geldi\b/giu, 'burada bir detay öne çıkıyor')
    .replace(/\bkahve\s+demlen(?:ir|mez|di|miş|mişti|iyor|ecek|miş gibi|mişçesine)?\b/giu, 'kahve yapılır')
    .replace(/\bdemlen(?:en|miş|mişti|iyor|ecek|ir)\s+kahve\b/giu, 'yapılmış kahve')
    .replace(/\bkahveni\s+demle\b/giu, 'kahveni yap')
    .replace(/\bkahveyi\s+demle\b/giu, 'kahveyi yap')
    .replace(/\bgeleceği\s+kesin(?:likle)?\s+bil(?:mek|irim|iyorum|eceğim|eceğiz)\b/giu, 'geleceğe dair kesin konuşmak')
    .replace(/\bkesin(?:likle)?\s+(?:olacak|çıkar|gerçekleşecek|dönecek|bitecek|başlayacak|gelecek|geçecek|iyileşecek|düzelecek)\b/giu, 'olası görünüyor')
    .replace(/\biyileşeceğini\s+vaat\s+ed(?:er|iyor|en|iyor gibi)\b/giu, 'iyileşme ihtimalini düşündürüyor')
    .replace(/\b(?:sağlığı|bedeni|hastalığı|rahatsızlığı)\s+(?:düzelecek|iyileşecek|geçecek)\b/giu, 'bu konuda bir uzmana danışmak iyi olur')
    .replace(/\b(?:şunu|bunu|onu)\s+(?:ye|yiyip|iç|içip)\s+(?:geçer|düzelir|iyi\s+gelir)\b/giu, 'bu konuda bir uzmana danışmak daha doğru olur')
    .replace(/\b(?:ilaç|doz|tedavi|takviye)\s+(?:al|almalısın|kullan|kullanmalısın|başla|başlamalısın)\b/giu, 'bir uzmana danış')
    .replace(/\b(?:ağrın|belirtin|şikayetin|hastalığın)\s+geçer\b/giu, 'bu belirti için bir uzmana görünmek iyi olur')
    .replace(/\b(fincan(?:ın|daki|da|ın\s+içindeki|ın\s+yanındaki)?|kupa(?:nın|daki)?)\s+kul\b/giu, '$1 kulpu')
    .replace(/\bkul\s+taraf(?:ı|ında|ından|ına)\b/giu, 'kulp tarafı')
    .replace(/\b(?:bu|şu)\s+fal(?:ın|da|dan|ı|a)?\b/giu, 'bu yorum')
    .replace(/\bfal(?:ın|ım|ını|ımı|ına|ıma|ında|ımda|dan|ımdan|ı|ım|a|da)?\b/giu, 'yorum')
    .replace(/\bfalcı(?:n|yım|yız|sı|sın|lar)?\b/giu, 'yorumcu')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function appendHealthProfessionalReminder(
  text: string,
  params?: { userText?: string | null; isAnimalProfile?: boolean },
) {
  const source = (params?.userText || '').toLocaleLowerCase('tr-TR');
  if (!userAskedHealthConcern(source)) return text;
  const animalConcern = userAskedAnimalHealthConcern(source, params?.isAnimalProfile);
  const options = animalConcern ? ANIMAL_HEALTH_REMINDERS : HUMAN_HEALTH_REMINDERS;
  const reminder = options[hashString(source) % options.length] || options[0];
  if (text.toLocaleLowerCase('tr-TR').includes(reminder.toLocaleLowerCase('tr-TR'))) return text;
  if (animalConcern && /\bveteriner/.test(text.toLocaleLowerCase('tr-TR'))) return text;
  if (!animalConcern && /\b(doktor|sağlık uzman)/.test(text.toLocaleLowerCase('tr-TR'))) return text;
  return `${text.trim()}\n\n${reminder}`.trim();
}

function profileAgeFromMemory(memorySnippet?: ProfileMemorySnippet | null) {
  const birthDate = memorySnippet?.birthChartData?.birthDate || '';
  const match = birthDate.match(/^(\d{4})-\d{2}-\d{2}$/);
  return match ? new Date().getFullYear() - Number(match[1]) : null;
}

function canUseFamilyAddress(params: {
  assistantId?: string | null;
  memorySnippet?: ProfileMemorySnippet | null;
}) {
  const assistantAge = FORTUNE_PERSONA_DATA[personaId(params.assistantId || undefined)]?.age;
  const profileAge = profileAgeFromMemory(params.memorySnippet);
  return Boolean(
    ['suzan', 'teoman', 'ayse'].includes(params.assistantId || '') &&
      assistantAge &&
      profileAge &&
      assistantAge - profileAge >= 10,
  );
}

export function sanitizeGenderedAddress(
  text: string,
  params?: {
    assistantId?: string | null;
    memorySnippet?: ProfileMemorySnippet | null;
    isAnimalProfile?: boolean;
  },
) {
  const memorySnippet = params?.memorySnippet;
  if (params?.isAnimalProfile || memorySnippet?.relationshipPrimary === 'evcil_hayvan') return text;
  const feminineTerms: Record<string, string> = {
    'güzel kızım': 'güzel evladım',
    kızım: 'evladım',
    'güzel kız': 'güzel evlat',
  };
  const masculineTerms: Record<string, string> = {
    'güzel oğlum': 'güzel evladım',
    oğlum: 'evladım',
    'aslan oğlum': 'aslanım',
    'güzel oğlan': 'güzel evlat',
  };
  const familyTerms: Record<string, string> = {
    yavrum: 'canım',
    evladım: 'canım',
    'güzel evladım': 'canım',
  };
  let replacements: Record<string, string> = {};
  if (memorySnippet?.profileGender === 'erkek') replacements = feminineTerms;
  else if (memorySnippet?.profileGender === 'kadin') replacements = masculineTerms;
  else if (memorySnippet?.profileGender === 'hicbiri' || memorySnippet?.profileGender === 'belirtmek_istemiyorum') {
    replacements = { ...feminineTerms, ...masculineTerms };
  }
  if (!canUseFamilyAddress({ assistantId: params?.assistantId, memorySnippet })) {
    replacements = { ...replacements, ...feminineTerms, ...masculineTerms, ...familyTerms };
  }
  let cleaned = text;
  Object.entries(replacements).forEach(([source, target]) => {
    cleaned = cleaned.replace(new RegExp(source, 'g'), target);
    cleaned = cleaned.replace(
      new RegExp(source.charAt(0).toLocaleUpperCase('tr-TR') + source.slice(1), 'g'),
      target.charAt(0).toLocaleUpperCase('tr-TR') + target.slice(1),
    );
  });
  return cleaned;
}

export function completeWithPersonaClosing(params: {
  text: string;
  assistantId: string;
  domain: PersonalReadingDomain;
  seed: string;
  forceClosing?: boolean;
  allowHealthClosing?: boolean;
  isAnimalProfile?: boolean;
}) {
  const base = sanitizePublicReadingLanguage(stripPersonaSelfIntroduction(trimIncompleteTail(params.text)));
  const shouldClose = params.forceClosing || !hasTerminalPunctuation(base);
  if (!shouldClose) return base;
  const closing = params.isAnimalProfile
    ? selectAnimalClosingSentence({
        assistantId: params.assistantId,
        seed: `${params.domain}:${params.seed}:${base.slice(-160)}`,
      })
    : selectPersonaClosingSentence({
        assistantId: params.assistantId,
        domain: params.domain,
        seed: `${params.seed}:${base.slice(-160)}`,
        allowHealthClosing: params.allowHealthClosing,
      });
  if (!closing) return base;
  if (!base) return closing;
  if (base.includes(closing)) return base;
  return `${base}\n\n${closing}`.trim();
}

export async function selectRememberedPersonaClosingSentence(params: {
  assistantId: string;
  domain: PersonalReadingDomain;
  seed: string;
  allowHealthClosing?: boolean;
  isAnimalProfile?: boolean;
  usedClosings?: string[];
}) {
  const recent = await getRecentPersonalClosings(params.assistantId);
  const usedClosings = [...recent, ...(params.usedClosings || [])];
  const closing = params.isAnimalProfile
    ? selectAnimalClosingSentence({
        assistantId: params.assistantId,
        seed: `${params.domain}:${params.seed}`,
        usedClosings,
      })
    : selectPersonaClosingSentence({
        assistantId: params.assistantId,
        domain: params.domain,
        seed: params.seed,
        allowHealthClosing: params.allowHealthClosing,
        usedClosings,
      });
  if (closing) await rememberPersonalClosing(params.assistantId, closing);
  return closing;
}

export async function completeWithRememberedPersonaClosing(params: {
  text: string;
  assistantId: string;
  domain: PersonalReadingDomain;
  seed: string;
  allowHealthClosing?: boolean;
  isAnimalProfile?: boolean;
  usedClosings?: string[];
}) {
  const base = sanitizePublicReadingLanguage(stripPersonaSelfIntroduction(trimIncompleteTail(params.text)));
  const closing = await selectRememberedPersonaClosingSentence({
    assistantId: params.assistantId,
    domain: params.domain,
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
