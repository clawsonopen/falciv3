import * as FileSystem from 'expo-file-system/legacy';

type GeneralReadingType =
  | 'fortune-cookie'
  | 'magic-ball'
  | 'daily-affirmation'
  | 'daily-quote'
  | 'daily-runes'
  | 'daily-i-ching';

type GeneralReadingStore = {
  schemaVersion: 3;
  nextSequence: number;
  usedTexts: string[];
  dailyReadings: Array<{
    dateKey: string;
    type: GeneralReadingType;
    profileId: string;
    text: string;
    sequence: number;
    createdAt: string;
  }>;
  history: Array<{
    type: GeneralReadingType;
    profileId: string;
    text: string;
    createdAt: string;
    sequence: number;
  }>;
};

const DATA_DIR = `${FileSystem.documentDirectory}falci-data/`;
const STORE_FILE = `${DATA_DIR}general-readings-store.json`;

const COOKIE_OPENERS = [
  'Bugün evrene attığın küçük adım, beklediğinden büyük kapı açacak.',
  'Kalbinin çekindiği konu, aslında şansının kapısında bekliyor.',
  'Kısmetin ağırdan gelmiyor; doğru anda netleşmek için hazırlanıyor.',
  'Sessizce kurduğun niyet, görünmeyen yerden destek alıyor.',
  'Bugün aldığın kısa bir haber, uzun bir ferahlığın başlangıcı olabilir.',
];

const COOKIE_ACTIONS = [
  'Ertelediğin tek bir işi tamamla; yolun hızlanacak.',
  'Kısa bir telefon konuşması yap; beklediğin bağ açılacak.',
  'Küçük bir düzenleme yap; bereketin yönü değişecek.',
  'Günün erken saatinde bir karar ver; iç rahatlığın artacak.',
  'İçine sinmeyen bir detayı düzelt; ardından işaretler netleşecek.',
];

const COOKIE_BLESSINGS = [
  'Hanene huzur, zihnine açıklık geliyor.',
  'Dileğinin etrafındaki sis dağılıyor.',
  'Yoluna denk gelen kişi sana iyi haber taşıyacak.',
  'Maddi tarafta küçük ama sevindiren bir rahatlama görünüyor.',
  'Kalbini yoran konu tatlı bir netlikle çözülüyor.',
];

const SPHERE_OMENS = [
  'Küre bugün sabırlı kalanın kazanacağını söylüyor.',
  'Küre, acele karar yerine net adımın şans getireceğini gösteriyor.',
  'Küreye göre belirsizlik kısa; sonuç düşündüğünden yakın.',
  'Küre, görünmeyen bir desteğin şu an devrede olduğunu işaret ediyor.',
  'Küre, doğru soruyu sorarsan cevabın hızla açılacağını söylüyor.',
];

const SPHERE_WINDOWS = [
  'Önündeki 3 gün içinde bir işaret alacaksın.',
  'Bu hafta içinde iki seçenekten biri net biçimde öne çıkacak.',
  'Ay bitmeden seni rahatlatan bir haber duyuluyor.',
  'Yakın bir zamanda ertelenen bir konu tekrar masaya gelecek.',
  'Beklediğin dönüş kısa bir gecikmeden sonra geliyor.',
];

const SPHERE_ADVICE = [
  'Kendini açıklarken kısa ve net ol; sonuç senin lehine dönecek.',
  'Planını iki adımda tut; karmaşayı azalttığında şansın artacak.',
  'Önce sakinleş, sonra konuş; cümlelerin kapı açacak.',
  'Kırgınlıkla değil, merakla yaklaş; beklenmedik bir kolaylık doğacak.',
  'Bugün küçük, yarın büyük etki yaratacak bir başlangıç yap.',
];

const SPHERE_CLOSERS = [
  'Niyetin temiz kaldıkça yolun açık.',
  'Kalbin yumuşadıkça kısmetin hızlanıyor.',
  'İşaretler senin lehine birikiyor.',
  'Doğru zaman, düşündüğünden daha yakın.',
  'Kısmet çizgin yukarı yönlü ilerliyor.',
];

const SIGN_WORDS = [
  'lale',
  'zümrüt',
  'rüzgar',
  'duru',
  'mercan',
  'ışıltı',
  'atlas',
  'safir',
  'papatya',
  'nehir',
  'vaha',
  'kıvılcım',
  'yosun',
  'yakut',
  'akşam',
  'şafak',
  'nar',
  'defne',
  'güneş',
  'ayışığı',
  'çınar',
  'damla',
  'sedef',
  'masal',
  'kumsal',
  'gizem',
  'umut',
  'sevda',
  'bereket',
  'uğur',
  'yankı',
  'eser',
];

const AFFIRMATION_OPENERS = [
  'Bugün kendime güveniyorum ve net adımlar atıyorum.',
  'Bugün iç sesimi sakinlikle dinliyorum.',
  'Bugün kendi değerimi hatırlıyor ve ona göre davranıyorum.',
  'Bugün kalbimle aklımı uyum içinde tutuyorum.',
  'Bugün sabrımı koruyor ve acele etmiyorum.',
  'Bugün doğru sınırları sevgiyle koyuyorum.',
  'Bugün kendimi suçlamadan ilerliyorum.',
  'Bugün küçük adımların büyük sonuçlar doğurduğunu biliyorum.',
  'Bugün içimdeki gücü net biçimde hissediyorum.',
  'Bugün huzurumu önceliğim yapıyorum.',
];

const AFFIRMATION_MIDDLES = [
  'Geçmişin yükünü hafifletiyor, bugünün fırsatına odaklanıyorum.',
  'Kararsızlık yerine sade ve uygulanabilir kararlar seçiyorum.',
  'Korku yerine merakı, telaş yerine dengeyi büyütüyorum.',
  'Beklemek yerine hazırlığımı tamamlayıp yola çıkıyorum.',
  'Yorulduğum yerde nefes alıp yeniden hizalanıyorum.',
  'Kırıldığım yerde kapanmak yerine açık ve net kalıyorum.',
  'Kendi ritmime saygı duyuyor, başkalarıyla kıyaslamıyorum.',
  'Ertelediğim işi nazikçe bitirip içimi ferahlatıyorum.',
  'Bolluk bilincini büyütüyor, kıtlık korkusunu azaltıyorum.',
  'Sezgilerime alan açıyor, gereksiz gürültüyü kısıyorum.',
];

const AFFIRMATION_CLOSERS = [
  'Bugün benim için mümkün, ben de buna açığım.',
  'Ben hazır oldukça hayat da benimle hizalanıyor.',
  'Ben netleştikçe yolum da aydınlanıyor.',
  'Ben sakinleştikçe doğru cevaplar bana geliyor.',
  'Ben adım attıkça şansım da benimle çoğalıyor.',
  'Ben dengede kaldıkça kalbim güçleniyor.',
  'Ben kendime inandıkça sonuçlar güzelleşiyor.',
  'Ben değerimi bildikçe ilişkilerim iyileşiyor.',
  'Ben açık kaldıkça kısmet bana daha kolay ulaşıyor.',
  'Ben güvenle ilerledikçe kapılar sırasıyla açılıyor.',
];

const QUOTE_REFLECTIONS_1 = [
  'Bugün bu sözü bir kararının merkezine koy.',
  'Bu cümleyi gün içinde en az bir kez sesli tekrar et.',
  'Bu sözü bugünün pusulası gibi yanında taşı.',
  'Bu cümleye göre tek bir adım seç ve uygula.',
  'Bu alıntıyı bir niyet cümlesine dönüştür.',
  'Bu sözü günün sonunda yaptığın işle karşılaştır.',
  'Bu ifadeyi bugün bir davranışla somutlaştır.',
  'Bu cümleyi zihninde değil, eyleminde göster.',
  'Bu sözü en çok zorlandığın anda hatırla.',
  'Bu alıntıyı bugün kendine verdiğin söz yap.',
];

const QUOTE_REFLECTIONS_2 = [
  'Küçük ama gerçek bir adım yeterli olacak.',
  'Mükemmel olmanı değil, samimi olmanı isteyecek.',
  'Seni zorlamadan ama net biçimde dönüştürecek.',
  'Beklediğinden daha hızlı etki yaratacak.',
  'Önce zihnini, sonra gününü düzenleyecek.',
  'Kararsızlığı azaltıp odağını güçlendirecek.',
  'İç sesini berraklaştırıp yükünü hafifletecek.',
  'Daha sade, daha güçlü bir yön verecek.',
  'Gereksiz yükleri eleyip özüne yaklaştıracak.',
  'Kendine güvenini sessizce yükseltecek.',
];

const REAL_QUOTES: Array<{ text: string; author: string }> = [
  { text: 'Hayatta en hakiki mürşit ilimdir.', author: 'Mustafa Kemal Atatürk' },
  { text: 'Bir mum, başka bir mumu tutuşturmakla ışığından bir şey kaybetmez.', author: 'Mevlana' },
  { text: 'Bildiğim tek şey, hiçbir şey bilmediğimdir.', author: 'Sokrates' },
  { text: 'Kendini fetheden, şehir fethedenlerden daha büyüktür.', author: 'Aristo' },
  { text: 'Mutluluk, dış koşullarda değil; insanın içindedir.', author: 'Tolstoy' },
  { text: 'Başarı son değildir, başarısızlık öldürücü değildir; devam etme cesareti önemlidir.', author: 'Winston Churchill' },
  { text: 'Yapabileceğinizi düşündüğünüzde de, düşünmediğinizde de haklısınız.', author: 'Henry Ford' },
  { text: 'Hayal gücü bilgiden daha önemlidir.', author: 'Albert Einstein' },
  { text: 'Zor zamanlar kalıcı değildir, zor insanlar kalıcıdır.', author: 'Robert H. Schuller' },
  { text: 'Geleceği tahmin etmenin en iyi yolu onu yaratmaktır.', author: 'Peter Drucker' },
  { text: 'Başlamanın sırrı konuşmayı bırakıp işe koyulmaktır.', author: 'Walt Disney' },
  { text: 'Zorlukların ortasında fırsatlar yatar.', author: 'Albert Einstein' },
  { text: 'Karanlığa küfretmektense bir mum yak.', author: 'Konfüçyüs' },
  { text: 'Ne kadar yavaş gittiğin önemli değil, yeter ki durma.', author: 'Konfüçyüs' },
  { text: 'Kendin ol; diğer herkes zaten kapıldı.', author: 'Oscar Wilde' },
  { text: 'Olduğun yerde, sahip olduklarınla, yapabildiğini yap.', author: 'Theodore Roosevelt' },
  { text: 'Düşmek sorun değil, kalkmamak sorundur.', author: 'Çin Atasözü' },
  { text: 'İyi bir başlangıç, yarım başarıdır.', author: 'Aristo' },
  { text: 'Dünyada görmek istediğin değişim ol.', author: 'Mahatma Gandhi' },
  { text: 'Asla vazgeçme; büyük şeyler zaman alır.', author: 'Maya Angelou' },
  { text: 'Her gün yeniden başlamak için iyi bir gündür.', author: 'Seneca' },
  { text: 'Sabır acıdır, meyvesi tatlıdır.', author: 'Jean-Jacques Rousseau' },
  { text: 'Sakin bir zihin, güçlü bir kalptir.', author: 'Dalai Lama' },
  { text: 'Hayat, sen plan yaparken olup bitendir.', author: 'John Lennon' },
  { text: 'Kendini bilmek, tüm bilgeliğin başlangıcıdır.', author: 'Aristo' },
  { text: 'Sessizlik bazen en güçlü cevaptır.', author: 'Lao Tzu' },
  { text: 'Disiplin, hedeflerle başarı arasındaki köprüdür.', author: 'Jim Rohn' },
  { text: 'Kendine inanç, başarının ilk sırrıdır.', author: 'Ralph Waldo Emerson' },
  { text: 'Enerjini korkuya değil, olasılığa ver.', author: 'Oprah Winfrey' },
  { text: 'Bazen en büyük adım, yerinde kalmayı bırakmaktır.', author: 'Mark Twain' },
];

const RUNE_MEANINGS: Array<{ rune: string; keyword: string; message: string }> = [
  { rune: 'Fehu', keyword: 'Bereket', message: 'Kaynaklarını korurken paylaşmayı da unutma; akışın gücü dengeden gelir.' },
  { rune: 'Uruz', keyword: 'Güç', message: 'Bugün dayanıklılığın artıyor; başladığın işi kararlılıkla tamamla.' },
  { rune: 'Thurisaz', keyword: 'Eşik', message: 'Hızlı tepki yerine kısa bir duraksama, seni doğru sonuca götürecek.' },
  { rune: 'Ansuz', keyword: 'Mesaj', message: 'Açık iletişim kurduğunda beklediğin netlik sandığından hızlı gelir.' },
  { rune: 'Raidho', keyword: 'Yol', message: 'Planını sadeleştir; doğru rota küçük ama istikrarlı adımlarla açılır.' },
  { rune: 'Kenaz', keyword: 'Aydınlanma', message: 'Karanlıkta kalan bir konu bugün zihninde berraklaşmaya başlayacak.' },
  { rune: 'Gebo', keyword: 'Karşılıklılık', message: 'Vermek ve almak dengesini kurduğunda ilişkilerde ferahlık artar.' },
  { rune: 'Wunjo', keyword: 'Sevinç', message: 'Küçük bir iyi haber moralini yükseltip günün ritmini değiştirebilir.' },
  { rune: 'Hagalaz', keyword: 'Dönüşüm', message: 'Plan dışı bir gelişme, uzun vadede seni daha doğru bir zemine taşır.' },
  { rune: 'Nauthiz', keyword: 'Sabır', message: 'Eksik gördüğün yerde panik yapma; bugün az ama doğru adım en iyisi.' },
  { rune: 'Isa', keyword: 'Sakinlik', message: 'Duraklama bir kayıp değil; güç toplama alanı olarak kullan.' },
  { rune: 'Jera', keyword: 'Hasat', message: 'Dün ektiğinin karşılığı geliyor; sürece sadık kalman ödül getirir.' },
];

const ICHING_HEXAGRAMS: Array<{ no: number; name: string; insight: string }> = [
  { no: 1, name: 'Yaratıcı', insight: 'Güçlü başlangıç enerjisi var; yönünü netleştir ve ilk adımı erteleme.' },
  { no: 2, name: 'Alıcı', insight: 'Zorlamak yerine uyumlanmak bugün daha hızlı sonuç getirir.' },
  { no: 3, name: 'Başlangıç Zorluğu', insight: 'İlk karmaşa normal; düzen kurdukça yol kendini gösterecek.' },
  { no: 5, name: 'Bekleyiş', insight: 'Doğru zaman yaklaşırken hazırlık yapmak, aceleden daha verimli olur.' },
  { no: 8, name: 'Birlik', insight: 'Uyumlu işbirliği bugün tek başına efordan daha güçlü çalışır.' },
  { no: 11, name: 'Barış', insight: 'İç ve dış dengeyi korursan fırsatlar doğal biçimde yaklaşır.' },
  { no: 14, name: 'Büyük Sahiplik', insight: 'Elindeki imkânları düzenlediğinde büyüme alanın genişler.' },
  { no: 24, name: 'Dönüş', insight: 'Eski bir mesele temiz niyetle ele alındığında yeni bir kapı açar.' },
  { no: 32, name: 'Süreklilik', insight: 'Bugün istikrar, parlak ama kısa hamlelerden daha kıymetli.' },
  { no: 42, name: 'Artış', insight: 'Küçük iyileştirmeler birikerek beklenenden büyük fayda sağlar.' },
  { no: 46, name: 'Yükseliş', insight: 'Sabırlı yükseliş çizgisi aktif; adım adım ilerleme lehine çalışır.' },
  { no: 63, name: 'Tamamlanma Sonrası', insight: 'Bitti sanılan konuyu korumak için ince ayar ve dikkat gerekir.' },
];

function nowIso() {
  return new Date().toISOString();
}

function pickBySequence<T>(list: T[], sequence: number, shift: number): T {
  const index = Math.abs((sequence * 17 + shift * 23) % list.length);
  return list[index];
}

function normalizeText(text: string) {
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildUniqueSign(sequence: number) {
  const base = SIGN_WORDS.length;
  let value = Math.max(0, sequence);
  const parts: string[] = [];
  do {
    parts.push(SIGN_WORDS[value % base]);
    value = Math.floor(value / base);
  } while (value > 0);
  while (parts.length < 3) {
    parts.push(SIGN_WORDS[(sequence + parts.length * 7) % base]);
  }
  return parts.join(' ');
}

function buildFortuneCookieText(sequence: number) {
  const a = pickBySequence(COOKIE_OPENERS, sequence, 1);
  const b = pickBySequence(COOKIE_ACTIONS, sequence, 2);
  const c = pickBySequence(COOKIE_BLESSINGS, sequence, 3);
  const sign = buildUniqueSign(sequence);
  return `${a} ${b} ${c} Bugünün uğur işareti: ${sign}.`;
}

function buildMagicBallText(sequence: number) {
  const a = pickBySequence(SPHERE_OMENS, sequence, 4);
  const b = pickBySequence(SPHERE_WINDOWS, sequence, 5);
  const c = pickBySequence(SPHERE_ADVICE, sequence, 6);
  const d = pickBySequence(SPHERE_CLOSERS, sequence, 7);
  const sign = buildUniqueSign(sequence);
  return `${a} ${b} ${c} ${d} Kürenin işareti: ${sign}.`;
}

function buildDailyAffirmationText(sequence: number) {
  const a = pickBySequence(AFFIRMATION_OPENERS, sequence, 8);
  const b = pickBySequence(AFFIRMATION_MIDDLES, sequence, 9);
  const c = pickBySequence(AFFIRMATION_CLOSERS, sequence, 10);
  return `${a} ${b} ${c}`;
}

function buildDailyQuoteText(sequence: number) {
  const quote = pickBySequence(REAL_QUOTES, sequence, 11);
  const r1 = pickBySequence(QUOTE_REFLECTIONS_1, sequence, 12);
  const r2 = pickBySequence(QUOTE_REFLECTIONS_2, sequence, 13);
  return `“${quote.text}”\n- ${quote.author}\n${r1} ${r2}`;
}

function buildDailyRunesText(sequence: number) {
  const rune = pickBySequence(RUNE_MEANINGS, sequence, 14);
  return `Günün runesi: ${rune.rune} (${rune.keyword}). ${rune.message}`;
}

function buildDailyIChingText(sequence: number) {
  const hex = pickBySequence(ICHING_HEXAGRAMS, sequence, 15);
  return `I-Ching bugün ${hex.no}. hexagramı gösteriyor: ${hex.name}. ${hex.insight}`;
}

function defaultStore(): GeneralReadingStore {
  return {
    schemaVersion: 3,
    nextSequence: 1,
    usedTexts: [],
    dailyReadings: [],
    history: [],
  };
}

function todayKeyInIstanbul(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value ?? '0000';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

async function ensureDir(path: string) {
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(path, { intermediates: true });
  }
}

async function ensureBaseDir() {
  await ensureDir(DATA_DIR);
}

async function loadStore(): Promise<GeneralReadingStore> {
  await ensureBaseDir();
  const info = await FileSystem.getInfoAsync(STORE_FILE);
  if (!info.exists) {
    const initial = defaultStore();
    await FileSystem.writeAsStringAsync(STORE_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  const raw = await FileSystem.readAsStringAsync(STORE_FILE);
  const parsed = JSON.parse(raw) as Partial<GeneralReadingStore>;
  return {
    schemaVersion: 3,
    nextSequence: Number(parsed.nextSequence || 1),
    usedTexts: Array.isArray(parsed.usedTexts) ? parsed.usedTexts : [],
    dailyReadings: Array.isArray(parsed.dailyReadings) ? parsed.dailyReadings : [],
    history: Array.isArray(parsed.history) ? parsed.history : [],
  };
}

async function saveStore(store: GeneralReadingStore) {
  await ensureBaseDir();
  await FileSystem.writeAsStringAsync(STORE_FILE, JSON.stringify(store, null, 2));
}

function buildTextForType(type: GeneralReadingType, sequence: number): string {
  if (type === 'fortune-cookie') return buildFortuneCookieText(sequence);
  if (type === 'magic-ball') return buildMagicBallText(sequence);
  if (type === 'daily-affirmation') return buildDailyAffirmationText(sequence);
  if (type === 'daily-quote') return buildDailyQuoteText(sequence);
  if (type === 'daily-runes') return buildDailyRunesText(sequence);
  return buildDailyIChingText(sequence);
}

export async function createUniqueGeneralReading(params: {
  type: GeneralReadingType;
  profileId: string;
}): Promise<{ text: string; sequence: number }> {
  const store = await loadStore();
  const dateKey = todayKeyInIstanbul();
  const existingDaily = store.dailyReadings.find(
    (item) => item.type === params.type && item.profileId === params.profileId && item.dateKey === dateKey,
  );
  if (existingDaily) {
    return { text: existingDaily.text, sequence: existingDaily.sequence };
  }

  const used = new Set(store.usedTexts.map((item) => normalizeText(item)));

  let sequence = Math.max(1, store.nextSequence);
  let selectedText = '';

  for (let attempt = 0; attempt < 10000; attempt += 1) {
    const current = sequence + attempt;
    const candidate = buildTextForType(params.type, current);
    const normalized = normalizeText(candidate);
    if (used.has(normalized)) continue;
    selectedText = candidate;
    sequence = current;
    break;
  }

  if (!selectedText) {
    throw new Error('Benzersiz metin üretilemedi. Lütfen tekrar dene.');
  }

  const nextStore: GeneralReadingStore = {
    ...store,
    nextSequence: sequence + 1,
    usedTexts: [...store.usedTexts, selectedText],
    dailyReadings: [
      {
        dateKey,
        type: params.type,
        profileId: params.profileId,
        text: selectedText,
        sequence,
        createdAt: nowIso(),
      },
      ...store.dailyReadings,
    ].slice(0, 30000),
    history: [
      {
        type: params.type,
        profileId: params.profileId,
        text: selectedText,
        createdAt: nowIso(),
        sequence,
      },
      ...store.history,
    ].slice(0, 8000),
  };
  await saveStore(nextStore);

  return { text: selectedText, sequence };
}
