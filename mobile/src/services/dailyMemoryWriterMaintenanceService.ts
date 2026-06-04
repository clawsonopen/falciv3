import * as FileSystem from 'expo-file-system/legacy';
import { runAndApplyProfileIdentityMemoryWriter } from './memoryWriterDebugService';
import { loadAccountState } from './profileMemoryService';

const DATA_DIR = `${FileSystem.documentDirectory}falci-data/`;
const DAILY_MEMORY_WRITER_FILE = `${DATA_DIR}daily-memory-writer-maintenance.json`;
const DAILY_MEMORY_WRITER_TASK = 'daily-memory-writer-maintenance';
const DAY_MS = 24 * 60 * 60 * 1000;
const RUNNING_STALE_MS = 45 * 60 * 1000;
const MAINTENANCE_START_HOUR = 2;
const MAINTENANCE_END_HOUR = 3;

// Production/release için tek noktadan kapatılabilir.
export const ENABLE_DAILY_MEMORY_WRITER_MAINTENANCE = true;
export const DAILY_MEMORY_WRITER_BUSY_MESSAGE =
  'Günlük hafıza bakımı yapılıyor. Lütfen 1-2 dakika sonra tekrar deneyiniz.';

type DailyMemoryWriterRun = {
  runId: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'skipped' | 'failed';
  profileCount: number;
  appliedCount: number;
  failedCount: number;
  message?: string;
};

type DailyMemoryWriterStore = {
  schemaVersion: 1;
  status: 'idle' | 'running';
  lastStartedAt?: string;
  lastCompletedAt?: string;
  lastFailedAt?: string;
  lastSkippedAt?: string;
  runs: DailyMemoryWriterRun[];
};

let inMemoryRun: Promise<DailyMemoryWriterRun | null> | null = null;
let backgroundTaskDefined = false;

function loadBackgroundTaskModules():
  | {
      BackgroundTask: any;
      TaskManager: any;
    }
  | null {
  try {
    return {
      BackgroundTask: require('expo-background-task'),
      TaskManager: require('expo-task-manager'),
    };
  } catch {
    return null;
  }
}

function ensureBackgroundTaskDefined() {
  if (backgroundTaskDefined) return loadBackgroundTaskModules();
  const modules = loadBackgroundTaskModules();
  if (!modules) return null;
  const { BackgroundTask, TaskManager } = modules;
  try {
    TaskManager.defineTask(DAILY_MEMORY_WRITER_TASK, async () => {
      try {
        await maybeRunDailyMemoryWriterMaintenance({ source: 'background-task' });
        return BackgroundTask.BackgroundTaskResult.Success;
      } catch {
        return BackgroundTask.BackgroundTaskResult.Failed;
      }
    });
    backgroundTaskDefined = true;
  } catch {
    return null;
  }
  return modules;
}

function nowIso() {
  return new Date().toISOString();
}

function makeRunId() {
  return `daily_memory_writer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(DATA_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DATA_DIR, { intermediates: true });
  }
}

async function readStore(): Promise<DailyMemoryWriterStore> {
  await ensureDir();
  try {
    const info = await FileSystem.getInfoAsync(DAILY_MEMORY_WRITER_FILE);
    if (!info.exists) return { schemaVersion: 1, status: 'idle', runs: [] };
    const parsed = JSON.parse(await FileSystem.readAsStringAsync(DAILY_MEMORY_WRITER_FILE)) as Partial<DailyMemoryWriterStore>;
    return {
      schemaVersion: 1,
      status: parsed.status === 'running' ? 'running' : 'idle',
      lastStartedAt: parsed.lastStartedAt,
      lastCompletedAt: parsed.lastCompletedAt,
      lastFailedAt: parsed.lastFailedAt,
      lastSkippedAt: parsed.lastSkippedAt,
      runs: Array.isArray(parsed.runs) ? parsed.runs.slice(0, 30) : [],
    };
  } catch {
    return { schemaVersion: 1, status: 'idle', runs: [] };
  }
}

async function writeStore(store: DailyMemoryWriterStore) {
  await ensureDir();
  await FileSystem.writeAsStringAsync(
    DAILY_MEMORY_WRITER_FILE,
    JSON.stringify({ ...store, runs: store.runs.slice(0, 30) }, null, 2),
  );
}

function isMaintenanceWindow(date = new Date()) {
  const hour = date.getHours();
  return hour >= MAINTENANCE_START_HOUR && hour < MAINTENANCE_END_HOUR;
}

function completedWithin24Hours(store: DailyMemoryWriterStore) {
  if (!store.lastCompletedAt) return false;
  const completedAt = new Date(store.lastCompletedAt).getTime();
  return Number.isFinite(completedAt) && Date.now() - completedAt < DAY_MS;
}

function isRunningStale(store: DailyMemoryWriterStore) {
  if (store.status !== 'running' || !store.lastStartedAt) return false;
  const startedAt = new Date(store.lastStartedAt).getTime();
  return Number.isFinite(startedAt) && Date.now() - startedAt > RUNNING_STALE_MS;
}

async function updateRun(run: DailyMemoryWriterRun, patch: Partial<DailyMemoryWriterRun>, status: DailyMemoryWriterStore['status']) {
  const store = await readStore();
  const nextRun = { ...run, ...patch };
  const runs = [nextRun, ...store.runs.filter((item) => item.runId !== run.runId)];
  await writeStore({
    ...store,
    status,
    lastStartedAt: nextRun.startedAt,
    lastCompletedAt: nextRun.status === 'completed' ? nextRun.completedAt : store.lastCompletedAt,
    lastFailedAt: nextRun.status === 'failed' ? nextRun.completedAt : store.lastFailedAt,
    lastSkippedAt: nextRun.status === 'skipped' ? nextRun.completedAt : store.lastSkippedAt,
    runs,
  });
  return nextRun;
}

export async function getDailyMemoryWriterMaintenanceStatus() {
  const store = await readStore();
  return {
    isRunning: Boolean(inMemoryRun) || (store.status === 'running' && !isRunningStale(store)),
    lastStartedAt: store.lastStartedAt,
    lastCompletedAt: store.lastCompletedAt,
    lastFailedAt: store.lastFailedAt,
    lastSkippedAt: store.lastSkippedAt,
    runs: store.runs,
  };
}

export async function shouldBlockForDailyMemoryWriterMaintenance() {
  const status = await getDailyMemoryWriterMaintenanceStatus();
  return status.isRunning;
}

export async function registerDailyMemoryWriterBackgroundTask() {
  if (!ENABLE_DAILY_MEMORY_WRITER_MAINTENANCE) return;
  const modules = ensureBackgroundTaskDefined();
  if (!modules) return;
  const { BackgroundTask } = modules;
  const status = await BackgroundTask.getStatusAsync().catch(() => BackgroundTask.BackgroundTaskStatus.Restricted);
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
  await BackgroundTask.registerTaskAsync(DAILY_MEMORY_WRITER_TASK, { minimumInterval: 15 }).catch(() => {});
}

export async function maybeRunDailyMemoryWriterMaintenance(_options?: { source?: 'background-task' | 'manual-test' }) {
  if (!ENABLE_DAILY_MEMORY_WRITER_MAINTENANCE) return null;
  if (inMemoryRun) return inMemoryRun;

  const store = await readStore();
  if (store.status === 'running' && !isRunningStale(store)) {
    return null;
  }
  if (completedWithin24Hours(store)) {
    return null;
  }
  if (!isMaintenanceWindow()) {
    return null;
  }

  const startedAt = nowIso();
  const initialRun: DailyMemoryWriterRun = {
    runId: makeRunId(),
    startedAt,
    status: 'running',
    profileCount: 0,
    appliedCount: 0,
    failedCount: 0,
  };
  await writeStore({
    ...store,
    status: 'running',
    lastStartedAt: startedAt,
    runs: [initialRun, ...store.runs],
  });

  inMemoryRun = (async () => {
    let run = initialRun;
    try {
      const state = await loadAccountState();
      const profiles = state.profiles || [];
      run = await updateRun(run, { profileCount: profiles.length }, 'running');

      let appliedCount = 0;
      let failedCount = 0;
      for (const profile of profiles) {
        try {
          const result = await runAndApplyProfileIdentityMemoryWriter(profile.profileId);
          if (result.status === 'applied' || result.status === 'skipped') appliedCount += 1;
          else failedCount += 1;
        } catch {
          failedCount += 1;
        }
        run = { ...run, appliedCount, failedCount };
      }

      const finalStatus: DailyMemoryWriterRun['status'] = failedCount && !appliedCount ? 'failed' : 'completed';
      return await updateRun(
        run,
        {
          status: finalStatus,
          completedAt: nowIso(),
          appliedCount,
          failedCount,
          message: finalStatus === 'completed' ? 'Günlük hafıza bakımı tamamlandı.' : 'Günlük hafıza bakımı tamamlanamadı.',
        },
        'idle',
      );
    } catch (error: any) {
      return updateRun(
        run,
        {
          status: 'failed',
          completedAt: nowIso(),
          message: error?.message || 'Günlük hafıza bakımı tamamlanamadı.',
        },
        'idle',
      );
    } finally {
      inMemoryRun = null;
    }
  })();

  return inMemoryRun;
}
