import type { SubjectProfile } from '../types/memory';
import type { AstroPeriod, AstroReadingResult } from './astroEngine';
import { buildAnimalProfileInstructionFromProfile, isAnimalProfile } from './animalProfilePrompt';
import { sanitizePublicReadingLanguage } from './personaClosingService';
import { AGENT_API_URL } from '../config/constants';

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
    [
      'Yükselen veya kişiye özel doğum haritası bilgisi varmış gibi davranma.',
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
}) {
  const signLabel = SIGN_TR[params.sign];
  if (params.period === 'daily') {
    return `${signLabel} için bugün genel hava daha sade ve toparlayıcı ilerliyor. Duygusal tarafta acele tepki vermek yerine önce gözlem yapmak, ilişkilerde gereksiz yanlış anlamaları azaltabilir. İş ve para tarafında küçük ama net bir düzenleme günü rahatlatır; büyük kararları ise kanıt ve zamanla tartmak daha iyi olur. Günün önerisi, enerjini tek bir önceliğe toplamak ve akşam saatlerinde zihnini dağıtan küçük işleri kapatmak.`;
  }
  if (params.period === 'weekly') {
    return `${signLabel} için ${params.label} haftasının genel ritmi parça parça netleşme üzerine kurulu. Haftanın başında iletişim ve planlama öne çıkarken, orta bölümde ilişkilerde denge ve karşılıklı beklentiler daha görünür olabilir. İş ve para tarafında hızlı büyütmek yerine mevcut düzeni sağlamlaştırmak destekleyici duruyor. Hafta sonuna doğru dinlenme, sadeleşme ve bir konuyu kapatma isteği artabilir.`;
  }
  return `${signLabel} için ${params.label} genel olarak yön belirleme ve yük azaltma teması taşıyor. Ayın ilk kısmında gündelik düzen, iş akışı ve kişisel sorumluluklar öne çıkabilir. Orta bölümde ilişkilerde açıklık, aile veya yakın çevreyle uyum arayışı belirginleşir. Ay sonuna doğru daha sade hedefler seçmek, enerjiyi dağıtmadan ilerlemeyi kolaylaştırır. Bu yorum genel Güneş burcu ritmidir; kişisel doğum haritası yerine kolektif eğilimi anlatır.`;
}

export async function fetchGeneralAstroDirect(params: {
  period: Exclude<AstroPeriod, 'yearly'>;
  profile: SubjectProfile;
}): Promise<AstroReadingResult | null> {
  const sign = deriveSign(params.profile);
  const context = periodContext(params.period);
  try {
    const text = await fetchServerGeneralAstroCached({
      period: params.period,
      sign,
      periodKey: context.key,
      timezone: context.timezone,
    });
    return {
      text: sanitizePublicReadingLanguage(text),
      sign: SIGN_TR[sign],
      timezoneUsed: context.timezone,
      periodKey: context.key,
      cached: true,
      modelName: 'server-general-astro-cache',
    };
  } catch (err: any) {
    const fallback = buildLocalGeneralAstroFallback({
      period: params.period,
      sign,
      label: context.label,
    });
    return {
      text: sanitizePublicReadingLanguage(fallback),
      sign: SIGN_TR[sign],
      timezoneUsed: context.timezone,
      periodKey: context.key,
      cached: true,
      modelName: 'local-general-astro-fallback',
    };
  }
}
