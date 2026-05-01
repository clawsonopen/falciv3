import * as FileSystem from 'expo-file-system/legacy';
import * as Astronomy from 'astronomy-engine';
import type { SubjectProfile } from '../types/memory';
import { resolveAstroLocation } from './astroLocationService';
import { generateGeminiTextDirect } from './geminiDirectService';

export type AstroPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type AstroReadingResult = {
  text: string;
  sign: string;
  risingSign?: string | null;
  timezoneUsed: string;
  periodKey: string;
  precisionNote?: string;
  cached?: boolean;
};

export type BirthChartAspect = {
  planetA: string;
  planetB: string;
  type: 'Kavuşum' | 'Altmışlık' | 'Kare' | 'Üçgen' | 'Karşıt';
  orb: number;
};

export type BirthChartSnapshot = {
  sign: string;
  ascendant: string | null;
  dominantHouse: number;
  planets: Array<{ name: string; sign: string; degree: number; longitude: number; retrograde: boolean; house: number | null }>;
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
      }>;
      toNatalAspects: Array<{
        transitPlanetLabel: string;
        natalPlanetLabel: string;
        aspect: string;
        orb: number;
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
const LOCAL_ASTRO_VERSION = 2;

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
    displayName: profile.displayName,
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

async function loadBirthChartFromCache(profileId: string, fingerprint: string): Promise<BirthChartSnapshot | null> {
  const store = await readJsonFile(BIRTH_CHART_CACHE_FILE, defaultBirthChartCache());
  const hit = store.entries.find((entry) => entry.profileId === profileId && entry.profileFingerprint === fingerprint);
  if (hit && (!Array.isArray(hit.chart.aspects) || hit.chart.planets.some((planet) => !('house' in planet)))) {
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
  if (locationPrecision !== 'district') {
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

function buildLocalBirthChartSnapshot(profile: SubjectProfile): BirthChartSnapshot {
  const location = resolveAstroLocation(profile.birth.location);
  if (!profile.birth.date || !location) {
    throw new Error('Doğum haritası için doğum tarihi, ülke ve şehir gerekli.');
  }

  const precisionNote = buildPrecisionNote(profile, location.precision, location.warnings);
  const birthUtc = zonedDateTimeToUtc(profile.birth.date, profile.birth.timeKnown ? profile.birth.time : null, location.timezone);
  const birthTime = new Astronomy.AstroTime(birthUtc);
  const ascendantLongitudeValue =
    profile.birth.timeKnown && profile.birth.time
      ? ascendantLongitude(birthTime, location.latitude, location.longitude)
      : null;
  const ascendant = ascendantLongitudeValue === null ? null : SIGN_LABELS[signIndexFromLongitude(ascendantLongitudeValue)];
  const planets = buildLocalPlanets(birthTime, ascendantLongitudeValue);
  const sun = planets.find((planet) => planet.name === 'Güneş');
  const aspects = buildAspects(planets);
  const retrogradeNames = planets.filter((planet) => planet.retrograde).map((planet) => planet.name);
  const transitNotes = [
    ...(precisionNote ? [precisionNote] : []),
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
    dominantHouse: ascendant ? 1 : 0,
    planets,
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

function buildTransitPlanets(profile: SubjectProfile) {
  const time = new Astronomy.AstroTime(new Date(`${todayIsoDate()}T12:00:00.000Z`));
  return buildLocalPlanets(time, null).map((planet) => ({
    planetLabel: planet.name,
    signLabel: planet.sign,
    degreeInSign: Number(planet.degree.toFixed(1)),
    retrograde: planet.retrograde,
    longitude: planet.longitude,
  }));
}

function buildTransitToNatalAspects(chart: BirthChartSnapshot, profile: SubjectProfile) {
  const transits = buildTransitPlanets(profile);
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

function buildCompactAstroPayload(profile: SubjectProfile, chart: BirthChartSnapshot, locationPrecision: string): CompactAstroPayload {
  const transitPositions = buildTransitPlanets(profile);
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
        positions: transitPositions.slice(0, 7).map(({ longitude: _longitude, ...planet }) => planet),
        toNatalAspects: buildTransitToNatalAspects(chart, profile),
      },
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

function personalAstroAssistantStyleHint(assistantId: string, assistantLabel: string) {
  const styles: Record<string, string> = {
    'bahar-hanim': 'Bahar Hanım tonu: modern, rafine, farkındalık dili yüksek, sıcak ama net bir astrolog.',
    'mert-bey': 'Mert Bey tonu: analitik, sade, dost gibi yakın ve toparlayıcı.',
    'durdane-hanim': 'Dürdane Hanım tonu: anaç, sıcak, sezgisel ve koruyucu.',
    'hikmet-bey': 'Hikmet Bey tonu: babacan, felsefi, sakin ve psikolojik derinliği olan.',
    caner: 'Caner tonu: sezgisel, yumuşak, sanatsal ve hafif melankolik.',
  };
  return styles[assistantId] || `${assistantLabel || 'Falcı'} tonu: sıcak, doğal ve persona içinde kalan.`;
}

function buildPersonalAstroGeminiPayload(params: {
  period: AstroPeriod;
  profileName: string;
  assistantId: string;
  assistantLabel: string;
  astroPayload: ReturnType<typeof buildCompactAstroPayload>;
  precisionNote: string;
  locationLabel: string;
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
  };
  const focus = {
    daily: 'Bugünün kişisel odağı, duygu ritmi, ilişki/iş akışı ve kısa öneri.',
    weekly: 'Haftanın ana teması, ilişki ve iş para ritmi, içsel denge ve uygulanabilir öneri.',
    monthly: 'Ayın ana evresi, ilişki ve kariyer/para temaları, enerji dalgalanması ve öneri.',
    yearly: 'Yılın büyük temaları, ilişki, kariyer/para, kişisel gelişim, kritik dönemler ve öneri.',
  }[params.period];
  const systemText =
    'You are a Turkish personal astrology writer. Use only the provided on-device astronomy JSON. Do not invent houses, ascendant, exact Moon degree or birth-time-sensitive claims when timeKnown is false. Focus on how the current sky touches the user natal pattern and real life.';
  const userText = [
    `Profile: ${params.profileName || 'Profil'}`,
    `Assistant style: ${personalAstroAssistantStyleHint(params.assistantId, params.assistantLabel)}`,
    `Period: ${periodLabel}`,
    `Birth/location precision note: ${params.precisionNote || 'Doğum bilgileri yeterli.'}`,
    `Resolved location: ${params.locationLabel || 'belirtilmedi'}`,
    `Content focus: ${focus}`,
    `Calculated key placements JSON:\n${JSON.stringify(keyPlacements)}`,
    `Period interpretation data JSON:\n${JSON.stringify(interpretationData)}`,
    [
      'Türkçe yaz. Başlık atma; düz, akıcı ve premium bir yorum ver.',
      'Persona içinde kal ama kendini tanıtma.',
      'Genel burç yorumundan farklı ol: natal Güneş/Ay, gezegen evleri, natal açılar, transit temaslar, retro hareketler ve varsa yükseleni kullan.',
      'Gökyüzü bilgisini kısa tut; asıl ağırlık ilişkiler, duygu hali, kararlar, iş/para ve kişisel ritimde neyi etkilediği olsun.',
      'Öneri dilini belirgin kur: ne yapmalı, neyi zorlamamalı, hangi davranış beklemeli.',
      'Doğum saati bilinmiyorsa yükselen/ev yorumu yapma; eksik bilgiyi bir kez nazikçe belirtip kalan bilinen verilerle güçlü yorum kur.',
      'Kapanışta yeni soru sorma.',
    ].join(' '),
  ].join('\n\n');
  return {
    system_instruction: { parts: [{ text: systemText }] },
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    generationConfig: {
      temperature: 0.72,
      maxOutputTokens: { daily: 750, weekly: 1050, monthly: 1550, yearly: 1800 }[params.period],
    },
  };
}

export async function createPersonalAstroReading(params: {
  period: AstroPeriod;
  profile: SubjectProfile;
  assistantId: string;
  assistantLabel: string;
}): Promise<AstroReadingResult> {
  const location = resolveAstroLocation(params.profile.birth.location);
  if (!params.profile.birth.date || !location) {
    throw new Error('Kişiye özel astro için doğum tarihi, ülke ve şehir gerekli.');
  }

  const precisionNote = buildPrecisionNote(params.profile, location.precision, location.warnings);
  const chart = await createBirthChartSnapshot(params.profile);
  const astroPayload = buildCompactAstroPayload(params.profile, chart, location.precision);
  const geminiPayload = buildPersonalAstroGeminiPayload({
    period: params.period,
    profileName: params.profile.displayName,
    assistantId: params.assistantId,
    assistantLabel: params.assistantLabel,
    astroPayload,
    precisionNote,
    locationLabel: location.label,
  });
  const currentPeriodKey = periodKey(params.period);
  const fingerprint = profileFingerprint(params.profile);
  const cacheKeyValue = cacheKey([params.assistantId, params.profile.profileId, params.period, currentPeriodKey, fingerprint]);
  const cached = await loadFreshPersonalAstroFromCache({ cacheKeyValue, periodKeyValue: currentPeriodKey, fingerprint });
  if (cached) return cached;

  try {
    const data = await generateGeminiTextDirect(geminiPayload);

    const reading: AstroReadingResult = {
      text: repairMojibakeTurkish(data.text),
      sign: normalizeSignLabel(chart.sign),
      risingSign: chart.ascendant,
      timezoneUsed: location.timezone,
      periodKey: currentPeriodKey,
      precisionNote,
      cached: false,
    };
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
  readingText: string;
  question: string;
}): Promise<string> {
  const systemText = [
    `Sen ${params.assistantLabel} adlı falcısın.`,
    'Türkçe, sıcak, net ve kişiye özel konuş.',
    'Cevabı yalnızca daha önce üretilmiş kişisel astroloji yorumu ve kullanıcının sorusu üzerinden ver.',
    'Yeni uzun doğum haritası üretme; tekrar eden cümleler kurma.',
  ].join(' ');
  const userText = [
    `Profil: ${params.profileName}`,
    `Dönem: ${params.period}`,
    `Falcı kimliği: ${params.assistantId}`,
    `Önceki kişisel astroloji yorumu:\n${params.readingText}`,
    `Kullanıcının sorusu:\n${params.question}`,
    'Yanıtı tek paragraf olarak ver. Kısa geçiştirme yapma; önce net yanıtı, sonra astroloji bağlamından 1-2 gerekçeyi ve en sonda uygulanabilir kısa tavsiyeyi ver. Yaklaşık 120-170 token içinde tamamla.',
  ].join('\n\n');
  const data = await generateGeminiTextDirect({
    system_instruction: { parts: [{ text: systemText }] },
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    generationConfig: {
      temperature: 0.68,
      maxOutputTokens: 520,
    },
  });
  return repairMojibakeTurkish(data.text);
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
