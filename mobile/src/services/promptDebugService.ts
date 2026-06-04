import * as FileSystem from 'expo-file-system/legacy';

const DATA_DIR = `${FileSystem.documentDirectory}falci-data/`;
const PROMPT_DEBUG_FILE = `${DATA_DIR}last-session-prompts.json`;

export type PromptDebugProvider = 'api' | 'local';

export type PromptDebugEntry = {
  id: string;
  provider: PromptDebugProvider;
  title: string;
  prompt: string;
  createdAt: string;
};

type PromptDebugStore = {
  schemaVersion: 1;
  entries: PromptDebugEntry[];
};

async function ensureDir(path: string) {
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(path, { intermediates: true });
  }
}

async function readStore(): Promise<PromptDebugStore> {
  try {
    const info = await FileSystem.getInfoAsync(PROMPT_DEBUG_FILE);
    if (!info.exists) return { schemaVersion: 1, entries: [] };
    const parsed = JSON.parse(await FileSystem.readAsStringAsync(PROMPT_DEBUG_FILE)) as PromptDebugStore;
    return {
      schemaVersion: 1,
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
    };
  } catch {
    return { schemaVersion: 1, entries: [] };
  }
}

async function writeStore(store: PromptDebugStore) {
  await ensureDir(DATA_DIR);
  await FileSystem.writeAsStringAsync(PROMPT_DEBUG_FILE, JSON.stringify(store, null, 2));
}

type PromptDebugKind = {
  readingLabel: string;
  isFollowUp: boolean;
};

function compactPromptText(prompt: string) {
  return prompt.replace(/\s+/g, ' ').trim();
}

function looksLikeInitialReadingPrompt(prompt: string) {
  const text = prompt.toLocaleLowerCase('tr-TR');
  return /\b(ana .*yorum|ilk yorumu|yorumumu başlat|okumasına devam et|ana açılım yorumunda|rüya metni|doğum haritası yorumu|detaylı .* okuması yaz|kişisel numeroloji)\b/iu.test(text);
}

function looksLikeFollowUpPrompt(prompt: string) {
  const text = prompt.toLocaleLowerCase('tr-TR');
  return (
    text.includes('## follow-up yanıt sözleşmesi') ||
    text.includes('bu tur yeni bir okuma açılışı değildir') ||
    text.includes('yalnızca kullanıcının son mesajındaki soruya') ||
    text.includes('önceki soru-cevap') ||
    text.includes('önceki soru cevap')
  );
}

function inferReadingLabel(prompt: string) {
  const text = compactPromptText(prompt).toLocaleLowerCase('tr-TR');
  const explicitType = text.match(/okuma türü:\s*([a-zğüşöçıİ\s/-]+)/iu)?.[1]?.trim();
  if (explicitType?.includes('palm') || explicitType?.includes('el')) return 'El';
  if (explicitType?.includes('coffee') || explicitType?.includes('kahve')) return 'Kahve';
  if (text.includes('bu oturumun okuma türünü öncele: el okuması') || text.includes('avuç içi görsel protokolü')) return 'El';
  if (text.includes('bu oturumun okuma türünü öncele: kahve') || text.includes('kahve görsel protokolü')) return 'Kahve';
  if (text.includes('pati görsel protokolü') || text.includes('kişisel el/pati okuması')) return 'Pati';
  if (text.includes('bu oturum tarot açılımıdır') || text.includes('kartlar ve pozisyonlar')) return 'Tarot';
  if (text.includes('rüya yorumu direktifleri') || text.includes('rüya metni:') || text.includes('uyku/rüya notu:')) return 'Rüya';
  if (text.includes('kişiye özel numerolojide') || text.includes('numerology json') || text.includes('kişisel numeroloji')) return 'Numeroloji';
  if (text.includes('doğum haritası yorumu') || text.includes('doğum haritası verisi json')) return 'Doğum Haritası';
  if (text.includes('astrolojik uyum analizi') || text.includes('astrolojik aile okuması') || text.includes('ilişki/aile temasları json')) return 'Astro İlişki';
  if (text.includes('kişiye özel astrolojide') || text.includes('period interpretation data json') || text.includes('güncel gökyüzü/transit json')) return 'Astro';
  return 'Okuma';
}

function inferPromptKind(prompt: string): PromptDebugKind {
  const looksInitial = looksLikeInitialReadingPrompt(prompt);
  return {
    readingLabel: inferReadingLabel(prompt),
    isFollowUp: looksLikeFollowUpPrompt(prompt) || !looksInitial,
  };
}

function entryTitle(kind: PromptDebugKind, entries: PromptDebugEntry[]) {
  if (!kind.isFollowUp) return `${kind.readingLabel} + ilk yorum`;
  const prefix = `${kind.readingLabel} + followup #`;
  const lastInitialIndex = entries
    .map((entry) => entry.title)
    .lastIndexOf(`${kind.readingLabel} + ilk yorum`);
  const relevantEntries = lastInitialIndex >= 0 ? entries.slice(lastInitialIndex + 1) : entries;
  const count = relevantEntries.filter((entry) => entry.title.startsWith(prefix)).length + 1;
  return `${prefix}${count}`;
}

function textFromPart(part: any) {
  if (!part) return '';
  if (typeof part.text === 'string') return part.text;
  const inline = part.inline_data || part.inlineData;
  if (inline) {
    const mime = inline.mime_type || inline.mimeType || 'image';
    return `[görsel gönderildi: ${mime}; base64 debug kaydına yazılmadı]`;
  }
  return '';
}

export function promptTextFromGeminiPayload(payload: Record<string, unknown>) {
  const systemText = (payload as any)?.system_instruction?.parts?.map(textFromPart).filter(Boolean).join('\n\n') || '';
  const contents = ((payload as any)?.contents || [])
    .map((content: any, contentIndex: number) => {
      const role = content?.role || `content-${contentIndex + 1}`;
      const text = (content?.parts || []).map(textFromPart).filter(Boolean).join('\n\n');
      return text ? `<${role}>\n${text}` : '';
    })
    .filter(Boolean)
    .join('\n\n');
  return [
    systemText ? `<system>\n${systemText}` : '',
    contents,
  ].filter(Boolean).join('\n\n').trim();
}

export function shouldSkipPromptDebug(payload: Record<string, unknown>) {
  const config = (payload as any)?.generationConfig || {};
  if (config.responseMimeType === 'application/json' || config.responseJsonSchema) return true;
  const prompt = promptTextFromGeminiPayload(payload).toLocaleLowerCase('tr-TR');
  if (prompt.includes('hafıza seçimi yapan küçük bir json selector')) return true;
  if (prompt.includes('internal length repair')) return true;
  return /\bhafıza analizi\b|\bmemory analysis\b|\bjson\b/.test(prompt) && prompt.includes('schema');
}

export async function appendPromptDebugEntry(provider: PromptDebugProvider, prompt: string) {
  const normalized = (prompt || '').trim();
  if (!normalized) return;
  if (normalized.toLocaleLowerCase('tr-TR').includes('internal length repair')) return;
  const store = await readStore();
  const entries = store.entries.slice(-11);
  const kind = inferPromptKind(normalized);
  const next: PromptDebugEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    provider,
    title: entryTitle(kind, entries),
    prompt: normalized,
    createdAt: new Date().toISOString(),
  };
  await writeStore({ schemaVersion: 1, entries: [...entries, next] });
}

export async function loadPromptDebugEntries() {
  return (await readStore()).entries;
}

export async function clearPromptDebugEntries() {
  await writeStore({ schemaVersion: 1, entries: [] });
}
