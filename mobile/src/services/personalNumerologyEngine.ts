import * as FileSystem from 'expo-file-system/legacy';
import type { SubjectProfile } from '../types/memory';
import { generateGeminiTextDirect } from './geminiDirectService';
import { isRetryableLlmError } from './llmRetryMessages';

export type PersonalNumerologyMode = 'core' | 'period';
export type PersonalNumerologyPeriod = 'monthly';

export type PersonalNumerologyCore = {
  lifePath: number;
  destiny: number;
  soulUrge: number;
  personality: number;
  birthday: number;
  maturity: number;
  personalYear: number;
  personalMonth: number;
  personalDay: number;
};

export type PersonalNumerologyContext = {
  targetDateIso: string;
  calendarYear: number;
  calendarMonth: number;
  calendarMonthName: string;
  monthTotal: number;
  calendarDay: number;
  monthWeeks: Array<{
    label: string;
    startDateIso: string;
    endDateIso: string;
    startTotal: number;
    endTotal: number;
    weekTotal: number;
  }>;
  personTotal?: number;
};

export type PersonalNumerologyReading = {
  text: string;
  core: PersonalNumerologyCore;
  context: PersonalNumerologyContext;
  mode: PersonalNumerologyMode;
  period?: PersonalNumerologyPeriod;
  periodKey?: string;
  source: string;
  cached?: boolean;
  hasCoreReading?: boolean;
};

type CoreCacheFile = {
  schemaVersion: 1;
  entries: Array<{
    profileId: string;
    profileFingerprint: string;
    createdAt: string;
    reading: PersonalNumerologyReading;
  }>;
};

type PeriodCacheFile = {
  schemaVersion: 1;
  entries: Array<{
    assistantId: string;
    profileId: string;
    period: PersonalNumerologyPeriod;
    periodKey: string;
    profileFingerprint: string;
    createdAt: string;
    expiresAt: string;
    reading: PersonalNumerologyReading;
  }>;
};

const DATA_DIR = `${FileSystem.documentDirectory}falci-data/`;
const CORE_CACHE_FILE = `${DATA_DIR}personal-numerology-core-cache.json`;
const PERIOD_CACHE_FILE = `${DATA_DIR}personal-numerology-period-cache.json`;
const MAX_PERIOD_CACHE_ITEMS = 160;
const NUMEROLOGY_CACHE_VERSION = 4;
const ISTANBUL_TIME_ZONE = 'Europe/Istanbul';

const LETTER_VALUES: Record<string, number> = {
  a: 1,
  b: 2,
  c: 3,
  ç: 3,
  d: 4,
  e: 5,
  f: 6,
  g: 7,
  ğ: 7,
  h: 8,
  ı: 9,
  i: 9,
  j: 1,
  k: 2,
  l: 3,
  m: 4,
  n: 5,
  o: 6,
  ö: 6,
  p: 7,
  r: 9,
  s: 1,
  ş: 1,
  t: 2,
  u: 3,
  ü: 3,
  v: 4,
  y: 7,
  z: 8,
};

const VOWELS = new Set(['a', 'e', 'ı', 'i', 'o', 'ö', 'u', 'ü']);
const MASTER_NUMBERS = new Set([11, 22, 33]);
const MONTH_NAMES = [
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

function nowIso() {
  return new Date().toISOString();
}

async function ensureDir(path: string) {
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(path, { intermediates: true });
  }
}

async function readJsonFile<T>(path: string, fallback: T): Promise<T> {
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return fallback;
    return JSON.parse(await FileSystem.readAsStringAsync(path)) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(path: string, value: unknown) {
  await ensureDir(DATA_DIR);
  await FileSystem.writeAsStringAsync(path, JSON.stringify(value, null, 2));
}

function defaultCoreCache(): CoreCacheFile {
  return { schemaVersion: 1, entries: [] };
}

function defaultPeriodCache(): PeriodCacheFile {
  return { schemaVersion: 1, entries: [] };
}

function profileFingerprint(profile: SubjectProfile) {
  return JSON.stringify({
    displayName: profile.displayName,
    birthDate: profile.birth.date,
    version: NUMEROLOGY_CACHE_VERSION,
  });
}

function getIstanbulParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ISTANBUL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value || 0);
  const year = part('year');
  const month = part('month');
  const day = part('day');
  return {
    year,
    month,
    day,
    dateKey: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  };
}

function weekKeyFromParts(year: number, month: number, day: number) {
  const utc = new Date(Date.UTC(year, month - 1, day));
  const weekday = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() - weekday + 1);
  return `${utc.getUTCFullYear()}-W${String(Math.ceil((((utc.getTime() - Date.UTC(utc.getUTCFullYear(), 0, 1)) / 86400000) + 1) / 7)).padStart(2, '0')}`;
}

function periodKey(date = new Date()) {
  const { year, month } = getIstanbulParts(date);
  return `${year}-${String(month).padStart(2, '0')}`;
}

function periodExpiryIso(date = new Date()) {
  const { year, month } = getIstanbulParts(date);
  return new Date(Date.UTC(year, month, 1) - 3 * 60 * 60 * 1000).toISOString();
}

function reduceNumber(value: number): number {
  let current = Math.abs(value);
  while (current > 9 && !MASTER_NUMBERS.has(current)) {
    current = String(current)
      .split('')
      .reduce((sum, digit) => sum + Number(digit), 0);
  }
  return current;
}

function sumDigits(text: string): number {
  return text
    .replace(/\D/g, '')
    .split('')
    .reduce((sum, digit) => sum + Number(digit), 0);
}

function sumDateDigits(dateIso: string): number {
  return sumDigits(dateIso);
}

function normalizeName(name: string): string[] {
  return name
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-zçğıöşü]/g, '')
    .split('');
}

function nameValue(chars: string[], mode: 'all' | 'vowels' | 'consonants'): number {
  return reduceNumber(
    chars.reduce((sum, char) => {
      const isVowel = VOWELS.has(char);
      if (mode === 'vowels' && !isVowel) return sum;
      if (mode === 'consonants' && isVowel) return sum;
      return sum + (LETTER_VALUES[char] || 0);
    }, 0),
  );
}

function dateParts(dateIso: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateIso.split('-').map((part) => Number(part));
  return { year, month, day };
}

function buildContext(targetDate = new Date()): PersonalNumerologyContext {
  const { year, month, day, dateKey } = getIstanbulParts(targetDate);
  const monthTotal = reduceNumber(sumDigits(`${year}-${String(month).padStart(2, '0')}`));
  return {
    targetDateIso: dateKey,
    calendarYear: year,
    calendarMonth: month,
    calendarMonthName: MONTH_NAMES[month - 1],
    monthTotal,
    calendarDay: day,
    monthWeeks: [0, 1, 2, 3].map((index) => {
      const start = new Date(Date.UTC(year, month - 1, 1 + index * 7));
      const end = new Date(Date.UTC(year, month - 1, Math.min(7 + index * 7, new Date(Date.UTC(year, month, 0)).getUTCDate())));
      const startDateIso = start.toISOString().slice(0, 10);
      const endDateIso = end.toISOString().slice(0, 10);
      const startTotal = reduceNumber(sumDateDigits(startDateIso));
      const endTotal = reduceNumber(sumDateDigits(endDateIso));
      return {
        label: `${index + 1}. hafta`,
        startDateIso,
        endDateIso,
        startTotal,
        endTotal,
        weekTotal: reduceNumber(startTotal + endTotal + monthTotal),
      };
    }),
  };
}

function calculateCore(profile: SubjectProfile, context: PersonalNumerologyContext): PersonalNumerologyCore {
  if (!profile.birth.date) {
    throw new Error('Kişisel numeroloji için doğum tarihi gerekli.');
  }
  const birth = dateParts(profile.birth.date);
  const chars = normalizeName(profile.displayName);
  const lifePath = reduceNumber(sumDigits(profile.birth.date));
  const destiny = nameValue(chars, 'all');
  const soulUrge = nameValue(chars, 'vowels');
  const personality = nameValue(chars, 'consonants');
  const birthday = reduceNumber(birth.day);
  const maturity = reduceNumber(lifePath + destiny);
  const personTotal = reduceNumber(lifePath + destiny + soulUrge + personality + birthday + maturity);
  const personalYear = reduceNumber(context.calendarYear + birth.month + birth.day);
  const personalMonth = reduceNumber(personalYear + context.calendarMonth);
  const personalDay = reduceNumber(personalMonth + context.calendarDay);
  context.personTotal = personTotal;
  context.monthWeeks = context.monthWeeks.map((week, index) => ({
    ...week,
    weekTotal: reduceNumber(week.startTotal + week.endTotal + context.monthTotal + personTotal + index + 1),
  }));

  return {
    lifePath,
    destiny,
    soulUrge,
    personality,
    birthday,
    maturity,
    personalYear,
    personalMonth,
    personalDay,
  };
}

function fallbackCoreText(profileName: string, core: PersonalNumerologyCore): string {
  return (
    `${profileName} için temel numeroloji haritasında Yaşam Yolu ${core.lifePath}, Kader/İfade ${core.destiny} ve Ruh Arzusu ${core.soulUrge} ana ekseni kuruyor. ` +
    `Kişilik sayısı ${core.personality} dışarıdan nasıl algılandığını, Doğum Günü sayısı ${core.birthday} doğal yeteneğini, Olgunluk ${core.maturity} ise zamanla güçlenen ana yönünü anlatır.`
  );
}

function weekTone(total: number) {
  const tones: Record<number, string> = {
    1: 'başlatma, karar verme ve kendi sesini netleştirme',
    2: 'ilişkilerde denge, sabır ve karşılıklı duyma',
    3: 'ifade, sosyal temas ve yaratıcı görünürlük',
    4: 'düzen kurma, planı somutlaştırma ve eksik kapatma',
    5: 'hareket, değişim ve esnek kalma',
    6: 'sorumluluk, aile/ilişki dengesi ve özen',
    7: 'içe dönme, analiz ve sezgiyi dinleme',
    8: 'iş, para, sınır ve sonuç alma',
    9: 'tamamlama, bırakma ve duygusal temizlik',
    11: 'sezgisel farkındalık ve ilhamı sakin kullanma',
    22: 'büyük planı gerçekçi adımlara indirme',
    33: 'şefkat, hizmet ve kalpten toparlama',
  };
  return tones[total] || 'ritmi sadeleştirme';
}

function fallbackPeriodText(profileName: string, context: PersonalNumerologyContext): string {
  const intro =
    `${profileName} için ${context.calendarMonthName} ${context.calendarYear} ayı, kişinin temel numeroloji zeminiyle ayın kendi sayısının birleştiği dört haftalık bir akış veriyor. ` +
    `Ayın ana toplamı ${context.monthTotal}; bu yüzden bütün ay boyunca ana mesele ritmi dağıtmadan öncelikleri sadeleştirmek.`;
  const weekLines = context.monthWeeks
    .map((week) => {
      const tone = weekTone(week.weekTotal);
      return `${week.label} (${week.startDateIso} - ${week.endDateIso}): hafta başı toplamı ${week.startTotal}, hafta sonu toplamı ${week.endTotal}; birleşik ritim ${week.weekTotal}. Bu hafta ${tone} öne çıkıyor.`;
    })
    .join('\n\n');
  return `${intro}\n\n${weekLines}\n\nAyın önerisi: ilk hafta niyeti belirle, ikinci hafta ilişki ve iş dilini toparla, üçüncü hafta somut adım at, dördüncü hafta ise ayın dersini kapatıp yeni aya daha temiz gir.`;
}

async function loadCoreFromCache(profileId: string, fingerprint: string): Promise<PersonalNumerologyReading | null> {
  const store = await readJsonFile(CORE_CACHE_FILE, defaultCoreCache());
  const hit = store.entries.find((entry) => entry.profileId === profileId && entry.profileFingerprint === fingerprint);
  return hit ? { ...hit.reading, cached: true, hasCoreReading: true } : null;
}

async function saveCoreToCache(profileId: string, fingerprint: string, reading: PersonalNumerologyReading) {
  const store = await readJsonFile(CORE_CACHE_FILE, defaultCoreCache());
  const nextEntries = store.entries.filter((entry) => entry.profileId !== profileId);
  nextEntries.push({
    profileId,
    profileFingerprint: fingerprint,
    createdAt: nowIso(),
    reading: { ...reading, cached: false, hasCoreReading: true },
  });
  await writeJsonFile(CORE_CACHE_FILE, { schemaVersion: 1, entries: nextEntries });
}

async function loadPeriodFromCache(params: {
  assistantId: string;
  profileId: string;
  period: PersonalNumerologyPeriod;
  periodKeyValue: string;
  fingerprint: string;
}): Promise<PersonalNumerologyReading | null> {
  const store = await readJsonFile(PERIOD_CACHE_FILE, defaultPeriodCache());
  const now = Date.now();
  const hit = store.entries.find(
    (entry) =>
      entry.assistantId === params.assistantId &&
      entry.profileId === params.profileId &&
      entry.period === params.period &&
      entry.periodKey === params.periodKeyValue &&
      entry.profileFingerprint === params.fingerprint &&
      new Date(entry.expiresAt).getTime() > now,
  );
  return hit ? { ...hit.reading, cached: true, period: params.period, periodKey: params.periodKeyValue } : null;
}

async function savePeriodToCache(entry: PeriodCacheFile['entries'][number]) {
  const store = await readJsonFile(PERIOD_CACHE_FILE, defaultPeriodCache());
  const nextEntries = store.entries
    .filter(
      (item) =>
        !(
          item.assistantId === entry.assistantId &&
          item.profileId === entry.profileId &&
          item.period === entry.period &&
          item.periodKey === entry.periodKey &&
          item.profileFingerprint === entry.profileFingerprint
        ),
    )
    .concat(entry)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, MAX_PERIOD_CACHE_ITEMS);
  await writeJsonFile(PERIOD_CACHE_FILE, { schemaVersion: 1, entries: nextEntries });
}

function compactCoreSummary(coreReading: PersonalNumerologyReading | null) {
  if (!coreReading?.text) return null;
  return coreReading.text.replace(/\s+/g, ' ').trim().slice(0, 520);
}

function assistantStyleHint(assistantId: string, assistantLabel: string) {
  const styles: Record<string, string> = {
    'bahar-hanim': 'Bahar Hanım tonu: modern, rafine, farkındalık dili yüksek, sıcak ama net.',
    'mert-bey': 'Mert Bey tonu: analitik, sade, dost gibi yakın ve toparlayıcı.',
    'durdane-hanim': 'Dürdane Hanım tonu: anaç, sıcak, sezgisel ve koruyucu.',
    'hikmet-bey': 'Hikmet Bey tonu: babacan, felsefi, sakin ve psikolojik derinliği olan.',
    caner: 'Caner tonu: sezgisel, yumuşak, sanatsal ve hafif melankolik.',
  };
  return styles[assistantId] || `${assistantLabel || 'Falcı'} tonu: sıcak, doğal ve persona içinde kalan.`;
}

function coreBaseNumbers(core: PersonalNumerologyCore) {
  return {
    lifePath: core.lifePath,
    destiny: core.destiny,
    soulUrge: core.soulUrge,
    personality: core.personality,
    birthday: core.birthday,
    maturity: core.maturity,
  };
}

function monthlyNumerologyContext(core: PersonalNumerologyCore, context: PersonalNumerologyContext) {
  return {
    calendarYear: context.calendarYear,
    calendarMonth: context.calendarMonth,
    calendarMonthName: context.calendarMonthName,
    monthTotal: context.monthTotal,
    personTotal: context.personTotal || reduceNumber(core.lifePath + core.destiny + core.soulUrge + core.personality + core.birthday + core.maturity),
    monthWeeks: context.monthWeeks,
  };
}

function buildGeminiPayload(params: {
  profileName: string;
  assistantId: string;
  assistantLabel: string;
  mode: PersonalNumerologyMode;
  core: PersonalNumerologyCore;
  context: PersonalNumerologyContext;
  coreSummary: string | null;
  hasCoreReading: boolean;
}) {
  const styleHint = assistantStyleHint(params.assistantId, params.assistantLabel);
  const systemText =
    "You are a Turkish personal numerology reader. Use only the provided on-device numerology JSON. Do not mention general divination numerology cards. Stay inside the persona style, but never introduce yourself.";
  const numerologyJson = params.mode === 'core' ? coreBaseNumbers(params.core) : monthlyNumerologyContext(params.core, params.context);
  const taskPrompt =
    params.mode === 'core'
      ? [
          'Türkçe yaz. Başlık atma.',
          'Yalnızca ve yalnızca temel numeroloji haritasını yorumla: Yaşam Yolu, Kader/İfade, Ruh Arzusu, Kişilik, Doğum Günü ve Olgunluk.',
          'Kişisel Yıl, Kişisel Ay, Kişisel Gün, aylık akış, haftalık akış, bugünkü enerji veya dönemsel yorum yazmak kesinlikle yasak.',
          'Bu okuma doğum haritası gibi ömürlük saklanacak; geçici tarih, bugün, bu hafta, bu ay veya bu yıl dili kullanma.',
          'Akıcı, premium ve kişisel bir yorum ver; sayıların her birini ayrı ayrı ezber bilgi gibi anlatmadan ana karakter örüntüsüne bağla.',
        ].join(' ')
      : [
          'Türkçe yaz. Başlık atma. Bu sadece aylık numeroloji yorumu.',
          'Günlük, haftalık veya yıllık okuma yazma. Gün gün yorumlama; tek tek günlere inme.',
          'Kişinin temel sayı haritasını arka planda dikkate al ama metinde Yaşam Yolu, Kader/İfade, Ruh Arzusu, Kişilik, Doğum Günü veya Olgunluk sayılarını tekrar etme.',
          'Metinde Kişisel Yıl, Kişisel Ay veya Kişisel Gün sayılarını söyleme. Sayı raporu değil, yorum yaz.',
          'Ayın monthTotal ve personTotal değerlerini ana zemin olarak kullan.',
          'Her hafta için monthWeeks içindeki startTotal, endTotal ve weekTotal değerlerini karşılaştırarak ayrı bir yorum üret.',
          'Hafta tarihlerini kullan ama hesap formülünü anlatma; sadece her haftanın karakterini, dikkat edilmesi gereken alanı ve önerisini yaz.',
          `Temel numeroloji okuması daha önce yapılmış mı: ${params.hasCoreReading}.`,
          params.coreSummary
            ? `Temel harita özeti arka plan için: ${params.coreSummary}`
            : 'Temel harita özeti yok; on-device gelen compact JSON arka plan olarak kullanılacak.',
          'Kişiye net öneri ver: ayın başında neyi başlatmalı, ortasında neyi toparlamalı, sonunda neyi kapatmalı.',
          'Current date context dışındaki hiçbir yıl veya ay adını yazma.',
        ].join(' ');

  return {
    system_instruction: { parts: [{ text: systemText }] },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: [
              `Profile: ${params.profileName || 'Profil'}`,
              `Assistant style: ${styleHint}`,
              `Mode: ${params.mode}`,
              `Numerology JSON calculated on-device:\n${JSON.stringify(numerologyJson)}`,
              taskPrompt,
            ].join('\n\n'),
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.72,
      maxOutputTokens: params.mode === 'core' ? 750 : 900,
    },
  };
}

export function hasRequiredNumerologyInputs(profile: SubjectProfile): boolean {
  return Boolean(profile.birth.date && profile.displayName.trim());
}

export async function createPersonalNumerologyReading(params: {
  profile: SubjectProfile;
  assistantId: string;
  assistantLabel: string;
  mode: PersonalNumerologyMode;
}): Promise<PersonalNumerologyReading> {
  const context = buildContext();
  const core = calculateCore(params.profile, context);
  const fingerprint = profileFingerprint(params.profile);
  const cachedCore = await loadCoreFromCache(params.profile.profileId, fingerprint);

  if (params.mode === 'core' && cachedCore) {
    return cachedCore;
  }

  const selectedPeriod: PersonalNumerologyPeriod | undefined = params.mode === 'period' ? 'monthly' : undefined;
  const selectedPeriodKey = selectedPeriod ? periodKey() : undefined;
  if (params.mode === 'period' && selectedPeriod && selectedPeriodKey) {
    const cachedPeriod = await loadPeriodFromCache({
      assistantId: params.assistantId,
      profileId: params.profile.profileId,
      period: selectedPeriod,
      periodKeyValue: selectedPeriodKey,
      fingerprint,
    });
    if (cachedPeriod) {
      return cachedPeriod;
    }
  }

  const hasCoreReading = Boolean(cachedCore);
  try {
    const geminiPayload = buildGeminiPayload({
      profileName: params.profile.displayName,
      assistantId: params.assistantId,
      assistantLabel: params.assistantLabel,
      mode: params.mode,
      core,
      context,
      coreSummary: params.mode === 'period' ? compactCoreSummary(cachedCore) : null,
      hasCoreReading,
    });
    const payload = await generateGeminiTextDirect(geminiPayload);
    if (payload.text) {
      const reading: PersonalNumerologyReading = {
        text: payload.text,
        core,
        context,
        mode: params.mode,
        period: selectedPeriod,
        periodKey: selectedPeriodKey,
        source: 'gemini-direct-personal-numerology',
        cached: false,
        hasCoreReading,
      };
      if (params.mode === 'core') {
        await saveCoreToCache(params.profile.profileId, fingerprint, reading);
      } else if (selectedPeriod && selectedPeriodKey) {
        await savePeriodToCache({
          assistantId: params.assistantId,
          profileId: params.profile.profileId,
          period: selectedPeriod,
          periodKey: selectedPeriodKey,
          profileFingerprint: fingerprint,
          createdAt: nowIso(),
          expiresAt: periodExpiryIso(),
          reading,
        });
      }
      return reading;
    }
  } catch (err) {
    if (isRetryableLlmError(err)) {
      throw err;
    }
    // Backend yoksa yerel fallback ile ekran boş kalmasın.
  }

  const fallback: PersonalNumerologyReading = {
    text:
      params.mode === 'core'
        ? fallbackCoreText(params.profile.displayName, core)
        : fallbackPeriodText(params.profile.displayName, context),
    core,
    context,
    mode: params.mode,
    period: selectedPeriod,
    periodKey: selectedPeriodKey,
    source: 'local-fallback',
    cached: false,
    hasCoreReading,
  };
  if (params.mode === 'core') {
    await saveCoreToCache(params.profile.profileId, fingerprint, fallback);
  } else if (selectedPeriod && selectedPeriodKey) {
    await savePeriodToCache({
      assistantId: params.assistantId,
      profileId: params.profile.profileId,
      period: selectedPeriod,
      periodKey: selectedPeriodKey,
      profileFingerprint: fingerprint,
      createdAt: nowIso(),
      expiresAt: periodExpiryIso(),
      reading: fallback,
    });
  }
  return fallback;
}
