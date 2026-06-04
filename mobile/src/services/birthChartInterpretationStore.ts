import * as FileSystem from 'expo-file-system/legacy';
import type { BirthChartSnapshot } from './astroEngine';
import type { SubjectProfile } from '../types/memory';

export type BirthChartFollowUpMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
};

export type BirthChartInterpretationSession = {
  profileId: string;
  profileFingerprint: string;
  profileName: string;
  interpretationVersion?: number;
  chart: BirthChartSnapshot;
  interpretationText: string;
  followUps: BirthChartFollowUpMessage[];
  createdAt: string;
  updatedAt: string;
};

type BirthChartInterpretationStore = {
  schemaVersion: 2;
  sessions: BirthChartInterpretationSession[];
};

const DATA_DIR = `${FileSystem.documentDirectory}falci-data/`;
const STORE_FILE = `${DATA_DIR}birth-chart-interpretations.json`;
const CURRENT_INTERPRETATION_VERSION = 4;

function nowIso() {
  return new Date().toISOString();
}

async function ensureDir(path: string) {
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(path, { intermediates: true });
  }
}

async function readStore(): Promise<BirthChartInterpretationStore> {
  await ensureDir(DATA_DIR);
  const info = await FileSystem.getInfoAsync(STORE_FILE);
  if (!info.exists) return { schemaVersion: 2, sessions: [] };
  try {
    const parsed = JSON.parse(await FileSystem.readAsStringAsync(STORE_FILE)) as Partial<BirthChartInterpretationStore>;
    return {
      schemaVersion: 2,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    };
  } catch {
    return { schemaVersion: 2, sessions: [] };
  }
}

async function writeStore(store: BirthChartInterpretationStore) {
  await ensureDir(DATA_DIR);
  await FileSystem.writeAsStringAsync(STORE_FILE, JSON.stringify(store, null, 2));
}

export function birthChartProfileFingerprint(profile: SubjectProfile) {
  return JSON.stringify({
    birth: profile.birth,
    chartPrecision: profile.chartPrecision,
  });
}

export async function loadBirthChartInterpretationSession(
  profileId: string,
  profileFingerprint: string,
): Promise<BirthChartInterpretationSession | null> {
  const store = await readStore();
  return (
    store.sessions.find(
      (session) =>
        session.profileId === profileId &&
        session.profileFingerprint === profileFingerprint,
    ) || null
  );
}

export async function saveBirthChartInterpretationSession(
  session: BirthChartInterpretationSession,
): Promise<BirthChartInterpretationSession> {
  const store = await readStore();
  const updated: BirthChartInterpretationSession = {
    ...session,
    interpretationVersion: CURRENT_INTERPRETATION_VERSION,
    updatedAt: nowIso(),
  };
  const sessions = store.sessions.filter((item) => item.profileId !== session.profileId);
  sessions.unshift(updated);
  await writeStore({ schemaVersion: 2, sessions });
  return updated;
}

export async function createBirthChartInterpretationSession(params: {
  profile: SubjectProfile;
  chart: BirthChartSnapshot;
  interpretationText: string;
}): Promise<BirthChartInterpretationSession> {
  const now = nowIso();
  const session: BirthChartInterpretationSession = {
    profileId: params.profile.profileId,
    profileFingerprint: birthChartProfileFingerprint(params.profile),
    profileName: params.profile.displayName,
    interpretationVersion: CURRENT_INTERPRETATION_VERSION,
    chart: params.chart,
    interpretationText: params.interpretationText,
    followUps: [],
    createdAt: now,
    updatedAt: now,
  };
  return saveBirthChartInterpretationSession(session);
}

export async function deleteBirthChartInterpretationSession(profileId: string): Promise<void> {
  const store = await readStore();
  await writeStore({
    schemaVersion: 2,
    sessions: store.sessions.filter((session) => session.profileId !== profileId),
  });
}
