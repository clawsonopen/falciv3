import * as FileSystem from 'expo-file-system/legacy';

const DATA_DIR = `${FileSystem.documentDirectory}falci-data/`;
const LEDGER_FILE = `${DATA_DIR}token-ledger.json`;

export const DEFAULT_USD_TRY_RATE = 45.45;
export const GEMINI_FLASH_LITE_INPUT_PRICE_USD_PER_M = 0.1;
export const GEMINI_FLASH_LITE_OUTPUT_PRICE_USD_PER_M = 0.3;

export type PersonalTokenUsageRow = {
  key: string;
  modelName: string;
  readingName: string;
  imageInputTokens: number;
  textInputTokens: number;
  outputTokens: number;
};

type TokenLedger = {
  pendingInputTokens: number;
  pendingRejectedUploads: number;
  pendingMemoryAnalysisInputTokens: number;
  totalMemoryAnalysisInputTokens: number;
  totalMemoryAnalysisOutputTokens: number;
  memoryAnalysisInFlight: number;
  personalUsageRows: PersonalTokenUsageRow[];
};

const EMPTY_LEDGER: TokenLedger = {
  pendingInputTokens: 0,
  pendingRejectedUploads: 0,
  pendingMemoryAnalysisInputTokens: 0,
  totalMemoryAnalysisInputTokens: 0,
  totalMemoryAnalysisOutputTokens: 0,
  memoryAnalysisInFlight: 0,
  personalUsageRows: [],
};
let pendingResetDoneForLaunch = false;

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(DATA_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DATA_DIR, { intermediates: true });
  }
}

async function readLedger(): Promise<TokenLedger> {
  await ensureDir();
  const info = await FileSystem.getInfoAsync(LEDGER_FILE);
  if (!info.exists) return EMPTY_LEDGER;
  const raw = await FileSystem.readAsStringAsync(LEDGER_FILE);
  return { ...EMPTY_LEDGER, ...(JSON.parse(raw) as Partial<TokenLedger>) };
}

async function writeLedger(ledger: TokenLedger) {
  await ensureDir();
  await FileSystem.writeAsStringAsync(LEDGER_FILE, JSON.stringify(ledger, null, 2));
}

export async function getTokenLedgerSnapshot(): Promise<TokenLedger> {
  return readLedger();
}

export async function addPersonalTokenUsage(params: {
  modelName: string;
  readingName: string;
  imageInputTokens?: number;
  textInputTokens?: number;
  outputTokens?: number;
}): Promise<void> {
  const ledger = await readLedger();
  const key = `${params.modelName || 'gemini-2.5-flash-lite'}|${params.readingName}`;
  const current = (ledger.personalUsageRows || []).find((row) => row.key === key);
  if (current) {
    current.imageInputTokens += Math.max(0, params.imageInputTokens || 0);
    current.textInputTokens += Math.max(0, params.textInputTokens || 0);
    current.outputTokens += Math.max(0, params.outputTokens || 0);
  } else {
    ledger.personalUsageRows = [
      ...(ledger.personalUsageRows || []),
      {
        key,
        modelName: params.modelName || 'gemini-2.5-flash-lite',
        readingName: params.readingName,
        imageInputTokens: Math.max(0, params.imageInputTokens || 0),
        textInputTokens: Math.max(0, params.textInputTokens || 0),
        outputTokens: Math.max(0, params.outputTokens || 0),
      },
    ];
  }
  await writeLedger(ledger);
}

export async function resetPersonalTokenUsage(): Promise<void> {
  const ledger = await readLedger();
  ledger.personalUsageRows = [];
  await writeLedger(ledger);
}

export async function resetPendingLedgerOncePerLaunch(): Promise<void> {
  if (pendingResetDoneForLaunch) return;
  pendingResetDoneForLaunch = true;
  const ledger = await readLedger();
  const next: TokenLedger = {
    ...ledger,
    pendingInputTokens: 0,
    pendingRejectedUploads: 0,
    pendingMemoryAnalysisInputTokens: 0,
    memoryAnalysisInFlight: 0,
  };
  await writeLedger(next);
}

export async function addPendingInputTokens(amount: number): Promise<void> {
  if (!amount) return;
  const ledger = await readLedger();
  ledger.pendingInputTokens += amount;
  await writeLedger(ledger);
}

export async function consumePendingInputTokens(): Promise<number> {
  const ledger = await readLedger();
  const amount = ledger.pendingInputTokens || 0;
  if (amount) {
    ledger.pendingInputTokens = 0;
    await writeLedger(ledger);
  }
  return amount;
}

export async function addRejectedUploadAttempt(amount = 1): Promise<void> {
  if (!amount) return;
  const ledger = await readLedger();
  ledger.pendingRejectedUploads += amount;
  await writeLedger(ledger);
}

export async function consumeRejectedUploadAttempts(): Promise<number> {
  const ledger = await readLedger();
  const amount = ledger.pendingRejectedUploads || 0;
  if (amount) {
    ledger.pendingRejectedUploads = 0;
    await writeLedger(ledger);
  }
  return amount;
}

export async function addPendingMemoryAnalysisInputTokens(amount: number): Promise<void> {
  if (!amount) return;
  const ledger = await readLedger();
  ledger.pendingMemoryAnalysisInputTokens += amount;
  await writeLedger(ledger);
}

export async function startMemoryAnalysisEstimate(amount: number): Promise<void> {
  const ledger = await readLedger();
  ledger.memoryAnalysisInFlight += 1;
  ledger.pendingMemoryAnalysisInputTokens += Math.max(0, amount || 0);
  await writeLedger(ledger);
}

export async function settleMemoryAnalysisUsage(
  inputTokens: number,
  outputTokens: number,
  estimatedInputTokens?: number,
): Promise<void> {
  const ledger = await readLedger();
  ledger.memoryAnalysisInFlight = Math.max(0, (ledger.memoryAnalysisInFlight || 0) - 1);
  ledger.pendingMemoryAnalysisInputTokens = Math.max(
    0,
    (ledger.pendingMemoryAnalysisInputTokens || 0) - Math.max(0, estimatedInputTokens || inputTokens || 0),
  );
  ledger.totalMemoryAnalysisInputTokens += Math.max(0, inputTokens || 0);
  ledger.totalMemoryAnalysisOutputTokens += Math.max(0, outputTokens || 0);
  const key = 'gemini-2.5-flash-lite|Hafıza Analizi';
  const current = (ledger.personalUsageRows || []).find((row) => row.key === key);
  if (current) {
    current.textInputTokens += Math.max(0, inputTokens || 0);
    current.outputTokens += Math.max(0, outputTokens || 0);
  } else {
    ledger.personalUsageRows = [
      ...(ledger.personalUsageRows || []),
      {
        key,
        modelName: 'gemini-2.5-flash-lite',
        readingName: 'Hafıza Analizi',
        imageInputTokens: 0,
        textInputTokens: Math.max(0, inputTokens || 0),
        outputTokens: Math.max(0, outputTokens || 0),
      },
    ];
  }
  await writeLedger(ledger);
}

export async function failMemoryAnalysisEstimate(amount: number): Promise<void> {
  const ledger = await readLedger();
  ledger.memoryAnalysisInFlight = Math.max(0, (ledger.memoryAnalysisInFlight || 0) - 1);
  ledger.pendingMemoryAnalysisInputTokens = Math.max(
    0,
    (ledger.pendingMemoryAnalysisInputTokens || 0) - Math.max(0, amount || 0),
  );
  await writeLedger(ledger);
}
