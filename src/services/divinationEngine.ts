import * as FileSystem from 'expo-file-system/legacy';
import {
  ANGEL_CARDS,
  ANGEL_NUMBERS,
  DAILY_QUOTES,
  ICHING_HEXAGRAMS,
  NUMEROLOGY_MEANINGS,
  RUNES,
  TAROT_CARDS,
} from '../data/divinationData';

export type GeneralDivinationType =
  | 'fortune-cookie'
  | 'magic-ball'
  | 'daily-affirmation'
  | 'daily-quote'
  | 'daily-runes'
  | 'daily-i-ching'
  | 'daily-numerology'
  | 'daily-tarot'
  | 'daily-angel'
  | 'daily-angel-number';

type DivinationStore = {
  schemaVersion: 1;
  nextSequence: number;
  usedTexts: string[];
  dailyReadings: Array<{
    dateKey: string;
    type: GeneralDivinationType;
    profileId: string;
    text: string;
    sequence: number;
    createdAt: string;
  }>;
};

const DATA_DIR = `${FileSystem.documentDirectory}falci-data/`;
const STORE_FILE = `${DATA_DIR}general-divination-store.json`;

const FORTUNE_LINES = [
  'Bugün küçük bir adımın büyük bir kapı açabilir.',
  'Kalbinin çekindiği konuda şansın yavaşça güçleniyor.',
  'Beklediğin haber, doğru zamanda netleşecek.',
  'Niyetin berraklaştıkça yolun hızlanıyor.',
];

const SPHERE_LINES = [
  'Bugün acele yerine netlik kazanır.',
  'Belirsizlik kısa; işaretler lehine dönüyor.',
  'Bir sorunun cevabı beklediğinden yakında açılacak.',
  'Sakin kalırsan doğru seçenek kendini gösterecek.',
];

const AFFIRMATION_LINES = [
  'Bugün kendime güveniyor ve net adım atıyorum.',
  'Bugün iç sesimi sakinlikle dinliyorum.',
  'Bugün değerimi hatırlayıp ona göre davranıyorum.',
  'Bugün acele etmeden dengede kalıyorum.',
];

function nowIso() {
  return new Date().toISOString();
}

function normalize(text: string) {
  return text.toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim();
}

function pick<T>(list: T[], sequence: number, shift: number): T {
  const idx = Math.abs((sequence * 37 + shift * 17) % list.length);
  return list[idx];
}

function todayKeyIstanbul(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value ?? '0000';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

function dateTimeDigits(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value ?? '0000';
  const mo = parts.find((p) => p.type === 'month')?.value ?? '01';
  const da = parts.find((p) => p.type === 'day')?.value ?? '01';
  const hh = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const mm = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${y}${mo}${da}${hh}${mm}`;
}

function reduceNumerology(value: number): number {
  if (value === 11 || value === 22 || value === 33) return value;
  let n = Math.abs(value);
  while (n > 9) {
    if (n === 11 || n === 22 || n === 33) return n;
    n = String(n)
      .split('')
      .reduce((acc, d) => acc + Number(d || 0), 0);
  }
  return n;
}

function momentCode(date: Date): number {
  const sum = dateTimeDigits(date)
    .split('')
    .reduce((acc, d) => acc + Number(d || 0), 0);
  return reduceNumerology(sum);
}

async function ensureDir(path: string) {
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(path, { intermediates: true });
  }
}

async function loadStore(): Promise<DivinationStore> {
  await ensureDir(DATA_DIR);
  const info = await FileSystem.getInfoAsync(STORE_FILE);
  if (!info.exists) {
    const initial: DivinationStore = { schemaVersion: 1, nextSequence: 1, usedTexts: [], dailyReadings: [] };
    await FileSystem.writeAsStringAsync(STORE_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  const raw = await FileSystem.readAsStringAsync(STORE_FILE);
  const parsed = JSON.parse(raw) as Partial<DivinationStore>;
  return {
    schemaVersion: 1,
    nextSequence: Number(parsed.nextSequence || 1),
    usedTexts: Array.isArray(parsed.usedTexts) ? parsed.usedTexts : [],
    dailyReadings: Array.isArray(parsed.dailyReadings) ? parsed.dailyReadings : [],
  };
}

async function saveStore(store: DivinationStore) {
  await ensureDir(DATA_DIR);
  await FileSystem.writeAsStringAsync(STORE_FILE, JSON.stringify(store, null, 2));
}

function buildText(type: GeneralDivinationType, sequence: number, now: Date): string {
  if (type === 'fortune-cookie') return pick(FORTUNE_LINES, sequence, 1);
  if (type === 'magic-ball') return pick(SPHERE_LINES, sequence, 2);
  if (type === 'daily-affirmation') return pick(AFFIRMATION_LINES, sequence, 3);
  if (type === 'daily-quote') {
    const q = pick(DAILY_QUOTES, sequence, 4);
    return `“${q.text}”\n- ${q.author}`;
  }
  if (type === 'daily-runes') {
    const rune = pick(RUNES, sequence, 5);
    return `Günün runesi: ${rune.rune} (${rune.keyword}). ${rune.message}`;
  }
  if (type === 'daily-i-ching') {
    const h = pick(ICHING_HEXAGRAMS, sequence, 6);
    return `I-Ching ${h.no}. hexagram (${h.name}): ${h.insight}`;
  }
  if (type === 'daily-tarot') {
    const card = pick(TAROT_CARDS, sequence, 7);
    return `Günün tarot kartı: ${card.name}. Ana tema: ${card.upright}. Öneri: ${card.advice}`;
  }
  if (type === 'daily-angel') {
    const card = pick(ANGEL_CARDS, sequence, 8);
    return `Günün melek kartı: ${card.name}. Mesaj: ${card.message} Öneri: ${card.action}`;
  }
  if (type === 'daily-angel-number') {
    const n = pick(ANGEL_NUMBERS, sequence, 9);
    return `Günün uğurlu melek sayısı: ${n.number}. Anlam: ${n.meaning} Rehberlik: ${n.guidance}`;
  }
  const code = momentCode(now);
  const meaning = NUMEROLOGY_MEANINGS[String(code)] || 'Bugün denge ve netlik enerjisi baskın.';
  return `Günün numerolojisi: ${code}. MomentCode (YYYYMMDD+HHmm) formülüne göre hesaplandı. ${meaning}`;
}

export async function createDailyGeneralReading(params: {
  type: GeneralDivinationType;
  profileId: string;
  now?: Date;
}): Promise<{ text: string; sequence: number }> {
  const now = params.now ?? new Date();
  const store = await loadStore();
  const dateKey = todayKeyIstanbul(now);

  const existing = store.dailyReadings.find(
    (r) => r.type === params.type && r.profileId === params.profileId && r.dateKey === dateKey,
  );
  if (existing) return { text: existing.text, sequence: existing.sequence };

  const used = new Set(store.usedTexts.map((item) => normalize(item)));
  let sequence = Math.max(1, store.nextSequence);
  let selected = '';

  for (let i = 0; i < 5000; i += 1) {
    const current = sequence + i;
    const candidate = buildText(params.type, current, now);
    if (used.has(normalize(candidate))) continue;
    selected = candidate;
    sequence = current;
    break;
  }

  if (!selected) throw new Error('Günlük metin üretilemedi.');

  const next: DivinationStore = {
    ...store,
    nextSequence: sequence + 1,
    usedTexts: [...store.usedTexts, selected],
    dailyReadings: [
      {
        dateKey,
        type: params.type,
        profileId: params.profileId,
        text: selected,
        sequence,
        createdAt: nowIso(),
      },
      ...store.dailyReadings,
    ].slice(0, 40000),
  };
  await saveStore(next);
  return { text: selected, sequence };
}

