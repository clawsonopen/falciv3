import { NativeModules, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { appendPromptDebugEntry } from './promptDebugService';

export type LocalGemmaModelId = 'gemma-4-e2b-it';

export type LocalGemmaBackendMode = 'gpu_mtp';

export type LocalGemmaModelInfo = {
  id: LocalGemmaModelId;
  label: string;
  fileName: string;
  bundledAssetName?: string;
  sizeInBytes: number;
  sizeLabel: string;
  url: string;
  fallbackUrl?: string;
  note: string;
  contextLabel: string;
  inputTokenLimit: number;
  initialMaxTokens: number;
  followUpMaxTokens: number;
  runtimeMaxTokens: number;
  backendMode: LocalGemmaBackendMode;
};

export type LocalGemmaRuntimeInfo = {
  hasSpeculativeDecodingSupport: boolean;
  requestedSpeculativeDecoding: boolean;
  willRequestSpeculativeDecoding: boolean;
  requestedBackendMode?: string;
  loadedBackendMode?: string | null;
  loadedEffectiveBackendMode?: string | null;
};

const MODEL_DIR = `${FileSystem.documentDirectory}local-ai/gemma-4-e2b/`;
const APPROX_CHARS_PER_TOKEN = 4;
const SPECIAL_TOKEN_RE = /<\|[^>]{1,80}\|>|<\/?(?:unused|extra_id|pad|bos|eos|start_of_turn|end_of_turn)[^>]{0,80}>|<unused\d+>/giu;

export const LOCAL_GEMMA_MODELS: LocalGemmaModelInfo[] = [
  {
    id: 'gemma-4-e2b-it',
    label: 'Gemma 4 E2B IT',
    fileName: 'gemma-4-E2B-it.litertlm',
    bundledAssetName: 'gemma-4-E2B-it.litertlm',
    sizeInBytes: 2588147712,
    sizeLabel: '2.59 GB',
    url: 'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it.litertlm?download=true',
    note: 'Ana lokal beyin adayı; GPU + MTP denenir, olmazsa otomatik daha güvenli moda düşer.',
    contextLabel: 'input 1024 / ilk yanıt 350 / takip 320 token / GPU+MTP aday modu',
    inputTokenLimit: 1024,
    initialMaxTokens: 350,
    followUpMaxTokens: 320,
    runtimeMaxTokens: 1374,
    backendMode: 'gpu_mtp',
  },
];

type NativeLiteRtLm = {
  generate(
    modelPath: string,
    prompt: string,
    maxTokens: number,
    temperature: number,
    contextMaxTokens: number,
    backendMode: string,
  ): Promise<string>;
  unload(): Promise<boolean>;
  installBundledModel?(fileName: string): Promise<string>;
  getModelRuntimeInfo?(modelPath: string, backendMode: string): Promise<LocalGemmaRuntimeInfo>;
};

const nativeLiteRtLm = NativeModules.RuhbazLiteRtLm as NativeLiteRtLm | undefined;

async function ensureModelDir() {
  const info = await FileSystem.getInfoAsync(MODEL_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(MODEL_DIR, { intermediates: true });
  }
}

export function getLocalGemmaModelInfo(id: LocalGemmaModelId) {
  return LOCAL_GEMMA_MODELS.find((model) => model.id === id) || LOCAL_GEMMA_MODELS[0];
}

export function getLocalGemmaModelPath(id: LocalGemmaModelId) {
  return `${MODEL_DIR}${getLocalGemmaModelInfo(id).fileName}`;
}

export function getLocalGemmaGenerationLimits(id: LocalGemmaModelId, mode: 'initial' | 'followUp') {
  const model = getLocalGemmaModelInfo(id);
  return {
    inputTokenLimit: model.inputTokenLimit,
    maxOutputTokens: mode === 'initial' ? model.initialMaxTokens : model.followUpMaxTokens,
  };
}

export async function unloadLocalGemma() {
  if (Platform.OS !== 'android' || !nativeLiteRtLm) return;
  await nativeLiteRtLm.unload();
}

export async function getLocalGemmaStatus(id: LocalGemmaModelId) {
  const model = getLocalGemmaModelInfo(id);
  const uri = getLocalGemmaModelPath(id);
  const info = await FileSystem.getInfoAsync(uri);
  return {
    model,
    uri,
    exists: info.exists,
    size: info.exists && 'size' in info ? info.size || 0 : 0,
  };
}

export async function getLocalGemmaRuntimeInfo(id: LocalGemmaModelId) {
  if (Platform.OS !== 'android' || !nativeLiteRtLm?.getModelRuntimeInfo) return null;
  const status = await getLocalGemmaStatus(id);
  if (!status.exists) return null;
  return nativeLiteRtLm.getModelRuntimeInfo(status.uri, status.model.backendMode);
}

export async function downloadLocalGemmaModel(
  id: LocalGemmaModelId,
  onProgress?: (progress: number) => void,
) {
  const model = getLocalGemmaModelInfo(id);
  await unloadLocalGemma();
  await ensureModelDir();
  const uri = getLocalGemmaModelPath(id);
  if (Platform.OS === 'android' && model.bundledAssetName && nativeLiteRtLm?.installBundledModel) {
    await nativeLiteRtLm.installBundledModel(model.bundledAssetName);
    await validateDownloadedLocalModel(model, uri);
    onProgress?.(1);
    return getLocalGemmaStatus(id);
  }
  const urls = [model.url, model.fallbackUrl].filter(Boolean) as string[];
  let lastError: any = null;
  for (const url of urls) {
    try {
      return await downloadAndValidateLocalModel(model, uri, url, onProgress);
    } catch (err) {
      lastError = err;
      await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
    }
  }
  throw lastError || new Error('Model indirilemedi.');
}

async function downloadAndValidateLocalModel(
  model: LocalGemmaModelInfo,
  uri: string,
  url: string,
  onProgress?: (progress: number) => void,
) {
  const download = FileSystem.createDownloadResumable(
    url,
    uri,
    {},
    ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
      const expected = totalBytesExpectedToWrite > 0 ? totalBytesExpectedToWrite : model.sizeInBytes;
      onProgress?.(Math.min(1, totalBytesWritten / expected));
    },
  );
  const result = await download.downloadAsync();
  if (!result?.uri) {
    throw new Error('Model indirilemedi.');
  }
  await validateDownloadedLocalModel(model, uri);
  return getLocalGemmaStatus(model.id);
}

async function validateDownloadedLocalModel(model: LocalGemmaModelInfo, uri: string) {
  const info = await FileSystem.getInfoAsync(uri);
  const actualSize = info.exists && 'size' in info ? info.size || 0 : 0;
  const minimumExpectedSize = Math.max(1024 * 1024, Math.floor(model.sizeInBytes * 0.72));
  if (!info.exists || actualSize < minimumExpectedSize) {
    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
    throw new Error(`${model.label} indirilemedi. Hugging Face erişim/terms onayı gerekebilir ya da dosya eksik indi.`);
  }
}

export async function deleteLocalGemmaModel(id: LocalGemmaModelId) {
  await unloadLocalGemma();
  const uri = getLocalGemmaModelPath(id);
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists) {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }
}

function estimateTokens(text: string) {
  return Math.ceil(text.length / APPROX_CHARS_PER_TOKEN);
}

function takeHeadAndTail(text: string, maxChars: number) {
  if (text.length <= maxChars) return text;
  if (maxChars <= 240) return text.slice(0, maxChars).trim();
  const headSize = Math.floor(maxChars * 0.38);
  const tailSize = maxChars - headSize - 96;
  return [
    text.slice(0, headSize).trim(),
    '[...bağlam sıkıştırıldı...]',
    text.slice(-tailSize).trim(),
  ].join('\n');
}

function compactLocalContext(text: string, maxChars: number) {
  const normalized = text.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const blocks = normalized.split(/\n\n+/).map((block) => block.trim()).filter(Boolean);
  const priorityLabels = [
    'Profile:',
    'Period:',
    'Content focus:',
    'Kullanıcının',
    'Memory',
    'Selected memory',
    'Seçilmiş',
    'Calculated key placements',
    'Güncel',
    'Önceki kişisel astroloji yorumu',
    'Bu oturumdaki önceki',
  ];
  const picked = blocks.filter((block) => priorityLabels.some((label) => block.includes(label)));
  const source = (picked.length ? picked : blocks).join('\n\n');
  return takeHeadAndTail(source, maxChars);
}

export function buildLocalGemmaPromptFromGeminiPayload(
  payload: any,
  options?: {
    modelId?: LocalGemmaModelId;
    mode?: 'initial' | 'followUp';
    inputTokenLimit?: number;
  },
) {
  const model = options?.modelId ? getLocalGemmaModelInfo(options.modelId) : LOCAL_GEMMA_MODELS[0];
  const inputTokenLimit = options?.inputTokenLimit || model.inputTokenLimit;
  const charLimit = inputTokenLimit * APPROX_CHARS_PER_TOKEN;
  const systemBudget = Math.min(920, Math.floor(charLimit * 0.24));
  const userBudget = Math.max(800, charLimit - systemBudget - 220);
  const sourceUserText = payload?.contents
    ?.flatMap((content: any) => content?.parts || [])
    .map((part: any) => part?.text)
    .filter(Boolean)
    .join('\n\n') || '';
  const localSystem = takeHeadAndTail([
    'Türkçe, sıcak, net ve kişiye özel yaz.',
    'Kendini tanıtma; yorumcu/persona adını asla yazma.',
    'Astrolojiyi sembolik yorum diliyle kur; kesin gelecek, sağlık tedavisi, ilaç, doz veya finans tavsiyesi verme.',
    'Verilen profil, dönem, soru, hafıza ve astroloji verisini kullan; eksik bilgiyi uydurma.',
    'Tekrar etme; eski okuma metnini sadece son soruyu anlamak için kullan.',
    options?.mode === 'followUp'
      ? 'Takip cevabı ver: son soruya doğrudan cevapla, 2 kısa paragrafı geçme.'
      : 'İlk yorumu ver: 3 kısa paragrafı geçme, son cümleyi tamamla.',
  ].filter(Boolean).join(' '), systemBudget);
  const compactUser = compactLocalContext(sourceUserText, userBudget);
  const prompt = [
    `<system>\n${localSystem}\n</system>`,
    `<user>\n${compactUser}\n</user>`,
    '<assistant>',
  ].join('\n\n');
  if (estimateTokens(prompt) <= inputTokenLimit) return prompt;
  return takeHeadAndTail(prompt, charLimit);
}

export async function generateLocalGemmaText(params: {
  modelId: LocalGemmaModelId;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}) {
  if (Platform.OS !== 'android' || !nativeLiteRtLm) {
    throw new Error('Yerel model yalnızca Android native build içinde kullanılabilir.');
  }
  const status = await getLocalGemmaStatus(params.modelId);
  if (!status.exists) {
    throw new Error(`${status.model.label} henüz indirilmemiş.`);
  }
  await appendPromptDebugEntry('local', params.prompt).catch(() => {});
  const text = sanitizeLocalGemmaOutput(await nativeLiteRtLm.generate(
    status.uri,
    params.prompt,
    params.maxTokens || status.model.initialMaxTokens,
    params.temperature || 0.72,
    status.model.runtimeMaxTokens,
    status.model.backendMode,
  ));
  if (!text.trim()) {
    throw new Error('Yerel model boş yanıt döndürdü.');
  }
  return text;
}

function sanitizeLocalGemmaOutput(text: string) {
  const source = (text || '').replace(/\r/g, '').trim();
  const specialMatches = source.match(SPECIAL_TOKEN_RE) || [];
  const specialTextLength = specialMatches.reduce((total, token) => total + token.length, 0);
  if (specialMatches.length >= 3 || specialTextLength > Math.max(24, source.length * 0.08)) {
    throw new Error('Yerel model özel token sızıntısı yaptı; çıktı güvenli değil.');
  }
  return source
    .replace(SPECIAL_TOKEN_RE, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
