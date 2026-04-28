import type { SubjectProfile } from '../types/memory';

export type AstroPeriod = 'daily' | 'weekly' | 'monthly';

export type AstroReadingResult = {
  text: string;
  sign: string;
  timezoneUsed: string;
  periodKey: string;
};

export type BirthChartSnapshot = {
  sign: string;
  ascendant: string;
  dominantHouse: number;
  planets: Array<{ name: string; sign: string; degree: number; retrograde: boolean }>;
  transitNotes: string[];
};

export function hasRequiredAstroBirthInputs(profile: SubjectProfile): boolean {
  return Boolean(
    profile.birth.date && 
    profile.birth.location.country && 
    profile.birth.location.cityOrRegion
  );
}

export function createBirthChartSnapshot(profile: SubjectProfile): BirthChartSnapshot {
  // Minimal placeholder implementation since user wants to replace local engine
  return {
    sign: 'Analiz ediliyor...',
    ascendant: 'Analiz ediliyor...',
    dominantHouse: 1,
    planets: [],
    transitNotes: ['Detaylı doğum haritası analizi yakında aktif olacak.'],
  };
}

export async function createPersonalAstroReading(params: {
  period: AstroPeriod;
  profile: SubjectProfile;
  assistantId: string;
  assistantLabel: string;
}): Promise<AstroReadingResult> {
  // Placeholder implementation
  return {
    text: `${params.assistantLabel} henüz bu özelliği desteklemiyor. Kişiye özel astroloji yorumları yakında LLM desteğiyle aktif olacak.`,
    sign: 'Analiz ediliyor...',
    timezoneUsed: 'Europe/Istanbul',
    periodKey: new Date().toISOString().slice(0, 10),
  };
}

export async function createGeneralAstroReading(params: {
  period: AstroPeriod;
  profile: SubjectProfile;
}): Promise<AstroReadingResult> {
  // This was used for general readings when opastroLite was active
  return {
    text: 'Genel gökyüzü yorumu hazırlanıyor...',
    sign: 'Analiz ediliyor...',
    timezoneUsed: 'Europe/Istanbul',
    periodKey: new Date().toISOString().slice(0, 10),
  };
}
