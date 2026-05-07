import * as FileSystem from 'expo-file-system/legacy';

export type ZodiacSignId =
  | 'aries'
  | 'taurus'
  | 'gemini'
  | 'cancer'
  | 'leo'
  | 'virgo'
  | 'libra'
  | 'scorpio'
  | 'sagittarius'
  | 'capricorn'
  | 'aquarius'
  | 'pisces';

export type SunCompatibilitySectionId =
  | 'general'
  | 'love'
  | 'work'
  | 'home'
  | 'friendship'
  | 'neighbor';

export type SunCompatibilitySection = {
  id: SunCompatibilitySectionId;
  title: string;
  score: number;
  color: string;
  text: string;
};

export type SunCompatibilityReading = {
  title: string;
  sections: SunCompatibilitySection[];
};

type SignMeta = {
  id: ZodiacSignId;
  label: string;
  element: 'fire' | 'earth' | 'air' | 'water';
  modality: 'cardinal' | 'fixed' | 'mutable';
  polarity: 'yang' | 'yin';
};

type HistoryFile = {
  schemaVersion: 1;
  choices: Record<string, number[]>;
};

const DATA_DIR = `${FileSystem.documentDirectory}falci-data/`;
const HISTORY_FILE = `${DATA_DIR}sun-compatibility-history.json`;
const MAX_HISTORY_PER_KEY = 8;

export const ZODIAC_SIGNS: SignMeta[] = [
  { id: 'aries', label: 'Koç', element: 'fire', modality: 'cardinal', polarity: 'yang' },
  { id: 'taurus', label: 'Boğa', element: 'earth', modality: 'fixed', polarity: 'yin' },
  { id: 'gemini', label: 'İkizler', element: 'air', modality: 'mutable', polarity: 'yang' },
  { id: 'cancer', label: 'Yengeç', element: 'water', modality: 'cardinal', polarity: 'yin' },
  { id: 'leo', label: 'Aslan', element: 'fire', modality: 'fixed', polarity: 'yang' },
  { id: 'virgo', label: 'Başak', element: 'earth', modality: 'mutable', polarity: 'yin' },
  { id: 'libra', label: 'Terazi', element: 'air', modality: 'cardinal', polarity: 'yang' },
  { id: 'scorpio', label: 'Akrep', element: 'water', modality: 'fixed', polarity: 'yin' },
  { id: 'sagittarius', label: 'Yay', element: 'fire', modality: 'mutable', polarity: 'yang' },
  { id: 'capricorn', label: 'Oğlak', element: 'earth', modality: 'cardinal', polarity: 'yin' },
  { id: 'aquarius', label: 'Kova', element: 'air', modality: 'fixed', polarity: 'yang' },
  { id: 'pisces', label: 'Balık', element: 'water', modality: 'mutable', polarity: 'yin' },
];

const SECTION_LABELS: Record<SunCompatibilitySectionId, string> = {
  general: 'Genel Uyum',
  love: 'Aşk',
  work: 'İş',
  home: 'Ev Arkadaşlığı',
  friendship: 'Dostluk ve Arkadaşlık',
  neighbor: 'Komşuluk',
};

const SECTION_TEMPLATES: Record<SunCompatibilitySectionId, string[]> = {
  general: [
    '{a} ve {b} ilk bakışta farklı hızlarda ilerlese de birbirlerinin dünyasını merak ettiklerinde iyi bir denge kurabilir. {tone} Bu ikili için ana mesele, kimin daha çok alan istediğini açıkça konuşmak ve küçük kırgınlıkları büyütmemektir.',
    '{a} daha çok kendi ritmini korumak isterken {b} başka bir güven veya hareket biçimi arayabilir. {tone} Günlük hayatta birbirlerinin reflekslerini kişisel algılamazlarsa uyum daha rahat akar.',
    'Bu eşleşmede uyum, iki tarafın da birbirini değiştirmeye çalışmadan anlamasına bağlıdır. {a} ile {b} arasında {toneLower} ama düzenli emekle daha sıcak bir bağ kurulabilir. Ortak kararlar aceleye gelmediğinde ilişki zemini güçlenir.',
    '{a} ve {b} birbirinin güçlü tarafını gördüğünde tamamlayıcı bir etki yaratabilir. {tone} Fakat beklentiler açık söylenmezse küçük farklar gereksiz yorucu hale gelir.',
    'Bu iki burç birlikteyken ilişki bazen canlı, bazen de öğretici bir sınav gibi hissedilebilir. {tone} Uyumun anahtarı, aynı konuyu farklı dillerle anlattıklarını fark etmeleridir.',
    '{a} ile {b} arasında doğal bir merak alanı var; biri diğerinin görmediği bir pencereyi açabilir. {tone} Esneklik gösterdiklerinde bağ daha samimi ve sürdürülebilir olur.',
    'Genel tabloda bu eşleşme tek bir kalıba sığmaz; günün koşullarına göre yakınlaşma ve uzaklaşma dalgaları olabilir. {tone} İki taraf da niyetini net tutarsa anlaşma zemini kaybolmaz.',
    '{a} ve {b}, birbirlerinin sınırlarına saygı duyduklarında rahat bir ortak alan yaratabilir. {tone} En iyi sonuç, beklentileri varsaymak yerine düzenli konuşmakla gelir.',
    'Bu ikili için uyum, benzerlikten çok tamamlayıcılık üzerinden çalışır. {tone} Ortak ritim zamanla oturur; acele kararlar yerine gözlem daha iyi sonuç verir.',
    '{a} ile {b} arasında çekim veya merak hızlı başlayabilir, fakat kalıcılık için davranış tutarlılığı gerekir. {tone} Birbirlerinin hassas noktalarını öğrendikçe bağ daha az yorucu hale gelir.',
  ],
  love: [
    'Aşkta {a} ve {b} arasında duyguyu gösterme biçimi farklı olabilir. {tone} Sevgi dili açık konuşulursa yanlış beklentiler azalır ve yakınlık daha güvenli hissedilir.',
    'Romantik bağda bu ikili birbirini hem çekebilir hem de zaman zaman şaşırtabilir. {tone} Özellikle ilgi, sadakat ve özgürlük ihtiyacı dengelenirse ilişki daha rahat akar.',
    '{a} aşkı daha farklı bir yerden kurarken {b} başka bir yakınlık dili bekleyebilir. {tone} Bu yüzden sevginin sadece sözle değil davranışla da teyit edilmesi önemlidir.',
    'Bu eşleşmede romantik uyumun gücü, iki tarafın da kırılganlığını saklamamasına bağlıdır. {tone} Bir taraf geri çekildiğinde diğeri hemen hüküm vermemeli, alan tanımalıdır.',
    'Aşk alanında {a} ve {b} birbirlerine güçlü bir ayna tutabilir. {tone} Tutku varsa bile ilişkiyi taşıyan şey günlük özen ve açık iletişim olur.',
    'Bu ikilide flört enerjisi canlı olabilir, fakat uzun vadede güven inşası daha belirleyicidir. {tone} Duyguların iniş çıkışını kişisel savaş haline getirmemek gerekir.',
    '{a} ile {b} romantik olarak birbirinden çok şey öğrenebilir. {tone} Kıskançlık, mesafe veya beklenti farkları erken konuşulursa ilişki daha az yorulur.',
    'Aşkta bu bağ bazen sıcak, bazen temkinli ilerleyebilir. {tone} İki taraf da sevgiyi aynı anda hem özgürlük hem güven ihtiyacıyla dengelemelidir.',
    'Romantik uyumda temel soru, iki kişinin aynı ilişki tanımına sahip olup olmadığıdır. {tone} Tanım netleşirse burç farkları daha kolay yönetilir.',
    '{a} ve {b} arasında aşk, doğru koşulda büyüyebilen ama ihmal edilirse çabuk gerilen bir alandır. {tone} Sevgi dili, zaman ayırma ve sadakat beklentisi açık tutulmalıdır.',
  ],
  work: [
    'İş ilişkisinde {a} ve {b} farklı önceliklerle hareket edebilir. {tone} Görev dağılımı net yapılırsa bu fark verimliliğe dönüşür.',
    'Bu ikili işte birlikte üretirken biri hız, diğeri kalite veya güvenlik arayabilir. {tone} Yetki sınırları karışmazsa ortak sonuç daha güçlü olur.',
    '{a} ve {b} profesyonel alanda birbirini tamamlayabilir, fakat karar alma tarzları çakışabilir. {tone} Takvim, sorumluluk ve beklenti yazılı hale gelirse sorun azalır.',
    'İş uyumunda bu eşleşme fikir alışverişinden beslenir. {tone} Kimin son kararı verdiği ve kimin hangi alanı yönettiği baştan belirlenmelidir.',
    'Bu ikili projede farklı risk algılarına sahip olabilir. {tone} Biri acele ederken diğeri kontrol etmek isterse araya gerçekçi bir plan koymak gerekir.',
    '{a} ve {b} birlikte çalışırken birbirlerinin güçlü tarafına alan açarsa iyi sonuç alır. {tone} Eleştirinin kişisel değil iş odaklı kalması özellikle önemlidir.',
    'Profesyonel bağda uyum, ortak hedefin netliğine bağlıdır. {tone} Hedef bulanıklaştığında burçların farklı refleksleri daha görünür hale gelir.',
    'Bu eşleşme işte pratik bir denge kurabilir, ama iletişim ritmi düzenlenmelidir. {tone} Toplantı, teslim tarihi ve sorumluluklar açık olursa verim artar.',
    '{a} ile {b} iş alanında birbirine yeni yöntem öğretebilir. {tone} En iyi sonuç, rekabeti yumuşatıp ortak başarıya odaklandıklarında gelir.',
    'İş uyumunda bu ikili doğru sistemle iyi ilerler. {tone} Plansızlık veya belirsiz liderlik olduğunda küçük farklar büyük gerilime dönebilir.',
  ],
  home: [
    'Ev arkadaşlığında {a} ve {b} için düzen, alan ve mahremiyet baştan konuşulmalıdır. {tone} Ev içi görevler netleşirse günlük sürtüşmeler azalır.',
    'Aynı evi paylaşırken bu ikili farklı tempo ve alışkanlıklarla hareket edebilir. {tone} Ortak alan kuralları yazılı olmasa bile açıkça konuşulmalıdır.',
    '{a} ve {b} ev içinde birbirinin sessizlik, sosyallik ve düzen ihtiyacını anlamalıdır. {tone} Küçük ev işleri büyümeden paylaşılırsa uyum kolaylaşır.',
    'Ev arkadaşlığında bu eşleşme rahat da olabilir, yorucu da; belirleyici olan sınırların netliğidir. {tone} Misafir, temizlik ve harcama konuları baştan belirlenmelidir.',
    'Bu ikili aynı evde yaşarken biri daha hareketli, diğeri daha kontrollü davranabilir. {tone} Birbirlerinin yaşam tarzını düzeltmeye çalışmadan ortak ritim kurmaları gerekir.',
    '{a} ile {b} ev alanında doğru görev paylaşımıyla dengeli olabilir. {tone} En büyük risk, söylenmeyen beklentilerin birikmesidir.',
    'Ev içi uyumda bu iki burcun sabrı ve esnekliği test edilir. {tone} Kişisel alanlara saygı gösterildiğinde birlikte yaşamak daha keyifli olur.',
    'Aynı mekanda {a} ve {b} birbirine hem hareket hem denge katabilir. {tone} Fakat ortak düzen kurulmazsa küçük alışkanlıklar fazla görünür hale gelir.',
    'Ev arkadaşlığında uyum, temizlikten çok iletişim ve alan paylaşımıyla ilgilidir. {tone} Planlı konuşmalar gereksiz pasif gerilimi önler.',
    '{a} ve {b} ev yaşamında birbirlerinin ritmine alıştıkça daha rahat edebilir. {tone} İlk dönemde kuralları nazik ama net koymak iyi olur.',
  ],
  friendship: [
    'Dostlukta {a} ve {b} birbirine farklı bakış açıları kazandırabilir. {tone} Bu arkadaşlıkta en önemli şey, beklenti ve mesafe dengesini doğal bırakmaktır.',
    'Arkadaşlık bağında bu ikili birlikte eğlenebilir ama zaman zaman farklı hassasiyetler gösterebilir. {tone} Alınganlık yerine açıklık seçilirse bağ güçlenir.',
    '{a} ve {b} dostlukta birbirini tamamlayan iki ayrı ritim gibi çalışabilir. {tone} Ortak ilgi alanları arttıkça ilişki daha sağlam hale gelir.',
    'Bu arkadaşlık bazen hızlı yakınlaşır, bazen mesafe isteyebilir. {tone} İki taraf da bunu kişisel reddedilme gibi görmezse bağ rahatlar.',
    'Dostlukta {a} ile {b} birbirinin cesaretini veya sakinliğini besleyebilir. {tone} Gereksiz rekabetten uzak durduklarında ilişki daha keyifli olur.',
    'Bu ikilinin arkadaşlığında sohbet ve deneyim paylaşımı önemli yer tutar. {tone} Farklı karar tarzları yargılanmazsa uzun soluklu bir bağ kurulabilir.',
    '{a} ve {b} sosyal ortamda birbirini dengeleyebilir. {tone} Birinin ihtiyacı hareket, diğerinin ihtiyacı güven olduğunda orta yol aranmalıdır.',
    'Arkadaşlık açısından bu eşleşme öğretici ve canlıdır. {tone} Zaman zaman farklı öncelikler olsa da saygı korunursa bağ kopmaz.',
    'Bu dostlukta güven yavaş yavaş oluşabilir. {tone} Tutarlılık, sözünde durmak ve küçük jestler ilişkiyi güçlendirir.',
    '{a} ile {b} arkadaşlıkta birbirinin dünyasına merak duyarsa güzel bir bağ kurar. {tone} Tek taraflı fedakarlık oluşmadığı sürece ilişki dengede kalır.',
  ],
  neighbor: [
    'Komşulukta {a} ve {b} için en iyi uyum, saygılı mesafe ve net sınırlarla gelir. {tone} Yardımlaşma güzel çalışır ama özel alana müdahale edilmemelidir.',
    'Bu iki burç komşu olduğunda günlük nezaket ilişkiyi belirler. {tone} Gürültü, ortak alan ve ziyaret sıklığı gibi konular açık tutulursa sorun azalır.',
    '{a} ve {b} komşulukta birbirine destek olabilir, fakat fazla iç içelik yorucu olabilir. {tone} Dengeli mesafe uzun vadede daha huzurludur.',
    'Komşuluk uyumunda bu eşleşme pratik yardımlaşmadan beslenir. {tone} Küçük jestler ilişkiyi güzelleştirir, ama beklentiye dönüşmemelidir.',
    'Bu ikili aynı apartman ya da mahallede saygılı bir ilişki kurabilir. {tone} En önemli nokta, sorunları dolaylı değil doğrudan ve nazik konuşmaktır.',
    '{a} ile {b} komşulukta farklı yaşam ritimlerine sahip olabilir. {tone} Ortak alan kuralları ve sessizlik saatleri belirgin olduğunda uyum artar.',
    'Komşulukta bu iki burç arasında sıcak ama ölçülü bir bağ daha sağlıklıdır. {tone} Gerektiğinde yardım etmek, gerektiğinde mesafe bırakmak dengeyi korur.',
    'Bu eşleşmede komşuluk ilişkisi küçük alışkanlıklardan etkilenir. {tone} Düzenli nezaket ve açık iletişim, olası sürtüşmeleri büyümeden çözer.',
    '{a} ve {b} komşu olarak birbirinin sınırlarını anlarsa rahat geçinir. {tone} Fazla yorum, fazla beklenti veya ani çıkışlar uyumu zorlayabilir.',
    'Komşuluk bağında bu ikili için saygı, sessizlik ve güven öne çıkar. {tone} İyi niyetli ama ölçülü bir yakınlık en verimli formdur.',
  ],
};

const ELEMENT_COMPATIBILITY: Record<SignMeta['element'], Record<SignMeta['element'], number>> = {
  fire: { fire: 78, air: 82, earth: 48, water: 38 },
  air: { fire: 82, air: 76, earth: 42, water: 45 },
  earth: { fire: 48, air: 42, earth: 80, water: 84 },
  water: { fire: 38, air: 45, earth: 84, water: 79 },
};

const SECTION_WEIGHTS: Record<SunCompatibilitySectionId, number> = {
  general: 0,
  love: 2,
  work: -1,
  home: -2,
  friendship: 3,
  neighbor: -3,
};

function getSign(id: ZodiacSignId) {
  return ZODIAC_SIGNS.find((sign) => sign.id === id) || ZODIAC_SIGNS[0];
}

function hash(value: string) {
  let out = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    out ^= value.charCodeAt(i);
    out = Math.imul(out, 16777619);
  }
  return Math.abs(out >>> 0);
}

function scoreColor(score: number) {
  if (score < 15) return '#E5484D';
  if (score < 30) return '#F97316';
  if (score < 45) return '#FACC15';
  if (score < 60) return '#A3E635';
  if (score < 75) return '#22C55E';
  return '#14B8A6';
}

function scoreTone(score: number) {
  if (score < 15) return 'Uyum düşük görünüyor; bu bağda sabır, açık sınır ve beklenti kontrolü çok önemli.';
  if (score < 30) return 'Uyum zorlayıcı ama tamamen kapalı değil; iki taraf da bilinçli emek verirse denge kurulabilir.';
  if (score < 45) return 'Uyum dalgalı; bazı alanlar rahat akarken bazı konular özel dikkat ister.';
  if (score < 60) return 'Uyum orta-iyi seviyede; doğru iletişimle bağ daha dengeli hale gelebilir.';
  if (score < 75) return 'Uyum güçlü; farklılıklar yönetildiğinde ilişki besleyici ve doğal hissedebilir.';
  return 'Uyum çok güçlü; iki taraf birbirinin ritmine kolayca eşlik edebilir ve bağ kendiliğinden akabilir.';
}

function compatibilityScore(first: SignMeta, second: SignMeta, section: SunCompatibilitySectionId) {
  const sameSign = first.id === second.id ? 8 : 0;
  const base = ELEMENT_COMPATIBILITY[first.element][second.element];
  const modality = first.modality === second.modality ? -4 : 4;
  const polarity = first.polarity === second.polarity ? 3 : -1;
  const jitter = (hash(`${first.id}:${second.id}:${section}`) % 13) - 6;
  return Math.max(4, Math.min(96, base + sameSign + modality + polarity + SECTION_WEIGHTS[section] + jitter));
}

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(DATA_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DATA_DIR, { intermediates: true });
  }
}

async function readHistory(): Promise<HistoryFile> {
  try {
    await ensureDir();
    const info = await FileSystem.getInfoAsync(HISTORY_FILE);
    if (!info.exists) return { schemaVersion: 1, choices: {} };
    return { schemaVersion: 1, choices: {}, ...(JSON.parse(await FileSystem.readAsStringAsync(HISTORY_FILE)) as Partial<HistoryFile>) };
  } catch {
    return { schemaVersion: 1, choices: {} };
  }
}

async function writeHistory(history: HistoryFile) {
  await ensureDir();
  await FileSystem.writeAsStringAsync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

function pickTemplateIndex(history: HistoryFile, key: string, templateCount: number) {
  const recent = history.choices[key] || [];
  const available = Array.from({ length: templateCount }, (_, index) => index).filter((index) => !recent.includes(index));
  const pool = available.length ? available : Array.from({ length: templateCount }, (_, index) => index);
  const pick = pool[hash(`${key}:${recent.join(',')}:${Date.now()}`) % pool.length];
  history.choices[key] = [pick, ...recent.filter((index) => index !== pick)].slice(0, Math.min(MAX_HISTORY_PER_KEY, templateCount - 1));
  return pick;
}

export async function createSunCompatibilityReading(firstId: ZodiacSignId, secondId: ZodiacSignId): Promise<SunCompatibilityReading> {
  const first = getSign(firstId);
  const second = getSign(secondId);
  const history = await readHistory();
  const sections = (Object.keys(SECTION_LABELS) as SunCompatibilitySectionId[]).map((sectionId) => {
    const score = compatibilityScore(first, second, sectionId);
    const templates = SECTION_TEMPLATES[sectionId];
    const key = `${first.id}:${second.id}:${sectionId}`;
    const template = templates[pickTemplateIndex(history, key, templates.length)];
    const text = template
      .replace(/\{a\}/g, first.label)
      .replace(/\{b\}/g, second.label)
      .replace(/\{toneLower\}/g, scoreTone(score).toLocaleLowerCase('tr-TR'))
      .replace(/\{tone\}/g, scoreTone(score));
    return {
      id: sectionId,
      title: SECTION_LABELS[sectionId],
      score,
      color: scoreColor(score),
      text,
    };
  });
  await writeHistory(history);
  return {
    title: `${first.label} - ${second.label} Güneş Burcu Uyumu`,
    sections,
  };
}
