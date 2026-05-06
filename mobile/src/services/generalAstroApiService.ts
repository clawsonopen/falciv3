import type { SubjectProfile } from '../types/memory';
import type { AstroPeriod, AstroReadingResult } from './astroEngine';
import { generateGeminiTextDirect } from './geminiDirectService';

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

function buildGeneralAstroPayload(params: {
  period: Exclude<AstroPeriod, 'yearly'>;
  profile: SubjectProfile;
  sign: (typeof SIGN_ORDER)[number];
  targetDate: string;
}) {
  const signLabel = SIGN_TR[params.sign];
  const periodLabel = PERIOD_TR[params.period];
  const systemText =
    'Sen Türkçe yazan bir genel astroloji yorumcususun. Yanıtı kısa, akıcı ve kullanıcıya dönük yaz; kesin kehanet, sağlık/finans garantisi ve korkutucu dil kullanma.';
  const userText = [
    `Profil adı: ${params.profile.displayName}`,
    `Güneş burcu: ${signLabel}`,
    `Dönem: ${periodLabel}`,
    `Tarih anahtarı: ${params.targetDate}`,
    [
      'Yükselen veya kişiye özel doğum haritası bilgisi varmış gibi davranma.',
      '3-4 ana konuya değin: duygu hali, ilişkiler, iş/para ve küçük bir öneri.',
      'Başlık atma. Türkçe yaz. 110-170 kelime arasında doğal bir yorum ver.',
    ].join('\n'),
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

export async function fetchGeneralAstroDirect(params: {
  period: Exclude<AstroPeriod, 'yearly'>;
  profile: SubjectProfile;
}): Promise<AstroReadingResult | null> {
  const sign = deriveSign(params.profile);
  const periodKey = todayIsoDate();
  try {
    const data = await generateGeminiTextDirect(
      buildGeneralAstroPayload({
        period: params.period,
        profile: params.profile,
        sign,
        targetDate: periodKey,
      }),
      45000,
    );
    return {
      text: data.text,
      sign: SIGN_TR[sign],
      timezoneUsed: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Istanbul',
      periodKey,
      modelName: data.model,
      usage: data.usage,
    };
  } catch (err: any) {
    if (err?.status) throw err;
    return null;
  }
}
