import * as FileSystem from 'expo-file-system/legacy';

const DATA_DIR = `${FileSystem.documentDirectory}falci-data/`;
const LEDGER_FILE = `${DATA_DIR}token-ledger.json`;

export const DEFAULT_USD_TRY_RATE = 45.45;
export const GEMINI_FLASH_LITE_INPUT_PRICE_USD_PER_M = 0.1;
export const GEMINI_FLASH_LITE_OUTPUT_PRICE_USD_PER_M = 0.4;
export const GEMINI_FLASH_LITE_MODEL_NAME = 'gemini-2.5-flash-lite';
export const GEMINI_EMBEDDING_2_MODEL_NAME = 'gemini-embedding-2';
export const GEMINI_EMBEDDING_2_INPUT_PRICE_USD_PER_M = 0.2;

export type ModelTokenPrices = {
  inputPriceUsdPerM: number;
  outputPriceUsdPerM: number;
};

export const MODEL_TOKEN_PRICES_USD_PER_M: Record<string, ModelTokenPrices> = {
  [GEMINI_FLASH_LITE_MODEL_NAME]: { inputPriceUsdPerM: 0.1, outputPriceUsdPerM: 0.4 },
  [GEMINI_EMBEDDING_2_MODEL_NAME]: { inputPriceUsdPerM: GEMINI_EMBEDDING_2_INPUT_PRICE_USD_PER_M, outputPriceUsdPerM: 0 },
};

export function getModelTokenPrices(modelName?: string | null): ModelTokenPrices {
  return MODEL_TOKEN_PRICES_USD_PER_M[modelName || ''] || MODEL_TOKEN_PRICES_USD_PER_M[GEMINI_FLASH_LITE_MODEL_NAME];
}

export type PersonalTokenUsageRow = {
  key: string;
  createdAt: string;
  modelName: string;
  readingName: string;
  imageInputTokens: number;
  textInputTokens: number;
  outputTokens: number;
  rawPromptTokens: number;
  rawOutputTokens: number;
  rawThinkingTokens: number;
  rawTotalTokens: number;
};

type TokenLedger = {
  pendingInputTokens: number;
  pendingRejectedUploads: number;
  pendingMemoryAnalysisInputTokens: number;
  totalMemoryAnalysisInputTokens: number;
  totalMemoryAnalysisOutputTokens: number;
  totalMemoryAnalysisRuns: number;
  memoryAnalysisInFlight: number;
  personalUsageRows: PersonalTokenUsageRow[];
};

const EMPTY_LEDGER: TokenLedger = {
  pendingInputTokens: 0,
  pendingRejectedUploads: 0,
  pendingMemoryAnalysisInputTokens: 0,
  totalMemoryAnalysisInputTokens: 0,
  totalMemoryAnalysisOutputTokens: 0,
  totalMemoryAnalysisRuns: 0,
  memoryAnalysisInFlight: 0,
  personalUsageRows: [],
};
let pendingResetDoneForLaunch = false;

function nowIso() {
  return new Date().toISOString();
}

function makeUsageRowKey() {
  return `usage_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeUsageRow(row: Partial<PersonalTokenUsageRow>, index: number): PersonalTokenUsageRow {
  const imageInputTokens = Math.max(0, row.imageInputTokens || 0);
  const textInputTokens = Math.max(0, row.textInputTokens || 0);
  const outputTokens = Math.max(0, row.outputTokens || 0);
  const rawPromptTokens = Math.max(0, row.rawPromptTokens ?? imageInputTokens + textInputTokens);
  const rawOutputTokens = Math.max(0, row.rawOutputTokens ?? outputTokens);
  const rawThinkingTokens = Math.max(0, row.rawThinkingTokens || 0);
  return {
    key: row.key || `usage_legacy_${index}`,
    createdAt: row.createdAt || nowIso(),
    modelName: row.modelName || GEMINI_FLASH_LITE_MODEL_NAME,
    readingName: row.readingName || 'Bilinmeyen Çağrı',
    imageInputTokens,
    textInputTokens,
    outputTokens,
    rawPromptTokens,
    rawOutputTokens,
    rawThinkingTokens,
    rawTotalTokens: Math.max(0, row.rawTotalTokens ?? rawPromptTokens + rawOutputTokens),
  };
}

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
  const savedLedger = JSON.parse(raw) as Partial<TokenLedger>;
  const hadMemoryAnalysisRunCounter = Object.prototype.hasOwnProperty.call(savedLedger, 'totalMemoryAnalysisRuns');
  const ledger = { ...EMPTY_LEDGER, ...savedLedger };
  if (!hadMemoryAnalysisRunCounter) {
    ledger.totalMemoryAnalysisInputTokens = 0;
    ledger.totalMemoryAnalysisOutputTokens = 0;
    ledger.totalMemoryAnalysisRuns = 0;
  }
  const seenKeys = new Set<string>();
  ledger.personalUsageRows = (ledger.personalUsageRows || []).map((row, index) => {
    const normalized = normalizeUsageRow(row, index);
    if (seenKeys.has(normalized.key)) {
      normalized.key = `${normalized.key}_${index}`;
    }
    seenKeys.add(normalized.key);
    return normalized;
  });
  return ledger;
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
  rawPromptTokens?: number;
  rawOutputTokens?: number;
  rawThinkingTokens?: number;
  rawTotalTokens?: number;
}): Promise<void> {
  const ledger = await readLedger();
  const imageInputTokens = Math.max(0, params.imageInputTokens || 0);
  const textInputTokens = Math.max(0, params.textInputTokens || 0);
  const outputTokens = Math.max(0, params.outputTokens || 0);
  const rawPromptTokens = Math.max(0, params.rawPromptTokens ?? imageInputTokens + textInputTokens);
  const rawOutputTokens = Math.max(0, params.rawOutputTokens ?? outputTokens);
  const rawThinkingTokens = Math.max(0, params.rawThinkingTokens || 0);
  ledger.personalUsageRows = [
    ...(ledger.personalUsageRows || []),
    {
      key: makeUsageRowKey(),
      createdAt: nowIso(),
      modelName: params.modelName || GEMINI_FLASH_LITE_MODEL_NAME,
      readingName: params.readingName,
      imageInputTokens,
      textInputTokens,
      outputTokens,
      rawPromptTokens,
      rawOutputTokens,
      rawThinkingTokens,
      rawTotalTokens: Math.max(0, params.rawTotalTokens ?? rawPromptTokens + rawOutputTokens),
    },
  ];
  await writeLedger(ledger);
}

export async function resetPersonalTokenUsage(): Promise<void> {
  const ledger = await readLedger();
  ledger.personalUsageRows = [];
  ledger.totalMemoryAnalysisInputTokens = 0;
  ledger.totalMemoryAnalysisOutputTokens = 0;
  ledger.totalMemoryAnalysisRuns = 0;
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
  ledger.totalMemoryAnalysisRuns += 1;
  const textInputTokens = Math.max(0, inputTokens || 0);
  const rawOutputTokens = Math.max(0, outputTokens || 0);
  ledger.personalUsageRows = [
    ...(ledger.personalUsageRows || []),
    {
      key: makeUsageRowKey(),
      createdAt: nowIso(),
      modelName: GEMINI_FLASH_LITE_MODEL_NAME,
      readingName: 'Hafıza Analizi',
      imageInputTokens: 0,
      textInputTokens,
      outputTokens: rawOutputTokens,
      rawPromptTokens: textInputTokens,
      rawOutputTokens,
      rawThinkingTokens: 0,
      rawTotalTokens: textInputTokens + rawOutputTokens,
    },
  ];
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
