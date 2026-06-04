import * as FileSystem from 'expo-file-system/legacy';
import type { SubjectProfile } from '../types/memory';
import type { AstroPeriod, AstroReadingResult } from './astroEngine';
import { buildGeneralAstroSkyContext } from './astroEngine';
import { buildAnimalProfileInstructionFromProfile, isAnimalProfile } from './animalProfilePrompt';
import { sanitizePublicReadingLanguage } from './personaClosingService';
import { AGENT_API_URL } from '../config/constants';
import { generateGeminiTextDirect } from './geminiDirectService';
import { appendReadingSummary, loadAccountState } from './profileMemoryService';
import { addPersonalTokenUsage } from './tokenLedgerService';

const SIGN_ORDER = [
  'aries',
  'taurus',
  'gemini',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'scorpio',
  'sagittarius',
  'capricorn',
  'aquarius',
  'pisces',
] as const;

const SIGN_TR: Record<(typeof SIGN_ORDER)[number], string> = {
  aries: 'Koç',
  taurus: 'Boğa',
  gemini: 'İkizler',
  cancer: 'Yengeç',
  leo: 'Aslan',
  virgo: 'Başak',
  libra: 'Terazi',
  scorpio: 'Akrep',
  sagittarius: 'Yay',
  capricorn: 'Oğlak',
  aquarius: 'Kova',
  pisces: 'Balık',
};

const PERIOD_TR: Record<Exclude<AstroPeriod, 'yearly'>, string> = {
  daily: 'günlük',
  weekly: 'haftalık',
  monthly: 'aylık',
};

const PERIOD_TITLE_TR: Record<Exclude<AstroPeriod, 'yearly'>, string> = {
  daily: 'Günlük',
  weekly: 'Haftalık',
  monthly: 'Aylık',
};

const DATA_DIR = `${FileSystem.documentDirectory}falci-data/`;
const GENERAL_ASTRO_CACHE_FILE = `${DATA_DIR}general-astro-cache.json`;
const MAX_GENERAL_ASTRO_CACHE_ITEMS = 120;

type GeneralAstroCacheFile = {
  schemaVersion: 1;
  entries: Array<{
    cacheKey: string;
    profileId: string;
    sign: (typeof SIGN_ORDER)[number];
    period: Exclude<AstroPeriod, 'yearly'>;
    periodKey: string;
    createdAt: string;
    reading: AstroReadingResult;
  }>;
};

const WEEKDAY_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const MONTH_TR = [
  '',
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

async function readGeneralAstroCache(): Promise<GeneralAstroCacheFile> {
  try {
    const info = await FileSystem.getInfoAsync(GENERAL_ASTRO_CACHE_FILE);
    if (!info.exists) return { schemaVersion: 1, entries: [] };
    const raw = await FileSystem.readAsStringAsync(GENERAL_ASTRO_CACHE_FILE);
    const parsed = JSON.parse(raw) as GeneralAstroCacheFile;
    return {
      schemaVersion: 1,
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
    };
  } catch {
    return { schemaVersion: 1, entries: [] };
  }
}

async function writeGeneralAstroCache(cache: GeneralAstroCacheFile) {
  await FileSystem.makeDirectoryAsync(DATA_DIR, { intermediates: true }).catch(() => {});
  await FileSystem.writeAsStringAsync(
    GENERAL_ASTRO_CACHE_FILE,
    JSON.stringify(
      {
        schemaVersion: 1,
        entries: cache.entries.slice(0, MAX_GENERAL_ASTRO_CACHE_ITEMS),
      },
      null,
      2,
    ),
  );
}

function generalAstroCacheKey(params: {
  profileId: string;
  sign: (typeof SIGN_ORDER)[number];
  period: Exclude<AstroPeriod, 'yearly'>;
  periodKey: string;
}) {
  return `${params.profileId}:${params.sign}:${params.period}:${params.periodKey}`;
}

async function loadGeneralAstroFromCache(params: {
  profileId: string;
  sign: (typeof SIGN_ORDER)[number];
  period: Exclude<AstroPeriod, 'yearly'>;
  periodKey: string;
}) {
  const cacheKey = generalAstroCacheKey(params);
  const cache = await readGeneralAstroCache();
  const hit = cache.entries.find((entry) => entry.cacheKey === cacheKey);
  return hit ? { ...hit.reading, cached: true } : null;
}

async function saveGeneralAstroToCache(params: {
  profileId: string;
  sign: (typeof SIGN_ORDER)[number];
  period: Exclude<AstroPeriod, 'yearly'>;
  periodKey: string;
  reading: AstroReadingResult;
}) {
  const cacheKey = generalAstroCacheKey(params);
  const cache = await readGeneralAstroCache();
  const entry = {
    cacheKey,
    profileId: params.profileId,
    sign: params.sign,
    period: params.period,
    periodKey: params.periodKey,
    createdAt: new Date().toISOString(),
    reading: { ...params.reading, cached: false },
  };
  await writeGeneralAstroCache({
    schemaVersion: 1,
    entries: [entry, ...cache.entries.filter((item) => item.cacheKey !== cacheKey)],
  });
}

function deriveSign(profile: SubjectProfile): (typeof SIGN_ORDER)[number] {
  const date = profile.birth.date;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return SIGN_ORDER[hashSeed(profile.profileId) % SIGN_ORDER.length];
  }
  const [, mm, dd] = date.split('-').map(Number);
  if ((mm === 3 && dd >= 21) || (mm === 4 && dd <= 19)) return 'aries';
  if ((mm === 4 && dd >= 20) || (mm === 5 && dd <= 20)) return 'taurus';
  if ((mm === 5 && dd >= 21) || (mm === 6 && dd <= 20)) return 'gemini';
  if ((mm === 6 && dd >= 21) || (mm === 7 && dd <= 22)) return 'cancer';
  if ((mm === 7 && dd >= 23) || (mm === 8 && dd <= 22)) return 'leo';
  if ((mm === 8 && dd >= 23) || (mm === 9 && dd <= 22)) return 'virgo';
  if ((mm === 9 && dd >= 23) || (mm === 10 && dd <= 22)) return 'libra';
  if ((mm === 10 && dd >= 23) || (mm === 11 && dd <= 21)) return 'scorpio';
  if ((mm === 11 && dd >= 22) || (mm === 12 && dd <= 21)) return 'sagittarius';
  if ((mm === 12 && dd >= 22) || (mm === 1 && dd <= 19)) return 'capricorn';
  if ((mm === 1 && dd >= 20) || (mm === 2 && dd <= 18)) return 'aquarius';
  return 'pisces';
}

function deviceTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Istanbul';
}

function timezoneDateParts(date = new Date(), timezone = deviceTimeZone()) {
  const parts = new Intl.DateTimeFormat('tr-TR', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === 'year')?.value || date.getFullYear());
  const month = Number(parts.find((part) => part.type === 'month')?.value || date.getMonth() + 1);
  const day = Number(parts.find((part) => part.type === 'day')?.value || date.getDate());
  const calendarDateUtc = new Date(Date.UTC(year, month - 1, day));
  const weekday = WEEKDAY_TR[calendarDateUtc.getUTCDay()];
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { year, month, day, iso, weekday, calendarDateUtc, timezone };
}

function addDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatLongDate(parts: { year: number; month: number; day: number; weekday?: string }) {
  const formatted = `${parts.day} ${MONTH_TR[parts.month] || String(parts.month).padStart(2, '0')} ${parts.year}`;
  return parts.weekday ? `${formatted} ${parts.weekday}` : formatted;
}

function partsFromUtcDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  return { year, month, day, weekday: WEEKDAY_TR[date.getUTCDay()] };
}

function weekKeyAndRange(today = timezoneDateParts()) {
  const weekdayIndex = today.calendarDateUtc.getUTCDay() || 7;
  const monday = addDays(today.calendarDateUtc, 1 - weekdayIndex);
  const sunday = addDays(monday, 6);
  const weekOne = new Date(Date.UTC(monday.getUTCFullYear(), 0, 4));
  const weekOneDay = weekOne.getUTCDay() || 7;
  weekOne.setUTCDate(weekOne.getUTCDate() - weekOneDay + 1);
  const week = Math.floor((monday.getTime() - weekOne.getTime()) / 604800000) + 1;
  return {
    key: `${monday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`,
    rangeLabel: `${formatLongDate(partsFromUtcDate(monday))} - ${formatLongDate(partsFromUtcDate(sunday))}`,
  };
}

function monthLabel(today = timezoneDateParts()) {
  return `${MONTH_TR[today.month] || String(today.month).padStart(2, '0')} ${today.year}`;
}

function periodContext(period: Exclude<AstroPeriod, 'yearly'>) {
  const timezone = deviceTimeZone();
  const today = timezoneDateParts(new Date(), timezone);
  const todayLabel = formatLongDate(today);
  if (period === 'daily') {
    return {
      key: today.iso,
      label: todayLabel,
      instruction:
        `Bu yalnızca günlük genel astro yorumudur. Cihazın aktif zaman dilimine göre tarih bağlamı: ${todayLabel}. ` +
        `Zaman dilimi: ${timezone}. ` +
        `Gün adı kesin olarak ${today.weekday}; başka bir gün adı, özellikle Pazartesi, yazma.`,
      timezone,
    };
  }
  if (period === 'weekly') {
    const week = weekKeyAndRange(today);
    return {
      key: week.key,
      label: week.rangeLabel,
      instruction:
        `Bu yalnızca haftalık genel astro yorumudur. Cihazın aktif zaman dilimi: ${timezone}. Hafta aralığı: ${week.rangeLabel}. ` +
        'Tek günlük yorum gibi yazma; ayın tamamını da yorumlama. Haftanın genel ritmini, hafta başı/ortası/sonu akışını ayır.',
      timezone,
    };
  }
  return {
    key: `${today.year}-${String(today.month).padStart(2, '0')}`,
    label: monthLabel(today),
    instruction:
      `Bu yalnızca aylık genel astro yorumudur. Cihazın aktif zaman dilimi: ${timezone}. Ay bağlamı: ${monthLabel(today)}. ` +
      'Günlük veya haftalık yorum gibi yazma; ayın ana teması, ilk yarı, ikinci yarı ve ay sonu kapanışını anlat.',
    timezone,
  };
}

function buildGeneralAstroPayload(params: {
  period: Exclude<AstroPeriod, 'yearly'>;
  profile: SubjectProfile;
  sign: (typeof SIGN_ORDER)[number];
  periodKey: string;
  periodContextLabel: string;
  periodInstruction: string;
  skyContextJson?: string;
  repeatMemory?: string;
}) {
  const signLabel = SIGN_TR[params.sign];
  const periodLabel = PERIOD_TR[params.period];
  const animalProfile = isAnimalProfile(params.profile);
  const systemText =
    [
      'Sen Türkçe yazan bir genel astroloji yorumcususun. Yanıtı kısa, akıcı ve kullanıcıya dönük yaz; kesin gelecek iddiası, sağlık/finans garantisi ve korkutucu dil kullanma. Sağlıkta teşhis, tedavi, ilaç, doz, beslenme reçetesi veya kesin iyileşme dili kurma; insan sağlığı endişesinde doktor/uygun sağlık uzmanı, hayvan sağlığı endişesinde veteriner öner. Markdown, yıldızlı vurgu, madde imi, emoji, ikon veya dekoratif sembol kullanma.',
      animalProfile
        ? 'Seçili profil evcil hayvansa genel astro yorumunu insan okuması gibi yazma. Kariyer, iş, para kazanma, okul, evlilik, romantik ilişki, insan sosyal çevresi veya yetişkin insan psikolojisi teması kurma; hayvanın mizacı, oyun/dinlenme ritmi, duyuları, ev içi güveni, pencere/dış dünya merakı, evdeki diğer hayvanlarla ilişkisi ve sahibiyle bağı üzerinden yaz.'
        : '',
    ].filter(Boolean).join(' ');
  const userText = [
    `Profil adı: ${params.profile.displayName}`,
    buildAnimalProfileInstructionFromProfile(params.profile),
    `Güneş burcu: ${signLabel}`,
    `Dönem kodu: ${params.period}`,
    `Dönem: ${periodLabel}`,
    `Dönem anahtarı: ${params.periodKey}`,
    `Dönem bağlamı: ${params.periodContextLabel}`,
    `Zaman kuralı: ${params.periodInstruction}`,
    params.skyContextJson
      ? `Gerçek gökyüzü verisi JSON:\n${params.skyContextJson}`
      : '',
    params.repeatMemory
      ? `Tekrar önleme hafızası: ${params.repeatMemory}. Bu önceki genel astro metinlerindeki ana kalıpları tekrar etme; aynı temayı kullanman gerekirse farklı açı ve farklı cümlelerle işle.`
      : '',
    [
      'Yükselen veya kişiye özel doğum haritası bilgisi varmış gibi davranma.',
      'Verilen gerçek gökyüzü verisini kullan; yorumu yalnızca genel Güneş burcu bağlamında kur. Kullanıcının Ay burcu, yükseleni, doğum saati, natal evi veya kişisel doğum haritası varmış gibi yazma.',
      'Teknik dili ölçülü kullan: retro, kare, karşıt, kavuşum, sert etki, destekleyici etki gibi 1-3 doğal ifade yeterli. Derece listesi, tablo dili, ev numarası veya hesap raporu yazma.',
      'Gökyüzü verisiyle bağ kurmadan tamamen jenerik motivasyon metni yazma; en az bir gezegen/retro/açı veya dönem timeline vurgusu doğal biçimde yoruma girsin.',
      animalProfile
        ? '3-4 ana konuya değin: mizaç/duygu tonu, oyun ve dinlenme ritmi, ev içi güven ve sahibiyle bağ, küçük bir gözlem önerisi.'
        : '3-4 ana konuya değin: duygu hali, ilişkiler, iş/para ve küçük bir öneri.',
      animalProfile
        ? 'Metin hayvanı üçüncü tekil şahısla anlatsın; hesap sahibine yalnızca sahibi/refakatçisi olarak yumuşak öneri ver.'
        : '',
      params.period === 'daily'
        ? 'Metni 110-150 kelime arasında tut. Bugünün gün adını yazarsan sadece verilen zaman kuralındaki gün adını kullan.'
        : params.period === 'weekly'
          ? 'Metni 150-210 kelime arasında tut. Haftalık olduğunu ilk paragraftan hissettir; günlük ve aylık metinle aynı cümle kalıplarını kullanma.'
          : 'Metni 170-230 kelime arasında tut. Aylık olduğunu ilk paragraftan hissettir; günlük ve haftalık metinle aynı cümle kalıplarını kullanma.',
      'Başlık atma. Türkçe yaz.',
    ].filter(Boolean).join('\n'),
  ].join('\n\n');

  return {
    system_instruction: { parts: [{ text: systemText }] },
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    generationConfig: {
      temperature: 0.68,
      maxOutputTokens: params.period === 'daily' ? 520 : params.period === 'weekly' ? 720 : 820,
    },
  };
}

function recentGeneralAstroMemory(params: {
  profileId: string;
  period: Exclude<AstroPeriod, 'yearly'>;
  signLabel: string;
}) {
  return loadAccountState()
    .then((state) =>
      state.readings
        .filter(
          (reading) =>
            reading.profileId === params.profileId &&
            reading.readingType === 'general-astro' &&
            reading.period === params.period,
        )
        .slice(0, 3)
        .map((reading) => reading.summary.replace(/\s+/g, ' ').trim().slice(0, 260))
        .filter(Boolean)
        .join(' | '),
    )
    .catch(() => '');
}

async function generateGeneralAstroWithGemini(params: {
  period: Exclude<AstroPeriod, 'yearly'>;
  profile: SubjectProfile;
  sign: (typeof SIGN_ORDER)[number];
  periodKey: string;
  periodContextLabel: string;
  periodInstruction: string;
  skyContextJson?: string;
  repeatMemory?: string;
}) {
  const payload = buildGeneralAstroPayload(params);
  const response = await generateGeminiTextDirect(payload, 45000, { usageMode: 'raw' });
  const text = response.text.trim();
  if (!text) throw new Error('Genel astro Gemini yanıtı boş döndü.');
  await addPersonalTokenUsage({
    modelName: response.model || 'gemini-2.5-flash-lite',
    readingName: `Genel Astro ${PERIOD_TITLE_TR[params.period]}`,
    textInputTokens: response.usage.inputTokens || 0,
    outputTokens: response.usage.outputTokens || 0,
    rawPromptTokens: response.usage.inputTokens || 0,
    rawOutputTokens: response.usage.outputTokens || 0,
    rawTotalTokens: response.usage.totalTokens || (response.usage.inputTokens || 0) + (response.usage.outputTokens || 0),
  }).catch(() => {});
  return {
    text,
    modelName: response.model || 'gemini-2.5-flash-lite',
  };
}

async function fetchServerGeneralAstroCached(params: {
  period: Exclude<AstroPeriod, 'yearly'>;
  sign: (typeof SIGN_ORDER)[number];
  periodKey: string;
  timezone: string;
}) {
  const query = new URLSearchParams({
    period: params.period,
    sign: params.sign,
    periodKey: params.periodKey,
    timezone: params.timezone,
  });
  const response = await fetch(`${AGENT_API_URL}/general-astro?${query.toString()}`);
  if (!response.ok) {
    throw new Error(`Genel astro cache okunamadı: ${response.status}`);
  }
  const data = await response.json();
  const text = typeof data?.text === 'string' ? data.text.trim() : '';
  if (!text) throw new Error('Genel astro cache boş döndü.');
  return text;
}

function buildLocalGeneralAstroFallback(params: {
  period: Exclude<AstroPeriod, 'yearly'>;
  sign: (typeof SIGN_ORDER)[number];
  label: string;
  repeatMemory?: string;
}) {
  const signLabel = SIGN_TR[params.sign];
  const avoidRepeat = params.repeatMemory
    ? ' Önceki genel yorumlarla aynı cümle kalıbına düşmemek için bu kez odağı daha pratik ve farklı bir açıdan tutmak iyi olur.'
    : '';
  if (params.period === 'daily') {
    return `${signLabel} için bugün genel hava daha sade ve toparlayıcı ilerliyor. Duygusal tarafta acele tepki vermek yerine önce gözlem yapmak, ilişkilerde gereksiz yanlış anlamaları azaltabilir. İş ve para tarafında küçük ama net bir düzenleme günü rahatlatır; büyük kararları ise kanıt ve zamanla tartmak daha iyi olur. Günün önerisi, enerjini tek bir önceliğe toplamak ve akşam saatlerinde zihnini dağıtan küçük işleri kapatmak.${avoidRepeat}`;
  }
  if (params.period === 'weekly') {
    return `${signLabel} için ${params.label} haftasının genel ritmi parça parça netleşme üzerine kurulu. Haftanın başında iletişim ve planlama öne çıkarken, orta bölümde ilişkilerde denge ve karşılıklı beklentiler daha görünür olabilir. İş ve para tarafında hızlı büyütmek yerine mevcut düzeni sağlamlaştırmak destekleyici duruyor. Hafta sonuna doğru dinlenme, sadeleşme ve bir konuyu kapatma isteği artabilir.${avoidRepeat}`;
  }
  return `${signLabel} için ${params.label} genel olarak yön belirleme ve yük azaltma teması taşıyor. Ayın ilk kısmında gündelik düzen, iş akışı ve kişisel sorumluluklar öne çıkabilir. Orta bölümde ilişkilerde açıklık, aile veya yakın çevreyle uyum arayışı belirginleşir. Ay sonuna doğru daha sade hedefler seçmek, enerjiyi dağıtmadan ilerlemeyi kolaylaştırır. Bu yorum genel Güneş burcu ritmidir; kişisel doğum haritası yerine kolektif eğilimi anlatır.${avoidRepeat}`;
}

async function rememberGeneralAstroReading(params: {
  profileId: string;
  period: Exclude<AstroPeriod, 'yearly'>;
  text: string;
}) {
  await appendReadingSummary({
    profileId: params.profileId,
    assistantId: 'general-astro',
    readingType: 'general-astro',
    period: params.period,
    surfacesRead: [],
    summary: params.text,
    transcript: [{ role: 'assistant', text: params.text, timestamp: Date.now() }],
  }).catch(() => {});
}

export async function fetchGeneralAstroDirect(params: {
  period: Exclude<AstroPeriod, 'yearly'>;
  profile: SubjectProfile;
}): Promise<AstroReadingResult | null> {
  const sign = deriveSign(params.profile);
  const context = periodContext(params.period);
  const signLabel = SIGN_TR[sign];
  const cachedReading = await loadGeneralAstroFromCache({
    profileId: params.profile.profileId,
    sign,
    period: params.period,
    periodKey: context.key,
  });
  if (cachedReading) return cachedReading;

  const skyContextJson = JSON.stringify(buildGeneralAstroSkyContext(signLabel, params.period));
  const repeatMemory = await recentGeneralAstroMemory({
    profileId: params.profile.profileId,
    period: params.period,
    signLabel,
  });
  try {
    const text = await fetchServerGeneralAstroCached({
      period: params.period,
      sign,
      periodKey: context.key,
      timezone: context.timezone,
    });
    const sanitizedText = sanitizePublicReadingLanguage(text);
    const reading: AstroReadingResult = {
      text: sanitizedText,
      sign: signLabel,
      timezoneUsed: context.timezone,
      periodKey: context.key,
      cached: true,
      modelName: 'server-general-astro-cache',
    };
    await saveGeneralAstroToCache({ profileId: params.profile.profileId, sign, period: params.period, periodKey: context.key, reading });
    await rememberGeneralAstroReading({ profileId: params.profile.profileId, period: params.period, text: sanitizedText });
    return reading;
  } catch (err: any) {
    try {
      const generated = await generateGeneralAstroWithGemini({
        period: params.period,
        profile: params.profile,
        sign,
        periodKey: context.key,
        periodContextLabel: context.label,
        periodInstruction: context.instruction,
        skyContextJson,
        repeatMemory,
      });
      const sanitizedText = sanitizePublicReadingLanguage(generated.text);
      const reading: AstroReadingResult = {
        text: sanitizedText,
        sign: signLabel,
        timezoneUsed: context.timezone,
        periodKey: context.key,
        cached: false,
        modelName: generated.modelName,
      };
      await saveGeneralAstroToCache({ profileId: params.profile.profileId, sign, period: params.period, periodKey: context.key, reading });
      await rememberGeneralAstroReading({ profileId: params.profile.profileId, period: params.period, text: sanitizedText });
      return reading;
    } catch {}
    const fallback = buildLocalGeneralAstroFallback({
      period: params.period,
      sign,
      label: context.label,
      repeatMemory,
    });
    const sanitizedText = sanitizePublicReadingLanguage(fallback);
    const reading: AstroReadingResult = {
      text: sanitizedText,
      sign: signLabel,
      timezoneUsed: context.timezone,
      periodKey: context.key,
      cached: true,
      modelName: 'local-general-astro-fallback',
    };
    await saveGeneralAstroToCache({ profileId: params.profile.profileId, sign, period: params.period, periodKey: context.key, reading });
    await rememberGeneralAstroReading({ profileId: params.profile.profileId, period: params.period, text: sanitizedText });
    return reading;
  }
}
