import type { BirthLocation } from '../types/memory';
import { TURKEY_CITY_COORDS } from '../data/turkeyLocations';

export type ResolvedAstroLocation = {
  country: string;
  cityOrRegion: string;
  district: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
  precision: 'district' | 'city' | 'country';
  label: string;
  warnings: string[];
};

type LocationEntry = {
  lat: number;
  lon: number;
  timezone: string;
  districts?: Record<string, { lat: number; lon: number }>;
};

const CITY_DATA: Record<string, LocationEntry> = {
  'turkiye|istanbul': {
    lat: 41.0082,
    lon: 28.9784,
    timezone: 'Europe/Istanbul',
    districts: {
      kadikoy: { lat: 40.9919, lon: 29.0252 },
      uskudar: { lat: 41.0227, lon: 29.0153 },
      besiktas: { lat: 41.0438, lon: 29.0094 },
      sisli: { lat: 41.0605, lon: 28.9872 },
      bakirkoy: { lat: 40.9806, lon: 28.8772 },
      fatih: { lat: 41.0164, lon: 28.9497 },
      beyoglu: { lat: 41.0369, lon: 28.9851 },
      sariyer: { lat: 41.1663, lon: 29.0501 },
      maltepe: { lat: 40.9357, lon: 29.1551 },
      pendik: { lat: 40.8747, lon: 29.235 },
    },
  },
  'turkiye|ankara': {
    lat: 39.9334,
    lon: 32.8597,
    timezone: 'Europe/Istanbul',
    districts: {
      cankaya: { lat: 39.9179, lon: 32.8627 },
      kecioren: { lat: 39.98, lon: 32.8663 },
      yenimahalle: { lat: 39.9719, lon: 32.8118 },
      mamak: { lat: 39.9208, lon: 32.9106 },
      etimesgut: { lat: 39.9533, lon: 32.6329 },
    },
  },
  'turkiye|izmir': {
    lat: 38.4237,
    lon: 27.1428,
    timezone: 'Europe/Istanbul',
    districts: {
      konak: { lat: 38.4145, lon: 27.1441 },
      karsiyaka: { lat: 38.4613, lon: 27.1127 },
      bornova: { lat: 38.4697, lon: 27.2211 },
      buca: { lat: 38.3848, lon: 27.1741 },
      cesme: { lat: 38.3227, lon: 26.3064 },
    },
  },
  'turkiye|bursa': { lat: 40.1885, lon: 29.061, timezone: 'Europe/Istanbul' },
  'turkiye|antalya': { lat: 36.8969, lon: 30.7133, timezone: 'Europe/Istanbul' },
  'turkiye|adana': { lat: 37.0, lon: 35.3213, timezone: 'Europe/Istanbul' },
  'turkiye|konya': { lat: 37.8746, lon: 32.4932, timezone: 'Europe/Istanbul' },
  'turkiye|gaziantep': { lat: 37.0662, lon: 37.3833, timezone: 'Europe/Istanbul' },
  'turkiye|mersin': { lat: 36.8121, lon: 34.6415, timezone: 'Europe/Istanbul' },
  'turkiye|kocaeli': { lat: 40.8533, lon: 29.8815, timezone: 'Europe/Istanbul' },
  'turkiye|diyarbakir': { lat: 37.925, lon: 40.211, timezone: 'Europe/Istanbul' },
  'turkiye|kayseri': { lat: 38.7205, lon: 35.4826, timezone: 'Europe/Istanbul' },
  'turkiye|eskisehir': { lat: 39.7767, lon: 30.5206, timezone: 'Europe/Istanbul' },
  'turkiye|samsun': { lat: 41.2867, lon: 36.33, timezone: 'Europe/Istanbul' },
  'turkiye|denizli': { lat: 37.7765, lon: 29.0864, timezone: 'Europe/Istanbul' },
  'turkiye|sakarya': { lat: 40.7731, lon: 30.3948, timezone: 'Europe/Istanbul' },
  'turkiye|mugla': { lat: 37.2153, lon: 28.3636, timezone: 'Europe/Istanbul' },
  'turkiye|tekirdag': { lat: 40.978, lon: 27.511, timezone: 'Europe/Istanbul' },
};

const COUNTRY_DATA: Record<string, LocationEntry> = {
  turkiye: { lat: 39.0, lon: 35.0, timezone: 'Europe/Istanbul' },
  almanya: { lat: 51.1657, lon: 10.4515, timezone: 'Europe/Berlin' },
  fransa: { lat: 46.2276, lon: 2.2137, timezone: 'Europe/Paris' },
  hollanda: { lat: 52.1326, lon: 5.2913, timezone: 'Europe/Amsterdam' },
  belcika: { lat: 50.5039, lon: 4.4699, timezone: 'Europe/Brussels' },
  ingiltere: { lat: 52.3555, lon: -1.1743, timezone: 'Europe/London' },
  abd: { lat: 39.8283, lon: -98.5795, timezone: 'America/New_York' },
  kanada: { lat: 56.1304, lon: -106.3468, timezone: 'America/Toronto' },
};

function normalizeLocationText(value: string | null | undefined): string {
  return (value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function countryKey(value: string | null | undefined): string {
  const key = normalizeLocationText(value);
  if (key === 'turkey') return 'turkiye';
  if (key === 'usa' || key === 'amerika' || key === 'amerika birlesik devletleri') return 'abd';
  if (key === 'united kingdom' || key === 'uk' || key === 'britanya') return 'ingiltere';
  if (key === 'netherlands') return 'hollanda';
  if (key === 'belgium') return 'belcika';
  if (key === 'germany') return 'almanya';
  if (key === 'france') return 'fransa';
  if (key === 'canada') return 'kanada';
  return key;
}

export function resolveAstroLocation(location: BirthLocation): ResolvedAstroLocation | null {
  const country = location.country?.trim();
  const city = location.cityOrRegion?.trim();
  if (!country || !city) return null;

  const cKey = countryKey(country);
  const cityKey = normalizeLocationText(city);
  const districtKey = normalizeLocationText(location.district);
  const cityEntry = CITY_DATA[`${cKey}|${cityKey}`];
  const turkeyCityName =
    cKey === 'turkiye' ? Object.keys(TURKEY_CITY_COORDS).find((name) => normalizeLocationText(name) === cityKey) : null;
  const turkeyCityEntry = turkeyCityName ? TURKEY_CITY_COORDS[turkeyCityName] : null;
  const countryEntry = COUNTRY_DATA[cKey];
  const warnings: string[] = [];

  if (cityEntry) {
    const district = districtKey ? cityEntry.districts?.[districtKey] : null;
    if (district) {
      return {
        country,
        cityOrRegion: city,
        district: location.district?.trim() || null,
        latitude: district.lat,
        longitude: district.lon,
        timezone: cityEntry.timezone,
        precision: 'district',
        label: `${city} / ${location.district}`,
        warnings,
      };
    }

    return {
      country,
      cityOrRegion: city,
      district: location.district?.trim() || null,
      latitude: cityEntry.lat,
      longitude: cityEntry.lon,
      timezone: cityEntry.timezone,
      precision: 'city',
      label: city,
      warnings,
    };
  }

  if (turkeyCityEntry) {
    return {
      country,
      cityOrRegion: city,
      district: location.district?.trim() || null,
      latitude: turkeyCityEntry.lat,
      longitude: turkeyCityEntry.lon,
      timezone: 'Europe/Istanbul',
      precision: 'city',
      label: city,
      warnings,
    };
  }

  if (countryEntry) {
    warnings.push('Şehir koordinatı listede bulunamadı; ülke merkeziyle yaklaşık yorum yapılacak.');
    return {
      country,
      cityOrRegion: city,
      district: location.district?.trim() || null,
      latitude: countryEntry.lat,
      longitude: countryEntry.lon,
      timezone: countryEntry.timezone,
      precision: 'country',
      label: `${country} / ${city}`,
      warnings,
    };
  }

  return {
    country,
    cityOrRegion: city,
    district: location.district?.trim() || null,
    latitude: 39.0,
    longitude: 35.0,
    timezone: 'UTC',
    precision: 'country',
    label: `${country} / ${city}`,
    warnings: ['Konum listede bulunamadı; UTC ve yaklaşık koordinatla yorum yapılacak.'],
  };
}
