import * as FileSystem from 'expo-file-system/legacy';
import * as Astronomy from 'astronomy-engine';
import type { ProfileMemorySnippet, SubjectProfile } from '../types/memory';
import {
  PERSONAL_FOLLOW_UP_MAX_OUTPUT_TOKENS,
  PERSONAL_FOLLOW_UP_TOKEN_INSTRUCTION,
  PERSONAL_INITIAL_READING_MAX_OUTPUT_TOKENS,
  PERSONAL_INITIAL_READING_TOKEN_INSTRUCTION,
} from '../config/llmTokenPolicy';
import { resolveAstroLocation } from './astroLocationService';
import { generateGeminiTextDirect } from './geminiDirectService';
import { FORTUNE_PERSONA_DATA } from './fortunePersonaData';
import {
  appendHealthProfessionalReminder,
  completeWithRememberedPersonaClosing,
  sanitizeGenderedAddress,
  sanitizePublicReadingLanguage,
  stripPersonaSelfIntroduction,
  userAskedHealthConcern,
} from './personaClosingService';
import { buildAnimalProfileInstructionFromMemory, buildAnimalProfileInstructionFromProfile, isAnimalProfile } from './animalProfilePrompt';
import { formatPromptMemoryPack } from './memoryPromptPackFormatter';
import { formatPetMentionMemoryContext, formatStandardPersonalMemoryContext } from './personalMemoryPromptContext';
import {
  buildLocalGemmaPromptFromGeminiPayload,
  getLocalGemmaGenerationLimits,
  generateLocalGemmaText,
  type LocalGemmaModelId,
} from './localGemmaService';
import { cleanFollowUpReply, FOLLOW_UP_CHAT_CONTRACT } from './followUpResponseService';

export type AstroPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type AstroReadingResult = {
  text: string;
  sign: string;
  risingSign?: string | null;
  timezoneUsed: string;
  periodKey: string;
  precisionNote?: string;
  cached?: boolean;
  modelName?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
};

export type AstroRelationshipMode = 'compatibility' | 'family';
export type AstroCompatibilityContext =
  | 'genel'
  | 'ask'
  | 'is'
  | 'ev-arkadasligi'
  | 'dostluk'
  | 'komsuluk'
  | 'aile'
  | 'diger';

export type AstroRelationshipSubject = {
  profile: SubjectProfile;
  roleLabel?: string | null;
  source: 'saved' | 'temporary';
  memorySnippet?: ProfileMemorySnippet | null;
};

function formatRelevantMemory(snippet?: ProfileMemorySnippet | null, questionText?: string | null, readingLabel = 'kişisel astroloji') {
  const items = snippet?.relevantObservations || [];
  const memoryPack = formatPromptMemoryPack(snippet);
  const standardMemory = formatStandardPersonalMemoryContext({
    profileName: snippet?.profileName,
    readingLabel,
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

function formatAstroAvoidanceMemory(snippet?: ProfileMemorySnippet | null, questionText?: string | null) {
  if (!snippet) return '';
  const parts: string[] = [];
  const memoryPack = formatPromptMemoryPack(snippet);
  if (memoryPack) parts.push(memoryPack);
  const standardMemory = formatStandardPersonalMemoryContext({
    profileName: snippet.profileName,
    readingLabel: 'kişisel astroloji',
    memorySnippet: snippet,
    questionText,
    includePromptPack: false,
  });
  if (standardMemory) parts.push(standardMemory);
  const recentThemes = (snippet.readingTopicGroups || [])
    .slice(0, 6)
    .map((item) => `${item.group || 'Genel'} / ${item.subgroup || 'Diğer'}: ${item.label}`)
    .join('\n');
  if (recentThemes) {
    parts.push(`Önceki yorumlarda sık dönen temalar:\n${recentThemes}`);
  }
  const concreteMemory = (snippet.relevantObservations || [])
    .slice(0, 5)
    .map((item) => {
      const details = [item.title, item.summary].filter(Boolean).join(' | ');
      return `${item.category || item.group} / ${item.subgroup}: ${details}`;
    })
    .join('\n');
  if (concreteMemory) {
    parts.push(`İlgili hafıza kırıntıları:\n${concreteMemory}`);
  }
  return parts.join('\n\n');
}

function formatSubjectIdentityMemory(snippet?: ProfileMemorySnippet | null) {
  if (!snippet) return '';
  const topicText = snippet.userTopicGroups
    .filter((item) => item.group === 'profil' || item.subgroup === 'kişisel eğilim')
    .slice(0, 3)
    .map((item) => `${item.subgroup}: ${item.label}`)
    .join('; ');
  const observationText = snippet.userObservations
    .filter((item) => item.group === 'profil' || item.subgroup === 'kişisel eğilim')
    .slice(0, 3)
    .map((item) => item.summary || item.title)
    .join('; ');
  const relevantText = snippet.relevantObservations
    .slice(0, 3)
    .map((item) => item.summary || item.title)
    .join('; ');
  const relationText = snippet.prominentRelations
    .slice(0, 5)
    .map((item) => `${item.label} (${item.relationship || 'ilişkili kişi'})`)
    .join('; ');
  return [topicText, observationText, relationText, relevantText].filter(Boolean).join(' | ');
}

export type BirthChartAspect = {
  planetA: string;
  planetB: string;
  type: 'Kavuşum' | 'Altmışlık' | 'Kare' | 'Üçgen' | 'Karşıt';
  orb: number;
};

export type BirthChartSnapshot = {
  sign: string;
  ascendant: string | null;
  moonSign?: string | null;
  dominantHouse: number;
  planets: Array<{ name: string; sign: string; degree: number; longitude: number; retrograde: boolean; house: number | null }>;
  points?: Array<{ name: string; sign: string; degree: number; longitude: number; house: number | null; note: string }>;
  aspects: BirthChartAspect[];
  transitNotes: string[];
  timezoneUsed?: string;
  precisionNote?: string;
  cached?: boolean;
};

type PersonalAstroResponse = {
  ok?: boolean;
  text?: string;
  sign?: string;
  risingSign?: string | null;
  risingSignAvailable?: boolean;
  timezoneUsed?: string;
  periodKey?: string;
  precisionNote?: string;
  error?: string;
};

type CompactAstroPayload = {
  ok: true;
  source: 'mobile-local-astro';
  data: {
    natal: {
      sunSignLabel: string;
      risingSignLabel: string | null;
      timeKnown: boolean;
      locationPrecision: string;
      positions: Array<{
        planetLabel: string;
        signLabel: string;
        degreeInSign: number;
        longitude: number;
        retrograde: boolean;
        house: number | null;
      }>;
      aspects: Array<{
        planet1Label: string;
        planet2Label: string;
        aspect: string;
        orb: number;
      }>;
    };
    transit: {
      positions: Array<{
        planetLabel: string;
        signLabel: string;
        degreeInSign: number;
        retrograde: boolean;
        natalHouse: number | null;
      }>;
      toNatalAspects: Array<{
        transitPlanetLabel: string;
        natalPlanetLabel: string;
        aspect: string;
        orb: number;
      }>;
      periodTimeline: Array<{
        dateKey: string;
        positions: Array<{
          planetLabel: string;
          signLabel: string;
          degreeInSign: number;
          retrograde: boolean;
          natalHouse: number | null;
        }>;
        toNatalAspects: Array<{
          transitPlanetLabel: string;
          natalPlanetLabel: string;
          aspect: string;
          orb: number;
        }>;
      }>;
    };
  };
};

type PersonalAstroCacheFile = {
  schemaVersion: 1;
  entries: Array<{
    cacheKey: string;
    assistantId: string;
    profileId: string;
    period: AstroPeriod;
    periodKey: string;
    profileFingerprint: string;
    createdAt: string;
    expiresAt: string;
    reading: AstroReadingResult;
  }>;
};

type BirthChartCacheFile = {
  schemaVersion: 1;
  entries: Array<{
    profileId: string;
    profileFingerprint: string;
    createdAt: string;
    chart: BirthChartSnapshot;
  }>;
};

const DATA_DIR = `${FileSystem.documentDirectory}falci-data/`;
const PERSONAL_ASTRO_CACHE_FILE = `${DATA_DIR}personal-astro-cache.json`;
const BIRTH_CHART_CACHE_FILE = `${DATA_DIR}birth-chart-cache.json`;
const MAX_PERSONAL_ASTRO_CACHE_ITEMS = 160;
const LOCAL_ASTRO_VERSION = 6;
const PERSONAL_ASTRO_PERSONA_PROMPT_VERSION = 6;
const BIRTH_CHART_MAIN_MAX_OUTPUT_TOKENS = 4092;
const BIRTH_CHART_CONTINUATION_MAX_OUTPUT_TOKENS = 1400;

const SIGN_LABELS = ['Koç', 'Boğa', 'İkizler', 'Yengeç', 'Aslan', 'Başak', 'Terazi', 'Akrep', 'Yay', 'Oğlak', 'Kova', 'Balık'];
const PLANETS = [
  { name: 'Güneş', body: Astronomy.Body.Sun },
  { name: 'Ay', body: Astronomy.Body.Moon },
  { name: 'Merkür', body: Astronomy.Body.Mercury },
  { name: 'Venüs', body: Astronomy.Body.Venus },
  { name: 'Mars', body: Astronomy.Body.Mars },
  { name: 'Jüpiter', body: Astronomy.Body.Jupiter },
  { name: 'Satürn', body: Astronomy.Body.Saturn },
  { name: 'Uranüs', body: Astronomy.Body.Uranus },
  { name: 'Neptün', body: Astronomy.Body.Neptune },
  { name: 'Plüton', body: Astronomy.Body.Pluto },
] as const;

export function hasRequiredAstroBirthInputs(profile: SubjectProfile): boolean {
  return Boolean(
    profile.birth.date &&
      profile.birth.location.country &&
      profile.birth.location.cityOrRegion,
  );
}

function nowIso() {
  return new Date().toISOString();
}

function todayIsoDate() {
  return periodDateParts().dateKey;
}

function periodDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === 'year')?.value ?? '1970');
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? '1');
  const day = Number(parts.find((p) => p.type === 'day')?.value ?? '1');
  return { year, month, day, dateKey: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
}

function periodKey(period: AstroPeriod, date = new Date()) {
  const { year, month, day, dateKey } = periodDateParts(date);
  if (period === 'daily') return dateKey;
  if (period === 'monthly') return `${year}-${String(month).padStart(2, '0')}`;
  if (period === 'yearly') return String(year);
  const utcDay = new Date(Date.UTC(year, month - 1, day));
  const weekday = utcDay.getUTCDay() || 7;
  utcDay.setUTCDate(utcDay.getUTCDate() - weekday + 1);
  const weekOne = new Date(Date.UTC(utcDay.getUTCFullYear(), 0, 4));
  const weekOneWeekday = weekOne.getUTCDay() || 7;
  weekOne.setUTCDate(weekOne.getUTCDate() - weekOneWeekday + 1);
  const week = Math.floor((utcDay.getTime() - weekOne.getTime()) / 604800000) + 1;
  return `${utcDay.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function periodExpiryIso(period: AstroPeriod, date = new Date()) {
  const { year, month, day } = periodDateParts(date);
  let expiryUtcMs: number;
  if (period === 'daily') {
    expiryUtcMs = Date.UTC(year, month - 1, day + 1) - 3 * 60 * 60 * 1000;
  } else if (period === 'weekly') {
    const utcDay = new Date(Date.UTC(year, month - 1, day));
    const weekday = utcDay.getUTCDay() || 7;
    utcDay.setUTCDate(utcDay.getUTCDate() - weekday + 8);
    expiryUtcMs = utcDay.getTime() - 3 * 60 * 60 * 1000;
  } else if (period === 'monthly') {
    expiryUtcMs = Date.UTC(year, month, 1) - 3 * 60 * 60 * 1000;
  } else {
    expiryUtcMs = Date.UTC(year + 1, 0, 1) - 3 * 60 * 60 * 1000;
  }
  return new Date(expiryUtcMs).toISOString();
}

function profileFingerprint(profile: SubjectProfile) {
  return JSON.stringify({
    birth: profile.birth,
    chartPrecision: profile.chartPrecision,
    localAstroVersion: LOCAL_ASTRO_VERSION,
  });
}

function cacheKey(parts: string[]) {
  return parts.map((part) => encodeURIComponent(part || '_')).join('|');
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

function defaultPersonalAstroCache(): PersonalAstroCacheFile {
  return { schemaVersion: 1, entries: [] };
}

function defaultBirthChartCache(): BirthChartCacheFile {
  return { schemaVersion: 1, entries: [] };
}

async function loadFreshPersonalAstroFromCache(params: {
  cacheKeyValue: string;
  periodKeyValue: string;
  fingerprint: string;
}): Promise<AstroReadingResult | null> {
  const store = await readJsonFile(PERSONAL_ASTRO_CACHE_FILE, defaultPersonalAstroCache());
  const now = Date.now();
  const hit = store.entries.find(
    (entry) =>
      entry.cacheKey === params.cacheKeyValue &&
      entry.periodKey === params.periodKeyValue &&
      entry.profileFingerprint === params.fingerprint &&
      new Date(entry.expiresAt).getTime() > now,
  );
  return hit
    ? {
        ...hit.reading,
        text: repairMojibakeTurkish(hit.reading.text),
        sign: normalizeSignLabel(hit.reading.sign),
        risingSign: hit.reading.risingSign ? normalizeSignLabel(hit.reading.risingSign) : hit.reading.risingSign,
        cached: true,
      }
    : null;
}

async function savePersonalAstroToCache(entry: PersonalAstroCacheFile['entries'][number]) {
  const store = await readJsonFile(PERSONAL_ASTRO_CACHE_FILE, defaultPersonalAstroCache());
  const nextEntries = store.entries.filter((item) => item.cacheKey !== entry.cacheKey);
  nextEntries.push(entry);
  await writeJsonFile(PERSONAL_ASTRO_CACHE_FILE, {
    schemaVersion: 1,
    entries: nextEntries.slice(-MAX_PERSONAL_ASTRO_CACHE_ITEMS),
  });
}

export async function getCachedPersonalAstroReading(params: {
  profile: SubjectProfile;
  assistantId: string;
  period: AstroPeriod;
}): Promise<AstroReadingResult | null> {
  const currentPeriodKey = periodKey(params.period);
  const fingerprint = profileFingerprint(params.profile);
  const cacheKeyValue = cacheKey([
    String(PERSONAL_ASTRO_PERSONA_PROMPT_VERSION),
    params.assistantId,
    params.profile.profileId,
    params.period,
    currentPeriodKey,
    fingerprint,
  ]);
  return loadFreshPersonalAstroFromCache({ cacheKeyValue, periodKeyValue: currentPeriodKey, fingerprint });
}

async function loadBirthChartFromCache(profileId: string, fingerprint: string): Promise<BirthChartSnapshot | null> {
  const store = await readJsonFile(BIRTH_CHART_CACHE_FILE, defaultBirthChartCache());
  const hit = store.entries.find((entry) => entry.profileId === profileId && entry.profileFingerprint === fingerprint);
  if (
    hit &&
    (!Array.isArray(hit.chart.aspects) ||
      hit.chart.planets.some((planet) => !('house' in planet)) ||
      !Array.isArray(hit.chart.points) ||
      !('moonSign' in hit.chart))
  ) {
    return null;
  }
  return hit ? { ...hit.chart, cached: true } : null;
}

async function saveBirthChartToCache(profileId: string, fingerprint: string, chart: BirthChartSnapshot) {
  const store = await readJsonFile(BIRTH_CHART_CACHE_FILE, defaultBirthChartCache());
  const nextEntries = store.entries.filter((entry) => entry.profileId !== profileId);
  nextEntries.push({ profileId, profileFingerprint: fingerprint, createdAt: nowIso(), chart: { ...chart, cached: false } });
  await writeJsonFile(BIRTH_CHART_CACHE_FILE, { schemaVersion: 1, entries: nextEntries });
}

function buildPrecisionNote(profile: SubjectProfile, locationPrecision: string, warnings: string[]) {
  const parts: string[] = [];
  if (!profile.birth.timeKnown || !profile.birth.time) {
    parts.push('Doğum saati bilinmediği için yükselen burç, evler ve saat hassasiyetli Ay derecesi yoruma dahil edilmedi.');
  }
  if (locationPrecision === 'country') {
    parts.push(...warnings);
  }
  return parts.join(' ');
}

function signIndexFromLongitude(longitude: number) {
  return Math.floor((((longitude % 360) + 360) % 360) / 30) % 12;
}

function sunSignIndexFromDate(dateIso: string) {
  const [, mm, dd] = dateIso.split('-').map(Number);
  if ((mm === 3 && dd >= 21) || (mm === 4 && dd <= 19)) return 0;
  if ((mm === 4 && dd >= 20) || (mm === 5 && dd <= 20)) return 1;
  if ((mm === 5 && dd >= 21) || (mm === 6 && dd <= 20)) return 2;
  if ((mm === 6 && dd >= 21) || (mm === 7 && dd <= 22)) return 3;
  if ((mm === 7 && dd >= 23) || (mm === 8 && dd <= 22)) return 4;
  if ((mm === 8 && dd >= 23) || (mm === 9 && dd <= 22)) return 5;
  if ((mm === 9 && dd >= 23) || (mm === 10 && dd <= 22)) return 6;
  if ((mm === 10 && dd >= 23) || (mm === 11 && dd <= 21)) return 7;
  if ((mm === 11 && dd >= 22) || (mm === 12 && dd <= 21)) return 8;
  if ((mm === 12 && dd >= 22) || (mm === 1 && dd <= 19)) return 9;
  if ((mm === 1 && dd >= 20) || (mm === 2 && dd <= 18)) return 10;
  return 11;
}

function normalizeDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

function datePartsFromIso(dateIso: string) {
  const [year, month, day] = dateIso.split('-').map(Number);
  return { year, month, day };
}

function timePartsFromIso(time: string | null) {
  const [hour, minute] = (time || '12:00').split(':').map(Number);
  return { hour: hour || 0, minute: minute || 0 };
}

function getTimeZoneOffsetMinutes(timezone: string, utcDate: Date) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(utcDate);
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
    const asUtc = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second'));
    return Math.round((asUtc - utcDate.getTime()) / 60000);
  } catch {
    return timezone === 'Europe/Istanbul' ? 180 : 0;
  }
}

function zonedDateTimeToUtc(dateIso: string, time: string | null, timezone: string) {
  const { year, month, day } = datePartsFromIso(dateIso);
  const { hour, minute } = timePartsFromIso(time);
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 3; i += 1) {
    const offset = getTimeZoneOffsetMinutes(timezone, new Date(utcMs));
    utcMs = Date.UTC(year, month - 1, day, hour, minute, 0) - offset * 60000;
  }
  return new Date(utcMs);
}

function eclipticLongitude(body: Astronomy.Body, time: Astronomy.AstroTime) {
  const vec = Astronomy.GeoVector(body, time, true);
  return normalizeDegrees(Astronomy.Ecliptic(vec).elon);
}

function planetSpeed(body: Astronomy.Body, time: Astronomy.AstroTime) {
  const prev = eclipticLongitude(body, time.AddDays(-0.5));
  const next = eclipticLongitude(body, time.AddDays(0.5));
  const delta = normalizeDegrees(next - prev);
  return delta > 180 ? delta - 360 : delta;
}

function obliquityDeg(time: Astronomy.AstroTime) {
  const t = time.ut / 36525;
  return 23.439291 - 0.0130042 * t;
}

function ascendantLongitude(time: Astronomy.AstroTime, latitude: number, longitude: number) {
  const eps = (obliquityDeg(time) * Math.PI) / 180;
  const phi = (latitude * Math.PI) / 180;
  const theta = (((Astronomy.SiderealTime(time) * 15) + longitude) * Math.PI) / 180;
  const y = -Math.cos(theta);
  const x = Math.sin(theta) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps);
  return normalizeDegrees((Math.atan2(y, x) * 180) / Math.PI + 180);
}

function houseForLongitude(longitude: number, ascendantLongitudeValue: number | null) {
  if (ascendantLongitudeValue === null) return null;
  return Math.floor(normalizeDegrees(longitude - ascendantLongitudeValue) / 30) + 1;
}

function aspectDelta(a: number, b: number) {
  const raw = Math.abs(normalizeDegrees(a) - normalizeDegrees(b));
  return raw > 180 ? 360 - raw : raw;
}

function buildAspects(
  planets: Array<{ name: string; longitude: number }>,
): BirthChartAspect[] {
  const aspectDefs = [
    { type: 'Kavuşum' as const, angle: 0, orb: 7 },
    { type: 'Altmışlık' as const, angle: 60, orb: 5 },
    { type: 'Kare' as const, angle: 90, orb: 6 },
    { type: 'Üçgen' as const, angle: 120, orb: 6 },
    { type: 'Karşıt' as const, angle: 180, orb: 7 },
  ];
  const aspects: BirthChartAspect[] = [];
  for (let i = 0; i < planets.length; i += 1) {
    for (let j = i + 1; j < planets.length; j += 1) {
      const delta = aspectDelta(planets[i].longitude, planets[j].longitude);
      const hit = aspectDefs.find((aspect) => Math.abs(delta - aspect.angle) <= aspect.orb);
      if (!hit) continue;
      aspects.push({
        planetA: planets[i].name,
        planetB: planets[j].name,
        type: hit.type,
        orb: Number(Math.abs(delta - hit.angle).toFixed(1)),
      });
    }
  }
  return aspects.sort((a, b) => a.orb - b.orb).slice(0, 10);
}

function meanNorthNodeLongitude(time: Astronomy.AstroTime) {
  const t = time.ut / 36525;
  return normalizeDegrees(125.04452 - 1934.136261 * t + 0.0020708 * t * t + (t * t * t) / 450000);
}

function meanLilithLongitude(time: Astronomy.AstroTime) {
  const t = time.ut / 36525;
  return normalizeDegrees(
    83.3532465 +
      4069.0137287 * t -
      0.01032 * t * t -
      (t * t * t) / 80053 +
      (t * t * t * t) / 18999000,
  );
}

function buildLocalPlanets(time: Astronomy.AstroTime, ascendantLongitudeValue: number | null) {
  return PLANETS.map((planet) => {
    const longitude = eclipticLongitude(planet.body, time);
    const signIndex = signIndexFromLongitude(longitude);
    const speed = planetSpeed(planet.body, time);
    return {
      name: planet.name,
      sign: SIGN_LABELS[signIndex],
      degree: longitude % 30,
      longitude,
      retrograde: speed < 0,
      house: houseForLongitude(longitude, ascendantLongitudeValue),
    };
  });
}

function buildChartPoints(time: Astronomy.AstroTime, ascendantLongitudeValue: number | null) {
  const northNodeLongitude = meanNorthNodeLongitude(time);
  const southNodeLongitude = normalizeDegrees(northNodeLongitude + 180);
  const lilithLongitude = meanLilithLongitude(time);
  return [
    {
      name: 'Kuzey Ay Düğümü',
      longitude: northNodeLongitude,
      note: 'Yaklaşık ortalama ay düğümü hesabı; yön, gelişim ve hayat dersleri için kullanılır.',
    },
    {
      name: 'Güney Ay Düğümü',
      longitude: southNodeLongitude,
      note: 'Kuzey Ay Düğümü karşıt noktası; alışılmış refleksler ve geçmiş kalıplar için kullanılır.',
    },
    {
      name: 'Lilith',
      longitude: lilithLongitude,
      note: 'Yaklaşık ortalama Lilith hesabı; bastırılan taraflar ve içgüdüsel sınırlar için temkinli yorumlanır.',
    },
  ].map((point) => ({
    ...point,
    sign: SIGN_LABELS[signIndexFromLongitude(point.longitude)],
    degree: point.longitude % 30,
    house: houseForLongitude(point.longitude, ascendantLongitudeValue),
  }));
}

function buildLocalBirthChartSnapshot(profile: SubjectProfile): BirthChartSnapshot {
  const location = resolveAstroLocation(profile.birth.location);
  if (!profile.birth.date || !location) {
    throw new Error('Doğum haritası için doğum tarihi, ülke ve şehir gerekli.');
  }

  const precisionNote = buildPrecisionNote(profile, location.precision, location.warnings);
  const timeKnown = Boolean(profile.birth.timeKnown && profile.birth.time);
  const birthUtc = zonedDateTimeToUtc(profile.birth.date, profile.birth.timeKnown ? profile.birth.time : null, location.timezone);
  const birthTime = new Astronomy.AstroTime(birthUtc);
  const ascendantLongitudeValue =
    profile.birth.timeKnown && profile.birth.time
      ? ascendantLongitude(birthTime, location.latitude, location.longitude)
      : null;
  const ascendant = ascendantLongitudeValue === null ? null : SIGN_LABELS[signIndexFromLongitude(ascendantLongitudeValue)];
  const planets = buildLocalPlanets(birthTime, ascendantLongitudeValue);
  const points = buildChartPoints(birthTime, ascendantLongitudeValue);
  const sun = planets.find((planet) => planet.name === 'Güneş');
  const moon = planets.find((planet) => planet.name === 'Ay');
  const aspects = buildAspects([...planets, ...points]);
  const retrogradeNames = planets.filter((planet) => planet.retrograde).map((planet) => planet.name);
  const transitNotes = [
    ...(!timeKnown && precisionNote ? [precisionNote] : []),
    ascendant
      ? `Yükselen ${ascendant}, doğum saatiyle birlikte kişisel aksın daha belirgin okunmasını sağlar.`
      : 'Doğum saati olmadığı için yorum Güneş, Ay ve gezegen burçlarına yaslanır.',
    retrogradeNames.length
      ? `Haritada retro görünen gezegenler: ${retrogradeNames.join(', ')}.`
      : 'Haritada belirgin retro gezegen vurgusu sınırlı görünüyor.',
  ];

  return {
    sign: sun?.sign || SIGN_LABELS[sunSignIndexFromDate(profile.birth.date)],
    ascendant,
    moonSign: moon?.sign || null,
    dominantHouse: ascendant ? 1 : 0,
    planets,
    points,
    aspects,
    transitNotes,
    timezoneUsed: location.timezone,
    precisionNote,
    cached: false,
  };
}

export function formatTimezoneForDisplay(timezone: string | null | undefined) {
  if (!timezone || timezone === 'Europe/Istanbul') return 'Avrupa İstanbul';
  return timezone.replace('Europe/', 'Avrupa ').replace('America/', 'Amerika ').replace(/_/g, ' ');
}

function repairMojibakeTurkish(text: string) {
  let out = text || '';
  const replacements: Array<[RegExp, string]> = [
    [/Ko\u00c3\u00a7/g, 'Koç'],
    [/Bo\u00c4\u0178a/g, 'Boğa'],
    [/\u00c4\u00b0kizler/g, 'İkizler'],
    [/Yenge\u00c3\u00a7/g, 'Yengeç'],
    [/Ba\u00c5\u0178ak/g, 'Başak'],
    [/O\u00c4\u0178lak/g, 'Oğlak'],
    [/Bal\u00c4\u00b1k/g, 'Balık'],
    [/G\u00c3\u00bcne\u00c5\u0178/g, 'Güneş'],
    [/Y\u00c3\u00bckselen/g, 'Yükselen'],
    [/Do\u00c4\u0178um/g, 'Doğum'],
    [/g\u00c3\u00b6ky\u00c3\u00bcz\u00c3\u00bc/g, 'gökyüzü'],
    [/G\u00c3\u00b6ky\u00c3\u00bcz\u00c3\u00bc/g, 'Gökyüzü'],
    [/ili\u00c5\u0178ki/g, 'ilişki'],
    [/\u00c4\u00b0li\u00c5\u0178ki/g, 'İlişki'],
    [/\u00c3\u00a7/g, 'ç'],
    [/\u00c3\u2021/g, 'Ç'],
    [/\u00c4\u0178/g, 'ğ'],
    [/\u00c4\u017d/g, 'Ğ'],
    [/\u00c4\u00b1/g, 'ı'],
    [/\u00c4\u00b0/g, 'İ'],
    [/\u00c3\u00b6/g, 'ö'],
    [/\u00c3\u2013/g, 'Ö'],
    [/\u00c5\u0178/g, 'ş'],
    [/\u00c5\u017d/g, 'Ş'],
    [/\u00c3\u00bc/g, 'ü'],
    [/\u00c3\u0153/g, 'Ü'],
  ];
  replacements.forEach(([pattern, replacement]) => {
    out = out.replace(pattern, replacement);
  });
  return out;
}

function sanitizeAffectionateRepetition(text: string) {
  return (text || '')
    .replace(/\b(canım|tatlım|güzelim|evladım|yavrum)([\s,;:]+\1\b)+/giu, '$1')
    .replace(/\b(canım|tatlım|güzelim|evladım|yavrum),?\s+([^.?!]{0,80}?)\b\1\b/giu, '$1, $2')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function cleanGeneratedTurkishText(text: string) {
  return sanitizePublicReadingLanguage(sanitizeAffectionateRepetition(repairMojibakeTurkish(text)));
}

function normalizeSignLabel(sign: string | null | undefined) {
  const repaired = repairMojibakeTurkish(sign || '').trim();
  const aliases: Record<string, string> = {
    koc: 'Koç',
    koç: 'Koç',
    boga: 'Boğa',
    boğa: 'Boğa',
    ikizler: 'İkizler',
    yengec: 'Yengeç',
    yengeç: 'Yengeç',
    aslan: 'Aslan',
    basak: 'Başak',
    başak: 'Başak',
    terazi: 'Terazi',
    akrep: 'Akrep',
    yay: 'Yay',
    oglak: 'Oğlak',
    oğlak: 'Oğlak',
    kova: 'Kova',
    balik: 'Balık',
    balık: 'Balık',
  };
  const key = repaired.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return aliases[key] || repaired || 'Analiz edildi';
}

function dateKeyFromDate(date: Date) {
  const { dateKey } = periodDateParts(date);
  return dateKey;
}

function addDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function natalAscendantLongitude(profile: SubjectProfile) {
  if (!profile.birth.timeKnown || !profile.birth.time || !profile.birth.date) return null;
  const location = resolveAstroLocation(profile.birth.location);
  if (!location) return null;
  const birthUtc = zonedDateTimeToUtc(profile.birth.date, profile.birth.time, location.timezone);
  return ascendantLongitude(new Astronomy.AstroTime(birthUtc), location.latitude, location.longitude);
}

function periodCheckpointDates(period: AstroPeriod) {
  const base = new Date(`${todayIsoDate()}T12:00:00.000Z`);
  if (period === 'daily') return [base];
  if (period === 'weekly') return [base, addDays(base, 3), addDays(base, 6)];
  if (period === 'monthly') return [base, addDays(base, 7), addDays(base, 14), addDays(base, 21)];
  return [base, addDays(base, 90), addDays(base, 180), addDays(base, 270)];
}

function buildTransitPlanets(profile: SubjectProfile, date = new Date(`${todayIsoDate()}T12:00:00.000Z`)) {
  const time = new Astronomy.AstroTime(date);
  const natalAscendant = natalAscendantLongitude(profile);
  return buildLocalPlanets(time, natalAscendant).map((planet) => ({
    planetLabel: planet.name,
    signLabel: planet.sign,
    degreeInSign: Number(planet.degree.toFixed(1)),
    retrograde: planet.retrograde,
    natalHouse: planet.house,
    longitude: planet.longitude,
  }));
}

function buildTransitToNatalAspects(chart: BirthChartSnapshot, profile: SubjectProfile, date?: Date) {
  const transits = buildTransitPlanets(profile, date);
  const aspects: CompactAstroPayload['data']['transit']['toNatalAspects'] = [];
  const aspectDefs = [
    { aspect: 'Kavuşum', angle: 0, orb: 4 },
    { aspect: 'Altmışlık', angle: 60, orb: 3 },
    { aspect: 'Kare', angle: 90, orb: 4 },
    { aspect: 'Üçgen', angle: 120, orb: 4 },
    { aspect: 'Karşıt', angle: 180, orb: 4 },
  ];
  for (const transit of transits.slice(0, 7)) {
    for (const natal of chart.planets.slice(0, 7)) {
      const delta = aspectDelta(transit.longitude, natal.longitude);
      const hit = aspectDefs.find((aspect) => Math.abs(delta - aspect.angle) <= aspect.orb);
      if (!hit) continue;
      aspects.push({
        transitPlanetLabel: transit.planetLabel,
        natalPlanetLabel: natal.name,
        aspect: hit.aspect,
        orb: Number(Math.abs(delta - hit.angle).toFixed(1)),
      });
    }
  }
  return aspects.sort((a, b) => a.orb - b.orb).slice(0, 8);
}

function stripTransitLongitude(planet: ReturnType<typeof buildTransitPlanets>[number]) {
  const { longitude: _longitude, ...rest } = planet;
  return rest;
}

function solarAreaFromTransit(signLabel: string, transitSignLabel: string) {
  const natalIndex = SIGN_LABELS.indexOf(signLabel);
  const transitIndex = SIGN_LABELS.indexOf(transitSignLabel);
  if (natalIndex < 0 || transitIndex < 0) return null;
  const areaIndex = ((transitIndex - natalIndex + 12) % 12) + 1;
  const labels: Record<number, string> = {
    1: 'benlik ve enerji',
    2: 'para, değer ve güven',
    3: 'iletişim ve yakın çevre',
    4: 'ev, aile ve iç denge',
    5: 'yaratıcılık ve keyif',
    6: 'rutin, iş akışı ve sağlık düzeni',
    7: 'ilişkiler ve ortaklıklar',
    8: 'paylaşım, kriz ve dönüşüm',
    9: 'uzaklar, eğitim ve inançlar',
    10: 'hedefler ve görünürlük',
    11: 'sosyal çevre ve gelecek planları',
    12: 'içe dönüş ve kapanışlar',
  };
  return { areaNo: areaIndex, label: labels[areaIndex] };
}

function buildGeneralSkyAspects(date: Date) {
  const time = new Astronomy.AstroTime(date);
  const planets = buildLocalPlanets(time, null);
  return buildAspects(planets)
    .slice(0, 7)
    .map((aspect) => ({
      planet1Label: aspect.planetA,
      planet2Label: aspect.planetB,
      aspect: aspect.type,
      orb: aspect.orb,
      tone: aspect.type === 'Kare' || aspect.type === 'Karşıt' ? 'sert etki' : 'akışkan/destekleyici etki',
    }));
}

export function buildGeneralAstroSkyContext(signLabel: string, period: AstroPeriod = 'daily') {
  const checkpoints = periodCheckpointDates(period);
  const currentDate = checkpoints[0] || new Date(`${todayIsoDate()}T12:00:00.000Z`);
  const currentPositions = buildLocalPlanets(new Astronomy.AstroTime(currentDate), null).slice(0, 8);
  const dominantSolarAreas = currentPositions
    .map((planet) => {
      const area = solarAreaFromTransit(signLabel, planet.sign);
      if (!area) return null;
      return {
        planetLabel: planet.name,
        signLabel: planet.sign,
        retrograde: planet.retrograde,
        solarArea: area.label,
      };
    })
    .filter(Boolean)
    .slice(0, 6);
  return {
    source: 'mobile-local-astro',
    rule: 'Genel Güneş burcu yorumu; kişisel yükselen, Ay burcu, doğum saati ve natal ev bilgisi içermez.',
    signLabel,
    period,
    currentSky: {
      dateKey: dateKeyFromDate(currentDate),
      positions: currentPositions.map((planet) => ({
        planetLabel: planet.name,
        signLabel: planet.sign,
        degreeInSign: Number(planet.degree.toFixed(1)),
        retrograde: planet.retrograde,
      })),
      aspects: buildGeneralSkyAspects(currentDate),
      solarSignFocus: dominantSolarAreas,
    },
    periodTimeline: checkpoints.map((date) => ({
      dateKey: dateKeyFromDate(date),
      positions: buildLocalPlanets(new Astronomy.AstroTime(date), null)
        .slice(0, 7)
        .map((planet) => ({
          planetLabel: planet.name,
          signLabel: planet.sign,
          retrograde: planet.retrograde,
        })),
      aspects: buildGeneralSkyAspects(date).slice(0, 4),
    })),
  };
}

function buildCompactAstroPayload(
  profile: SubjectProfile,
  chart: BirthChartSnapshot,
  locationPrecision: string,
  period: AstroPeriod = 'daily',
): CompactAstroPayload {
  const transitPositions = buildTransitPlanets(profile);
  const periodTimeline = periodCheckpointDates(period).map((date) => ({
    dateKey: dateKeyFromDate(date),
    positions: buildTransitPlanets(profile, date).slice(0, 7).map(stripTransitLongitude),
    toNatalAspects: buildTransitToNatalAspects(chart, profile, date),
  }));
  return {
    ok: true,
    source: 'mobile-local-astro',
    data: {
      natal: {
        sunSignLabel: chart.sign,
        risingSignLabel: chart.ascendant,
        timeKnown: Boolean(profile.birth.timeKnown && profile.birth.time),
        locationPrecision,
        positions: chart.planets.map((planet) => ({
          planetLabel: planet.name,
          signLabel: planet.sign,
          degreeInSign: Number(planet.degree.toFixed(1)),
          longitude: Number(planet.longitude.toFixed(2)),
          retrograde: planet.retrograde,
          house: planet.house,
        })),
        aspects: chart.aspects.map((aspect) => ({
          planet1Label: aspect.planetA,
          planet2Label: aspect.planetB,
          aspect: aspect.type,
          orb: aspect.orb,
        })),
      },
      transit: {
        positions: transitPositions.slice(0, 7).map(stripTransitLongitude),
        toNatalAspects: buildTransitToNatalAspects(chart, profile),
        periodTimeline,
      },
    },
  };
}

function withFallbackBirthLocation(profile: SubjectProfile): SubjectProfile {
  const country = profile.birth.location.country?.trim() || 'Türkiye';
  const cityOrRegion = profile.birth.location.cityOrRegion?.trim() || 'İstanbul';
  return {
    ...profile,
    birth: {
      ...profile.birth,
      time: profile.birth.timeKnown ? profile.birth.time : null,
      timeKnown: Boolean(profile.birth.timeKnown && profile.birth.time),
      location: {
        ...profile.birth.location,
        country,
        cityOrRegion,
        district: profile.birth.location.district?.trim() || null,
      },
    },
  };
}

function astroSubjectRelationshipLabel(profile: SubjectProfile, fallback?: string | null) {
  if (fallback?.trim()) return fallback.trim();
  if (profile.relationshipPrimary === 'evcil_hayvan') return profile.relationshipFreeform || 'evcil hayvan';
  if (profile.relationshipPrimary === 'akraba') return profile.relationshipFreeform || profile.relationshipDetail || 'akraba';
  return profile.relationshipPrimary;
}

function subjectPrecisionFlags(original: SubjectProfile) {
  return {
    dateKnown: Boolean(original.birth.date),
    timeKnown: Boolean(original.birth.timeKnown && original.birth.time),
    placeKnown: Boolean(original.birth.location.country && original.birth.location.cityOrRegion),
  };
}

function buildSynastryAspects(
  left: BirthChartSnapshot,
  right: BirthChartSnapshot,
): Array<{ from: string; to: string; aspect: string; orb: number; theme: string }> {
  const aspectDefs = [
    { aspect: 'Kavuşum', angle: 0, orb: 7, theme: 'çok güçlü temas' },
    { aspect: 'Altmışlık', angle: 60, orb: 4, theme: 'akış ve destek' },
    { aspect: 'Kare', angle: 90, orb: 5, theme: 'gerilim ve gelişim alanı' },
    { aspect: 'Üçgen', angle: 120, orb: 5, theme: 'doğal uyum' },
    { aspect: 'Karşıt', angle: 180, orb: 6, theme: 'çekim ve kutuplaşma' },
  ];
  const priority = new Set(['Güneş', 'Ay', 'Merkür', 'Venüs', 'Mars', 'Satürn']);
  const hits: Array<{ from: string; to: string; aspect: string; orb: number; theme: string; score: number }> = [];
  for (const a of left.planets.filter((planet) => priority.has(planet.name))) {
    for (const b of right.planets.filter((planet) => priority.has(planet.name))) {
      const delta = aspectDelta(a.longitude, b.longitude);
      const hit = aspectDefs.find((aspect) => Math.abs(delta - aspect.angle) <= aspect.orb);
      if (!hit) continue;
      const tightness = hit.orb - Math.abs(delta - hit.angle);
      const luminaryBoost = a.name === 'Güneş' || a.name === 'Ay' || b.name === 'Güneş' || b.name === 'Ay' ? 2 : 0;
      hits.push({
        from: a.name,
        to: b.name,
        aspect: hit.aspect,
        orb: Number(Math.abs(delta - hit.angle).toFixed(1)),
        theme: hit.theme,
        score: tightness + luminaryBoost,
      });
    }
  }
  return hits.sort((a, b) => b.score - a.score || a.orb - b.orb).slice(0, 14).map(({ score: _score, ...item }) => item);
}

function buildRelationshipAstroContext(subjects: AstroRelationshipSubject[]) {
  return subjects.map((subject) => {
    if (!subject.profile.birth.date) {
      throw new Error(`${subject.profile.displayName} için doğum tarihi gerekli.`);
    }
    const fallbackProfile = withFallbackBirthLocation(subject.profile);
    const location = resolveAstroLocation(fallbackProfile.birth.location);
    if (!location) {
      throw new Error(`${subject.profile.displayName} için doğum yeri çözümlenemedi.`);
    }
    const chart = buildLocalBirthChartSnapshot(fallbackProfile);
    return {
      source: subject.source,
      roleLabel: astroSubjectRelationshipLabel(subject.profile, subject.roleLabel),
      profile: subject.profile,
      fallbackProfile,
      chart,
      locationPrecision: location.precision,
      precision: subjectPrecisionFlags(subject.profile),
      compact: {
        displayName: subject.profile.displayName,
        relationshipLabel: astroSubjectRelationshipLabel(subject.profile, subject.roleLabel),
        isPet: subject.profile.relationshipPrimary === 'evcil_hayvan',
        source: subject.source,
        profileContext: formatSubjectIdentityMemory(subject.memorySnippet),
        precision: subjectPrecisionFlags(subject.profile),
        sunSign: chart.sign,
        moonSign: chart.moonSign,
        risingSign: chart.ascendant,
        planets: chart.planets.map((planet) => ({
          name: planet.name,
          sign: planet.sign,
          degree: Number(planet.degree.toFixed(1)),
          house: planet.house,
          retrograde: planet.retrograde,
        })),
        points: (chart.points || []).map((point) => ({
          name: point.name,
          sign: point.sign,
          degree: Number(point.degree.toFixed(1)),
          house: point.house,
        })),
        natalAspects: chart.aspects,
      },
    };
  });
}

function relationshipModeLabel(mode: AstroRelationshipMode) {
  return mode === 'family' ? 'astrolojik aile okuması' : 'astrolojik uyum analizi';
}

function buildRelationshipPrompt(params: {
  mode: AstroRelationshipMode;
  assistantId: string;
  assistantLabel: string;
  subjects: ReturnType<typeof buildRelationshipAstroContext>;
  compatibilityContext?: AstroCompatibilityContext | string | null;
  memorySnippet?: ProfileMemorySnippet | null;
}) {
  const personaContext = assistantPersonaContext(params.assistantId);
  const memoryContext = formatAstroAvoidanceMemory(params.memorySnippet, String(params.compatibilityContext || ''));
  const synastry =
    params.mode === 'compatibility' && params.subjects.length >= 2
      ? buildSynastryAspects(params.subjects[0].chart, params.subjects[1].chart)
      : [];
  const familyPairs =
    params.mode === 'family'
      ? params.subjects.flatMap((left, leftIndex) =>
          params.subjects.slice(leftIndex + 1).map((right) => ({
            pair: `${left.profile.displayName} - ${right.profile.displayName}`,
            aspects: buildSynastryAspects(left.chart, right.chart).slice(0, 6),
          })),
        )
      : [];
  const subjectNames = params.subjects.map((subject) => subject.profile.displayName);
  const hasPet = params.subjects.some((subject) => subject.profile.relationshipPrimary === 'evcil_hayvan');
  const systemText = [
    'Seçili persona Türkçe, sıcak ve kişisel astrolog sesini belirler.',
    'Kendini tanıtma; kullanıcıya görünen metinde yorumcu/persona adı, public label veya rol tanıtımı yazma. Doğrudan yoruma başla.',
    'Kullanıcıya görünen metinde hukuken kesin gelecek iddiası kurma; "yorum", "okuma", "sembolik ritüel", "sembolik yorum", "izlenim", "olasılık", "eğilim" dili kullan.',
    'Sağlık ve finans alanlarında spesifik tavsiye verme. İnsan sağlığıyla ilgili endişede doktora/uygun sağlık uzmanına, hayvan sağlığıyla ilgili endişede veterinere görünmeyi nazikçe öner.',
    '"Şunu ye/iç geçer", "kesin geçecek", "kesin iyileşecek", ilaç/doz/tedavi/beslenme reçetesi veya kesin sonuç dili yasak.',
    'Yalnızca verilen doğum verileri, gezegen yerleşimleri ve sinastri/aile haritası bağlamıyla konuş.',
    'Kişilik testi, doğum haritası veya numeroloji hafıza bağlamı verilirse bunları kişinin mizacını anlamak için içsel bağlam olarak kullan; MBTI kodu, test adı, test sonucu, numeroloji haritası veya hafıza kaydı gibi kaynak isimlerini kullanıcıya açık açık söyleme.',
    'Kahve, fincan, telve, el çizgisi, tarot veya kart dili kullanma.',
    'Teknik astrolojiyi boğmadan açıkla; Güneş, Ay, Merkür, Venüs, Mars, Satürn, Ay düğümleri ve yükselen/ev bilgisi varsa ilişki dinamiğine çevir.',
    'Doğum saati veya yer bilgisi eksikse bunu yalnızca belirsizlik payı olarak bil; şehir, ilçe, koordinat veya varsayılan konum adlarını asla söyleme.',
    hasPet
      ? 'Evcil hayvanlar aile bireyidir; pet olan özneyi romantik, cinsel veya yetişkin insan ilişkisi diliyle yorumlama. İş, para kazanma, okul, evlilik veya insan sosyal çevresi teması yükleme; hayvanın güveni, rutini, duyuları, ev içi alanı, diğer hayvanlarla ilişkisi ve insanlarıyla bağı üzerinden konuş.'
      : '',
    'Kesin kader hükmü verme; uyumu potansiyel, ritim, ihtiyaç, gerilim ve gelişim alanı olarak anlat.',
  ].filter(Boolean).join(' ');
  const userText = [
    `Okuma tipi: ${relationshipModeLabel(params.mode)}`,
    subjectNames.length ? `Kapsanması zorunlu aile bireyleri: ${subjectNames.join(', ')}` : '',
    params.compatibilityContext ? `Uyum bağlamı: ${params.compatibilityContext}` : '',
    personaContext ? `Yorumcu persona kartı:\n${personaContext}` : '',
    memoryContext ? `Hafıza ve tekrar koruması:\n${memoryContext}` : '',
    `Kişiler JSON:\n${JSON.stringify(params.subjects.map((subject) => subject.compact))}`,
    synastry.length ? `Ana sinastri açıları JSON:\n${JSON.stringify(synastry)}` : '',
    familyPairs.length ? `Aile içi ikili temaslar JSON:\n${JSON.stringify(familyPairs)}` : '',
    params.mode === 'compatibility'
      ? [
          'Detaylı astrolojik uyum analizi yaz.',
          hasPet ? 'İlk paragrafta evcil hayvanın dahil olduğu bağın ritmini güven, alışma, oyun, alan ve temas diliyle özetle.' : 'İlk paragrafta iki tarafın ilişki ritmini net özetle.',
          hasPet ? 'Sonra duygusal güven, iletişim işaretleri, enerji/oyun ritmi, sınır ve alan ihtiyacı, hassasiyet tetikleri ve birlikte rahatlama alanlarını ayrı kısa paragraflarla işle.' : 'Sonra duygusal uyum, iletişim/zihin, çekim/enerji, güven-sorumluluk, çatışma tetikleri ve birlikte büyüme alanlarını ayrı kısa paragraflarla işle.',
          hasPet ? 'Pet olan özne varsa aşk, iş, evlilik veya yetişkin insan uyumu varsayımı yapma; bağlamı sahip-refakatçi, ev arkadaşı, aile veya hayvanlar arası uyum olarak kur.' : 'Uyum bağlamı aşk değilse romantik varsayım yapma; iş, dostluk, ev arkadaşlığı, komşuluk veya genel bağlam neyse ona göre dil kur.',
          'İki kişinin doğum verilerindeki eksikler varsa yorumun güven aralığını abartmadan koru; eksik şehir/ilçe adı söyleme.',
          PERSONAL_INITIAL_READING_TOKEN_INSTRUCTION,
        ].join(' ')
      : [
          'Detaylı astrolojik aile okuması yaz.',
          `Kapsama kuralı çok önemli: ${subjectNames.length} aile bireyinin tamamını yoruma dahil et; hiçbirini atlama. Her bireyin adı metinde en az bir kez geçsin, ama bir kişiye diğerlerinden belirgin biçimde daha uzun alan ayırma.`,
          'Tek tek uzun bireysel profil dökümü yapma. Odağı aile sistemi, karşılıklı iletişim, bağlanma ritmi, roller, güven ihtiyacı, alan paylaşımı, uyum ve sürtüşme noktaları üzerinde tut.',
          'İlk paragrafta ailenin genel duygusal iklimini ve ortak ritmini özetle; baskın kişiyi merkeze alan bir okuma gibi yazma.',
          'Sonraki paragraflarda kişileri birbirlerine göreli anlat: kim kimin ritmini yumuşatıyor, kim kimin sınırını tetikliyor, kim evin güven/oyun/sakinlik/düzen ihtiyacını taşıyor.',
          'Doğum verileri, kişisel eğilim hafızası, önceki doğum haritası veya numeroloji bağlamı varsa bunları açık kaynak adı vermeden kişinin mizaç ve ihtiyaç yorumuna yedir.',
          'Son bölümde ikili/çoklu dinamiklerde destek ve gerilim noktalarını, ardından ev içi denge önerilerini ver.',
          'Pet varsa onu ailenin duygusal düzenleyicisi, alışkanlık ritmi ve bağ kurma biçimi olarak yorumla; insan gibi sorumluluk yükleme.',
          'Eksik doğum saatlerini yalnızca hassasiyet sınırı olarak dikkate al; şehir/ilçe adı veya varsayılan konum söyleme.',
          PERSONAL_INITIAL_READING_TOKEN_INSTRUCTION,
        ].join(' '),
  ].filter(Boolean).join('\n\n');
  return {
    system_instruction: { parts: [{ text: systemText }] },
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens:
        params.mode === 'family'
          ? PERSONAL_INITIAL_READING_MAX_OUTPUT_TOKENS + Math.min(500, Math.max(0, params.subjects.length - 2) * 180)
          : PERSONAL_INITIAL_READING_MAX_OUTPUT_TOKENS,
    },
  };
}

export async function createBirthChartSnapshot(profile: SubjectProfile): Promise<BirthChartSnapshot> {
  const fingerprint = profileFingerprint(profile);
  const cached = await loadBirthChartFromCache(profile.profileId, fingerprint);
  if (cached) return cached;

  const chart = buildLocalBirthChartSnapshot(profile);
  await saveBirthChartToCache(profile.profileId, fingerprint, chart);
  return chart;
}

function birthChartAssistantStyleHint() {
  return 'Modern rafine ton: farkındalık dili yüksek, sıcak ama net bir astrolog; teknik bilgiyi insanın hayatına çevirerek anlatır.';
}

function buildBirthChartInterpretationPayload(params: {
  profile: SubjectProfile;
  chart: BirthChartSnapshot;
  locationLabel: string;
  locationPrecision: string;
  memorySnippet?: ProfileMemorySnippet | null;
}) {
  const keyPlacements = {
    sunSign: params.chart.sign,
    moonSign: params.chart.moonSign,
    risingSign: params.chart.ascendant,
    precisionNote: params.chart.precisionNote,
    timezoneUsed: params.chart.timezoneUsed,
    locationLabel: params.locationLabel,
    locationPrecision: params.locationPrecision,
    timeKnown: Boolean(params.profile.birth.timeKnown && params.profile.birth.time),
    birthTime: params.profile.birth.timeKnown ? params.profile.birth.time : null,
  };
  const chartData = {
    planets: params.chart.planets.map((planet) => ({
      name: planet.name,
      sign: planet.sign,
      degree: Number(planet.degree.toFixed(1)),
      house: planet.house,
      retrograde: planet.retrograde,
    })),
    points: (params.chart.points || []).map((point) => ({
      name: point.name,
      sign: point.sign,
      degree: Number(point.degree.toFixed(1)),
      house: point.house,
      note: point.note,
    })),
    aspects: params.chart.aspects.map((aspect) => ({
      planetA: aspect.planetA,
      planetB: aspect.planetB,
      type: aspect.type,
      orb: aspect.orb,
    })),
    notes: params.chart.transitNotes,
  };
  const relevantMemory = formatRelevantMemory(params.memorySnippet, null, 'doğum haritası yorumu');
  const systemText =
    'Türkçe konuşan kişisel astrolog sesiyle yaz. Kendini tanıtma; yorumcu/persona adı, public label veya rol tanıtımı yazma, doğrudan yoruma gir. Kullanıcıya görünen metinde hukuken kesin gelecek iddiası kurma; "yorum", "okuma", "sembolik ritüel", "sembolik yorum", "izlenim", "olasılık", "eğilim" dili kullan. Sağlık ve finans alanlarında spesifik tavsiye verme; insan sağlığı endişesinde doktora/uzmana, hayvan sağlığı endişesinde veterinere yönlendir. Yalnızca verilen doğum haritası verilerini kullan. Teknik bilgiyi boğmadan, her konumu kişinin hayatı, ilişki biçimi, karar alma tarzı, dönemleri ve iç dünyasıyla anlamlandır. Kesin karakter hükmü verme; insanın dinamik olduğunu hissettir.';
  const userText = [
    `Profil: ${params.profile.displayName}`,
    `Anlatım tonu: ${birthChartAssistantStyleHint()}`,
    `Hitap politikası: ${addressPolicyForProfile(params.profile, params.profile.displayName)}`,
    relevantMemory ? `Seçilmiş hafıza bağlamı:\n${relevantMemory}` : '',
    `Ana yerleşimler JSON:\n${JSON.stringify(keyPlacements)}`,
    `Doğum haritası verisi JSON:\n${JSON.stringify(chartData)}`,
    [
      'Kapsamlı ama sıkmayan bir doğum haritası yorumu yaz.',
      'Metni anlam akışına göre 5-7 kısa paragrafta ver: açılış/ana karakter, duygu dünyası, zihin ve iletişim, ilişkiler, iş-para/yaşam yönü, gelişim dersleri ve kapanış. Her konu değişiminde boş satır bırak.',
      'Hitap modunu metin boyunca değiştirme; üçüncü tekil şahısla başladıysan "sen" diline geçme, "sen" diliyle başladıysan profil adıyla dışarıdan anlatmaya dönme.',
      'İlk paragrafta kişinin burç listesini rapor gibi tekrarlama; Güneş, yükselen ve Ay bilgisini yalnızca bir kez, akıcı ve kısa bir çerçeve olarak kullan.',
      'birthTime dolu ve timeKnown true ise kesinlikle doğum saati bilinmiyor deme; yükselen ve evler okunabilir kabul edilir.',
      'Doğum saati yoksa yükselen, evler ve saat hassasiyetli yorumların güvenilir olmayacağını yalnızca bir kez ve kısa belirt.',
      'İlçe, şehir merkezi, koordinat hassasiyeti veya yaklaşık konum hesabından bahsetme.',
      'Gezegenleri, bulundukları burçları ve varsa evlerini tek tek hayat alanlarına çevir: benlik, duygu, zihin, ilişki, enerji, genişleme, sorumluluk, değişim, sezgi ve dönüşüm.',
      'Açıları teknik liste gibi değil, gezegenlerin birbirleriyle kurduğu iç gerilim/destek diliyle anlat.',
      'Kuzey Ay Düğümü, Güney Ay Düğümü ve Lilith varsa yaklaşık ek noktalar olduklarını bilerek gelişim yönü, alışkanlıklar ve bastırılan sınırlar olarak yorumla.',
      'Kişiyi etiketleme; “sen böylesin” yerine “sende böyle bir eğilim çalışabilir” dilini kullan.',
      'Başlık kullanabilirsin ama kısa tut. Yaklaşık 3000 token civarında ana yorumu toparlamaya başla; kalan alanı sonuç, genel değerlendirme ve nazik kapanış için kullan. En geç 4092 token içinde tamamla.',
    ].join(' '),
  ].join('\n\n');
  return {
    system_instruction: { parts: [{ text: systemText }] },
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    generationConfig: {
      temperature: 0.62,
      maxOutputTokens: BIRTH_CHART_MAIN_MAX_OUTPUT_TOKENS,
    },
  };
}

function buildBirthChartContinuationPayload(params: {
  profile: SubjectProfile;
  chart: BirthChartSnapshot;
  previousText: string;
}) {
  const chartSummary = {
    sunSign: params.chart.sign,
    moonSign: params.chart.moonSign,
    risingSign: params.chart.ascendant,
    precisionNote: params.chart.precisionNote,
    timeKnown: Boolean(params.chart.ascendant),
    planets: params.chart.planets.map((planet) => ({
      name: planet.name,
      sign: planet.sign,
      degree: Number(planet.degree.toFixed(1)),
      house: planet.house,
      retrograde: planet.retrograde,
    })),
    points: (params.chart.points || []).map((point) => ({
      name: point.name,
      sign: point.sign,
      degree: Number(point.degree.toFixed(1)),
      house: point.house,
    })),
    aspects: params.chart.aspects,
  };
  const systemText =
    'Türkçe konuşan kişisel astrolog sesiyle yaz. Kendini tanıtma; yorumcu/persona adı, public label veya rol tanıtımı yazma. Kullanıcıya görünen metinde hukuken kesin gelecek iddiası kurma; "yorum", "okuma", "sembolik ritüel", "sembolik yorum", "izlenim", "olasılık", "eğilim" dili kullan. Sağlık ve finans alanlarında spesifik tavsiye verme; insan sağlığı endişesinde doktora/uzmana, hayvan sağlığı endişesinde veterinere yönlendir. Önceki doğum haritası yorumu token sınırı yüzünden yarım kalmış olabilir; metni tekrar etmeden doğal biçimde tamamla.';
  const userText = [
    `Profil: ${params.profile.displayName}`,
    `Harita özeti JSON:\n${JSON.stringify(chartSummary)}`,
    `Şimdiye kadar üretilen doğum haritası yorumu:\n${params.previousText}`,
    [
      'Yukarıdaki metni baştan yazma ve önceki paragrafları tekrar etme.',
      'Son cümle yarım kaldıysa önce onu doğal biçimde tamamla.',
      'Eksik kalan önemli yerleşim, açı, Lilith veya Ay Düğümü teması varsa kısaca tamamla.',
      'Ardından genel değerlendirme ve nazik kapanış yaz.',
      'Yeni baştan kapsamlı yorum üretme; yalnızca devam ve kapanış ver. Yaklaşık 700-1000 token içinde bitir.',
    ].join(' '),
  ].join('\n\n');
  return {
    system_instruction: { parts: [{ text: systemText }] },
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    generationConfig: {
      temperature: 0.54,
      maxOutputTokens: BIRTH_CHART_CONTINUATION_MAX_OUTPUT_TOKENS,
    },
  };
}

export async function createBirthChartInterpretation(params: {
  profile: SubjectProfile;
  chart?: BirthChartSnapshot;
  memorySnippet?: ProfileMemorySnippet | null;
}): Promise<AstroReadingResult> {
  const location = resolveAstroLocation(params.profile.birth.location);
  if (!params.profile.birth.date || !location) {
    throw new Error('Doğum haritası yorumu için doğum tarihi, ülke ve şehir gerekli.');
  }
  const chart = params.chart || (await createBirthChartSnapshot(params.profile));
  const payload = buildBirthChartInterpretationPayload({
    profile: params.profile,
    chart,
    locationLabel: location.label,
    locationPrecision: location.precision,
    memorySnippet: params.memorySnippet,
  });
  const data = await generateGeminiTextDirect(payload, 70000);
  let text = cleanGeneratedTurkishText(data.text);
  let usage = data.usage;
  if (data.finishReason === 'MAX_TOKENS') {
    const continuation = await generateGeminiTextDirect(
      buildBirthChartContinuationPayload({
        profile: params.profile,
        chart,
        previousText: text,
      }),
      70000,
    );
    text = `${text}\n\n${cleanGeneratedTurkishText(continuation.text)}`.trim();
    usage = {
      inputTokens: usage.inputTokens + continuation.usage.inputTokens,
      outputTokens: usage.outputTokens + continuation.usage.outputTokens,
      totalTokens: usage.totalTokens + continuation.usage.totalTokens,
    };
  }
  return {
    text: sanitizeGenderedAddress(
      appendHealthProfessionalReminder(sanitizePublicReadingLanguage(stripPersonaSelfIntroduction(text)), {
        isAnimalProfile: params.profile.relationshipPrimary === 'evcil_hayvan',
      }),
      {
        memorySnippet: params.memorySnippet,
        isAnimalProfile: params.profile.relationshipPrimary === 'evcil_hayvan',
      },
    ),
    sign: normalizeSignLabel(chart.sign),
    risingSign: chart.ascendant,
    timezoneUsed: location.timezone,
    periodKey: `birth-chart-${params.profile.profileId}`,
    precisionNote: chart.precisionNote,
    cached: false,
    modelName: data.model,
    usage,
  };
}

export async function createBirthChartFollowUp(params: {
  profileName: string;
  chart: BirthChartSnapshot;
  interpretationText: string;
  question: string;
  previousFollowUps?: Array<{ role: 'user' | 'assistant'; text: string }>;
  memorySnippet?: ProfileMemorySnippet | null;
}): Promise<{ text: string; modelName?: string; usage: { inputTokens: number; outputTokens: number; totalTokens: number } }> {
  const relevantMemory = formatRelevantMemory(params.memorySnippet, params.question, 'doğum haritası takip sorusu');
  const previousFollowUpText = (params.previousFollowUps || [])
    .filter((message) => message.text.trim())
    .map((message) => `${message.role === 'user' ? 'Kullanıcı' : 'Yorumcu'}: ${message.text.trim()}`)
    .join('\n');
  const chartSummary = {
    sunSign: params.chart.sign,
    moonSign: params.chart.moonSign,
    risingSign: params.chart.ascendant,
    precisionNote: params.chart.precisionNote,
    planets: params.chart.planets.map((planet) => ({
      name: planet.name,
      sign: planet.sign,
      degree: Number(planet.degree.toFixed(1)),
      house: planet.house,
      retrograde: planet.retrograde,
    })),
    points: (params.chart.points || []).map((point) => ({
      name: point.name,
      sign: point.sign,
      degree: Number(point.degree.toFixed(1)),
      house: point.house,
    })),
    aspects: params.chart.aspects,
  };
  const systemText = [
    'Seçili persona sıcak, modern ve kişisel astrolog sesini belirler.',
    'Cevabı mevcut doğum haritası yorumu ve soru-cevap akışı üzerinden ver.',
    FOLLOW_UP_CHAT_CONTRACT,
    'Kendini tekrar tanıtma; kullanıcıya görünen metinde yorumcu/persona adı, public label veya rol tanıtımı yazma.',
    'Kullanıcıya görünen metinde hukuken kesin gelecek iddiası kurma; "yorum", "okuma", "sembolik ritüel", "sembolik yorum", "izlenim", "olasılık", "eğilim" dili kullan.',
    'Sağlık ve finans alanlarında spesifik tavsiye verme. İnsan sağlığıyla ilgili endişede doktora/uygun sağlık uzmanına, hayvan sağlığıyla ilgili endişede veterinere görünmeyi nazikçe öner.',
    '"Şunu ye/iç geçer", "kesin geçecek", "kesin iyileşecek", ilaç/doz/tedavi/beslenme reçetesi veya kesin sonuç dili yasak.',
    'Kullanıcının sorusunu kendi aklına gelmiş gibi sahiplenme; "aklıma geldi", "şimdi aklıma geldi" gibi ifadeler kullanma.',
    'Ana yorumu veya kişinin Güneş/Ay/yükselen bilgisini yeniden özetleme.',
    'Kullanıcı özellikle sormadıkça veri kaynağını anlatma; harita bilgisini cevaba ince ve doğal biçimde yedir.',
    'Teknik bilgiyi kısa tut; asıl anlatımı kişinin hayatındaki karşılığına çevir.',
    'Önceki cevaplarla çelişme, kesin karakter hükmü verme.',
  ].join(' ');
  const userText = [
    `Profil: ${params.profileName}`,
    `Harita özeti JSON:\n${JSON.stringify(chartSummary)}`,
    relevantMemory ? `Seçilmiş hafıza bağlamı:\n${relevantMemory}` : '',
    formatPetMentionMemoryContext(params.question, params.memorySnippet),
    `Ana doğum haritası yorumu:\n${params.interpretationText}`,
    previousFollowUpText ? `Bu harita yorumundaki önceki soru-cevap akışı:\n${previousFollowUpText}` : '',
    `Kullanıcının sorusu:\n${params.question}`,
    'Yanıtı 2 kısa paragraf olarak ver: ilk paragrafta net cevap, ikinci paragrafta harita bağlamından 1-2 gerekçe ve uygulanabilir kısa tavsiye olsun. Yaklaşık 120-170 token içinde tamamla.',
  ].filter(Boolean).join('\n\n');
  const data = await generateGeminiTextDirect(
    {
      system_instruction: { parts: [{ text: systemText }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: {
        temperature: 0.62,
        maxOutputTokens: 520,
      },
    },
    45000,
  );
  return {
    text: sanitizeGenderedAddress(
      appendHealthProfessionalReminder(cleanFollowUpReply(sanitizePublicReadingLanguage(stripPersonaSelfIntroduction(cleanGeneratedTurkishText(data.text)))), {
        userText: params.question,
        isAnimalProfile: params.memorySnippet?.relationshipPrimary === 'evcil_hayvan',
      }),
      { memorySnippet: params.memorySnippet },
    ),
    modelName: data.model,
    usage: data.usage,
  };
}

function personalAstroAssistantStyleHint(assistantId: string) {
  const styles: Record<string, string> = {
    selin: 'Modern rafine ton: farkındalık dili yüksek; teknik astrolojiyi zarif ve net bir içgörüye çevirir.',
    berk: 'Modern analitik ton: sade, dost gibi yakın; ihtimalleri gereksiz süslemeden mantıklı bir plana bağlar.',
    suzan: 'Anaç mahalle tonu: sıcak, sezgisel ve koruyucu; eski usul bilgelik hissedilir ama aşırı şekerli hitap kullanmaz.',
    teoman: 'Babacan öğretmen tonu: felsefi, sakin ve psikolojik derinliği olan; kısa öğütleri hayat tecrübesi gibi verir.',
    arin: 'Sezgisel kuir ton: yumuşak, sanatsal ve hafif melankolik; sembolleri duygu ve atmosferle okur.',
    ayse: 'Bilge doğa tonu: sakin, şefkatli ve köklendirici; gökyüzünü sabır, bereket ve iç denge diliyle okur.',
    deniz: 'Sosyal dinamik tonu: enerjik, zeki ve yakın; gökyüzünü ilişki alt metni ve sosyal ritim gibi okur.',
  };
  return styles[assistantId] || 'Seçili persona tonu: sıcak, doğal ve karakter içinde kalan.';
}

const NON_ASTRO_PERSONA_DOMAIN_TERMS =
  /kahve|fincan|telve|tabak|görsel|fotoğraf|avuç|el okuması|el çizg|tarot|kart|melek kart|rune|i ching|hexagram/i;

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

function astroSafePersonaText(text?: string) {
  return (text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !NON_ASTRO_PERSONA_DOMAIN_TERMS.test(line.toLocaleLowerCase('tr-TR')))
    .join('\n');
}

function assistantPersonaContext(assistantId: string) {
  const identity = FORTUNE_PERSONA_DATA[assistantId as keyof typeof FORTUNE_PERSONA_DATA];
  if (!identity?.systemBody) return '';
  const voice = astroSafePersonaText(
    identity.systemBody.match(/# Voice And Temperament\n\n([\s\S]*?)(?:\n\n# |$)/)?.[1]?.trim()
  );
  return [
    `Persona adı: ${identity.displayName}`,
    `İmza üslup:\n${domainNeutralPersonaSignature(assistantId)}`,
    voice ? `Ses ve mizaç (yalnızca üslup için):\n${voice}` : '',
    'Astroloji sınırı: Persona yalnızca ses, hitap, ritim ve tavır olarak taşınır; kahve, fincan, telve, tabak, avuç içi, el çizgisi, görsel, kart, tarot veya başka sembolik araç dili kullanılmaz.',
  ].filter(Boolean).join('\n\n');
}

function addressPolicyForProfile(profile: SubjectProfile, profileName: string) {
  if (isAnimalProfile(profile)) {
    return [
      buildAnimalProfileInstructionFromProfile(profile),
      'Hitap modu: seçili profil evcil hayvan. Metin boyunca hayvanı üçüncü tekil şahısla anlat; hesap sahibine hayvanın sahibi/refakatçisi olarak öneri ver.',
      'Astrolojik göstergeleri insan kariyeri, romantik ilişki, evlilik, okul veya para kazanma eksenine çevirme; hayvanın mizacı, güven ihtiyacı, ev rutini ve sahibiyle bağı üzerinden yorumla.',
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

function buildPersonalAstroGeminiPayload(params: {
  period: AstroPeriod;
  profileName: string;
  assistantId: string;
  assistantLabel: string;
  astroPayload: ReturnType<typeof buildCompactAstroPayload>;
  precisionNote: string;
  locationLabel: string;
  addressPolicy: string;
  focusQuestion?: string | null;
  memorySnippet?: ProfileMemorySnippet | null;
  isAnimalProfile?: boolean;
}) {
  const periodLabel = { daily: 'günlük', weekly: 'haftalık', monthly: 'aylık', yearly: 'yıllık' }[params.period];
  const data = params.astroPayload.data;
  const natal = data.natal;
  const transit = data.transit;
  const moon = natal.positions.find((planet) => planet.planetLabel === 'Ay');
  const keyPlacements = {
    sunSignLabel: natal.sunSignLabel,
    moonSignLabel: moon?.signLabel || null,
    risingSignLabel: natal.risingSignLabel,
    timeKnown: natal.timeKnown,
    locationPrecision: natal.locationPrecision,
  };
  const interpretationData = {
    natalPositions: natal.positions,
    natalAspects: natal.aspects,
    transitPositions: transit.positions,
    transitToNatalAspects: transit.toNatalAspects,
    periodTimeline: transit.periodTimeline,
  };
  const focusQuestion = params.focusQuestion?.replace(/\s+/g, ' ').trim() || '';
  const memoryContext = formatAstroAvoidanceMemory(params.memorySnippet, focusQuestion);
  const personaContext = assistantPersonaContext(params.assistantId);
  const isAnimalAstro = Boolean(params.isAnimalProfile || params.memorySnippet?.relationshipPrimary === 'evcil_hayvan');
  const focus = {
    daily: isAnimalAstro
      ? 'Bugünün evcil hayvan odağı, mizaç/duyu ritmi, oyun-dinlenme akışı, ev içi güven ve sahibine kısa öneri.'
      : 'Bugünün kişisel odağı, duygu ritmi, ilişki/iş akışı ve kısa öneri.',
    weekly: isAnimalAstro
      ? 'Haftanın evcil hayvan ana teması, oyun ve dinlenme düzeni, pencere/dış dünya merakı, evdeki bağlar ve uygulanabilir öneri.'
      : 'Haftanın ana teması, ilişki ve iş para ritmi, içsel denge ve uygulanabilir öneri.',
    monthly: isAnimalAstro
      ? 'Ayın evcil hayvan ana ritmi, ev içi güven, duyu hassasiyeti, sahibiyle bağ, diğer hayvanlarla minik sosyal dinamikler ve öneri.'
      : 'Ayın ana evresi, ilişki ve kariyer/para temaları, enerji dalgalanması ve öneri.',
    yearly: isAnimalAstro
      ? 'Yılın evcil hayvan ana ritimleri, güven, rutin, oyun, duyu dünyası, evdeki ilişkiler ve sahibine öneri.'
      : 'Yılın büyük temaları, ilişki, kariyer/para, kişisel gelişim, kritik dönemler ve öneri.',
  }[params.period];
  const systemText = [
    'Seçili persona kişiye özel astrolojide yalnızca ses, hitap ritmi ve konuşma sıcaklığını belirler.',
    'Use only the provided on-device astronomy JSON. Do not invent houses, ascendant, exact Moon degree or birth-time-sensitive claims when timeKnown is false.',
    'A personal reading must compare natal placements/aspects with the selected period transits, transit-to-natal aspects and transit movement through natal houses when available; do not collapse it into a generic sky report.',
    'Astroloji yorumunda kahve, fincan, telve, tabak, avuç içi, el çizgisi, görsel, kart, tarot veya başka sembolik araç dili kullanma; natal yerleşimler, transitler ve dönem akışı üzerinden konuş.',
    'Persona sesi teknik astroloji dilinin üstünde hissedilmeli: kelime seçimi, ritim, hitap ve tavsiye tonu seçili tona ait olmalı. Kullanıcıya görünen metinde kendi adını, public labelını veya rolünü yazma.',
    'Kullanıcıya görünen metinde hukuken kesin gelecek iddiası kurma; "yorum", "okuma", "sembolik ritüel", "sembolik yorum", "izlenim", "olasılık", "eğilim" dili kullan.',
    'Sağlık ve finans alanlarında spesifik tavsiye verme. İnsan sağlığıyla ilgili endişede doktora/uygun sağlık uzmanına, hayvan sağlığıyla ilgili endişede veterinere görünmeyi nazikçe öner.',
    '"Şunu ye/iç geçer", "kesin geçecek", "kesin iyileşecek", ilaç/doz/tedavi/beslenme reçetesi veya kesin sonuç dili yasak.',
  ].join(' ');
  const userText = [
    `Profile: ${params.profileName || 'Profil'}`,
    `Persona style: ${personalAstroAssistantStyleHint(params.assistantId)}`,
    personaContext ? `Persona tone card:\n${personaContext}` : '',
    `Period: ${periodLabel}`,
    `Birth/location precision note: ${params.precisionNote || 'Doğum bilgileri yeterli.'}`,
    `Resolved location: ${params.locationLabel || 'belirtilmedi'}`,
    `Address policy: ${params.addressPolicy}`,
    `Content focus: ${focusQuestion ? `Konu odaklı kişisel astroloji: ${focusQuestion}` : focus}`,
    focusQuestion ? `Kullanıcının yorumlanmasını istediği konu:\n${focusQuestion}` : '',
    memoryContext ? `Memory and repetition guard:\n${memoryContext}` : '',
    `Calculated key placements JSON:\n${JSON.stringify(keyPlacements)}`,
    `Period interpretation data JSON:\n${JSON.stringify(interpretationData)}`,
    [
      'Türkçe yaz. Başlık atma; düz, akıcı ve premium bir yorum ver.',
      focusQuestion ? 'Bu yorumda ilk paragraftan itibaren kullanıcının verdiği konuya doğrudan cevap ver; konuyu genel astroloji yorumunun arasında kaybetme.' : '',
      focusQuestion ? 'Kullanıcının konusu ana eksendir; hafıza ve önceki life event/olay sinyallerini yalnızca bu konuyla gerçek bağ kuruyorsa kullan, alakasız temaları zorla merkeze alma.' : '',
      'Metni anlam akışına göre 3-5 kısa paragrafta ver; her paragraf ayrı bir konu taşısın ve konu değişiminde boş satır bırak.',
      'Persona içinde kal ama kendini tanıtma.',
      'Hitap modunu metin boyunca değiştirme; üçüncü tekil şahısla başladıysan "sen" diline geçme, "sen" diliyle başladıysan profil adıyla dışarıdan anlatmaya dönme.',
      'Aynı şefkat hitabını bir yanıtta en fazla bir kez kullan; "canım canım", "tatlım tatlım", "güzelim güzelim" gibi ikilemeler yapma.',
      'Bu kişiye özel astroloji yorumu genel burç yorumu gibi yazılmamalı; natal yerleşimler, natal açılar, transitlerin natal noktalara yaptığı açılar ve varsa transitlerin natal evlerden geçişi birlikte okunmalı.',
      'Teknik omurga şu olsun: doğumdaki bir yerleşim/açı hangi hayat alanını hassaslaştırıyor, seçilen dönemdeki gerçek transit bunu nasıl tetikliyor, kişi bunu bugün/hafta/ay/yıl içinde nasıl hissedebilir.',
      'Kullanıcıya sürekli "doğum haritana göre", "yükselenin", "Güneş burcun" diye kaynak tabelası gösterme; ama gerektiğinde "doğumdaki Ay vurgun" veya "Marsın şu alana dokunuyor" gibi doğal ve teknik olarak anlamlı bağ kur.',
      isAnimalAstro
        ? 'Evcil hayvan profilde natal-transit karşılaştırmasını insan hayat alanlarına çevirme; mizaç, güven, ev rutini, oyun, uyku, duyu hassasiyeti, pencere/dış dünya merakı, evdeki diğer hayvanlarla ilişki ve sahibiyle bağ üzerinden anlat.'
        : 'Para ve finans, kariyer, aşk, sağlık, ilişkiler veya benzeri alanlarda o alanın dönemsel etkisini natal-transit karşılaştırmasıyla anlat; genel transit cümleleriyle yetinme.',
      'Sağlık konusu geçerse tıbbi tavsiye, tedavi, ilaç, doz, beslenme reçetesi veya kesin iyileşme dili kurma; insan için doktor/uzman, hayvan için veteriner yönlendirmesi yap.',
      'Period timeline verisini kullan: günlük için bugünü, haftalık/aylık/yıllık için ara tarihlerde güçlenen veya zayıflayan temaları sezdir.',
      'Memory bölümündeki eski temaları birebir tekrar etme; gerekiyorsa yalnızca yeni bir açıdan kısa gönderme yap. Kullanıcının sorusuyla ilgisiz eski tema veya life event kayıtlarını yoruma sokma.',
      'Son paragraf mutlaka Öneriler hissi taşısın: ne yapmalı, neyi zorlamamalı, hangi davranış beklemeli. Yeni soru sormadan tamamla.',
      'Doğum saati bilinmiyorsa yükselen/ev yorumu yapma; eksik bilgiyi bir kez nazikçe belirtip kalan bilinen verilerle güçlü yorum kur.',
      'İlçe, şehir merkezi, koordinat hassasiyeti veya yaklaşık konum hesabından bahsetme.',
      PERSONAL_INITIAL_READING_TOKEN_INSTRUCTION,
      'Son cümleyi yarım bırakma; token sınırına yaklaşmadan doğal ve tamamlanmış bir kapanış yap.',
    ].join(' '),
  ].filter(Boolean).join('\n\n');
  return {
    system_instruction: { parts: [{ text: systemText }] },
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    generationConfig: {
      temperature: 0.72,
      maxOutputTokens: PERSONAL_INITIAL_READING_MAX_OUTPUT_TOKENS,
    },
  };
}

export async function createPersonalAstroReading(params: {
  period: AstroPeriod;
  profile: SubjectProfile;
  assistantId: string;
  assistantLabel: string;
  focusQuestion?: string | null;
  memorySnippet?: ProfileMemorySnippet | null;
  iqLevel?: 'free' | 'pro' | 'premium';
  localGemmaModelId?: LocalGemmaModelId;
}): Promise<AstroReadingResult> {
  const location = resolveAstroLocation(params.profile.birth.location);
  if (!params.profile.birth.date || !location) {
    throw new Error('Kişiye özel astro için doğum tarihi, ülke ve şehir gerekli.');
  }

  const precisionNote = buildPrecisionNote(params.profile, location.precision, location.warnings);
  const chart = await createBirthChartSnapshot(params.profile);
  const astroPayload = buildCompactAstroPayload(params.profile, chart, location.precision, params.period);
  const geminiPayload = buildPersonalAstroGeminiPayload({
    period: params.period,
    profileName: params.profile.displayName,
    assistantId: params.assistantId,
    assistantLabel: params.assistantLabel,
    astroPayload,
    precisionNote,
    locationLabel: location.label,
    addressPolicy: addressPolicyForProfile(params.profile, params.profile.displayName),
    focusQuestion: params.focusQuestion,
    memorySnippet: params.memorySnippet,
    isAnimalProfile: params.profile.relationshipPrimary === 'evcil_hayvan',
  });
  const currentPeriodKey = periodKey(params.period);
  const fingerprint = profileFingerprint(params.profile);
  const focusQuestion = params.focusQuestion?.replace(/\s+/g, ' ').trim() || '';
  const modelCacheKey = params.iqLevel === 'free' && params.localGemmaModelId ? `local-${params.localGemmaModelId}` : 'gemini';
  const cacheKeyValue = cacheKey([String(PERSONAL_ASTRO_PERSONA_PROMPT_VERSION), modelCacheKey, params.assistantId, params.profile.profileId, params.period, currentPeriodKey, fingerprint]);
  if (!focusQuestion) {
    const cached = await loadFreshPersonalAstroFromCache({ cacheKeyValue, periodKeyValue: currentPeriodKey, fingerprint });
    if (cached) return cached;
  }

  try {
    const localModelId = params.iqLevel === 'free' ? params.localGemmaModelId : undefined;
    if (params.iqLevel === 'free' && !localModelId) {
      throw new Error('Free IQ için önce bir yerel model seçmelisin.');
    }
    const localLimits = localModelId ? getLocalGemmaGenerationLimits(localModelId, 'initial') : null;
    const data = localModelId
      ? {
          text: await generateLocalGemmaText({
            modelId: localModelId,
            prompt: buildLocalGemmaPromptFromGeminiPayload(geminiPayload, {
              modelId: localModelId,
              mode: 'initial',
              inputTokenLimit: localLimits?.inputTokenLimit,
            }),
            maxTokens: localLimits?.maxOutputTokens,
            temperature: 0.72,
          }),
          model: `local-${localModelId}`,
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          finishReason: undefined,
        }
      : await generateGeminiTextDirect(geminiPayload, 45000, { usageMode: 'raw' });
    const text = await completeWithRememberedPersonaClosing({
      text: cleanGeneratedTurkishText(data.text),
      assistantId: params.assistantId,
      domain: 'astro',
      seed: `${params.profile.profileId}:${params.period}:${currentPeriodKey}`,
      allowHealthClosing: userAskedHealthConcern(params.focusQuestion),
      isAnimalProfile: params.profile.relationshipPrimary === 'evcil_hayvan',
    });

    const reading: AstroReadingResult = {
      text: sanitizeGenderedAddress(
        appendHealthProfessionalReminder(text.text, {
          userText: params.focusQuestion,
          isAnimalProfile: params.profile.relationshipPrimary === 'evcil_hayvan',
        }),
        {
          assistantId: params.assistantId,
          memorySnippet: params.memorySnippet,
          isAnimalProfile: params.profile.relationshipPrimary === 'evcil_hayvan',
        },
      ),
      sign: normalizeSignLabel(chart.sign),
      risingSign: chart.ascendant,
      timezoneUsed: location.timezone,
      periodKey: currentPeriodKey,
      precisionNote,
      cached: false,
      modelName: data.model,
      usage: data.usage,
    };
    if (!focusQuestion) {
      await savePersonalAstroToCache({
        cacheKey: cacheKeyValue,
        assistantId: params.assistantId,
        profileId: params.profile.profileId,
        period: params.period,
        periodKey: currentPeriodKey,
        profileFingerprint: fingerprint,
        createdAt: nowIso(),
        expiresAt: periodExpiryIso(params.period),
        reading,
      });
    }
    return reading;
  } catch (err: any) {
    if (err?.status) throw err;
    throw new Error(err?.message || 'Kişiye özel astro yorumu üretilemedi.');
  }
}

export async function createPersonalAstroFollowUp(params: {
  profileName: string;
  assistantId: string;
  assistantLabel: string;
  period: AstroPeriod;
  profile?: SubjectProfile | null;
  readingText: string;
  question: string;
  previousFollowUps?: Array<{ role: 'user' | 'assistant'; text: string }>;
  memorySnippet?: ProfileMemorySnippet | null;
  iqLevel?: 'free' | 'pro' | 'premium';
  localGemmaModelId?: LocalGemmaModelId;
}): Promise<{ text: string; modelName?: string; usage: { inputTokens: number; outputTokens: number; totalTokens: number } }> {
  const relevantMemory = formatRelevantMemory(params.memorySnippet, params.question, 'kişisel astroloji takip sorusu');
  let currentAstroContext = '';
  try {
    if (params.profile) {
      const location = resolveAstroLocation(params.profile.birth.location);
      if (params.profile.birth.date && location) {
        const chart = await createBirthChartSnapshot(params.profile);
        const astroPayload = buildCompactAstroPayload(params.profile, chart, location.precision, params.period);
        currentAstroContext = JSON.stringify({
          currentTransits: astroPayload.data.transit.positions,
          transitToNatalAspects: astroPayload.data.transit.toNatalAspects,
          periodTimeline: astroPayload.data.transit.periodTimeline,
          natalFilter: {
            sunSignLabel: astroPayload.data.natal.sunSignLabel,
            risingSignLabel: astroPayload.data.natal.risingSignLabel,
            timeKnown: astroPayload.data.natal.timeKnown,
            positions: astroPayload.data.natal.positions,
            aspects: astroPayload.data.natal.aspects,
          },
        });
      }
    }
  } catch {
    currentAstroContext = '';
  }
  const previousFollowUpText = (params.previousFollowUps || [])
    .filter((message) => message.text.trim())
    .slice(-8)
    .map((message) => `${message.role === 'user' ? 'Kullanıcı' : 'Yorumcu'}: ${message.text.trim()}`)
    .join('\n');
  const addressPolicy = params.profile
    ? addressPolicyForProfile(params.profile, params.profileName)
    : buildAnimalProfileInstructionFromMemory(params.memorySnippet) ||
      'Hitap modunu önceki kişisel astroloji yorumuyla tutarlı sürdür; aynı cevap içinde üçüncü tekil şahıs ve sen dili arasında geçiş yapma.';
  const personaContext = assistantPersonaContext(params.assistantId);
  const isAnimalAstro = Boolean(params.profile?.relationshipPrimary === 'evcil_hayvan' || params.memorySnippet?.relationshipPrimary === 'evcil_hayvan');
  const systemText = [
    'Seçili persona yalnızca ses, hitap ritmi ve konuşma sıcaklığını belirler.',
    'Türkçe, sıcak, net ve kişiye özel konuş.',
    'Kendini tanıtma; kullanıcıya görünen metinde yorumcu/persona adı, public label veya rol tanıtımı yazma.',
    'Kullanıcıya görünen metinde hukuken kesin gelecek iddiası kurma; "yorum", "okuma", "sembolik ritüel", "sembolik yorum", "izlenim", "olasılık", "eğilim" dili kullan.',
    'Sağlık ve finans alanlarında spesifik tavsiye verme. İnsan sağlığıyla ilgili endişede doktora/uygun sağlık uzmanına, hayvan sağlığıyla ilgili endişede veterinere görünmeyi nazikçe öner.',
    '"Şunu ye/iç geçer", "kesin geçecek", "kesin iyileşecek", ilaç/doz/tedavi/beslenme reçetesi veya kesin sonuç dili yasak.',
    'Kullanıcının sorusunu kendi aklına gelmiş gibi sahiplenme; "aklıma geldi", "şimdi aklıma geldi" gibi ifadeler kullanma.',
    'Persona sesini koru; kişiye özel astrolojide yorumcunun aynı üslubu, ritmi, hitabı ve tavsiye dili hissedilsin.',
    'Astroloji cevabında kahve, fincan, telve, tabak, avuç içi, el çizgisi, görsel, kart, tarot veya başka sembolik araç dili kullanma; natal-transit bağlamı ve son soru üzerinden konuş.',
    isAnimalAstro
      ? 'Seçili profil evcil hayvansa cevabı insan okuması gibi yazma; kariyer, iş, para kazanma, okul, evlilik, romantik ilişki, insan sosyal çevresi veya yetişkin insan psikolojisi teması kurma.'
      : '',
    isAnimalAstro
      ? 'Evcil hayvan profilde natal-transit bağını hayvanın mizacı, rutinleri, oyun/uyku düzeni, ev içi güveni, duyuları, diğer hayvanlarla ilişkisi ve sahibiyle bağı üzerinden açıkla; hesap sahibine sahibi/refakatçisi olarak öneri ver.'
      : '',
    'Cevabı daha önce üretilmiş kişisel astroloji yorumu, mevcut soru-cevap akışı ve kullanıcının son sorusu üzerinden ver.',
    FOLLOW_UP_CHAT_CONTRACT,
    'Son soruya göre natal yerleşimler ile mevcut/periyot transitlerini birlikte oku; cevabı genel gökyüzü yorumu gibi verme.',
    'Kullanıcı özellikle sormadıkça "doğum haritana göre", "önceki yorumda", "hafızada" gibi kaynak gösteren ifadeleri tekrarlama; teknik bağı doğal cümle içinde kur.',
    'Hitap modunu değiştirme; aynı yanıtta "canım", "tatlım", "güzelim" gibi şefkat hitaplarını tekrarlama.',
    'Önceki follow-up cevaplarıyla çelişme; son soru önceki bir soruya gönderme yapıyorsa o bağı sürdür.',
    'Yeni uzun doğum haritası üretme; tekrar eden cümleler kurma.',
  ].join(' ');
  const userText = [
    `Profil: ${params.profileName}`,
    `Dönem: ${params.period}`,
    `Persona tonu anahtarı: ${params.assistantId}`,
    personaContext ? `Persona ton kartı:\n${personaContext}` : '',
    `Hitap politikası: ${addressPolicy}`,
    currentAstroContext ? `Güncel gökyüzü/transit JSON:\n${currentAstroContext}` : '',
    relevantMemory ? `Seçilmiş hafıza bağlamı:\n${relevantMemory}` : '',
    formatPetMentionMemoryContext(params.question, params.memorySnippet),
    `Önceki kişisel astroloji yorumu:\n${params.readingText}`,
    previousFollowUpText ? `Bu oturumdaki önceki soru-cevap akışı:\n${previousFollowUpText}` : '',
    `Kullanıcının sorusu:\n${params.question}`,
    isAnimalAstro
      ? `Yanıtı 2-3 kısa paragraf olarak ver: ilk paragrafta net cevap, sonra natal-transit karşılaştırmasından hayvanın dünyasına uygun 1-2 gerekçe ve sahibine uygulanabilir kısa tavsiye olsun. ${PERSONAL_FOLLOW_UP_TOKEN_INSTRUCTION}`
      : `Yanıtı 2-3 kısa paragraf olarak ver: ilk paragrafta net cevap, sonra natal-transit karşılaştırmasından 1-2 gerekçe ve uygulanabilir kısa tavsiye olsun. Doğum haritasına doğrudan atıf gerekiyorsa teknik ve doğal biçimde kullan. ${PERSONAL_FOLLOW_UP_TOKEN_INSTRUCTION}`,
  ].filter(Boolean).join('\n\n');
  const followUpPayload = {
    system_instruction: { parts: [{ text: systemText }] },
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    generationConfig: {
      temperature: 0.68,
      maxOutputTokens: PERSONAL_FOLLOW_UP_MAX_OUTPUT_TOKENS,
    },
  };
  const localLimits = params.iqLevel === 'free' && params.localGemmaModelId
    ? getLocalGemmaGenerationLimits(params.localGemmaModelId, 'followUp')
    : null;
  if (params.iqLevel === 'free' && !params.localGemmaModelId) {
    throw new Error('Free IQ için önce bir yerel model seçmelisin.');
  }
  const data = params.iqLevel === 'free' && params.localGemmaModelId
    ? {
        text: await generateLocalGemmaText({
          modelId: params.localGemmaModelId,
          prompt: buildLocalGemmaPromptFromGeminiPayload(followUpPayload, {
            modelId: params.localGemmaModelId,
            mode: 'followUp',
            inputTokenLimit: localLimits?.inputTokenLimit,
          }),
          maxTokens: localLimits?.maxOutputTokens,
          temperature: 0.68,
        }),
        model: `local-${params.localGemmaModelId}`,
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        finishReason: undefined,
      }
    : await generateGeminiTextDirect(followUpPayload, 45000, { usageMode: 'raw' });
  const text = await completeWithRememberedPersonaClosing({
    text: cleanGeneratedTurkishText(data.text),
    assistantId: params.assistantId,
    domain: 'astro',
    seed: `${params.profileName}:${params.period}:${params.question}`,
    allowHealthClosing: userAskedHealthConcern(params.question),
    isAnimalProfile: params.memorySnippet?.relationshipPrimary === 'evcil_hayvan',
  });
  return {
    text: sanitizeGenderedAddress(
      appendHealthProfessionalReminder(cleanFollowUpReply(text.text), {
        userText: params.question,
        isAnimalProfile: params.memorySnippet?.relationshipPrimary === 'evcil_hayvan',
      }),
      { assistantId: params.assistantId, memorySnippet: params.memorySnippet },
    ),
    modelName: data.model,
    usage: data.usage,
  };
}

export async function createAstroRelationshipReading(params: {
  mode: AstroRelationshipMode;
  subjects: AstroRelationshipSubject[];
  assistantId: string;
  assistantLabel: string;
  compatibilityContext?: AstroCompatibilityContext | string | null;
  memorySnippet?: ProfileMemorySnippet | null;
}): Promise<AstroReadingResult> {
  if (params.mode === 'compatibility' && params.subjects.length !== 2) {
    throw new Error('Uyum analizi için iki kişi seçmelisin.');
  }
  if (params.mode === 'family' && params.subjects.length < 2) {
    throw new Error('Aile okuması için en az iki aile bireyi seçmelisin.');
  }
  const subjectContext = buildRelationshipAstroContext(params.subjects);
  const data = await generateGeminiTextDirect(
    buildRelationshipPrompt({
      mode: params.mode,
      assistantId: params.assistantId,
      assistantLabel: params.assistantLabel,
      subjects: subjectContext,
      compatibilityContext: params.compatibilityContext,
      memorySnippet: params.memorySnippet,
    }),
    45000,
    { usageMode: 'raw' },
  );
  const seed = `${params.mode}:${params.subjects.map((subject) => subject.profile.profileId).join(':')}:${params.compatibilityContext || ''}`;
  const text = await completeWithRememberedPersonaClosing({
    text: cleanGeneratedTurkishText(data.text),
    assistantId: params.assistantId,
    domain: 'astro',
    seed,
    allowHealthClosing: userAskedHealthConcern(String(params.compatibilityContext || '')),
    isAnimalProfile: params.subjects.some((subject) => subject.profile.relationshipPrimary === 'evcil_hayvan'),
  });
  return {
    text: sanitizeGenderedAddress(
      appendHealthProfessionalReminder(cleanFollowUpReply(text.text), {
        userText: String(params.compatibilityContext || ''),
        isAnimalProfile: params.subjects.some((subject) => subject.profile.relationshipPrimary === 'evcil_hayvan'),
      }),
      {
        assistantId: params.assistantId,
        memorySnippet: params.memorySnippet,
        isAnimalProfile: params.subjects.some((subject) => subject.profile.relationshipPrimary === 'evcil_hayvan'),
      },
    ),
    sign: params.mode === 'family' ? 'Aile' : 'Uyum',
    timezoneUsed: 'Çoklu doğum verisi',
    periodKey: todayIsoDate(),
    precisionNote: subjectContext.some((subject) => !subject.precision.timeKnown || !subject.precision.placeKnown)
      ? 'Bazı doğum saati veya doğum yeri bilgileri eksik olduğu için yükselen, evler ve zaman hassasiyetli temaslar daha temkinli yorumlandı.'
      : undefined,
    cached: false,
    modelName: data.model,
    usage: data.usage,
  };
}

export async function createAstroRelationshipFollowUp(params: {
  mode: AstroRelationshipMode;
  subjects: AstroRelationshipSubject[];
  assistantId: string;
  assistantLabel: string;
  compatibilityContext?: AstroCompatibilityContext | string | null;
  readingText: string;
  question: string;
  previousFollowUps?: Array<{ role: 'user' | 'assistant'; text: string }>;
  memorySnippet?: ProfileMemorySnippet | null;
}): Promise<{ text: string; modelName?: string; usage: { inputTokens: number; outputTokens: number; totalTokens: number } }> {
  const subjectContext = buildRelationshipAstroContext(params.subjects);
  const personaContext = assistantPersonaContext(params.assistantId);
  const relevantMemory = formatRelevantMemory(params.memorySnippet, params.question, 'astro ilişki/aile takip sorusu');
  const previousFollowUpText = (params.previousFollowUps || [])
    .filter((message) => message.text.trim())
    .slice(-8)
    .map((message) => `${message.role === 'user' ? 'Kullanıcı' : 'Yorumcu'}: ${message.text.trim()}`)
    .join('\n');
  const pairData =
    params.mode === 'compatibility' && subjectContext.length >= 2
      ? buildSynastryAspects(subjectContext[0].chart, subjectContext[1].chart)
      : subjectContext.flatMap((left, index) =>
          subjectContext.slice(index + 1).map((right) => ({
            pair: `${left.profile.displayName} - ${right.profile.displayName}`,
            aspects: buildSynastryAspects(left.chart, right.chart).slice(0, 5),
          })),
        );
  const systemText = [
    'Seçili persona Türkçe, sıcak ve kişisel astrolog sesini belirler.',
    'Kendini tanıtma; kullanıcıya görünen metinde yorumcu/persona adı, public label veya rol tanıtımı yazma.',
    'Kullanıcıya görünen metinde hukuken kesin gelecek iddiası kurma; "yorum", "okuma", "sembolik ritüel", "sembolik yorum", "izlenim", "olasılık", "eğilim" dili kullan.',
    'Sağlık ve finans alanlarında spesifik tavsiye verme. İnsan sağlığıyla ilgili endişede doktora/uygun sağlık uzmanına, hayvan sağlığıyla ilgili endişede veterinere görünmeyi nazikçe öner.',
    '"Şunu ye/iç geçer", "kesin geçecek", "kesin iyileşecek", ilaç/doz/tedavi/beslenme reçetesi veya kesin sonuç dili yasak.',
    'Kullanıcının sorusunu kendi aklına gelmiş gibi sahiplenme; "aklıma geldi", "şimdi aklıma geldi" gibi ifadeler kullanma.',
    'Cevabı yalnızca bu oturumdaki astrolojik uyum/aile okuması, verilen doğum verileri ve son soru üzerinden ver.',
    FOLLOW_UP_CHAT_CONTRACT,
    'Kahve, fincan, telve, tarot, kart, el çizgisi veya görsel dili kullanma.',
    'Pet bir özne varsa onu aile bireyi olarak ele al; romantik veya cinsel ilişki dili kurma.',
    'Önceki cevaplarla çelişme, son soruya doğrudan cevap ver.',
  ].join(' ');
  const userText = [
    `Okuma tipi: ${relationshipModeLabel(params.mode)}`,
    params.compatibilityContext ? `Uyum bağlamı: ${params.compatibilityContext}` : '',
    personaContext ? `Yorumcu persona kartı:\n${personaContext}` : '',
    relevantMemory ? `Seçilmiş hafıza bağlamı:\n${relevantMemory}` : '',
    formatPetMentionMemoryContext(params.question, params.memorySnippet),
    `Kişiler JSON:\n${JSON.stringify(subjectContext.map((subject) => subject.compact))}`,
    `İlişki/aile temasları JSON:\n${JSON.stringify(pairData)}`,
    `Ana yorum:\n${params.readingText}`,
    previousFollowUpText ? `Bu oturumdaki önceki soru-cevap akışı:\n${previousFollowUpText}` : '',
    `Kullanıcının sorusu:\n${params.question}`,
    `Yanıtı 2-3 kısa paragraf olarak ver: ilk paragrafta net cevap, sonra doğum verisi/sinastri bağından 1-2 gerekçe ve uygulanabilir kısa öneri olsun. ${PERSONAL_FOLLOW_UP_TOKEN_INSTRUCTION}`,
  ].filter(Boolean).join('\n\n');
  const data = await generateGeminiTextDirect({
    system_instruction: { parts: [{ text: systemText }] },
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    generationConfig: {
      temperature: 0.68,
      maxOutputTokens: PERSONAL_FOLLOW_UP_MAX_OUTPUT_TOKENS,
    },
  }, 45000, { usageMode: 'raw' });
  const text = await completeWithRememberedPersonaClosing({
    text: cleanGeneratedTurkishText(data.text),
    assistantId: params.assistantId,
    domain: 'astro',
    seed: `${params.mode}:${params.question}:${params.subjects.map((subject) => subject.profile.profileId).join(':')}`,
    allowHealthClosing: userAskedHealthConcern(params.question),
    isAnimalProfile: params.subjects.some((subject) => subject.profile.relationshipPrimary === 'evcil_hayvan'),
  });
  return {
    text: sanitizeGenderedAddress(
      appendHealthProfessionalReminder(cleanFollowUpReply(text.text), {
        userText: params.question,
        isAnimalProfile: params.subjects.some((subject) => subject.profile.relationshipPrimary === 'evcil_hayvan'),
      }),
      {
        assistantId: params.assistantId,
        memorySnippet: params.memorySnippet,
        isAnimalProfile: params.subjects.some((subject) => subject.profile.relationshipPrimary === 'evcil_hayvan'),
      },
    ),
    modelName: data.model,
    usage: data.usage,
  };
}

export async function createGeneralAstroReading(params: {
  period: Exclude<AstroPeriod, 'yearly'>;
  profile: SubjectProfile;
}): Promise<AstroReadingResult> {
  return {
    text: 'Genel gökyüzü yorumu hazırlanıyor...',
    sign: params.profile.birth.date ? 'Analiz ediliyor...' : 'Genel',
    timezoneUsed: 'Europe/Istanbul',
    periodKey: todayIsoDate(),
  };
}

export async function clearAstroCachesForProfile(_profileId: string): Promise<void> {
  // Cache stores vary across recovered builds; keeping this helper idempotent protects MemoryDebug cleanup.
}
