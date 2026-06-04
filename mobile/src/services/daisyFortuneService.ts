import * as FileSystem from 'expo-file-system/legacy';

type DaisyHistoryFile = {
  schemaVersion: 1;
  recentPetalCounts: number[];
};

export type DaisyFortuneSession = {
  petalCount: number;
  startsWithYes: boolean;
};

const DATA_DIR = `${FileSystem.documentDirectory}falci-data/`;
const HISTORY_FILE = `${DATA_DIR}daisy-fortune-history.json`;
const MIN_PETALS = 6;
const MAX_PETALS = 21;
const RECENT_LIMIT = 5;

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(DATA_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DATA_DIR, { intermediates: true });
  }
}

async function readHistory(): Promise<DaisyHistoryFile> {
  try {
    await ensureDir();
    const info = await FileSystem.getInfoAsync(HISTORY_FILE);
    if (!info.exists) return { schemaVersion: 1, recentPetalCounts: [] };
    return { schemaVersion: 1, recentPetalCounts: [], ...(JSON.parse(await FileSystem.readAsStringAsync(HISTORY_FILE)) as Partial<DaisyHistoryFile>) };
  } catch {
    return { schemaVersion: 1, recentPetalCounts: [] };
  }
}

async function writeHistory(history: DaisyHistoryFile) {
  await ensureDir();
  await FileSystem.writeAsStringAsync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

function randomPetalCount(recent: number[]) {
  const blocked = new Set(recent.slice(0, RECENT_LIMIT));
  const options = Array.from({ length: MAX_PETALS - MIN_PETALS + 1 }, (_, index) => MIN_PETALS + index).filter((count) => !blocked.has(count));
  const pool = options.length ? options : Array.from({ length: MAX_PETALS - MIN_PETALS + 1 }, (_, index) => MIN_PETALS + index);
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function createDaisyFortuneSession(): Promise<DaisyFortuneSession> {
  const history = await readHistory();
  const petalCount = randomPetalCount(history.recentPetalCounts || []);
  history.recentPetalCounts = [petalCount, ...(history.recentPetalCounts || []).filter((count) => count !== petalCount)].slice(0, RECENT_LIMIT);
  await writeHistory(history);
  return {
    petalCount,
    startsWithYes: Math.random() >= 0.5,
  };
}

export function daisyAnswerForPetal(startsWithYes: boolean, petalIndex: number) {
  const yes = petalIndex % 2 === 0 ? startsWithYes : !startsWithYes;
  return yes ? 'EVET' : 'HAYIR';
}
