import { AGENT_API_URL } from '../config/constants';
import type { SubjectProfile } from '../types/memory';
import type { AstroPeriod, AstroReadingResult } from './astroEngine';

type GeneralAstroResponse = {
  ok?: boolean;
  text?: string;
  periodKey?: string;
  sign?: string;
  error?: string;
};

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

function todayIsoDate() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function fetchGeneralAstroFromBackend(params: {
  period: Exclude<AstroPeriod, 'yearly'>;
  profile: SubjectProfile;
}): Promise<AstroReadingResult | null> {
  const sign = deriveSign(params.profile);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`${AGENT_API_URL}/general-astro/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        period: params.period,
        sign,
        targetDate: todayIsoDate(),
      }),
      signal: controller.signal,
    });
    const data = (await response.json().catch(() => ({}))) as GeneralAstroResponse;
    if (!response.ok) {
      const error = new Error(data.error || 'Genel astro hazırlanamadı.') as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
    if (!data?.text) return null;
    return {
      text: data.text,
      sign: SIGN_TR[sign],
      timezoneUsed: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Istanbul',
      periodKey: data.periodKey || todayIsoDate(),
    };
  } catch (err: any) {
    if (err?.status) throw err;
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
