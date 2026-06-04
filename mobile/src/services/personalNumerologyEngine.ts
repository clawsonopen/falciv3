import * as FileSystem from 'expo-file-system/legacy';
import type { ProfileMemorySnippet, SubjectProfile } from '../types/memory';
import {
  PERSONAL_FOLLOW_UP_MAX_OUTPUT_TOKENS,
  PERSONAL_FOLLOW_UP_TOKEN_INSTRUCTION,
  PERSONAL_INITIAL_READING_MAX_OUTPUT_TOKENS,
  PERSONAL_INITIAL_READING_TOKEN_INSTRUCTION,
} from '../config/llmTokenPolicy';
import { generateGeminiTextDirect } from './geminiDirectService';
import { isRetryableLlmError } from './llmRetryMessages';
import { FORTUNE_PERSONA_DATA } from './fortunePersonaData';
import { selectNumerologyLifeEvents } from './fortuneSpecificityBank';
import { loadAccountState } from './profileMemoryService';
import {
  appendHealthProfessionalReminder,
  completeWithRememberedPersonaClosing,
  sanitizeGenderedAddress,
  sanitizePublicReadingLanguage,
  userAskedHealthConcern,
} from './personaClosingService';
import { buildAnimalProfileInstructionFromMemory, buildAnimalProfileInstructionFromProfile, isAnimalProfile, isAnimalMemorySnippet } from './animalProfilePrompt';
import { formatPromptMemoryPack } from './memoryPromptPackFormatter';
import { formatPetMentionMemoryContext, formatStandardPersonalMemoryContext } from './personalMemoryPromptContext';
import { cleanFollowUpReply, FOLLOW_UP_CHAT_CONTRACT } from './followUpResponseService';

export type PersonalNumerologyMode = 'core' | 'daily' | 'weekly' | 'monthly';
export type PersonalNumerologyPeriod = Exclude<PersonalNumerologyMode, 'core'>;
const PERSONAL_NUMEROLOGY_PERSONA_PROMPT_VERSION = 6;

function formatRelevantMemory(snippet?: ProfileMemorySnippet | null, questionText?: string | null) {
  const items = snippet?.relevantObservations || [];
  const memoryPack = formatPromptMemoryPack(snippet);
  const standardMemory = formatStandardPersonalMemoryContext({
    profileName: snippet?.profileName,
    readingLabel: 'kişisel numeroloji',
    memorySnippet: snippet,
    questionText,
    includePromptPack: false,
  });
  const observationText = items
    .slice(0, 5)
    .map((item) => {
      const parts = [`${item.category || item.group} / ${item.subgroup}`, item.title, item.summary];
      if (item.timeText) parts.push(`zaman=${item.timeText}`);
      if (item.placeText) parts.push(`yer=${item.placeText}`);
      if (item.emotions.length) parts.push(`duygu=${item.emotions.slice(0, 3).join(', ')}`);
      return parts.join(' | ');
    })
    .join('\n');
  return [memoryPack, standardMemory, observationText].filter(Boolean).join('\n');
}

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
  dayTotal: number;
  weekTotal: number;
  weekStartDateIso: string;
  weekEndDateIso: string;
  weekDays: Array<{
    label: string;
    dateIso: string;
    dayTotal: number;
    personalDayTotal?: number;
  }>;
  monthWeeks: Array<{
    label: string;
    startDateIso: string;
    endDateIso: string;
    startTotal: number;
    endTotal: number;
    weekTotal: number;
    personalWeekTotal?: number;
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
  specificityUsage?: {
    events?: Array<{ group: string; label: string }>;
  };
  modelName?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
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
const NUMEROLOGY_CACHE_VERSION = 6;
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

function coreReadingFingerprint(profile: SubjectProfile) {
  return JSON.stringify({
    profile: profileFingerprint(profile),
    reading: 'personal-numerology-core-lifelong',
  });
}

function periodReadingFingerprint(profile: SubjectProfile, assistantId: string) {
  return JSON.stringify({
    profile: profileFingerprint(profile),
    assistantId,
    personaPromptVersion: PERSONAL_NUMEROLOGY_PERSONA_PROMPT_VERSION,
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

function isoDateFromUtc(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function weekStartUtc(year: number, month: number, day: number) {
  const utc = new Date(Date.UTC(year, month - 1, day));
  const weekday = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() - weekday + 1);
  return utc;
}

function weekKeyFromParts(year: number, month: number, day: number) {
  const utc = weekStartUtc(year, month, day);
  const weekOne = new Date(Date.UTC(utc.getUTCFullYear(), 0, 4));
  const weekOneWeekday = weekOne.getUTCDay() || 7;
  weekOne.setUTCDate(weekOne.getUTCDate() - weekOneWeekday + 1);
  const week = Math.floor((utc.getTime() - weekOne.getTime()) / 604800000) + 1;
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function periodKey(mode: PersonalNumerologyPeriod, date = new Date()) {
  const { year, month, day, dateKey } = getIstanbulParts(date);
  if (mode === 'daily') return dateKey;
  if (mode === 'weekly') return weekKeyFromParts(year, month, day);
  return `${year}-${String(month).padStart(2, '0')}`;
}

function periodExpiryIso(mode: PersonalNumerologyPeriod, date = new Date()) {
  const { year, month, day } = getIstanbulParts(date);
  if (mode === 'daily') {
    return new Date(Date.UTC(year, month - 1, day + 1) - 3 * 60 * 60 * 1000).toISOString();
  }
  if (mode === 'weekly') {
    const start = weekStartUtc(year, month, day);
    return new Date(addUtcDays(start, 7).getTime() - 3 * 60 * 60 * 1000).toISOString();
  }
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
  const weekStart = weekStartUtc(year, month, day);
  const weekDays = Array.from({ length: 7 }).map((_, index) => {
    const dateIso = isoDateFromUtc(addUtcDays(weekStart, index));
    return {
      label: ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'][index],
      dateIso,
      dayTotal: reduceNumber(sumDateDigits(dateIso)),
    };
  });
  const monthTotal = reduceNumber(sumDigits(`${year}-${String(month).padStart(2, '0')}`));
  return {
    targetDateIso: dateKey,
    calendarYear: year,
    calendarMonth: month,
    calendarMonthName: MONTH_NAMES[month - 1],
    monthTotal,
    calendarDay: day,
    dayTotal: reduceNumber(sumDateDigits(dateKey)),
    weekTotal: reduceNumber(weekDays.reduce((sum, item) => sum + item.dayTotal, 0)),
    weekStartDateIso: isoDateFromUtc(weekStart),
    weekEndDateIso: isoDateFromUtc(addUtcDays(weekStart, 6)),
    weekDays,
    monthWeeks: Array.from({ length: Math.ceil(new Date(Date.UTC(year, month, 0)).getUTCDate() / 7) }).map((_, index) => {
      const start = new Date(Date.UTC(year, month - 1, 1 + index * 7));
      const end = new Date(Date.UTC(year, month - 1, Math.min(7 + index * 7, new Date(Date.UTC(year, month, 0)).getUTCDate())));
      const startDateIso = isoDateFromUtc(start);
      const endDateIso = isoDateFromUtc(end);
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
  context.dayTotal = reduceNumber(context.dayTotal + personTotal + personalDay);
  context.weekTotal = reduceNumber(context.weekTotal + personTotal + personalMonth);
  context.weekDays = context.weekDays.map((dayItem, index) => ({
    ...dayItem,
    personalDayTotal: reduceNumber(dayItem.dayTotal + personTotal + personalMonth + index + 1),
  }));
  context.monthWeeks = context.monthWeeks.map((week, index) => ({
    ...week,
    weekTotal: reduceNumber(week.startTotal + week.endTotal + context.monthTotal),
    personalWeekTotal: reduceNumber(week.startTotal + week.endTotal + context.monthTotal + personTotal + index + 1),
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

function fallbackPeriodText(profileName: string, mode: PersonalNumerologyMode, context: PersonalNumerologyContext): string {
  if (mode === 'daily') {
    return `${profileName} için bugünün kişisel numeroloji ritmi ${context.dayTotal} sayısında toplanıyor. Bu sayı, günü daha net seçimler, sade bir öncelik listesi ve küçük ama kararlı bir adımla taşımayı anlatıyor.\n\nBugün aceleyle her yere yetişmek yerine tek bir ana meseleyi seçmek daha iyi çalışır. Günün sonunda da neyi tamamladığını görmek, zihni daha temiz kapatmana yardım eder.`;
  }
  if (mode === 'weekly') {
    const days = context.weekDays
      .map((item) => `${item.label} ${item.personalDayTotal || item.dayTotal} ritmiyle ${weekTone(item.personalDayTotal || item.dayTotal)} tarafını öne çıkarır`)
      .join(', ');
    return `${profileName} için bu haftanın kişisel numeroloji zemini ${context.weekTotal} sayısında birleşiyor; ana tema ${weekTone(context.weekTotal)}.\n\n${days}. Haftanın önerisi, her günü ayrı bir yarış gibi değil, birbirini tamamlayan küçük adımlar gibi taşımak.`;
  }
  const intro =
    `${profileName} için ${context.calendarMonthName} ${context.calendarYear} ayı, kişinin temel numeroloji zeminiyle ayın kendi sayısının birleştiği dört haftalık bir akış veriyor. ` +
    `Ayın ana toplamı ${context.monthTotal}; bu yüzden bütün ay boyunca ana mesele ritmi dağıtmadan öncelikleri sadeleştirmek.`;
  const weekLines = context.monthWeeks
    .map((week) => {
      const tone = weekTone(week.personalWeekTotal || week.weekTotal);
      return `${week.label} (${week.startDateIso} - ${week.endDateIso}): hafta başı toplamı ${week.startTotal}, hafta sonu toplamı ${week.endTotal}; kişisel birleşik ritim ${week.personalWeekTotal || week.weekTotal}. Bu hafta ${tone} öne çıkıyor.`;
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

export async function getCachedPersonalNumerologyReading(params: {
  profile: SubjectProfile;
  assistantId: string;
  mode: PersonalNumerologyMode;
}): Promise<PersonalNumerologyReading | null> {
  const context = buildContext();
  const fingerprint = params.mode === 'core'
    ? coreReadingFingerprint(params.profile)
    : periodReadingFingerprint(params.profile, params.assistantId);
  const cachedCore = await loadCoreFromCache(params.profile.profileId, fingerprint);
  if (params.mode === 'core') {
    if (cachedCore) return cachedCore;
    const core = calculateCore(params.profile, context);
    const state = await loadAccountState().catch(() => null);
    const existing = state?.readings.find(
      (reading) =>
        reading.profileId === params.profile.profileId &&
        reading.readingType === 'personal-numerology' &&
        !reading.period &&
        reading.assistantId === params.assistantId,
    );
    const existingText = existing?.transcript?.find((message) => message.role === 'assistant')?.text || '';
    if (!existingText) return null;
    const restored: PersonalNumerologyReading = {
      text: existingText,
      core,
      context,
      mode: 'core',
      source: 'reading-history-personal-numerology-core',
      cached: true,
      hasCoreReading: true,
    };
    await saveCoreToCache(params.profile.profileId, fingerprint, restored).catch(() => {});
    return restored;
  }
  return null;
}

function compactCoreSummary(coreReading: PersonalNumerologyReading | null) {
  if (!coreReading?.text) return null;
  return coreReading.text.replace(/\s+/g, ' ').trim().slice(0, 520);
}

function sanitizeAffectionateRepetition(text: string) {
  return (text || '')
    .replace(/\b(canım|tatlım|güzelim|evladım|yavrum)([\s,;:]+\1\b)+/giu, '$1')
    .replace(/\b(canım|tatlım|güzelim|evladım|yavrum),?\s+([^.?!]{0,80}?)\b\1\b/giu, '$1, $2')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function cleanNumerologyText(text: string) {
  return sanitizePublicReadingLanguage(sanitizeAffectionateRepetition(text));
}

function addressPolicyForProfile(profile: SubjectProfile, profileName: string) {
  if (isAnimalProfile(profile)) {
    return [
      buildAnimalProfileInstructionFromProfile(profile),
      'Hitap modu: seçili profil evcil hayvan. Metin boyunca hayvanı üçüncü tekil şahısla anlat; hesap sahibine hayvanın sahibi/refakatçisi olarak öneri ver.',
      'Sayısal yorumu insan kariyeri, romantik ilişki, evlilik, okul veya para kazanma eksenine çevirme; hayvanın mizacı, rutinleri, ev içi enerjisi ve sahibiyle bağı üzerinden yorumla.',
    ].join(' ');
  }
  const isSelf = profile.isPrimary || profile.relationshipPrimary === 'kendi';
  const genderHint = profile.gender
    ? `Profil cinsiyeti: ${profile.gender}; cinsiyetli hitap seçerken buna uy.`
    : 'Profil cinsiyeti bilinmiyor; cinsiyetli hitap kullanma.';
  if (isSelf) {
    return [
      'Hitap modu: seçili profil hesap sahibinin kendisi.',
      'Metin boyunca doğrudan ve tutarlı biçimde "sen" dili kullan; üçüncü tekil şahsa dönme.',
      'Profil adını rapor gibi tekrar etme.',
      genderHint,
    ].join(' ');
  }
  return [
    `Hitap modu: bu okuma hesap sahibinden farklı biri için; seçili profil ${profileName || 'bu kişi'}.`,
    'Metin boyunca üçüncü tekil şahıs kullan; bu kişiye veya hesap sahibine sonradan "sen" diye dönme.',
    'Gerekirse profil adını doğal biçimde kullan.',
    genderHint,
  ].join(' ');
}

function addressPolicyFromMemory(profileName: string, snippet?: ProfileMemorySnippet | null) {
  if (!snippet) {
    return 'Hitap modunu önceki kişisel numeroloji yorumuyla tutarlı sürdür; aynı cevap içinde üçüncü tekil şahıs ve sen dili arasında geçiş yapma.';
  }
  if (isAnimalMemorySnippet(snippet)) {
    return [
      buildAnimalProfileInstructionFromMemory(snippet),
      'Hitap modu: seçili profil evcil hayvan. Metin boyunca hayvanı üçüncü tekil şahısla anlat; hesap sahibine hayvanın sahibi/refakatçisi olarak öneri ver.',
      'Sayısal yorumu insan kariyeri, romantik ilişki, evlilik, okul, para kazanma veya yetişkin insan psikolojisi eksenine çevirme; hayvanın mizacı, rutinleri, ev içi enerjisi, duyuları ve sahibiyle bağı üzerinden yorumla.',
    ].join(' ');
  }
  const genderHint = snippet.profileGender
    ? `Profil cinsiyeti: ${snippet.profileGender}; cinsiyetli hitap seçerken buna uy.`
    : 'Profil cinsiyeti bilinmiyor; cinsiyetli hitap kullanma.';
  if (snippet.isSelf) {
    return [
      'Hitap modu: seçili profil hesap sahibinin kendisi.',
      'Metin boyunca doğrudan ve tutarlı biçimde "sen" dili kullan; üçüncü tekil şahsa dönme.',
      genderHint,
    ].join(' ');
  }
  return [
    `Hitap modu: bu okuma hesap sahibinden farklı biri için; seçili profil ${profileName || snippet.profileName || 'bu kişi'}.`,
    'Metin boyunca üçüncü tekil şahıs kullan; bu kişiye veya hesap sahibine sonradan "sen" diye dönme.',
    genderHint,
  ].join(' ');
}

function assistantStyleHint(assistantId: string) {
  const styles: Record<string, string> = {
    selin: 'Modern rafine ton: farkındalık dili yüksek; sayıları psikolojik içgörüye dönüştürür.',
    berk: 'Modern analitik ton: sade, dost gibi yakın; sayıları pratik karar ve plan diline çevirir.',
    suzan: 'Anaç mahalle tonu: sıcak, sezgisel ve koruyucu; eski usul bilgelik sıcaklığı vardır ama şefkat hitaplarını abartmaz.',
    teoman: 'Babacan öğretmen tonu: felsefi, sakin ve psikolojik derinliği olan; sayıları hayat dersi ve ölçülü öğüt gibi yorumlar.',
    arin: 'Sezgisel kuir ton: yumuşak, sanatsal ve hafif melankolik; sayıları duygu ritmi ve iç ses olarak okur.',
    ayse: 'Bilge doğa tonu: sakin, şefkatli ve köklendirici; sayıları sabır, bereket ve iç denge diliyle okur.',
    deniz: 'Sosyal dinamik tonu: enerjik, zeki ve yakın; sayıları çevre, ilişki alt metni ve sosyal ritim gibi okur.',
  };
  return styles[assistantId] || 'Seçili persona tonu: sıcak, doğal ve karakter içinde kalan.';
}

const NON_NUMEROLOGY_PERSONA_DOMAIN_TERMS =
  /kahve|fincan|telve|tabak|görsel|fotoğraf|avuç|el okuması|el çizg|çizgi|tarot|kart|melek kart|rune|i ching|hexagram/i;

function domainNeutralPersonaSignature(assistantId: string) {
  const signatures: Record<string, string> = {
    'selin': [
      'Modern, rafine, sezgisi güçlü ama cümleleri temiz ve kontrollü bir yorumcu gibi konuşur.',
      'Psikolojik farkındalık, iç düzen, ilişki dinamiği ve kişinin kendi seçim gücü öne çıkar.',
      'Süslemeyi abartmaz; zarif, net, premium ve sakin bir içgörü dili kurar.',
    ].join(' '),
    'berk': [
      'Analitik, sade, arkadaş gibi yakın ve toparlayıcı konuşur.',
      'Belirsizliği pratik adımlara çevirir; "şunu şöyle düşün" hissi veren net, güven veren bir ritmi vardır.',
      'Duyguyu küçümsemeden, çözüm ve plan tarafını görünür kılar.',
    ].join(' '),
    'suzan': [
      'Anaç, sıcak, sezgisel ve koruyucu konuşur; eski usul bilgelik hissi verir ama hiçbir sembolik araca yaslanmaz.',
      'Hane, kalp, niyet, kısmet, yol, yakın çevre ve iç direnç gibi hayat alanlarını doğal ve çeşitli biçimde okuyabilir.',
      'Şefkatli hitapları ölçülü kullanır; telaş, yük ve koşturma temasına takılı kalmaz.',
    ].join(' '),
    'teoman': [
      'Babacan, sakin, felsefi ve psikolojik derinliği olan bir sesle konuşur.',
      'Cümleleri ölçülü öğüt, hayat tecrübesi ve iç denge hissi taşır.',
      'Keskin hüküm yerine ağırbaşlı sezgi, sabır, erdem ve karar olgunluğu verir.',
    ].join(' '),
    arin: [
      'Sezgisel, yumuşak, sanatsal ve hafif melankolik konuşur.',
      'Duygu ritmi, iç ses, atmosfer, kırılgan umut ve estetik sezgi öne çıkar.',
      'Cümleleri şiirsel olabilir ama anlaşılır kalır; sembolik araç değil insanın iç dünyası üzerinden imge kurar.',
    ].join(' '),
  };
  return signatures[assistantId] || 'Sıcak, doğal, tutarlı ve seçili yorumcunun kendine özgü hitap ritmini taşıyan bir yorum dili kullanır.';
}

function numerologySafePersonaText(text?: string) {
  return (text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !NON_NUMEROLOGY_PERSONA_DOMAIN_TERMS.test(line.toLocaleLowerCase('tr-TR')))
    .join('\n');
}

function assistantPersonaContext(assistantId: string) {
  const identity = FORTUNE_PERSONA_DATA[assistantId as keyof typeof FORTUNE_PERSONA_DATA];
  if (!identity?.systemBody) return '';
  const voice = numerologySafePersonaText(
    identity.systemBody.match(/# Voice And Temperament\n\n([\s\S]*?)(?:\n\n# |$)/)?.[1]?.trim()
  );
  return [
    `Persona adı: ${identity.displayName}`,
    `İmza üslup:\n${domainNeutralPersonaSignature(assistantId)}`,
    voice ? `Ses ve mizaç (yalnızca üslup için):\n${voice}` : '',
    'Numeroloji sınırı: Persona yalnızca ses, hitap, ritim ve tavır olarak taşınır; kahve, fincan, telve, tabak, avuç içi, el çizgisi, görsel, kart, tarot veya başka sembolik araç dili kullanılmaz.',
  ].filter(Boolean).join('\n\n');
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

function periodNumerologyContext(mode: PersonalNumerologyMode, core: PersonalNumerologyCore, context: PersonalNumerologyContext, events: Array<{ group: string; label: string }>) {
  const personTotal = context.personTotal || reduceNumber(core.lifePath + core.destiny + core.soulUrge + core.personality + core.birthday + core.maturity);
  if (mode === 'daily') {
    return {
      targetDateIso: context.targetDateIso,
      calendarYear: context.calendarYear,
      calendarMonthName: context.calendarMonthName,
      baseDayTotal: reduceNumber(sumDateDigits(context.targetDateIso)),
      personTotal,
      personalDayTotal: context.dayTotal,
      suggestedLifeEvents: events,
    };
  }
  if (mode === 'weekly') {
    return {
      weekStartDateIso: context.weekStartDateIso,
      weekEndDateIso: context.weekEndDateIso,
      baseWeekTotal: context.weekTotal,
      personTotal,
      weekDays: context.weekDays,
      suggestedLifeEvents: events,
    };
  }
  return {
    calendarYear: context.calendarYear,
    calendarMonth: context.calendarMonth,
    calendarMonthName: context.calendarMonthName,
    monthTotal: context.monthTotal,
    personTotal,
    monthWeeks: context.monthWeeks,
    suggestedLifeEvents: events,
  };
}

function buildGeminiPayload(params: {
  profileName: string;
  assistantId: string;
  assistantLabel: string;
  profile: SubjectProfile;
  mode: PersonalNumerologyMode;
  core: PersonalNumerologyCore;
  context: PersonalNumerologyContext;
  coreSummary: string | null;
  hasCoreReading: boolean;
  memorySnippet?: ProfileMemorySnippet | null;
}) {
  const styleHint = assistantStyleHint(params.assistantId);
  const personaContext = assistantPersonaContext(params.assistantId);
  const isAnimalNumerology = isAnimalProfile(params.profile);
  const standardMemory = formatStandardPersonalMemoryContext({
    profileName: params.profileName,
    readingLabel: 'kişisel numeroloji',
    memorySnippet: params.memorySnippet,
    includePromptPack: false,
  });
  const eventNumbers =
    params.mode === 'core'
      ? [params.core.lifePath, params.core.destiny, params.core.maturity]
      : params.mode === 'daily'
        ? [params.context.dayTotal, params.core.personalDay, params.core.lifePath]
        : params.mode === 'weekly'
          ? [params.context.weekTotal, ...params.context.weekDays.slice(0, 2).map((item) => item.personalDayTotal || item.dayTotal)]
          : [
              params.context.monthTotal,
              ...params.context.monthWeeks.slice(0, 2).map((item) => item.personalWeekTotal || item.weekTotal),
            ];
  const lifeEvents =
    params.mode === 'core'
      ? []
      : selectNumerologyLifeEvents({
          seed: `${params.profile.profileId}:${params.assistantId}:${params.mode}:${params.context.targetDateIso}`,
          numbers: eventNumbers,
          memorySnippet: params.memorySnippet,
          count: 3,
        });
  const systemText = [
    'Seçili persona kişiye özel numerolojide yalnızca ses, hitap ritmi ve konuşma sıcaklığını belirler.',
    'Use only the provided on-device numerology JSON. Do not mention general divination numerology cards.',
    'Markdown biçimlendirmesi, yıldızlı vurgu, madde imi, numaralı liste, emoji, ikon veya dekoratif sembol üretme.',
    'Numeroloji yorumunda kahve, fincan, telve, tabak, avuç içi, el çizgisi, görsel, kart, tarot veya başka sembolik araç dili kullanma; sayılar, profil ve dönem akışı üzerinden konuş.',
    'Persona sesi teknik numeroloji dilinin üstünde hissedilmeli: kelime seçimi, ritim, hitap ve tavsiye tonu seçili tona ait olmalı. Kullanıcıya görünen metinde kendi adını, public labelını veya rolünü yazma.',
    'Kullanıcıya görünen metinde hukuken kesin gelecek iddiası kurma; "yorum", "okuma", "sembolik ritüel", "sembolik yorum", "izlenim", "olasılık", "eğilim" dili kullan.',
    'Sağlık ve finans alanlarında spesifik tavsiye verme. İnsan sağlığıyla ilgili endişede doktora/uygun sağlık uzmanına, hayvan sağlığıyla ilgili endişede veterinere görünmeyi nazikçe öner.',
    '"Şunu ye/iç geçer", "kesin geçecek", "kesin iyileşecek", ilaç/doz/tedavi/beslenme reçetesi veya kesin sonuç dili yasak.',
    'Hafıza veya önceki okuma kaynağını açık etme; "önceki okumanda", "hafızanda", "sana daha önce çıkmıştı" gibi cümleler kurma.',
    'Use profile and prior reading data as silent background unless the user explicitly asks about the source. Keep the address mode consistent throughout the answer.',
    isAnimalNumerology
      ? 'Seçili profil evcil hayvansa numeroloji yorumunu insan okuması gibi yazma; kariyer, iş, para kazanma, okul, evlilik, romantik ilişki, insan sosyal çevresi veya yetişkin insan psikolojisi teması kurma. Sayıları hayvanın mizacı, oyun/dinlenme düzeni, duyuları, ev içi güveni, diğer hayvanlarla ilişkisi ve sahibiyle bağı üzerinden yorumla.'
      : '',
  ].join(' ');
  const numerologyJson = params.mode === 'core' ? coreBaseNumbers(params.core) : periodNumerologyContext(params.mode, params.core, params.context, lifeEvents);
  const modeLabel = { core: 'temel numeroloji haritası', daily: 'günlük numeroloji', weekly: 'haftalık numeroloji', monthly: 'aylık numeroloji' }[params.mode];
  const taskPrompt =
    params.mode === 'core'
      ? [
           'Türkçe yaz. Başlık atma.',
          isAnimalNumerology
            ? 'Metni anlam akışına göre 3-4 kısa paragrafta ver: ana sayı örüntüsü, mizaç/duyu ritmi, oyun-dinlenme ve ev içi güven dengesi, sahibiyle bağ ve kapanış önerisi. Her konu değişiminde boş satır bırak.'
            : 'Metni anlam akışına göre 3-4 kısa paragrafta ver: ana sayı örüntüsü, iç motivasyon/kişilik, ilişki-iş dengesi ve kapanış önerisi. Her konu değişiminde boş satır bırak.',
          'Yalnızca ve yalnızca temel numeroloji haritasını yorumla: Yaşam Yolu, Kader/İfade, Ruh Arzusu, Kişilik, Doğum Günü ve Olgunluk.',
          'Kişisel Yıl, Kişisel Ay, Kişisel Gün, aylık akış, haftalık akış, bugünkü enerji veya dönemsel yorum yazmak kesinlikle yasak.',
          'Bu okuma doğum haritası gibi ömürlük saklanacak; geçici tarih, bugün, bu hafta, bu ay veya bu yıl dili kullanma.',
          'Akıcı, premium ve kişisel bir yorum ver; sayıların her birini ayrı ayrı ezber bilgi gibi anlatmadan ana karakter örüntüsüne bağla.',
          PERSONAL_INITIAL_READING_TOKEN_INSTRUCTION,
        ].join(' ')
      : params.mode === 'daily'
        ? [
          'Türkçe yaz. Başlık atma. Bu sadece günlük numeroloji yorumu.',
          isAnimalNumerology
            ? 'Metni anlam akışına göre 3 kısa paragrafta ver: günün hayvana özel sayı zemini, oyun/uyku/duyu dünyasında dikkat çeken tema ve sahibine uygulanabilir kapanış önerisi. Her konu değişiminde boş satır bırak.'
            : 'Metni anlam akışına göre 3 kısa paragrafta ver: günün kişisel sayı zemini, gün içinde dikkat çeken tema ve uygulanabilir kapanış önerisi. Her konu değişiminde boş satır bırak.',
          'Kişinin temel sayı haritasını arka planda dikkate al ama metinde Yaşam Yolu, Kader/İfade, Ruh Arzusu, Kişilik, Doğum Günü veya Olgunluk sayılarını tekrar etme.',
          'Metinde Kişisel Yıl, Kişisel Ay veya Kişisel Gün sayılarını söyleme. Sayı raporu değil, yorum yaz.',
          'Günün baseDayTotal, personTotal ve personalDayTotal değerlerini birlikte oku; genel gün sayısı gibi değil, seçili kişinin sayılarıyla birleşmiş günlük ritim gibi yorumla.',
          'suggestedLifeEvents içinden 1-2 mikro olayı, hesaplanan sayıların anlamıyla ilişki kuruyorsa doğalca kullan; liste gibi sayma.',
          params.coreSummary
            ? `Temel harita özeti arka plan için: ${params.coreSummary}`
            : 'Temel harita özeti yok; on-device gelen compact JSON arka plan olarak kullanılacak.',
          'Current date context dışındaki hiçbir tarih veya dönem adını yazma.',
          PERSONAL_INITIAL_READING_TOKEN_INSTRUCTION,
        ].join(' ')
        : params.mode === 'weekly'
          ? [
          'Türkçe yaz. Başlık atma. Bu sadece haftalık numeroloji yorumu.',
          isAnimalNumerology
            ? 'Önce haftanın hayvana özel genel sayısına ve ana atmosferine değin; ardından ayrı gün başlıkları atmadan Pazartesi’den Pazar’a akan, hayvanın rutinleri ve ev içi dünyası içinde gün gün ilerleyen süreğen bir anlatı kur.'
            : 'Önce haftanın genel kişisel sayısına ve ana atmosferine değin; ardından ayrı gün başlıkları atmadan Pazartesi’den Pazar’a akan, gün gün ilerleyen süreğen bir anlatı kur.',
          'Metni 4-5 kısa paragrafta ver; her paragraf haftanın doğal akışında birkaç günü taşıyabilir ama madde, başlık veya liste yapma.',
          'weekDays içindeki her günün personalDayTotal değerini kullan; günleri tek tek hesaplanan sayıların anlamıyla ilişkilendir.',
          'Kişinin temel sayı haritasını arka planda dikkate al ama temel harita sayılarını rapor gibi tekrar etme.',
          'Metinde Kişisel Yıl, Kişisel Ay veya Kişisel Gün sayılarını söyleme. Sayı raporu değil, yorum yaz.',
          'suggestedLifeEvents içinden 2-3 mikro olayı, haftanın ve günlerin sayısal ritmiyle anlamlı bağ kuruyorsa doğalca kullan; liste gibi sayma.',
          params.coreSummary
            ? `Temel harita özeti arka plan için: ${params.coreSummary}`
            : 'Temel harita özeti yok; on-device gelen compact JSON arka plan olarak kullanılacak.',
          PERSONAL_INITIAL_READING_TOKEN_INSTRUCTION,
        ].join(' ')
          : [
          'Türkçe yaz. Başlık atma. Bu sadece aylık numeroloji yorumu.',
          isAnimalNumerology
            ? 'Metni anlam akışına göre 4-5 kısa paragrafta ver: ayın hayvana özel ana zemini, ilk hafta, orta haftalar, son hafta ve sahibine yumuşak kapanış önerisi. Her konu değişiminde boş satır bırak.'
            : 'Metni anlam akışına göre 4-5 kısa paragrafta ver: ayın ana zemini, ilk hafta, orta haftalar, son hafta ve kapanış önerisi. Her konu değişiminde boş satır bırak.',
          'Günlük veya yıllık okuma yazma. Gün gün yorumlama; ayı haftalık dalgalar halinde anlat.',
          'Kişinin temel sayı haritasını arka planda dikkate al ama metinde Yaşam Yolu, Kader/İfade, Ruh Arzusu, Kişilik, Doğum Günü veya Olgunluk sayılarını tekrar etme.',
          'Önceki temel yorum, profil veya hesap verisi gibi kaynakları metinde açıkça anma; yalnızca yorumu daha isabetli yapmak için arka planda kullan.',
          'Metinde Kişisel Yıl, Kişisel Ay veya Kişisel Gün sayılarını söyleme. Sayı raporu değil, yorum yaz.',
          'Ayın monthTotal ve personTotal değerlerini ana zemin olarak kullan.',
          'Her hafta için monthWeeks içindeki startTotal, endTotal, weekTotal ve personalWeekTotal değerlerini karşılaştırarak ayrı ama akışkan bir yorum üret.',
          'Hafta tarihlerini kullan ama hesap formülünü anlatma; sadece her haftanın karakterini, dikkat edilmesi gereken alanı ve önerisini yaz.',
          'suggestedLifeEvents içinden 2-3 mikro olayı, ayın ve haftaların sayısal ritmiyle anlamlı bağ kuruyorsa doğalca kullan; liste gibi sayma.',
          `Temel numeroloji okuması daha önce yapılmış mı: ${params.hasCoreReading}.`,
          params.coreSummary
            ? `Temel harita özeti arka plan için: ${params.coreSummary}`
            : 'Temel harita özeti yok; on-device gelen compact JSON arka plan olarak kullanılacak.',
          isAnimalNumerology
            ? 'Sahibine net ama yumuşak gözlem önerisi ver: ayın başında hangi rutini desteklemeli, ortasında hangi sinyali izlemeli, sonunda hangi konfor alanını güçlendirmeli.'
            : 'Kişiye net öneri ver: ayın başında neyi başlatmalı, ortasında neyi toparlamalı, sonunda neyi kapatmalı.',
          'Current date context dışındaki hiçbir yıl veya ay adını yazma.',
          PERSONAL_INITIAL_READING_TOKEN_INSTRUCTION,
        ].join(' ');

  const geminiPayload = {
    system_instruction: { parts: [{ text: systemText }] },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: [
              `Profile: ${params.profileName || 'Profil'}`,
              `Persona style: ${styleHint}`,
              personaContext ? `Persona tone card:\n${personaContext}` : '',
              `Address policy: ${addressPolicyForProfile(params.profile, params.profileName)}`,
              standardMemory ? `Standart hafıza bağlamı:\n${standardMemory}` : '',
              isAnimalNumerology
                ? 'Evcil hayvan profili için tüm yorum boyunca hayvanı üçüncü tekil şahısla anlat; hesap sahibine sahibi/refakatçisi olarak seslen. İnsan hayatına ait iş, okul, evlilik, romantik ilişki ve para kazanma temalarını kullanma.'
                : '',
              `Mode: ${modeLabel}`,
              `Numerology JSON calculated on-device:\n${JSON.stringify(numerologyJson)}`,
              'Hitap modunu metin boyunca değiştirme; üçüncü tekil şahısla başladıysan "sen" diline geçme, "sen" diliyle başladıysan profil adıyla dışarıdan anlatmaya dönme. Aynı şefkat hitabını bir yanıtta en fazla bir kez kullan; "canım canım", "tatlım tatlım", "güzelim güzelim" gibi ikilemeler yapma.',
              taskPrompt,
            ].join('\n\n'),
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.72,
      maxOutputTokens: PERSONAL_INITIAL_READING_MAX_OUTPUT_TOKENS,
    },
  };
  return {
    geminiPayload,
    specificityUsage: {
      events: lifeEvents.map((event) => ({ group: event.group || 'numeroloji', label: event.label })),
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
  memorySnippet?: ProfileMemorySnippet | null;
}): Promise<PersonalNumerologyReading> {
  const context = buildContext();
  const core = calculateCore(params.profile, context);
  const fingerprint = params.mode === 'core'
    ? coreReadingFingerprint(params.profile)
    : periodReadingFingerprint(params.profile, params.assistantId);
  const cachedCore = await loadCoreFromCache(params.profile.profileId, fingerprint);

  if (params.mode === 'core' && cachedCore) {
    return cachedCore;
  }

  const selectedPeriod: PersonalNumerologyPeriod | undefined = params.mode === 'core' ? undefined : params.mode;
  const selectedPeriodKey = selectedPeriod ? periodKey(selectedPeriod) : undefined;

  const hasCoreReading = Boolean(cachedCore);
  try {
    const { geminiPayload, specificityUsage } = buildGeminiPayload({
      profileName: params.profile.displayName,
      assistantId: params.assistantId,
      assistantLabel: params.assistantLabel,
      profile: params.profile,
      mode: params.mode,
      core,
      context,
      coreSummary: params.mode === 'core' ? null : compactCoreSummary(cachedCore),
      hasCoreReading,
      memorySnippet: params.memorySnippet,
    });
    const payload = await generateGeminiTextDirect(geminiPayload, 45000, { usageMode: 'raw' });
    if (payload.text) {
      const completed = await completeWithRememberedPersonaClosing({
        text: cleanNumerologyText(payload.text),
        assistantId: params.assistantId,
        domain: 'numerology',
        seed: `${params.profile.profileId}:${params.mode}:${selectedPeriodKey || 'core'}`,
        allowHealthClosing: false,
        isAnimalProfile: params.profile.relationshipPrimary === 'evcil_hayvan',
      });
      const text = sanitizeGenderedAddress(
        appendHealthProfessionalReminder(completed.text, { isAnimalProfile: params.profile.relationshipPrimary === 'evcil_hayvan' }),
        {
          assistantId: params.assistantId,
          memorySnippet: params.memorySnippet,
          isAnimalProfile: params.profile.relationshipPrimary === 'evcil_hayvan',
        },
      );
      const reading: PersonalNumerologyReading = {
        text,
        core,
        context,
        mode: params.mode,
        period: selectedPeriod,
        periodKey: selectedPeriodKey,
        source: 'gemini-direct-personal-numerology',
        cached: false,
        hasCoreReading,
        specificityUsage,
        modelName: payload.model,
        usage: payload.usage,
      };
      if (params.mode === 'core') {
        await saveCoreToCache(params.profile.profileId, fingerprint, reading);
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
        : fallbackPeriodText(params.profile.displayName, params.mode, context),
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
  }
  return fallback;
}

export async function createPersonalNumerologyFollowUp(params: {
  profileName: string;
  assistantId: string;
  assistantLabel: string;
  mode: PersonalNumerologyMode;
  readingText: string;
  question: string;
  previousFollowUps?: Array<{ role: 'user' | 'assistant'; text: string }>;
  memorySnippet?: ProfileMemorySnippet | null;
}): Promise<{ text: string; modelName?: string; usage: { inputTokens: number; outputTokens: number; totalTokens: number } }> {
  const relevantMemory = formatRelevantMemory(params.memorySnippet, params.question);
  const addressPolicy = addressPolicyFromMemory(params.profileName, params.memorySnippet);
  const personaContext = assistantPersonaContext(params.assistantId);
  const previousFollowUpText = (params.previousFollowUps || [])
    .filter((message) => message.text.trim())
    .slice(-8)
    .map((message) => `${message.role === 'user' ? 'Kullanıcı' : 'Yorumcu'}: ${message.text.trim()}`)
    .join('\n');
  const systemText = [
    'Seçili persona yalnızca ses, hitap ritmi ve konuşma sıcaklığını belirler.',
    'Türkçe, sıcak, net ve kişiye özel konuş.',
    'Kendini tanıtma; kullanıcıya görünen metinde yorumcu/persona adı, public label veya rol tanıtımı yazma.',
    'Kullanıcıya görünen metinde hukuken kesin gelecek iddiası kurma; "yorum", "okuma", "sembolik ritüel", "sembolik yorum", "izlenim", "olasılık", "eğilim" dili kullan.',
    'Sağlık ve finans alanlarında spesifik tavsiye verme. İnsan sağlığıyla ilgili endişede doktora/uygun sağlık uzmanına, hayvan sağlığıyla ilgili endişede veterinere görünmeyi nazikçe öner.',
    '"Şunu ye/iç geçer", "kesin geçecek", "kesin iyileşecek", ilaç/doz/tedavi/beslenme reçetesi veya kesin sonuç dili yasak.',
    'Kullanıcının sorusunu kendi aklına gelmiş gibi sahiplenme; "aklıma geldi", "şimdi aklıma geldi" gibi ifadeler kullanma.',
    'Persona sesini koru; kişiye özel numerolojide yorumcunun aynı üslubu, ritmi, hitabı ve tavsiye dili hissedilsin.',
    'Numeroloji cevabında kahve, fincan, telve, tabak, avuç içi, el çizgisi, görsel, kart, tarot veya başka sembolik araç dili kullanma; sayılar ve soru bağlamı üzerinden konuş.',
    'Cevabı daha önce üretilmiş kişisel numeroloji yorumu, mevcut soru-cevap akışı ve kullanıcının son sorusu üzerinden ver.',
    FOLLOW_UP_CHAT_CONTRACT,
    'Kullanıcı özellikle sormadıkça önceki yorum, profil, hafıza veya sayı haritası kaynağını açıkça anma.',
    'Hitap modunu değiştirme; aynı yanıtta "canım", "tatlım", "güzelim" gibi şefkat hitaplarını tekrarlama.',
    'Önceki follow-up cevaplarıyla çelişme; son soru önceki bir soruya gönderme yapıyorsa o bağı sürdür.',
    'Yeni tam numeroloji haritası üretme; tekrar eden cümleler kurma.',
  ].join(' ');
  const userText = [
    `Profil: ${params.profileName}`,
    `Bölüm: ${params.mode}`,
    `Persona tonu anahtarı: ${params.assistantId}`,
    personaContext ? `Persona ton kartı:\n${personaContext}` : '',
    `Hitap politikası: ${addressPolicy}`,
    relevantMemory ? `Seçilmiş hafıza bağlamı:\n${relevantMemory}` : '',
    formatPetMentionMemoryContext(params.question, params.memorySnippet),
    `Önceki kişisel numeroloji yorumu:\n${params.readingText}`,
    previousFollowUpText ? `Bu oturumdaki önceki soru-cevap akışı:\n${previousFollowUpText}` : '',
    `Kullanıcının sorusu:\n${params.question}`,
    `Yanıtı 2-3 kısa paragraf olarak ver: ilk paragrafta net cevap, sonra numeroloji bağlamından 1-2 gerekçe ve uygulanabilir kısa tavsiye olsun. ${PERSONAL_FOLLOW_UP_TOKEN_INSTRUCTION}`,
  ].filter(Boolean).join('\n\n');
  const payload = await generateGeminiTextDirect({
    system_instruction: { parts: [{ text: systemText }] },
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    generationConfig: {
      temperature: 0.68,
      maxOutputTokens: PERSONAL_FOLLOW_UP_MAX_OUTPUT_TOKENS,
    },
  }, 45000, { usageMode: 'raw' });
  const completed = await completeWithRememberedPersonaClosing({
      text: cleanNumerologyText(payload.text),
      assistantId: params.assistantId,
      domain: 'numerology',
      seed: `${params.profileName}:${params.mode}:${params.question}`,
      allowHealthClosing: userAskedHealthConcern(params.question),
      isAnimalProfile: params.memorySnippet?.relationshipPrimary === 'evcil_hayvan',
    });
  const text = sanitizeGenderedAddress(
    appendHealthProfessionalReminder(cleanFollowUpReply(completed.text), {
      userText: params.question,
      isAnimalProfile: params.memorySnippet?.relationshipPrimary === 'evcil_hayvan',
    }),
    { assistantId: params.assistantId, memorySnippet: params.memorySnippet },
  );
  return { text, modelName: payload.model, usage: payload.usage };
}

export async function clearPersonalNumerologyCachesForProfile(_profileId: string): Promise<void> {
  // Cache stores vary across recovered builds; keeping this helper idempotent protects MemoryDebug cleanup.
}
