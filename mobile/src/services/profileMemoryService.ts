import * as FileSystem from 'expo-file-system/legacy';
import type {
  AccountState,
  BirthInfo,
  ChartPrecision,
  MemoryCategoryCandidate,
  MemoryEdge,
  MemoryObservation,
  MemoryPromptAuditEntry,
  MemoryWriterProposal,
  PromptMemoryPack,
  RawArchiveEntry,
  ReadingFingerprint,
  SourceChunk,
  UsedSpecificityEventMemory,
  UsedSurfaceCueMemory,
  ProfileGender,
  ProfileMemoryBundle,
  ProfileMemorySnippet,
  ProfileTopicMemory,
  ReadingDerivedMemoryFile,
  ReadingSummary,
  ReadingSurface,
  SessionJournalEntry,
  RelationshipPrimary,
  RelationshipRelativeDetail,
  SubjectProfile,
  UserStatedMemoryFile,
} from '../types/memory';
import type { MemoryAnalysisResult } from './memoryAnalysisService';
import {
  deleteSqliteArtifactsForProfile,
  deleteSqliteArtifactsForReading,
  indexMemoryEdges,
  indexMemoryNodes,
  indexRawArchiveEntry,
  indexReadingFingerprint,
  indexSessionJournal,
  searchSourceChunks,
} from './memorySqliteService';
import { indexObservationEmbeddings } from './memoryEmbeddingService';

const DATA_DIR = `${FileSystem.documentDirectory}falci-data/`;
const DATA_FILE = `${DATA_DIR}account-state.json`;
const MEMORY_DIR = `${DATA_DIR}profile-memories/`;
const MAX_MEMORY_ITEMS = 10;
const MAX_RAW_ARCHIVE_ITEMS = 80;
const MAX_SESSION_JOURNAL_ITEMS = 120;
const MAX_READING_FINGERPRINT_ITEMS = 60;
const MAX_MEMORY_EDGE_ITEMS = 160;
const MAX_SOURCE_CHUNK_ITEMS = 240;
const MAX_PROMPT_AUDIT_ITEMS = 160;
const MEMORY_PROFILE_QUOTA_BYTES = 1024 * 1024 * 1024;
const MEMORY_ACTIVE_INDEX_TARGET_BYTES = 256 * 1024 * 1024;
export const MEMORY_RETENTION_POLICY = {
  profileQuotaBytes: MEMORY_PROFILE_QUOTA_BYTES,
  activeIndexTargetBytes: MEMORY_ACTIVE_INDEX_TARGET_BYTES,
  rawArchive: 'Geçmiş ve ham arşiv mümkün olduğunca tutulur; kota baskısında en eski reading-derived raw kayıtlar önce arşiv adayı olur.',
  promptMemory: 'Prompt memory sabit küçük tutulur; user-stated ve Kendini Tanı essence reading-derived temalardan önceliklidir.',
  decay: 'Okuma kaynaklı düşük güvenli temalar consolidation sırasında zayıflatılır.',
  corrections: 'Kullanıcı düzeltmeleri yüksek güvenli core memory olarak korunur.',
} as const;
const ASSISTANT_NAME_SET = new Set([
  'suzan',
  'suzan hanim',
  'durdane',
  'durdane hanim',
  'teoman',
  'teoman bey',
  'hikmet',
  'hikmet bey',
  'selin',
  'selin hanim',
  'bahar',
  'bahar hanim',
  'berk',
  'berk bey',
  'mert',
  'mert bey',
  'arin',
  'caner',
  'ayse',
  'aisha',
  'deniz',
  'dennis',
]);
const SEMANTIC_STOP_WORDS = new Set([
  'ben',
  'beni',
  'bana',
  'benim',
  'sen',
  'sana',
  'ne',
  'mi',
  'mı',
  'mu',
  'mü',
  've',
  'veya',
  'ile',
  'için',
  'icin',
  'bir',
  'bu',
  'şu',
  'su',
  'o',
  'da',
  'de',
  'ki',
  'çok',
  'cok',
  'nasıl',
  'nasil',
  'neden',
  'acaba',
  'olur',
  'olacak',
]);

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeReadingTextForDedupe(value?: string | null) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function readingDedupeKey(reading: Pick<ReadingSummary, 'profileId' | 'assistantId' | 'readingType' | 'period' | 'astroFocusQuestion' | 'coffeeMode' | 'summary' | 'transcript'>) {
  const transcriptKey = (reading.transcript || [])
    .map((item) => `${item.role}:${normalizeReadingTextForDedupe(item.text)}`)
    .join('|');
  return [
    reading.profileId,
    reading.assistantId,
    reading.readingType,
    reading.period || '',
    normalizeReadingTextForDedupe(reading.astroFocusQuestion),
    reading.coffeeMode || '',
    normalizeReadingTextForDedupe(reading.summary),
    transcriptKey,
  ].join('\u001f');
}

function dedupeReadingSummaries(readings: ReadingSummary[]) {
  const seen = new Set<string>();
  return readings.filter((reading) => {
    const key = readingDedupeKey(reading);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const EMPTY_BIRTH: BirthInfo = {
  date: null,
  time: null,
  timeKnown: false,
  location: {
    country: null,
    cityOrRegion: null,
    district: null,
    subdistrict: null,
    freeform: null,
  },
};

function createEmptyState(): AccountState {
  return {
    accountId: makeId('acc'),
    primaryProfileId: null,
    profiles: [],
    readings: [],
  };
}

function computeChartPrecision(birth: BirthInfo): ChartPrecision {
  if (!birth.date) return 'unknown';
  if (
    birth.date &&
    birth.location.country &&
    birth.location.cityOrRegion &&
    birth.time &&
    birth.timeKnown
  ) {
    return 'full';
  }
  if (birth.date && birth.location.country && birth.location.cityOrRegion) {
    return 'date_plus_place';
  }
  return 'date_only';
}

function profileDir(profileId: string) {
  return `${MEMORY_DIR}${profileId}/`;
}

function userMemoryFile(profileId: string) {
  return `${profileDir(profileId)}user-stated.json`;
}

function readingMemoryFile(profileId: string) {
  return `${profileDir(profileId)}reading-derived.json`;
}

function rawArchiveFile(profileId: string) {
  return `${profileDir(profileId)}raw-archive.json`;
}

function sessionJournalFile(profileId: string) {
  return `${profileDir(profileId)}session-journals.json`;
}

function readingFingerprintsFile(profileId: string) {
  return `${profileDir(profileId)}reading-fingerprints.json`;
}

function memoryEdgesFile(profileId: string) {
  return `${profileDir(profileId)}memory-edges.json`;
}

function sourceChunksFile(profileId: string) {
  return `${profileDir(profileId)}source-chunks.json`;
}

function promptAuditFile(profileId: string) {
  return `${profileDir(profileId)}prompt-audits.json`;
}

function userSemanticWikiFile(profileId: string) {
  return `${profileDir(profileId)}user-semantic-wiki.json`;
}

function emptyUserStatedMemory(profileId: string, accountId: string): UserStatedMemoryFile {
  return {
    source: 'user-stated',
    profileId,
    accountId,
    recurringTopics: [],
    importantPeople: [],
    emotionalPatterns: [],
    observations: [],
    categoryCandidates: [],
    assistantAffinity: {},
    updatedAt: nowIso(),
  };
}

function emptyReadingDerivedMemory(profileId: string, accountId: string): ReadingDerivedMemoryFile {
  return {
    source: 'reading-derived',
    profileId,
    accountId,
    recurringTopics: [],
    importantPeople: [],
    emotionalPatterns: [],
    observations: [],
    categoryCandidates: [],
    usedLifeEvents: [],
    usedSurfaceCues: [],
    assistantAffinity: {},
    updatedAt: nowIso(),
  };
}

async function ensureDir(path: string) {
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(path, { intermediates: true });
  }
}

async function ensureBaseDirs() {
  await ensureDir(DATA_DIR);
  await ensureDir(MEMORY_DIR);
}

async function saveState(state: AccountState) {
  await ensureBaseDirs();
  await FileSystem.writeAsStringAsync(DATA_FILE, JSON.stringify(state, null, 2));
}

async function ensureProfileMemoryFiles(profileId: string, accountId: string) {
  await ensureBaseDirs();
  await ensureDir(profileDir(profileId));

  const userPath = userMemoryFile(profileId);
  const readingPath = readingMemoryFile(profileId);
  const rawArchivePath = rawArchiveFile(profileId);
  const journalPath = sessionJournalFile(profileId);
  const fingerprintsPath = readingFingerprintsFile(profileId);
  const edgesPath = memoryEdgesFile(profileId);
  const chunksPath = sourceChunksFile(profileId);
  const auditPath = promptAuditFile(profileId);

  const [userInfo, readingInfo, rawArchiveInfo, journalInfo, fingerprintsInfo, edgesInfo, chunksInfo, auditInfo] = await Promise.all([
    FileSystem.getInfoAsync(userPath),
    FileSystem.getInfoAsync(readingPath),
    FileSystem.getInfoAsync(rawArchivePath),
    FileSystem.getInfoAsync(journalPath),
    FileSystem.getInfoAsync(fingerprintsPath),
    FileSystem.getInfoAsync(edgesPath),
    FileSystem.getInfoAsync(chunksPath),
    FileSystem.getInfoAsync(auditPath),
  ]);

  if (!userInfo.exists) {
    await FileSystem.writeAsStringAsync(
      userPath,
      JSON.stringify(emptyUserStatedMemory(profileId, accountId), null, 2),
    );
  }

  if (!readingInfo.exists) {
    await FileSystem.writeAsStringAsync(
      readingPath,
      JSON.stringify(emptyReadingDerivedMemory(profileId, accountId), null, 2),
    );
  }

  if (!rawArchiveInfo.exists) {
    await FileSystem.writeAsStringAsync(rawArchivePath, JSON.stringify([], null, 2));
  }

  if (!journalInfo.exists) {
    await FileSystem.writeAsStringAsync(journalPath, JSON.stringify([], null, 2));
  }

  if (!fingerprintsInfo.exists) {
    await FileSystem.writeAsStringAsync(fingerprintsPath, JSON.stringify([], null, 2));
  }

  if (!edgesInfo.exists) {
    await FileSystem.writeAsStringAsync(edgesPath, JSON.stringify([], null, 2));
  }

  if (!chunksInfo.exists) {
    await FileSystem.writeAsStringAsync(chunksPath, JSON.stringify([], null, 2));
  }

  if (!auditInfo.exists) {
    await FileSystem.writeAsStringAsync(auditPath, JSON.stringify([], null, 2));
  }
}

async function readJsonFile<T>(path: string, fallback: T): Promise<T> {
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return fallback;
  const raw = await FileSystem.readAsStringAsync(path);
  return JSON.parse(raw) as T;
}

async function writeJsonFile(path: string, value: unknown) {
  await FileSystem.writeAsStringAsync(path, JSON.stringify(value, null, 2));
}

function transcriptToText(transcript?: ReadingSummary['transcript']) {
  return (transcript || [])
    .map((item) => `${item.role}: ${item.text}`)
    .join('\n')
    .trim();
}

function compactText(value: string, maxLength = 12000) {
  const normalized = value.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}\n[Kesildi: ham kayıt daha uzundu.]`;
}

function readingRawText(reading: ReadingSummary) {
  const chunks = [
    `Özet: ${reading.summary}`,
    transcriptToText(reading.transcript),
  ].filter(Boolean);
  return compactText(chunks.join('\n\n'));
}

function uniqueNonEmpty(values: string[], limit: number) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    const key = normalizeForMatching(trimmed);
    if (!trimmed || !key || seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
    if (result.length >= limit) break;
  }
  return result;
}

function inferReadingThemes(reading: ReadingSummary) {
  const source = normalizeForMatching(`${reading.readingType} ${reading.period || ''} ${reading.summary}`);
  const themes: string[] = [];
  const checks: Array<[RegExp, string]> = [
    [/(ask|iliski|sevgili|es|evlilik|flort|kalp)/, 'ilişki'],
    [/(is|kariyer|para|maddi|proje|ofis|patron)/, 'iş ve para'],
    [/(aile|anne|baba|kardes|cocuk|ev)/, 'aile'],
    [/(saglik|beden|yorgun|uyku|stres)/, 'beden ve enerji'],
    [/(yol|seyahat|tasın|tasin|uzak|haber)/, 'yol ve haber'],
    [/(karar|secim|ikilem|baslangic|bitis)/, 'karar eşiği'],
  ];
  for (const [pattern, label] of checks) {
    if (pattern.test(source)) themes.push(label);
  }
  themes.push(reading.readingType);
  if (reading.period) themes.push(reading.period);
  return uniqueNonEmpty(themes, 6);
}

function inferReadingSymbols(reading: ReadingSummary) {
  const text = `${reading.summary} ${transcriptToText(reading.transcript)}`;
  const symbols = [
    'yol',
    'kapı',
    'anahtar',
    'kalp',
    'kuş',
    'haber',
    'yüzük',
    'ağaç',
    'dağ',
    'su',
    'ev',
    'göz',
    'ay',
    'güneş',
  ];
  return uniqueNonEmpty(symbols.filter((symbol) => containsKeyword(text, symbol)), 8);
}

function inferPhrasesToAvoid(reading: ReadingSummary) {
  const text = normalizeForMatching(reading.summary);
  const phrases: string[] = [];
  const checks: Array<[RegExp, string]> = [
    [/(yeni bir baslangic|baslangic enerjisi)/, 'yeni başlangıç'],
    [/(haber alacaksin|haber geliyor)/, 'haber geliyor'],
    [/(yol gorunuyor|kisa bir yol)/, 'yol görünüyor'],
    [/(kalbinde|kalp enerjisi)/, 'kalp enerjisi'],
    [/(para kapisi|maddi rahatlama)/, 'maddi rahatlama'],
  ];
  for (const [pattern, phrase] of checks) {
    if (pattern.test(text)) phrases.push(phrase);
  }
  return uniqueNonEmpty(phrases, 6);
}

function buildReadingFingerprint(reading: ReadingSummary): ReadingFingerprint {
  const themes = inferReadingThemes(reading);
  const symbols = inferReadingSymbols(reading);
  const phrasesToAvoid = inferPhrasesToAvoid(reading);
  return {
    fingerprintId: makeId('fp'),
    accountId: reading.accountId,
    profileId: reading.profileId,
    readingId: reading.readingId,
    assistantId: reading.assistantId,
    readingType: reading.readingType,
    createdAt: reading.createdAt,
    themes,
    symbols,
    phrasesToAvoid,
    emotionalArc: themes.includes('karar eşiği') ? 'karar ve netleşme' : undefined,
    nextAngleSuggestion: themes.length
      ? `Bir sonraki okumada ${themes.slice(0, 2).join(', ')} temasını otomatik merkez yapma; yeni işaret arayarak farklı açı aç.`
      : undefined,
  };
}

function buildRawArchiveEntry(reading: ReadingSummary): RawArchiveEntry {
  return {
    rawId: makeId('raw'),
    accountId: reading.accountId,
    profileId: reading.profileId,
    readingId: reading.readingId,
    sourceType: 'reading_output',
    createdAt: reading.createdAt,
    text: readingRawText(reading),
    metadata: {
      readingType: reading.readingType,
      period: reading.period || null,
      coffeeMode: reading.coffeeMode || null,
      surfacesRead: reading.surfacesRead,
      hasTranscript: Boolean(reading.transcript?.length),
      assistantId: reading.assistantId,
    },
  };
}

function splitIntoSourceChunks(raw: RawArchiveEntry): SourceChunk[] {
  const paragraphs = raw.text
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = '';
  for (const paragraph of paragraphs.length ? paragraphs : [raw.text]) {
    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if (next.length > 1200 && current) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks.slice(0, 12).map((text, index) => ({
    chunkId: makeId('chunk'),
    rawId: raw.rawId,
    accountId: raw.accountId,
    profileId: raw.profileId,
    readingId: raw.readingId,
    sourceType: raw.sourceType,
    chunkIndex: index,
    text: compactText(text, 1600),
    tokens: uniqueNonEmpty(tokenize(text).filter((token) => !SEMANTIC_STOP_WORDS.has(token)), 80),
    createdAt: raw.createdAt,
    metadata: raw.metadata,
  }));
}

function buildSessionJournalEntry(reading: ReadingSummary, fingerprint: ReadingFingerprint): SessionJournalEntry {
  const followUpCount = (reading.transcript || []).filter((item) => item.role === 'user').length;
  return {
    journalId: makeId('journal'),
    accountId: reading.accountId,
    profileId: reading.profileId,
    readingId: reading.readingId,
    assistantId: reading.assistantId,
    readingType: reading.readingType,
    createdAt: reading.createdAt,
    summary: compactText(reading.summary, 900),
    events: uniqueNonEmpty(
      [
        `${reading.readingType} okuması tamamlandı`,
        followUpCount ? `${followUpCount} kullanıcı mesajı kaydedildi` : '',
        reading.period ? `${reading.period} dönemi işlendi` : '',
      ],
      5,
    ),
    memoryActions: uniqueNonEmpty(
      [
        'Reading History kaydı oluşturuldu',
        'Raw Archive girdisi oluşturuldu',
        'Reading Fingerprint üretildi',
        fingerprint.themes.length ? `Tekrar kontrol temaları: ${fingerprint.themes.join(', ')}` : '',
      ],
      6,
    ),
  };
}

async function appendUniqueByReadingId<T extends { readingId?: string }>(path: string, entry: T, limit: number) {
  const current = await readJsonFile<T[]>(path, []);
  const withoutDuplicate = entry.readingId
    ? current.filter((item) => item.readingId !== entry.readingId)
    : current;
  await writeJsonFile(path, [entry, ...withoutDuplicate].slice(0, limit));
}

async function appendMemoryV2Artifacts(reading: ReadingSummary) {
  await ensureProfileMemoryFiles(reading.profileId, reading.accountId);
  const fingerprint = buildReadingFingerprint(reading);
  const rawArchive = buildRawArchiveEntry(reading);
  const chunks = splitIntoSourceChunks(rawArchive);
  const journal = buildSessionJournalEntry(reading, fingerprint);
  const currentChunks = await readJsonFile<SourceChunk[]>(sourceChunksFile(reading.profileId), []);
  const nextChunks = [
    ...chunks,
    ...currentChunks.filter((item) => item.readingId !== reading.readingId && item.rawId !== rawArchive.rawId),
  ].slice(0, MAX_SOURCE_CHUNK_ITEMS);
  await Promise.all([
    appendUniqueByReadingId(rawArchiveFile(reading.profileId), rawArchive, MAX_RAW_ARCHIVE_ITEMS),
    appendUniqueByReadingId(sessionJournalFile(reading.profileId), journal, MAX_SESSION_JOURNAL_ITEMS),
    appendUniqueByReadingId(readingFingerprintsFile(reading.profileId), fingerprint, MAX_READING_FINGERPRINT_ITEMS),
    writeJsonFile(sourceChunksFile(reading.profileId), nextChunks),
    indexRawArchiveEntry(rawArchive),
    indexSessionJournal(journal),
    indexReadingFingerprint(fingerprint),
  ]);
}

function mergeUniqueStrings(existing: string[] | undefined, incoming: string[] | undefined, limit: number) {
  return uniqueNonEmpty([...(incoming || []), ...(existing || [])], limit);
}

async function applyMemoryV2AnalysisArtifacts(profileId: string, accountId: string, result: MemoryAnalysisResult) {
  const v2 = result.v2;
  if (!v2) return;
  await ensureProfileMemoryFiles(profileId, accountId);
  const now = nowIso();

  if (v2.journalEvents.length || v2.memoryActions.length) {
    const journal: SessionJournalEntry = {
      journalId: makeId('journal_analysis'),
      accountId,
      profileId,
      createdAt: now,
      summary: v2.journalEvents.slice(0, 3).join(' ') || 'Hafıza analizi tamamlandı.',
      events: v2.journalEvents,
      memoryActions: v2.memoryActions.length ? v2.memoryActions : ['Memory V2 analizi işlendi'],
    };
    await appendUniqueByReadingId(sessionJournalFile(profileId), journal, MAX_SESSION_JOURNAL_ITEMS);
    await indexSessionJournal(journal).catch(() => {});
  }

  const patch = v2.fingerprintPatch;
  if (patch && (patch.themes?.length || patch.symbols?.length || patch.phrasesToAvoid?.length || patch.emotionalArc || patch.nextAngleSuggestion)) {
    const fingerprints = await readJsonFile<ReadingFingerprint[]>(readingFingerprintsFile(profileId), []);
    const [latest, ...rest] = fingerprints;
    if (latest) {
      const nextLatest: ReadingFingerprint = {
        ...latest,
        themes: mergeUniqueStrings(latest.themes, patch.themes, 8),
        symbols: mergeUniqueStrings(latest.symbols, patch.symbols, 10),
        phrasesToAvoid: mergeUniqueStrings(latest.phrasesToAvoid, patch.phrasesToAvoid, 10),
        emotionalArc: patch.emotionalArc || latest.emotionalArc,
        nextAngleSuggestion: patch.nextAngleSuggestion || latest.nextAngleSuggestion,
      };
      await writeJsonFile(readingFingerprintsFile(profileId), [nextLatest, ...rest].slice(0, MAX_READING_FINGERPRINT_ITEMS));
      await indexReadingFingerprint(nextLatest).catch(() => {});
    }
  }

  if (v2.edges.length) {
    const current = await readJsonFile<MemoryEdge[]>(memoryEdgesFile(profileId), []);
    const nextEdges = v2.edges
      .map((edge) => {
        const fromNodeKey = String(edge.fromNodeKey || '').trim();
        const toNodeKey = String(edge.toNodeKey || '').trim();
        const explanation = String(edge.explanation || '').trim();
        if (!fromNodeKey || !toNodeKey || !edge.edgeType || !explanation) return null;
        return {
          edgeId: makeId('edge'),
          accountId,
          profileId,
          fromNodeKey,
          toNodeKey,
          edgeType: edge.edgeType,
          explanation,
          confidence: typeof edge.confidence === 'number' ? Math.max(0, Math.min(1, edge.confidence)) : 0.68,
          sourceReadingId: edge.sourceReadingId,
          sourceRawId: edge.sourceRawId,
          createdAt: now,
        } as MemoryEdge;
      })
      .filter(Boolean) as MemoryEdge[];
    const seen = new Set<string>();
    const merged = [...nextEdges, ...current].filter((edge) => {
      const key = `${edge.fromNodeKey}\u001f${edge.edgeType}\u001f${edge.toNodeKey}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    await writeJsonFile(memoryEdgesFile(profileId), merged.slice(0, MAX_MEMORY_EDGE_ITEMS));
    await indexMemoryEdges(nextEdges).catch(() => {});
  }
}

function withMemoryDefaults<T extends UserStatedMemoryFile | ReadingDerivedMemoryFile>(memory: T): T {
  return {
    ...memory,
    recurringTopics: memory.recurringTopics || [],
    importantPeople: memory.importantPeople || [],
    emotionalPatterns: memory.emotionalPatterns || [],
    observations: memory.observations || [],
    categoryCandidates: memory.categoryCandidates || [],
    assistantAffinity: memory.assistantAffinity || {},
    ...(memory.source === 'reading-derived'
      ? {
          usedLifeEvents: (memory as ReadingDerivedMemoryFile).usedLifeEvents || [],
          usedSurfaceCues: (memory as ReadingDerivedMemoryFile).usedSurfaceCues || [],
        }
      : {}),
  };
}

function topicGroupFor(key: string, label: string) {
  const normalized = normalizeForMatching(`${key} ${label}`);
  if (/(ask|iliski|sevgili|es|evlilik|flort|ayrilik|baris|partner)/.test(normalized)) {
    return { group: 'İlişkiler', subgroup: 'Romantik bağlar', detailGroup: 'Duygusal yakınlık' };
  }
  if (/(aile|anne|baba|kardes|cocuk|ev|hane|akraba)/.test(normalized)) {
    return { group: 'İlişkiler', subgroup: 'Aile ve yakın çevre', detailGroup: 'Aile dinamikleri' };
  }
  if (/(arkadas|dost|sosyal|cevre)/.test(normalized)) {
    return { group: 'İlişkiler', subgroup: 'Arkadaşlık ve sosyal çevre', detailGroup: 'Sosyal destek' };
  }
  if (/(is|kariyer|ofis|patron|para|maddi|borc|kazanc|odeme|finans)/.test(normalized)) {
    return { group: 'İş ve Para', subgroup: /para|maddi|borc|kazanc|odeme|finans/.test(normalized) ? 'Finans' : 'Kariyer', detailGroup: 'Güvenlik ve yön' };
  }
  if (/(saglik|beden|bel|sirt|uyku|uykusuz|yorgun|stres|kaygi|ruh|enerji|hareket|randevu|doktor|soguk|sicak|kaynar|agri)/.test(normalized)) {
    return { group: 'İç Dünya', subgroup: 'Ruh hali ve beden', detailGroup: 'Beden dengesi' };
  }
  if (/(tasin|tasın|sehir|yol|seyahat|okul|egitim|sinav)/.test(normalized)) {
    return { group: 'Yaşam Düzeni', subgroup: 'Değişim ve planlar', detailGroup: 'Gündelik kararlar' };
  }
  return { group: 'Genel', subgroup: 'Diğer konuşulanlar', detailGroup: 'Serbest not' };
}

function mergeTopicMemory(
  current: Array<{ key: string; label: string; group?: string; subgroup?: string; detailGroup?: string; salience: number; lastSeenAt: string }>,
  incoming: Array<{ key?: string; label?: string; group?: string; subgroup?: string; detailGroup?: string; salience?: number }>,
) {
  const next = [...current];
  for (const item of incoming) {
    const key = (item.key || '').trim();
    const label = (item.label || '').trim();
    if (!key || !label) continue;
    const fallbackGroup = topicGroupFor(key, label);
    const existingIndex = next.findIndex((entry) => entry.key === key);
    const prev = existingIndex >= 0 ? next[existingIndex] : null;
    if (existingIndex >= 0) next.splice(existingIndex, 1);
    next.push({
      key,
      label,
      group: item.group || prev?.group || fallbackGroup.group,
      subgroup: item.subgroup || prev?.subgroup || fallbackGroup.subgroup,
      detailGroup: item.detailGroup || prev?.detailGroup || fallbackGroup.detailGroup,
      salience: Math.min(1, Math.max(prev?.salience || 0.45, Number(item.salience || 0.68))),
      lastSeenAt: nowIso(),
    });
  }
  return next.slice(-MAX_MEMORY_ITEMS);
}
function mergePeopleMemory(
  current: Array<{ id: string; label: string; relationship: string; salience: number }>,
  incoming: Array<{ key?: string; label?: string; relationship?: string; salience?: number }>,
  profiles: SubjectProfile[] = [],
) {
  const normalizedProfileByName = new Map<string, SubjectProfile>();
  const normalizedProfileByRelationship = new Map<string, SubjectProfile>();
  for (const profile of profiles) {
    normalizedProfileByName.set(normalizeForMatching(profile.displayName), profile);
    if (profile.relationshipPrimary !== 'kendi') {
      normalizedProfileByRelationship.set(normalizeForMatching(relationshipLabel(profile)), profile);
      normalizedProfileByRelationship.set(normalizeForMatching(ownerToProfileRelationship(profile)), profile);
    }
  }

  const next: Array<{ id: string; label: string; relationship: string; salience: number }> = [];
  const allItems = [
    ...current.map((person) => ({
      key: person.id,
      label: person.label,
      relationship: person.relationship,
      salience: person.salience,
    })),
    ...incoming,
  ];

  for (const item of allItems) {
    const label = (item.label || '').trim();
    if (!label) continue;
    const normalizedLabel = normalizeForMatching(label);
    if (!normalizedLabel || ASSISTANT_NAME_SET.has(normalizedLabel)) continue;

    const normalizedRelationship = normalizeForMatching(normalizeRelationshipLabel((item.relationship || '').trim()));
    const profileHit =
      normalizedProfileByName.get(normalizedLabel) ||
      normalizedProfileByRelationship.get(normalizedLabel) ||
      normalizedProfileByRelationship.get(normalizedRelationship);
    const id = profileHit ? `profile:${profileHit.profileId}` : (item.key || normalizedLabel).trim();
    if (!id) continue;

    const relationship = profileHit
      ? ownerToProfileRelationship(profileHit)
      : normalizeRelationshipLabel((item.relationship || '').trim() || 'ilgili kişi');
    const salience = Math.min(1, Math.max(0.5, Number(item.salience || 0.7)));

    const existingIndex = next.findIndex(
      (entry) =>
        entry.id === id ||
        normalizeForMatching(entry.label) === normalizedLabel ||
        (profileHit && entry.id === `profile:${profileHit.profileId}`),
    );
    if (existingIndex >= 0) next.splice(existingIndex, 1);
    next.push({
      id,
      label: profileHit ? profileHit.displayName : label,
      relationship,
      salience,
    });
  }

  return next.slice(-MAX_MEMORY_ITEMS);
}
function mergePatternMemory(
  current: Array<{ key: string; label: string; confidence: number }>,
  incoming: Array<{ key?: string; label?: string; confidence?: number }>,
) {
  const next = [...current];
  for (const item of incoming) {
    const key = (item.key || '').trim();
    const label = (item.label || '').trim();
    if (!key || !label) continue;
    const existingIndex = next.findIndex((entry) => entry.key === key);
    const prev = existingIndex >= 0 ? next[existingIndex] : null;
    if (existingIndex >= 0) next.splice(existingIndex, 1);
    next.push({
      key,
      label,
      confidence: Math.min(0.98, Math.max(prev?.confidence || 0.5, Number(item.confidence || 0.7))),
    });
  }
  return next.slice(-MAX_MEMORY_ITEMS);
}

function dampenReadingTopics(
  incoming: Array<{ key?: string; label?: string; group?: string; subgroup?: string; detailGroup?: string; salience?: number }> = [],
) {
  return incoming.map((item) => ({
    ...item,
    salience: Math.min(0.42, Math.max(0.18, Number(item.salience || 0.5) * 0.45)),
  }));
}

function dampenReadingPeople(
  incoming: Array<{ key?: string; label?: string; relationship?: string; salience?: number }> = [],
) {
  return incoming.map((item) => ({
    ...item,
    salience: Math.min(0.38, Math.max(0.16, Number(item.salience || 0.5) * 0.42)),
  }));
}

function dampenReadingPatterns(
  incoming: Array<{ key?: string; label?: string; confidence?: number }> = [],
) {
  return incoming.map((item) => ({
    ...item,
    confidence: Math.min(0.42, Math.max(0.18, Number(item.confidence || 0.5) * 0.45)),
  }));
}

function dampenReadingObservations(
  incoming: Array<Partial<MemoryObservation> & { key?: string; title?: string; summary?: string }> = [],
) {
  return incoming.map((item) => ({
    ...item,
    confidence: Math.min(0.42, Math.max(0.18, Number(item.confidence || 0.5) * 0.45)),
  }));
}

function dampenReadingDerivedMemory<T extends ReadingDerivedMemoryFile>(memory: T): T {
  return {
    ...memory,
    recurringTopics: memory.recurringTopics.map((item) => ({
      ...item,
      salience: Math.min(item.salience, 0.34),
    })),
    emotionalPatterns: memory.emotionalPatterns.map((item) => ({
      ...item,
      confidence: Math.min(item.confidence, 0.38),
    })),
    importantPeople: memory.importantPeople.map((item) => ({
      ...item,
      salience: Math.min(item.salience, 0.35),
    })),
    observations: memory.observations.map((item) => ({
      ...item,
      confidence: Math.min(item.confidence, 0.38),
    })),
  };
}

function mergeUsedLifeEvents(
  current: UsedSpecificityEventMemory[] = [],
  incoming: Array<{ group: string; label: string }> = [],
) {
  const now = nowIso();
  const next = [...current];
  for (const item of incoming) {
    const group = String(item.group || '').trim();
    const label = String(item.label || '').trim();
    if (!group || !label) continue;
    const existingIndex = next.findIndex((entry) => entry.group === group && entry.label === label);
    const existing = existingIndex >= 0 ? next[existingIndex] : null;
    if (existingIndex >= 0) next.splice(existingIndex, 1);
    next.push({
      group,
      label,
      usedAt: now,
      count: (existing?.count || 0) + 1,
    });
  }
  return next.slice(-120);
}

function mergeUsedSurfaceCues(
  current: UsedSurfaceCueMemory[] = [],
  incoming: string[] = [],
) {
  const now = nowIso();
  const next = [...current];
  for (const raw of incoming) {
    const cue = String(raw || '').trim();
    if (!cue) continue;
    const existingIndex = next.findIndex((entry) => entry.cue === cue);
    const existing = existingIndex >= 0 ? next[existingIndex] : null;
    if (existingIndex >= 0) next.splice(existingIndex, 1);
    next.push({
      cue,
      usedAt: now,
      count: (existing?.count || 0) + 1,
    });
  }
  return next.slice(-120);
}

function categoryCandidateKey(group: string, subgroup: string) {
  return normalizeForMatching(`${group}-${subgroup}`) || makeId('category');
}

function normalizeObservationKind(value: string | undefined): MemoryObservation['kind'] {
  const allowed: MemoryObservation['kind'][] = [
    'event',
    'fact',
    'person',
    'emotion',
    'state',
    'question',
    'decision',
    'environment',
  ];
  return allowed.includes(value as MemoryObservation['kind']) ? (value as MemoryObservation['kind']) : 'fact';
}

function profileForEntity(entity: { label?: string; type?: string }, profiles: SubjectProfile[] = []) {
  const normalizedLabel = normalizeForMatching(entity.label || '');
  const normalizedRelationshipHint = normalizeForMatching((entity as { relationshipHint?: string; relationship?: string }).relationshipHint || (entity as { relationship?: string }).relationship || '');
  if (!normalizedLabel) return null;
  const ambiguousKinship = new Set(['anne', 'annem', 'baba', 'babam']);
  const inLawHints = /(kayin|kayinvalid|kaynpeder|esin|esimin|eşin|eşimin|partnerin|partnerimin)/;
  if (ambiguousKinship.has(normalizedLabel) && !inLawHints.test(normalizedRelationshipHint)) {
    const directParent = profiles.find((profile) => {
      if (normalizedLabel.startsWith('anne')) return profile.relationshipPrimary === 'anne';
      if (normalizedLabel.startsWith('baba')) return profile.relationshipPrimary === 'baba';
      return false;
    });
    if (directParent) return directParent;
  }
  for (const profile of profiles) {
    const nameAliases = [profile.displayName].map(normalizeForMatching);
    if (nameAliases.some((alias) => alias && alias === normalizedLabel)) {
      return profile;
    }
    const relationAliases = [
      relationshipLabel(profile),
      ownerToProfileRelationship(profile),
      profile.relationshipFreeform || '',
    ].map(normalizeForMatching);
    const hasRelationHint = normalizedRelationshipHint && relationAliases.some((alias) => alias && alias === normalizedRelationshipHint);
    const canUseGenericKinship =
      !ambiguousKinship.has(normalizedLabel) ||
      Boolean(hasRelationHint && !inLawHints.test(normalizedRelationshipHint));
    if (canUseGenericKinship && relationAliases.some((alias) => alias && alias === normalizedLabel)) return profile;
    if (hasRelationHint) return profile;
  }
  return null;
}

function mergeCategoryCandidates(
  current: MemoryCategoryCandidate[] = [],
  incoming: Array<{ group?: string; subgroup?: string; reason?: string; confidence?: number }> = [],
) {
  const next = [...current];
  const seen = new Set<string>();
  for (const item of incoming) {
    const group = (item.group || '').trim();
    const subgroup = (item.subgroup || '').trim();
    if (!group || !subgroup) continue;
    const key = categoryCandidateKey(group, subgroup);
    if (seen.has(key)) continue;
    seen.add(key);
    const existingIndex = next.findIndex((entry) => entry.key === key);
    const prev = existingIndex >= 0 ? next[existingIndex] : null;
    if (existingIndex >= 0) next.splice(existingIndex, 1);
    next.push({
      key,
      group,
      subgroup,
      reason: (item.reason || prev?.reason || 'Mevcut taksonomiye tam oturmayan tekrar eden tema.').trim(),
      count: (prev?.count || 0) + 1,
      firstSeenAt: prev?.firstSeenAt || nowIso(),
      lastSeenAt: nowIso(),
      confidence: Math.min(0.98, Math.max(prev?.confidence || 0.45, Number(item.confidence || 0.62))),
    });
  }
  return next
    .sort((a, b) => b.count - a.count || b.lastSeenAt.localeCompare(a.lastSeenAt))
    .slice(0, MAX_MEMORY_ITEMS);
}

function mergeObservationMemory(
  current: MemoryObservation[] = [],
  incoming: Array<Partial<MemoryObservation> & { key?: string; title?: string; summary?: string }> = [],
  source: MemoryObservation['source'],
  profiles: SubjectProfile[] = [],
) {
  const next = [...current];
  for (const item of incoming) {
    const title = (item.title || '').trim();
    const summary = (item.summary || '').trim();
    if (!title || !summary) continue;
    const key = (item.key || normalizeForMatching(`${title} ${summary}`) || makeId('observation')).trim();
    const fallback = topicGroupFor(key, `${title} ${summary}`);
    const existingIndex = next.findIndex((entry) => entry.key === key);
    const prev = existingIndex >= 0 ? next[existingIndex] : null;
    if (existingIndex >= 0) next.splice(existingIndex, 1);
    const suggestedCategory = item.suggestedCategory?.group && item.suggestedCategory?.subgroup
      ? {
          group: item.suggestedCategory.group.trim(),
          subgroup: item.suggestedCategory.subgroup.trim(),
          reason: item.suggestedCategory.reason?.trim(),
        }
      : undefined;
    next.push({
      id: prev?.id || makeId('obs'),
      key,
      source,
      category: ((item as { category?: string }).category || item.group || prev?.category || prev?.group || fallback.group).trim(),
      group: ((item as { category?: string }).category || item.group || prev?.group || fallback.group).trim(),
      subgroup: (item.subgroup || prev?.subgroup || fallback.subgroup).trim(),
      detailGroup: (item.detailGroup || prev?.detailGroup || fallback.detailGroup)?.trim(),
      suggestedCategory,
      kind: normalizeObservationKind(item.kind),
      title,
      summary,
      entities: Array.isArray(item.entities)
        ? item.entities
            .filter((entity) => entity?.label)
            .slice(0, 6)
            .map((entity) => {
              const profileHit = profileForEntity(entity, profiles);
              return {
                label: profileHit ? profileHit.displayName : String(entity.label).trim(),
                type: entity.type || 'other',
                relationshipHint: entity.relationshipHint,
                profileId: profileHit?.profileId,
                relationship: profileHit ? ownerToProfileRelationship(profileHit) : entity.relationship,
                gender: profileHit?.gender ?? entity.gender,
              };
            })
        : [],
      entityRelations: Array.isArray(item.entityRelations)
        ? item.entityRelations
            .filter((relation) => relation?.from && relation?.to && relation?.summary)
            .slice(0, 6)
            .map((relation) => ({
              from: String(relation.from).trim(),
              to: String(relation.to).trim(),
              type: relation.type || 'relates_to',
              summary: String(relation.summary).trim(),
              confidence: Math.min(0.98, Math.max(0.35, Number(relation.confidence || 0.62))),
            }))
        : [],
      emotions: Array.isArray(item.emotions) ? item.emotions.filter(Boolean).map(String).slice(0, 6) : [],
      timeText: item.timeText || null,
      placeText: item.placeText || null,
      mentionedAt: prev?.mentionedAt || item.mentionedAt || nowIso(),
      lastSeenAt: nowIso(),
      confidence: Math.min(0.98, Math.max(prev?.confidence || 0.45, Number(item.confidence || 0.68))),
      sourceType: item.sourceType || prev?.sourceType,
      visibility: item.visibility || prev?.visibility,
      promptUse: item.promptUse || prev?.promptUse,
      sourceReadingId: item.sourceReadingId || prev?.sourceReadingId,
      sourceRawId: item.sourceRawId || prev?.sourceRawId,
    });
  }
  return next
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
    .slice(0, MAX_MEMORY_ITEMS);
}
export async function loadAccountState(): Promise<AccountState> {
  await ensureBaseDirs();
  const info = await FileSystem.getInfoAsync(DATA_FILE);
  if (!info.exists) {
    const initial = createEmptyState();
    await saveState(initial);
    return initial;
  }

  const raw = await FileSystem.readAsStringAsync(DATA_FILE);
  const parsed = JSON.parse(raw) as AccountState & {
    memories?: unknown;
    readings?: Array<Partial<ReadingSummary> & { previewText?: string }>;
  };
  const normalizedReadings: ReadingSummary[] = (parsed.readings ?? []).map((reading: Partial<ReadingSummary> & { previewText?: string }) => ({
    readingId: reading.readingId || makeId('reading_legacy'),
    accountId: reading.accountId || parsed.accountId,
    profileId: reading.profileId || '',
    assistantId: reading.assistantId || 'suzan',
    readingType:
      reading.readingType === 'palm' ||
      reading.readingType === 'personal-astro' ||
      reading.readingType === 'personal-numerology' ||
      reading.readingType === 'birth-chart' ||
      reading.readingType === 'dream-interpretation' ||
      reading.readingType === 'personal-tarot' ||
      reading.readingType === 'personality-test' ||
      reading.readingType === 'general-astro' ||
      reading.readingType === 'astro-compatibility' ||
      reading.readingType === 'astro-family'
        ? reading.readingType
        : 'coffee',
    period:
      reading.period === 'daily' ||
      reading.period === 'weekly' ||
      reading.period === 'monthly' ||
      reading.period === 'yearly'
        ? reading.period
        : undefined,
    astroFocusQuestion: typeof reading.astroFocusQuestion === 'string' ? reading.astroFocusQuestion : undefined,
    coffeeMode:
      reading.readingType === 'palm' ||
      reading.readingType === 'personal-astro' ||
      reading.readingType === 'personal-numerology' ||
      reading.readingType === 'birth-chart' ||
      reading.readingType === 'dream-interpretation' ||
      reading.readingType === 'personal-tarot' ||
      reading.readingType === 'personality-test' ||
      reading.readingType === 'general-astro' ||
      reading.readingType === 'astro-compatibility' ||
      reading.readingType === 'astro-family'
        ? undefined
        : reading.coffeeMode === 'ai-brew'
          ? 'ai-brew'
          : 'upload',
    surfacesRead: Array.isArray(reading.surfacesRead) ? reading.surfacesRead : [],
    tarotSpread: reading.tarotSpread,
    testResult: reading.testResult,
    astroRelationship: reading.astroRelationship,
    createdAt: reading.createdAt || nowIso(),
    summary: reading.summary || reading.previewText || '',
    transcript: Array.isArray(reading.transcript)
      ? reading.transcript
          .filter((item) => item && (item.role === 'user' || item.role === 'assistant') && typeof item.text === 'string')
          .map((item) => ({
            role: item.role as 'user' | 'assistant',
            text: item.text || '',
            timestamp: typeof item.timestamp === 'number' ? item.timestamp : undefined,
          }))
      : [],
  }));
  const dedupedReadings = dedupeReadingSummaries(normalizedReadings);
  const nextState: AccountState = {
    accountId: parsed.accountId,
    primaryProfileId: parsed.primaryProfileId ?? null,
    profiles: parsed.profiles ?? [],
    readings: dedupedReadings,
  };

  for (const profile of nextState.profiles) {
    await ensureProfileMemoryFiles(profile.profileId, nextState.accountId);
  }
  await ensureProfileRelationshipMemoryLinks(nextState);
  if (dedupedReadings.length !== normalizedReadings.length) {
    await saveState(nextState);
  }

  return nextState;
}

export interface CreateProfileInput {
  displayName: string;
  relationshipPrimary: RelationshipPrimary;
  relationshipDetail: RelationshipRelativeDetail | null;
  relationshipFreeform: string | null;
  gender: ProfileGender | null;
  birth: BirthInfo;
  isPrimary: boolean;
}

export interface UpdateProfileInput {
  profileId: string;
  displayName: string;
  relationshipPrimary: RelationshipPrimary;
  relationshipDetail: RelationshipRelativeDetail | null;
  relationshipFreeform: string | null;
  gender: ProfileGender | null;
  birth: BirthInfo;
}

export async function createProfile(input: CreateProfileInput): Promise<AccountState> {
  const state = await loadAccountState();
  const profileId = makeId('profile');
  const createdAt = nowIso();
  const shouldBePrimary = input.isPrimary || state.profiles.length === 0;
  const profile: SubjectProfile = {
    profileId,
    accountId: state.accountId,
    isPrimary: shouldBePrimary,
    displayName: input.displayName.trim(),
    relationshipPrimary: shouldBePrimary ? 'kendi' : input.relationshipPrimary,
    relationshipDetail: shouldBePrimary ? null : input.relationshipDetail,
    relationshipFreeform: shouldBePrimary ? null : input.relationshipFreeform?.trim() || null,
    gender: input.gender,
    birth: input.birth,
    chartPrecision: computeChartPrecision(input.birth),
    createdAt,
    updatedAt: createdAt,
  };

  const nextState: AccountState = {
    ...state,
    primaryProfileId: shouldBePrimary ? profileId : state.primaryProfileId,
    profiles: shouldBePrimary ? [profile, ...state.profiles] : [...state.profiles, profile],
  };

  await saveState(nextState);
  await ensureProfileMemoryFiles(profileId, state.accountId);
  await ensureProfileRelationshipMemoryLinks(nextState);
  return nextState;
}

export async function updateProfile(input: UpdateProfileInput): Promise<AccountState> {
  const state = await loadAccountState();
  const target = state.profiles.find((profile) => profile.profileId === input.profileId);
  if (!target) return state;

  const updated: SubjectProfile = {
    ...target,
    displayName: input.displayName.trim(),
    relationshipPrimary: input.relationshipPrimary,
    relationshipDetail: input.relationshipDetail,
    relationshipFreeform: input.relationshipFreeform?.trim() || null,
    gender: input.gender,
    birth: input.birth,
    chartPrecision: computeChartPrecision(input.birth),
    updatedAt: nowIso(),
  };

  const nextState: AccountState = {
    ...state,
    profiles: state.profiles.map((profile) => (profile.profileId === input.profileId ? updated : profile)),
  };

  await saveState(nextState);
  await ensureProfileRelationshipMemoryLinks(nextState);
  return nextState;
}

export function getPrimaryProfile(state: AccountState): SubjectProfile | null {
  if (!state.primaryProfileId) return null;
  return state.profiles.find((profile) => profile.profileId === state.primaryProfileId) || null;
}

function relationshipLabel(profile: SubjectProfile): string {
  if (profile.relationshipPrimary === 'evcil_hayvan') {
    return profile.relationshipFreeform || 'evcil hayvan';
  }
  if (profile.relationshipPrimary !== 'akraba') {
    return profile.relationshipPrimary;
  }
  if (profile.relationshipDetail === 'diger_akraba') {
    return profile.relationshipFreeform || 'akraba';
  }
  return profile.relationshipDetail || 'akraba';
}

function petSpeciesLabel(profile: SubjectProfile): string {
  return profile.relationshipFreeform?.trim() || 'evcil hayvan';
}

function upsertImportantPerson<T extends UserStatedMemoryFile | ReadingDerivedMemoryFile>(
  memory: T,
  id: string,
  label: string,
  relationship: string,
  salience = 0.72,
): T {
  const importantPeople = [...memory.importantPeople];
  const normalizedLabel = normalizeForMatching(label);
  const existing = importantPeople.find((item) => item.id === id || normalizeForMatching(item.label) === normalizedLabel);
  const normalizedRelationship = normalizeRelationshipLabel(relationship);
  if (existing) {
    existing.label = label;
    existing.relationship = normalizedRelationship;
    existing.salience = Math.min(1, existing.salience + 0.08);
  } else {
    if (isProfileReference(id)) {
      for (let index = importantPeople.length - 1; index >= 0; index -= 1) {
        const item = importantPeople[index];
        if (normalizeForMatching(item.label) === normalizedLabel) {
          importantPeople.splice(index, 1);
        }
      }
    }
    importantPeople.push({ id, label, relationship: normalizedRelationship, salience });
  }
  return {
    ...memory,
    importantPeople: importantPeople.slice(-MAX_MEMORY_ITEMS),
    updatedAt: nowIso(),
  };
}

function isProfileReference(id: string): boolean {
  return id.startsWith('profile:');
}

function extractReferencedProfileId(id: string): string | null {
  if (!isProfileReference(id)) return null;
  return id.slice('profile:'.length) || null;
}

function parentLabelForProfile(profile: SubjectProfile): string {
  if (profile.gender === 'kadin') return 'anne';
  if (profile.gender === 'erkek') return 'baba';
  return 'ebeveyn';
}

function childLabelForProfile(profile: SubjectProfile): string {
  if (profile.gender === 'kadin') return 'kizi';
  if (profile.gender === 'erkek') return 'oglu';
  return 'cocugu';
}

async function pruneDanglingProfileReferences(state: AccountState): Promise<void> {
  const profileIds = new Set(state.profiles.map((profile) => profile.profileId));
  for (const profile of state.profiles) {
    await ensureProfileMemoryFiles(profile.profileId, state.accountId);
    const pruneBundle = <T extends UserStatedMemoryFile | ReadingDerivedMemoryFile>(current: T): T => {
      const seen = new Set<string>();
      const importantPeople = current.importantPeople.filter((person) => {
      if (seen.has(person.id)) return false;
      seen.add(person.id);
      const referencedProfileId = extractReferencedProfileId(person.id);
      if (referencedProfileId && !profileIds.has(referencedProfileId)) return false;
      if (ASSISTANT_NAME_SET.has(normalizeForMatching(person.label))) return false;
      return true;
      });
      const observations = current.observations
        .map((observation) => {
          const hadProfileEntity = observation.entities.some((entity) => Boolean(entity.profileId));
          const entities = observation.entities.filter((entity) => !entity.profileId || profileIds.has(entity.profileId));
          return { observation: { ...observation, entities }, hadProfileEntity };
        })
        .filter((item) => item.observation.entities.length || !item.hadProfileEntity)
        .map((item) => item.observation);
      return {
        ...current,
        importantPeople,
        observations,
      };
    };

    const currentUser = await readJsonFile<UserStatedMemoryFile>(
      userMemoryFile(profile.profileId),
      emptyUserStatedMemory(profile.profileId, state.accountId),
    );
    const currentReading = await readJsonFile<ReadingDerivedMemoryFile>(
      readingMemoryFile(profile.profileId),
      emptyReadingDerivedMemory(profile.profileId, state.accountId),
    );
    const nextUser = pruneBundle(currentUser);
    const nextReading = pruneBundle(currentReading);
    if (
      nextUser.importantPeople.length !== currentUser.importantPeople.length ||
      JSON.stringify(nextUser.observations) !== JSON.stringify(currentUser.observations)
    ) {
      await writeJsonFile(userMemoryFile(profile.profileId), { ...nextUser, updatedAt: nowIso() });
    }
    if (
      nextReading.importantPeople.length !== currentReading.importantPeople.length ||
      JSON.stringify(nextReading.observations) !== JSON.stringify(currentReading.observations)
    ) {
      await writeJsonFile(readingMemoryFile(profile.profileId), { ...nextReading, updatedAt: nowIso() });
    }
  }
}

function ownerToProfileRelationship(profile: SubjectProfile): string {
  if (profile.relationshipPrimary === 'evcil_hayvan') {
    return `evcil hayvanı (${petSpeciesLabel(profile)})`;
  }
  return relationshipLabel(profile);
}

function profileToOwnerRelationship(profile: SubjectProfile): string {
  switch (profile.relationshipPrimary) {
    case 'evcil_hayvan':
      return 'sahibi';
    case 'anne':
    case 'baba':
      return 'çocuğu';
    case 'cocuk':
      return profile.gender === 'erkek' ? 'babası/annesi' : 'annesi/babası';
    case 'es':
      return 'eşi';
    case 'sevgili':
      return 'sevgilisi';
    case 'eski_sevgili':
      return 'eski sevgilisi';
    case 'sevgili_adayi':
      return 'flörtü';
    case 'kardes':
      return 'kardeşi';
    case 'arkadas':
      return 'arkadaşı';
    case 'akraba':
      return 'akrabası';
    case 'diger':
      return 'yakını';
    case 'kendi':
      return 'kendisi';
  }
}

async function linkProfileToOwnerMemory(state: AccountState, linkedProfile: SubjectProfile): Promise<void> {
  const owner = getPrimaryProfile(state);
  if (!owner || owner.profileId === linkedProfile.profileId) return;

  await ensureProfileMemoryFiles(owner.profileId, state.accountId);
  await ensureProfileMemoryFiles(linkedProfile.profileId, state.accountId);

  const ownerMemory = await readJsonFile<UserStatedMemoryFile>(
    userMemoryFile(owner.profileId),
    emptyUserStatedMemory(owner.profileId, state.accountId),
  );
  const linkedMemory = await readJsonFile<UserStatedMemoryFile>(
    userMemoryFile(linkedProfile.profileId),
    emptyUserStatedMemory(linkedProfile.profileId, state.accountId),
  );

  await writeJsonFile(
    userMemoryFile(owner.profileId),
    upsertImportantPerson(
      ownerMemory,
      `profile:${linkedProfile.profileId}`,
      linkedProfile.displayName,
      ownerToProfileRelationship(linkedProfile),
      0.9,
    ),
  );
  await writeJsonFile(
    userMemoryFile(linkedProfile.profileId),
    upsertImportantPerson(
      linkedMemory,
      `profile:${owner.profileId}`,
      owner.displayName,
      profileToOwnerRelationship(linkedProfile),
      0.9,
    ),
  );
}

async function linkSpouseAndChildrenMemory(state: AccountState): Promise<void> {
  const spouses = state.profiles.filter((profile) => profile.relationshipPrimary === 'es');
  const children = state.profiles.filter((profile) => profile.relationshipPrimary === 'cocuk');

  for (const spouse of spouses) {
    for (const child of children) {
      if (spouse.profileId === child.profileId) continue;

      await ensureProfileMemoryFiles(spouse.profileId, state.accountId);
      await ensureProfileMemoryFiles(child.profileId, state.accountId);

      const [spouseMemory, childMemory] = await Promise.all([
        readJsonFile<UserStatedMemoryFile>(
          userMemoryFile(spouse.profileId),
          emptyUserStatedMemory(spouse.profileId, state.accountId),
        ),
        readJsonFile<UserStatedMemoryFile>(
          userMemoryFile(child.profileId),
          emptyUserStatedMemory(child.profileId, state.accountId),
        ),
      ]);

      const nextChildMemory = upsertImportantPerson(
        childMemory,
        `profile:${spouse.profileId}`,
        spouse.displayName,
        parentLabelForProfile(spouse),
        0.9,
      );
      const nextSpouseMemory = upsertImportantPerson(
        spouseMemory,
        `profile:${child.profileId}`,
        child.displayName,
        childLabelForProfile(child),
        0.9,
      );

      await Promise.all([
        writeJsonFile(userMemoryFile(child.profileId), nextChildMemory),
        writeJsonFile(userMemoryFile(spouse.profileId), nextSpouseMemory),
      ]);
    }
  }
}

async function ensureProfileRelationshipMemoryLinks(state: AccountState): Promise<void> {
  await pruneDanglingProfileReferences(state);
  for (const profile of state.profiles) {
    if (profile.relationshipPrimary !== 'kendi') {
      await linkProfileToOwnerMemory(state, profile);
    }
  }
  await linkSpouseAndChildrenMemory(state);
}

function inferNamedRelationship(source: SubjectProfile, target: SubjectProfile, text: string): {
  sourceToTarget: string;
  targetToSource: string;
} | null {
  const normalized = text.toLowerCase();
  const targetName = target.displayName.toLowerCase();
  if (!normalized.includes(targetName)) return null;

  const hasAny = (terms: string[]) => terms.some((term) => normalized.includes(term));
  if (hasAny(['kiziyim', 'kiziy', 'kizi', 'ogluyum', 'oglu', 'cocuguyum', 'cocugum'])) {
    const parentLabel = target.gender === 'erkek' ? 'baba' : target.gender === 'kadin' ? 'anne' : 'ebeveyn';
    return { sourceToTarget: parentLabel, targetToSource: 'cocuk' };
  }
  if (hasAny(['babam', 'babasi'])) {
    return { sourceToTarget: 'baba', targetToSource: 'cocuk' };
  }
  if (hasAny(['annem', 'annesi'])) {
    return { sourceToTarget: 'anne', targetToSource: 'cocuk' };
  }
  if (hasAny(['kedim', 'kopegim', 'iguanam', 'kusum', 'tavugum', 'evcil hayvanim'])) {
    return { sourceToTarget: target.relationshipFreeform || 'evcil hayvan', targetToSource: 'sahibi' };
  }
  if (source.relationshipPrimary === 'evcil_hayvan') {
    return { sourceToTarget: 'sahibi', targetToSource: source.relationshipFreeform || 'evcil hayvan' };
  }
  if (target.relationshipPrimary === 'evcil_hayvan') {
    return { sourceToTarget: target.relationshipFreeform || 'evcil hayvan', targetToSource: 'sahibi' };
  }
  return null;
}

const TOPIC_KEYWORDS: Array<{ key: string; label: string; keywords: string[] }> = [
  { key: 'money', label: 'maddi kaygı', keywords: ['para', 'maddi', 'borc', 'borç', 'odeme', 'ödeme', 'kazanc', 'kazanç'] },
  { key: 'career', label: 'kariyer stresi', keywords: ['iş', 'is', 'kariyer', 'ofis', 'patron', 'toplanti', 'toplantı'] },
  { key: 'love', label: 'aşk ve ilişki belirsizliği', keywords: ['aşk', 'ask', 'ilişki', 'iliski', 'sevgili', 'kalp'] },
  { key: 'family', label: 'aile içi gündem', keywords: ['anne', 'baba', 'aile', 'ev', 'hane', 'kardeş', 'kardes', 'çocuk', 'cocuk'] },
  { key: 'friendship', label: 'arkadaşlık ve sosyal çevre', keywords: ['arkadaş', 'arkadas', 'dost', 'sosyal', 'çevre', 'cevre'] },
  {
    key: 'health_energy',
    label: 'sağlık ve enerji',
    keywords: [
      'sağlık',
      'saglik',
      'beden',
      'bel',
      'sırt',
      'sirt',
      'ağrı',
      'agri',
      'yorgun',
      'uyku',
      'uykusuz',
      'stres',
      'kaygı',
      'kaygi',
      'enerji',
      'hareket',
      'doktor',
      'randevu',
      'soğuk',
      'soguk',
      'sıcak',
      'sicak',
      'kaynar',
    ],
  },
  { key: 'life_changes', label: 'yaşam düzeni değişimi', keywords: ['taşın', 'tasin', 'şehir', 'sehir', 'yol', 'seyahat', 'okul', 'eğitim', 'egitim'] },
];

const PATTERN_KEYWORDS: Array<{ key: string; label: string; keywords: string[] }> = [
  { key: 'boundaries', label: 'hayır diyememe', keywords: ['hayır diyem', 'hayir diyem', 'sınır', 'sinir', 'fazla fedakar'] },
  { key: 'fatigue', label: 'yorgunluk birikimi', keywords: ['yorgun', 'tüken', 'tuken', 'daralm', 'yorul'] },
  { key: 'control', label: 'kontrol ihtiyacı', keywords: ['kontrol', 'sabırsız', 'sabirsiz', 'bekleyiş', 'bekleyis'] },
];

const PEOPLE_KEYWORDS: Array<{ id: string; label: string; relationship: string; keywords: string[] }> = [
  { id: 'mother', label: 'anne', relationship: 'annesi', keywords: ['anne'] },
  { id: 'father', label: 'baba', relationship: 'babası', keywords: ['baba'] },
  { id: 'partner', label: 'sevgili', relationship: 'sevgilisi', keywords: ['sevgili', 'eş', 'eski sevgili'] },
];

function normalizeRelationshipLabel(value: string): string {
  const trimmed = (value || '').trim();
  if (!trimmed) return 'ilgili kişi';
  const normalized = normalizeForMatching(trimmed);
  const relationMap: Record<string, string> = {
    mother: 'annesi',
    father: 'babası',
    partner: 'sevgilisi',
    spouse: 'eşi',
    child: 'çocuğu',
    sibling: 'kardeşi',
    friend: 'arkadaşı',
    relative: 'akrabası',
    colleague: 'iş arkadaşı',
  };
  return relationMap[normalized] || trimmed;
}

function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

function tokenize(text: string): string[] {
  return normalizeForMatching(text)
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter(Boolean);
}

function containsKeyword(text: string, keyword: string): boolean {
  const normalizedText = normalizeForMatching(text);
  const normalizedKeyword = normalizeForMatching(keyword);
  if (!normalizedKeyword) return false;
  if (normalizedKeyword.includes(' ')) {
    return normalizedText.includes(normalizedKeyword);
  }
  const tokens = tokenize(text);
  return tokens.includes(normalizedKeyword);
}

function observationSemanticText(item: MemoryObservation) {
  return [
    item.title,
    item.summary,
    item.category,
    item.group,
    item.subgroup,
    item.detailGroup,
    item.kind,
    item.timeText || '',
    item.placeText || '',
    ...item.emotions,
    ...item.entities.flatMap((entity) => [entity.label, entity.type, entity.relationship || '', entity.relationshipHint || '']),
    ...item.entityRelations.flatMap((relation) => [relation.from, relation.to, relation.type, relation.summary]),
  ].join(' ');
}

function observationSemanticScore(item: MemoryObservation, queryTokens: Set<string>) {
  const observationTokens = new Set(
    tokenize(observationSemanticText(item)).filter((token) => !SEMANTIC_STOP_WORDS.has(token)),
  );
  let overlap = 0;
  queryTokens.forEach((token) => {
    if (observationTokens.has(token)) overlap += 1;
  });
  if (!overlap) return 0;
  const coverage = overlap / Math.max(1, queryTokens.size);
  const density = overlap / Math.max(4, observationTokens.size);
  const confidence = Math.min(1, Math.max(0.35, item.confidence || 0.5));
  const sourceWeight = item.source === 'user-stated' ? 1 : 0.42;
  return (coverage * 0.68 + density * 0.12 + confidence * 0.2) * sourceWeight;
}

function slugifyPersonId(value: string): string {
  return normalizeForMatching(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function extractNamedPeople(text: string): Array<{ id: string; label: string; relationship: string }> {
  const results: Array<{ id: string; label: string; relationship: string }> = [];
  const patterns: Array<{ regex: RegExp; relationship: string }> = [
    { regex: /\bkizim var(?:,\s*adi|\s+adi)?\s+([A-ZÇĞİÖŞÜ][a-zçğıöşü]+)\b/gi, relationship: 'kizi' },
    { regex: /\boglum var(?:,\s*adi|\s+adi)?\s+([A-ZÇĞİÖŞÜ][a-zçğıöşü]+)\b/gi, relationship: 'oglu' },
    { regex: /\bkizimin adi\s+([A-ZÇĞİÖŞÜ][a-zçğıöşü]+)\b/gi, relationship: 'kizi' },
    { regex: /\boglumun adi\s+([A-ZÇĞİÖŞÜ][a-zçğıöşü]+)\b/gi, relationship: 'oglu' },
    { regex: /\besimin adi\s+([A-ZÇĞİÖŞÜ][a-zçğıöşü]+)\b/gi, relationship: 'esi' },
    { regex: /\bsevgilimin adi\s+([A-ZÇĞİÖŞÜ][a-zçğıöşü]+)\b/gi, relationship: 'sevgilisi' },
    { regex: /\bannemin adi\s+([A-ZÇĞİÖŞÜ][a-zçğıöşü]+)\b/gi, relationship: 'annesi' },
    { regex: /\bbabamin adi\s+([A-ZÇĞİÖŞÜ][a-zçğıöşü]+)\b/gi, relationship: 'babasi' },
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.regex.exec(text))) {
      const label = match[1]?.trim();
      if (!label) continue;
      results.push({
        id: `named:${slugifyPersonId(label)}`,
        label,
        relationship: pattern.relationship,
      });
    }
  }

  return results;
}

function updateMemoryFromText<T extends UserStatedMemoryFile | ReadingDerivedMemoryFile>(
  memory: T,
  text: string,
  options?: { includeTopics?: boolean; includePatterns?: boolean; includePeople?: boolean },
): T {
  const normalized = text.toLowerCase();
  const recurringTopics = [...memory.recurringTopics];
  const emotionalPatterns = [...memory.emotionalPatterns];
  const importantPeople = [...memory.importantPeople];
  const includeTopics = options?.includeTopics ?? true;
  const includePatterns = options?.includePatterns ?? true;
  const includePeople = options?.includePeople ?? true;

  if (includeTopics) {
    for (const topic of TOPIC_KEYWORDS) {
      if (!topic.keywords.some((keyword) => containsKeyword(text, keyword))) continue;
      const existing = recurringTopics.find((item) => item.key === topic.key);
      if (existing) {
        existing.salience = Math.min(1, existing.salience + 0.08);
        existing.lastSeenAt = nowIso();
        const group = topicGroupFor(existing.key, existing.label);
        existing.group = existing.group || group.group;
        existing.subgroup = existing.subgroup || group.subgroup;
        existing.detailGroup = existing.detailGroup || group.detailGroup;
      } else {
        const group = topicGroupFor(topic.key, topic.label);
        recurringTopics.push({
          key: topic.key,
          label: topic.label,
          group: group.group,
          subgroup: group.subgroup,
          detailGroup: group.detailGroup,
          salience: 0.6,
          lastSeenAt: nowIso(),
        });
      }
    }
  }

  if (includePatterns) {
    for (const pattern of PATTERN_KEYWORDS) {
      if (!pattern.keywords.some((keyword) => containsKeyword(text, keyword))) continue;
      const existing = emotionalPatterns.find((item) => item.key === pattern.key);
      if (existing) {
        existing.confidence = Math.min(0.95, existing.confidence + 0.07);
      } else {
        emotionalPatterns.push({
          key: pattern.key,
          label: pattern.label,
          confidence: 0.62,
        });
      }
    }
  }

  if (includePeople) {
    for (const person of PEOPLE_KEYWORDS) {
      if (!person.keywords.some((keyword) => containsKeyword(text, keyword))) continue;
      const existing = importantPeople.find((item) => item.id === person.id);
      if (existing) {
        existing.salience = Math.min(1, existing.salience + 0.06);
      } else {
        importantPeople.push({
          id: person.id,
          label: person.label,
          relationship: person.relationship,
          salience: 0.58,
        });
      }
    }
  }

  if (includePeople) {
    for (const namedPerson of extractNamedPeople(text)) {
      const existing = importantPeople.find((item) => item.id === namedPerson.id);
      if (existing) {
        existing.label = namedPerson.label;
        existing.relationship = namedPerson.relationship;
        existing.salience = Math.min(1, existing.salience + 0.08);
      } else {
        importantPeople.push({
          id: namedPerson.id,
          label: namedPerson.label,
          relationship: namedPerson.relationship,
          salience: 0.76,
        });
      }
    }
  }

  return {
    ...memory,
    recurringTopics: recurringTopics.slice(-MAX_MEMORY_ITEMS),
    emotionalPatterns: emotionalPatterns.slice(-MAX_MEMORY_ITEMS),
    importantPeople: mergePeopleMemory(
      [],
      importantPeople.map((item) => ({
        key: item.id,
        label: item.label,
        relationship: item.relationship,
        salience: item.salience,
      })),
    ),
    updatedAt: nowIso(),
  };
}

function dedupePeopleForSnippet(
  people: Array<{ id: string; label: string; relationship: string; salience: number }>,
  profiles: SubjectProfile[],
) {
  return mergePeopleMemory(
    [],
    people.map((item) => ({
      key: item.id,
      label: item.label,
      relationship: item.relationship,
      salience: item.salience,
    })),
    profiles,
  ).sort((a, b) => b.salience - a.salience);
}

export async function loadProfileMemoryBundle(
  state: AccountState,
  profileId: string,
): Promise<ProfileMemoryBundle | null> {
  const profile = state.profiles.find((item) => item.profileId === profileId);
  if (!profile) return null;

  await ensureProfileRelationshipMemoryLinks(state);
  await ensureProfileMemoryFiles(profileId, state.accountId);
  const [userStated, readingDerived] = await Promise.all([
    readJsonFile<UserStatedMemoryFile>(
      userMemoryFile(profileId),
      emptyUserStatedMemory(profileId, state.accountId),
    ),
    readJsonFile<ReadingDerivedMemoryFile>(
      readingMemoryFile(profileId),
      emptyReadingDerivedMemory(profileId, state.accountId),
    ),
  ]);

  const [rawArchive, sessionJournals, readingFingerprints, memoryEdges, sourceChunks, promptAudits] = await Promise.all([
    readJsonFile<RawArchiveEntry[]>(rawArchiveFile(profileId), []),
    readJsonFile<SessionJournalEntry[]>(sessionJournalFile(profileId), []),
    readJsonFile<ReadingFingerprint[]>(readingFingerprintsFile(profileId), []),
    readJsonFile<MemoryEdge[]>(memoryEdgesFile(profileId), []),
    readJsonFile<SourceChunk[]>(sourceChunksFile(profileId), []),
    readJsonFile<MemoryPromptAuditEntry[]>(promptAuditFile(profileId), []),
  ]);

  return {
    userStated: withMemoryDefaults(userStated),
    readingDerived: withMemoryDefaults(readingDerived),
    rawArchive,
    sessionJournals,
    readingFingerprints,
    memoryEdges,
    sourceChunks,
    promptAudits,
  };
}

function buildPromptMemoryPack(params: {
  userTopics: ProfileTopicMemory[];
  readingTopics: ProfileTopicMemory[];
  userPatterns: string[];
  relevantObservations: MemoryObservation[];
  recentFingerprints: ReadingFingerprint[];
  memoryEdges: MemoryEdge[];
  sourceChunks: SourceChunk[];
}): PromptMemoryPack {
  const userSignals = [
    ...params.userTopics.map((item) => item.label),
    ...params.relevantObservations
      .filter((item) => item.source === 'user-stated' && item.promptUse !== 'never')
      .map((item) => item.summary || item.title),
  ];
  const readingSignals = [
    ...params.readingTopics.map((item) => item.label),
    ...params.relevantObservations
      .filter((item) => item.source === 'reading-derived' && item.promptUse !== 'never')
      .map((item) => item.summary || item.title),
  ];
  const toneEdges = params.memoryEdges
    .filter((item) => item.edgeType === 'affects_tone' || item.edgeType === 'safe_to_hint')
    .sort((a, b) => b.confidence - a.confidence)
    .map((item) => item.explanation);
  const avoidEdges = params.memoryEdges
    .filter((item) => item.edgeType === 'avoid_repeating' || item.edgeType === 'do_not_surface' || item.edgeType === 'corrected_by_user')
    .sort((a, b) => b.confidence - a.confidence)
    .map((item) => item.explanation);
  const avoidThemes = params.recentFingerprints.flatMap((item) => item.themes);
  const avoidSymbols = params.recentFingerprints.flatMap((item) => item.symbols);
  const avoidPhrases = params.recentFingerprints.flatMap((item) => item.phrasesToAvoid);
  const chunkHints = params.sourceChunks.map((item) => `Raw chunk ipucu: ${compactText(item.text, 260)}`);
  return {
    profileEssence: uniqueNonEmpty(userSignals, 6),
    relevantPatterns: uniqueNonEmpty([...params.userPatterns, ...readingSignals, ...toneEdges, ...chunkHints], 6),
    avoidRepetition: uniqueNonEmpty(
      [
        ...avoidEdges,
        ...avoidThemes.map((item) => `Tema tekrarına dikkat: ${item}`),
        ...avoidSymbols.map((item) => `Sembolü mecbur kalmadıkça yeniden merkez yapma: ${item}`),
        ...avoidPhrases.map((item) => `Kalıp ifadeyi tekrarlama: ${item}`),
      ],
      8,
    ),
    toneRules: [
      'Hafızayı açıklama gibi değil, doğal tanışıklık hissi gibi kullan.',
      'Kullanıcı söylemediyse önceki okuma temasını ana konu yapma.',
      'Seçili yorumcu kendi adını okumada söylememeli.',
    ],
    debug: {
      recentFingerprintIds: params.recentFingerprints.map((item) => item.fingerprintId),
      selectedChunkIds: params.sourceChunks.map((item) => item.chunkId),
    },
  };
}

async function appendPromptMemoryAudit(profileId: string, entry: Omit<MemoryPromptAuditEntry, 'auditId' | 'createdAt'>) {
  const current = await readJsonFile<MemoryPromptAuditEntry[]>(promptAuditFile(profileId), []);
  const next: MemoryPromptAuditEntry = {
    auditId: makeId('audit'),
    createdAt: nowIso(),
    ...entry,
  };
  await writeJsonFile(promptAuditFile(profileId), [next, ...current].slice(0, MAX_PROMPT_AUDIT_ITEMS));
}

async function selectSourceChunksForPrompt(params: {
  profileId: string;
  semanticQuery?: string;
  queryTokens: string[];
  fallbackChunks: SourceChunk[];
}): Promise<{ chunks: SourceChunk[]; mode: MemoryPromptAuditEntry['retrievalMode']; reasons: string[] }> {
  if (!params.semanticQuery?.trim() || !params.queryTokens.length) {
    return {
      chunks: [],
      mode: 'none',
      reasons: ['Konu girilmediği için raw chunk retrieval kullanılmadı.'],
    };
  }
  const tokenChunks = await searchSourceChunks(params.profileId, params.queryTokens, 3).catch(() => []);
  return {
    chunks: tokenChunks,
    mode: tokenChunks.length ? 'token-overlap' : 'none',
    reasons: tokenChunks.length
      ? ['Token-overlap fallback ile ilgili source chunk kayıtları seçildi.']
      : ['Konu girişi için uygun chunk bulunamadı.'],
  };
}

function consolidateObservations(items: MemoryObservation[], source: 'user-stated' | 'reading-derived') {
  const byKey = new Map<string, MemoryObservation>();
  for (const item of items) {
    const key = normalizeForMatching(item.key || `${item.title} ${item.summary}`);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      continue;
    }
    byKey.set(key, {
      ...existing,
      summary: existing.summary.length >= item.summary.length ? existing.summary : item.summary,
      confidence: Math.min(1, Math.max(existing.confidence, item.confidence) + 0.04),
      lastSeenAt: existing.lastSeenAt > item.lastSeenAt ? existing.lastSeenAt : item.lastSeenAt,
      promptUse: existing.promptUse === 'core' || item.promptUse === 'core' ? 'core' : existing.promptUse || item.promptUse,
      source,
    });
  }
  return [...byKey.values()]
    .filter((item) => item.confidence >= (source === 'user-stated' ? 0.35 : 0.22))
    .sort((a, b) => {
      if ((a.promptUse || '') !== (b.promptUse || '')) return a.promptUse === 'core' ? -1 : b.promptUse === 'core' ? 1 : 0;
      if (Math.abs(b.confidence - a.confidence) > 0.05) return b.confidence - a.confidence;
      return b.lastSeenAt.localeCompare(a.lastSeenAt);
    })
    .slice(0, MAX_MEMORY_ITEMS);
}

function trimTopicMemoryForConsolidation(items: ProfileTopicMemory[], source: 'user-stated' | 'reading-derived') {
  return items
    .map((item) => ({
      ...item,
      salience: source === 'reading-derived' ? Math.min(item.salience, 0.42) : item.salience,
    }))
    .filter((item) => item.salience >= (source === 'user-stated' ? 0.18 : 0.12))
    .sort((a, b) => b.salience - a.salience || b.lastSeenAt.localeCompare(a.lastSeenAt))
    .slice(0, MAX_MEMORY_ITEMS);
}

export async function runMemoryConsolidationForProfile(profileId: string): Promise<void> {
  const state = await loadAccountState();
  if (!state.profiles.some((profile) => profile.profileId === profileId)) return;
  await ensureProfileMemoryFiles(profileId, state.accountId);
  const [userMemory, readingMemory] = await Promise.all([
    readJsonFile<UserStatedMemoryFile>(userMemoryFile(profileId), emptyUserStatedMemory(profileId, state.accountId)),
    readJsonFile<ReadingDerivedMemoryFile>(readingMemoryFile(profileId), emptyReadingDerivedMemory(profileId, state.accountId)),
  ]);
  const safeUser = withMemoryDefaults(userMemory);
  const safeReading = withMemoryDefaults(readingMemory);
  const now = nowIso();
  const nextUser: UserStatedMemoryFile = {
    ...safeUser,
    recurringTopics: trimTopicMemoryForConsolidation(safeUser.recurringTopics, 'user-stated'),
    observations: consolidateObservations(safeUser.observations, 'user-stated'),
    updatedAt: now,
  };
  const nextReading: ReadingDerivedMemoryFile = {
    ...safeReading,
    recurringTopics: trimTopicMemoryForConsolidation(safeReading.recurringTopics, 'reading-derived'),
    observations: consolidateObservations(safeReading.observations, 'reading-derived'),
    updatedAt: now,
  };
  const journal: SessionJournalEntry = {
    journalId: makeId('journal_consolidation'),
    accountId: state.accountId,
    profileId,
    createdAt: now,
    summary: 'Memory V2 consolidation çalıştı; tekrar eden kayıtlar birleştirildi ve düşük güvenli sinyaller zayıflatıldı.',
    events: ['Memory node listeleri sıkıştırıldı', 'Okuma kaynaklı temalar düşük öncelikte tutuldu'],
    memoryActions: [
      `${safeUser.observations.length} kullanıcı observation → ${nextUser.observations.length}`,
      `${safeReading.observations.length} okuma observation → ${nextReading.observations.length}`,
    ],
  };
  await Promise.all([
    writeJsonFile(userMemoryFile(profileId), nextUser),
    writeJsonFile(readingMemoryFile(profileId), nextReading),
    appendUniqueByReadingId(sessionJournalFile(profileId), journal, MAX_SESSION_JOURNAL_ITEMS),
    indexMemoryNodes(state.accountId, profileId, [...nextUser.observations, ...nextReading.observations]),
    indexSessionJournal(journal),
  ]);
}

export async function applyMemoryWriterProposal(profileId: string, proposal: MemoryWriterProposal): Promise<void> {
  const state = await loadAccountState();
  if (!state.profiles.some((profile) => profile.profileId === profileId)) return;
  await ensureProfileMemoryFiles(profileId, state.accountId);
  const now = nowIso();
  const current = await readJsonFile<any>(userSemanticWikiFile(profileId), {
    accountId: state.accountId,
    profileId,
    scope: 'user_memory',
    sections: [],
    updatedAt: now,
  });
  const existingSections = Array.isArray(current.sections) ? current.sections : [];
  const byId = new Map(existingSections.map((section: any) => [section.sectionId, section]));
  for (const section of proposal.semanticSections || []) {
    const sectionId = `${section.pageKey}:${section.sectionKey}`;
    byId.set(sectionId, {
      ...(byId.get(sectionId) || {}),
      sectionId,
      pageKey: section.pageKey,
      sectionKey: section.sectionKey,
      title: section.title,
      body: section.body,
      importance: section.importance,
      promptUse: section.promptUse,
      sourceStrength: section.sourceStrength,
      sourceRefs: section.sourceRefs || ['memory-writer'],
      createdAt: (byId.get(sectionId) as any)?.createdAt || now,
      updatedAt: now,
      metadata: section.metadata || {},
    });
  }
  await writeJsonFile(userSemanticWikiFile(profileId), {
    accountId: state.accountId,
    profileId,
    scope: 'user_memory',
    sections: [...byId.values()],
    updatedAt: now,
  });
}

export async function loadProfileMemorySnippet(
  state: AccountState,
  profileId: string,
  options?: { semanticQuery?: string },
): Promise<ProfileMemorySnippet | null> {
  const profile = state.profiles.find((item) => item.profileId === profileId);
  if (!profile) return null;
  const bundle = await loadProfileMemoryBundle(state, profileId);
  if (!bundle) return null;
  const owner = getPrimaryProfile(state) || state.profiles.find((item) => item.relationshipPrimary === 'kendi') || null;
  const userPeople = dedupePeopleForSnippet(bundle.userStated.importantPeople, state.profiles);
  const readingPeople = dedupePeopleForSnippet(bundle.readingDerived.importantPeople, state.profiles);
  const prominentRelations = dedupePeopleForSnippet(
    [...bundle.userStated.importantPeople, ...bundle.readingDerived.importantPeople],
    state.profiles,
  ).slice(0, 10);
  const birth = profile.birth;
  const userObservations = bundle.userStated.observations.slice(0, MAX_MEMORY_ITEMS);
  const readingObservations = bundle.readingDerived.observations.slice(0, MAX_MEMORY_ITEMS);
  const relevantObservations = selectRelevantObservations(
    [
      ...userObservations,
      ...readingObservations.map((item) => ({
        ...item,
        confidence: Math.min(item.confidence, 0.38),
      })),
    ],
    options?.semanticQuery,
  ).map(sanitizeObservationForPrompt);
  const userTopicsForPrompt = bundle.userStated.recurringTopics.map(sanitizeTopicForPrompt);
  const readingTopicsForPrompt = bundle.readingDerived.recurringTopics.map(sanitizeTopicForPrompt);
  const userObservationsForPrompt = userObservations.map(sanitizeObservationForPrompt);
  const readingObservationsForPrompt = readingObservations.map(sanitizeObservationForPrompt);
  const recentFingerprints = (
    await readJsonFile<ReadingFingerprint[]>(
      readingFingerprintsFile(profileId),
      [],
    )
  ).slice(0, 5);
  const queryTokens = tokenize(options?.semanticQuery || '').filter((token) => !SEMANTIC_STOP_WORDS.has(token)).slice(0, 12);
  const chunkSelection = await selectSourceChunksForPrompt({
    profileId,
    semanticQuery: options?.semanticQuery,
    queryTokens,
    fallbackChunks: bundle.sourceChunks || [],
  });
  const selectedSourceChunks = chunkSelection.chunks;
  const promptMemoryPack = buildPromptMemoryPack({
    userTopics: userTopicsForPrompt,
    readingTopics: readingTopicsForPrompt,
    userPatterns: bundle.userStated.emotionalPatterns.map((item) => item.label),
    relevantObservations,
    recentFingerprints,
    memoryEdges: (bundle.memoryEdges || []).slice(0, 20),
    sourceChunks: selectedSourceChunks,
  });
  await appendPromptMemoryAudit(profileId, {
    profileId,
    semanticQuery: options?.semanticQuery,
    retrievalMode: chunkSelection.mode,
    selectedObservationIds: relevantObservations.map((item) => item.id),
    selectedChunkIds: selectedSourceChunks.map((item) => item.chunkId),
    selectedFingerprintIds: recentFingerprints.map((item) => item.fingerprintId),
    selectedLoreIds: promptMemoryPack.debug?.selectedLoreIds || [],
    reasons: [
      ...chunkSelection.reasons,
      relevantObservations.length
        ? 'Konu ve profil önceliğine göre ilgili observation kayıtları prompt adaylarına eklendi.'
        : 'Bu çağrıda prompta özel observation seçilmedi.',
      recentFingerprints.length
        ? 'Son reading fingerprint kayıtları tekrar azaltma için seçildi.'
        : 'Tekrar azaltma için fingerprint kaydı yok.',
    ],
  }).catch(() => {});

  return {
    profileName: profile.displayName,
    isSelf: profile.relationshipPrimary === 'kendi' || profile.profileId === owner?.profileId || profile.isPrimary,
    relationshipLabel: relationshipLabel(profile),
    relationshipPrimary: profile.relationshipPrimary,
    profileGender: profile.gender,
    petSpecies: profile.relationshipPrimary === 'evcil_hayvan' ? petSpeciesLabel(profile) : null,
    chartPrecision: profile.chartPrecision,
    profileInfo: {
      profileId: profile.profileId,
      displayName: profile.displayName,
      isAccountOwner: profile.relationshipPrimary === 'kendi' || profile.profileId === owner?.profileId || profile.isPrimary,
      relationshipToAccountOwner: relationshipLabel(profile),
      gender: profile.gender,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    },
    accountOwnerProfile: owner
      ? {
          profileId: owner.profileId,
          displayName: owner.displayName,
        }
      : null,
    birthChartData: {
      birthDate: birth.date,
      birthTime: birth.time,
      timeKnown: birth.timeKnown,
      country: birth.location.country,
      cityOrRegion: birth.location.cityOrRegion,
      district: birth.location.district,
      subdistrict: birth.location.subdistrict,
      freeformLocation: birth.location.freeform,
      chartPrecision: profile.chartPrecision,
      hasBirthDate: Boolean(birth.date),
      hasBirthPlace: Boolean(birth.location.country && birth.location.cityOrRegion),
      hasExactBirthTime: Boolean(birth.time && birth.timeKnown),
    },
    prominentRelations,
    userStatedTopics: userTopicsForPrompt.map((item) => item.label).slice(0, 3),
    userTopicGroups: userTopicsForPrompt
      .slice(-MAX_MEMORY_ITEMS)
      .map((item) => ({
        key: item.key,
        label: item.label,
        group: item.group || topicGroupFor(item.key, item.label).group,
        subgroup: item.subgroup || topicGroupFor(item.key, item.label).subgroup,
        detailGroup: item.detailGroup || topicGroupFor(item.key, item.label).detailGroup,
        salience: item.salience,
      })),
    userStatedPeople: userPeople.map((item) => item.label).slice(0, 10),
    userStatedPatterns: bundle.userStated.emotionalPatterns.map((item) => item.label).slice(0, 3),
    userObservations: userObservationsForPrompt,
    userCategoryCandidates: bundle.userStated.categoryCandidates.slice(0, MAX_MEMORY_ITEMS),
    readingTopics: readingTopicsForPrompt.map((item) => item.label).slice(0, 3),
    readingTopicGroups: readingTopicsForPrompt
      .slice(-10)
      .map((item) => {
        const fallback = topicGroupFor(item.key, item.label);
        return {
          key: item.key,
          label: item.label,
          group: item.group || fallback.group,
          subgroup: item.subgroup || fallback.subgroup,
          detailGroup: item.detailGroup || fallback.detailGroup,
          salience: item.salience,
        };
      }),
    readingPeople: readingPeople.map((item) => item.label).slice(0, 10),
    readingPatterns: bundle.readingDerived.emotionalPatterns.map((item) => item.label).slice(0, 3),
    readingObservations: readingObservationsForPrompt,
    readingCategoryCandidates: bundle.readingDerived.categoryCandidates.slice(0, MAX_MEMORY_ITEMS),
    usedLifeEvents: bundle.readingDerived.usedLifeEvents || [],
    usedSurfaceCues: bundle.readingDerived.usedSurfaceCues || [],
    recentFingerprints,
    promptMemoryPack,
    selectedSourceChunks,
    relevantObservations,
  };
}

function selectRelevantObservations(observations: MemoryObservation[], semanticQuery?: string) {
  const promptable = observations.filter((item) => item.promptUse !== 'never' && item.visibility !== 'debug_only');
  const queryTokens = new Set(tokenize(semanticQuery || '').filter((token) => !SEMANTIC_STOP_WORDS.has(token)));
  if (!queryTokens.size) {
    return promptable
      .sort((a, b) => {
        if (a.source !== b.source) return a.source === 'user-stated' ? -1 : 1;
        const promptUseWeight = (b.promptUse === 'core' ? 0.2 : b.promptUse === 'subtle' ? 0.1 : 0) - (a.promptUse === 'core' ? 0.2 : a.promptUse === 'subtle' ? 0.1 : 0);
        if (Math.abs(promptUseWeight) > 0.01) return promptUseWeight;
        const confidenceDiff = b.confidence - a.confidence;
        if (Math.abs(confidenceDiff) > 0.08) return confidenceDiff;
        return b.lastSeenAt.localeCompare(a.lastSeenAt);
      })
      .slice(0, 8);
  }
  return promptable
    .map((item) => ({ item, score: observationSemanticScore(item, queryTokens) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      if (Math.abs(b.score - a.score) > 0.01) return b.score - a.score;
      return b.item.lastSeenAt.localeCompare(a.item.lastSeenAt);
    })
    .slice(0, 8)
    .map(({ item }) => item);
}

const MBTI_RESULT_CODE_RE = /\b(?:INTJ|INTP|ENTJ|ENTP|INFJ|INFP|ENFJ|ENFP|ISTJ|ISFJ|ESTJ|ESFJ|ISTP|ISFP|ESTP|ESFP)\b/iu;
const TEST_SOURCE_RE = /\b(?:MBTI\s+Kişilik\s+Testi|Kişilik\s+Testi|Uyumluluk\s+Testi|Beş\s+Faktör\s+Testi|Bağlanma\s+Stili\s+Testi|Değerler\s+Pusulası|Stresle\s+Başa\s+Çıkma\s+Testi)\b/iu;
const MBTI_RESULT_CODE_REPLACE = /\b(?:INTJ|INTP|ENTJ|ENTP|INFJ|INFP|ENFJ|ENFP|ISTJ|ISFJ|ESTJ|ESFJ|ISTP|ISFP|ESTP|ESFP)\b/giu;
const TEST_SOURCE_REPLACE = /\b(?:MBTI\s+Kişilik\s+Testi|Kişilik\s+Testi|Uyumluluk\s+Testi|Beş\s+Faktör\s+Testi|Bağlanma\s+Stili\s+Testi|Değerler\s+Pusulası|Stresle\s+Başa\s+Çıkma\s+Testi)\b/giu;
const TEST_RESULT_LEAD_RE = /\b[^.!?]{0,80}?\bsonucu\s*:?\s*[^.!?]{0,80}[.!?]?\s*/giu;

function isTestMemoryText(text?: string | null) {
  const value = text || '';
  return TEST_SOURCE_RE.test(value) || MBTI_RESULT_CODE_RE.test(value);
}

function sanitizeTestMemoryTextForPrompt(text?: string | null) {
  if (!text) return '';
  const cleaned = text
    .replace(TEST_RESULT_LEAD_RE, '')
    .replace(TEST_SOURCE_REPLACE, 'kişilik eğilimi')
    .replace(MBTI_RESULT_CODE_REPLACE, 'kişilik eğilimi')
    .replace(/\b(?:test sonucu|kişilik testi)\b/giu, 'kişisel eğilim')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return cleaned || 'Profilde bazı kişisel eğilimler daha belirgin görünüyor.';
}

function sanitizeTopicForPrompt(item: ProfileTopicMemory): ProfileTopicMemory {
  if (!isTestMemoryText(`${item.label} ${item.detailGroup || ''} ${item.subgroup || ''}`)) return item;
  return {
    ...item,
    label: sanitizeTestMemoryTextForPrompt(item.detailGroup || item.label),
    subgroup: 'kişisel eğilim',
    detailGroup: undefined,
  };
}

function sanitizeObservationForPrompt(item: MemoryObservation): MemoryObservation {
  if (!item.key.startsWith('test:') && !isTestMemoryText(`${item.title} ${item.summary}`)) return item;
  return {
    ...item,
    title: 'Kişisel eğilim',
    summary: sanitizeTestMemoryTextForPrompt(item.summary || item.title),
    category: 'profil',
    subgroup: 'kişisel eğilim',
    detailGroup: undefined,
  };
}

export async function appendUserConversationMemory(profileId: string, text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  const socialOnly = /^(teşekkürler|teşekkür ederim|sağ ol|sağol|harika|tamam|ok|anladım|rica ederim|eyvallah)[.!?\s]*$/iu.test(trimmed);
  if (socialOnly) return;
  const state = await loadAccountState();
  await ensureProfileMemoryFiles(profileId, state.accountId);
  const profile = state.profiles.find((item) => item.profileId === profileId);
  if (!profile) return;
  const current = await readJsonFile<UserStatedMemoryFile>(
    userMemoryFile(profileId),
    emptyUserStatedMemory(profileId, state.accountId),
  );
  const next = updateMemoryFromText(current, trimmed);
  const now = nowIso();
  const key = `followup-question:${normalizeForMatching(trimmed).slice(0, 96) || makeId('question')}`;
  const existing = next.observations.find((item) => item.key === key);
  const questionObservation: MemoryObservation = {
    id: existing?.id || makeId('obs'),
    key,
    source: 'user-stated',
    sourceType: 'user_input',
    visibility: 'internal',
    promptUse: 'subtle',
    category: 'konuşma',
    group: 'Genel',
    subgroup: 'Takip sorusu',
    kind: 'question',
    title: 'Kullanıcı takip sorusu',
    summary: trimmed,
    entities: [
      {
        label: profile.displayName,
        type: 'person',
        profileId: profile.profileId,
        relationship: ownerToProfileRelationship(profile),
        gender: profile.gender,
      },
    ],
    entityRelations: [],
    emotions: [],
    mentionedAt: existing?.mentionedAt || now,
    lastSeenAt: now,
    confidence: Math.max(existing?.confidence || 0, 0.86),
  };
  next.observations = [questionObservation, ...next.observations.filter((item) => item.key !== key)].slice(0, MAX_MEMORY_ITEMS);
  next.updatedAt = now;
  await Promise.all([
    writeJsonFile(userMemoryFile(profileId), next),
    indexMemoryNodes(state.accountId, profileId, [questionObservation]).catch(() => {}),
    indexObservationEmbeddings(state.accountId, profileId, [questionObservation]).catch(() => {}),
  ]);
}

export async function appendUserReadingIntentMemory(params: {
  profileId: string;
  text: string;
  readingType?: ReadingSummary['readingType'] | string;
}): Promise<void> {
  const trimmed = params.text.trim();
  if (!trimmed) return;
  const socialOnly = /^(teşekkürler|teşekkür ederim|sağ ol|sağol|harika|tamam|ok|anladım|rica ederim|eyvallah)[.!?\s]*$/iu.test(trimmed);
  if (socialOnly) return;
  const state = await loadAccountState();
  await ensureProfileMemoryFiles(params.profileId, state.accountId);
  const profile = state.profiles.find((item) => item.profileId === params.profileId);
  if (!profile) return;
  const current = await readJsonFile<UserStatedMemoryFile>(
    userMemoryFile(params.profileId),
    emptyUserStatedMemory(params.profileId, state.accountId),
  );
  const next = updateMemoryFromText(current, trimmed);
  const now = nowIso();
  const typeKey = normalizeForMatching(String(params.readingType || 'reading')).slice(0, 40) || 'reading';
  const textKey = normalizeForMatching(trimmed).slice(0, 96) || makeId('intent');
  const key = `reading-intent:${typeKey}:${textKey}`;
  const existing = next.observations.find((item) => item.key === key);
  const observation: MemoryObservation = {
    id: existing?.id || makeId('obs'),
    key,
    source: 'user-stated',
    sourceType: 'user_input',
    visibility: 'internal',
    promptUse: 'core',
    category: 'okuma niyeti',
    group: 'Genel',
    subgroup: 'Okuma öncesi konu',
    detailGroup: params.readingType ? String(params.readingType) : undefined,
    kind: 'question',
    title: 'Okuma öncesi kullanıcı niyeti',
    summary: trimmed,
    entities: [
      {
        label: profile.displayName,
        type: 'person',
        profileId: profile.profileId,
        relationship: ownerToProfileRelationship(profile),
        gender: profile.gender,
      },
    ],
    entityRelations: [],
    emotions: [],
    mentionedAt: existing?.mentionedAt || now,
    lastSeenAt: now,
    confidence: Math.max(existing?.confidence || 0, 0.92),
  };
  next.observations = [observation, ...next.observations.filter((item) => item.key !== key)].slice(0, MAX_MEMORY_ITEMS);
  next.updatedAt = now;
  await Promise.all([
    writeJsonFile(userMemoryFile(params.profileId), next),
    indexMemoryNodes(state.accountId, params.profileId, [observation]).catch(() => {}),
    indexObservationEmbeddings(state.accountId, params.profileId, [observation]).catch(() => {}),
  ]);
}

export async function appendUserCorrectionMemory(params: {
  profileId: string;
  correctionText: string;
  targetKey?: string;
  targetTitle?: string;
}): Promise<void> {
  const trimmed = params.correctionText.trim();
  if (!trimmed) return;
  const state = await loadAccountState();
  const profile = state.profiles.find((item) => item.profileId === params.profileId);
  if (!profile) return;
  await ensureProfileMemoryFiles(params.profileId, state.accountId);
  const current = withMemoryDefaults(
    await readJsonFile<UserStatedMemoryFile>(
      userMemoryFile(params.profileId),
      emptyUserStatedMemory(params.profileId, state.accountId),
    ),
  );
  const now = nowIso();
  const key = `correction:${normalizeForMatching(params.targetKey || params.targetTitle || trimmed).slice(0, 80) || makeId('item')}`;
  const existing = current.observations.find((item) => item.key === key);
  const observation: MemoryObservation = {
    id: existing?.id || makeId('obs'),
    key,
    source: 'user-stated',
    sourceType: 'user_input',
    visibility: 'user_visible',
    promptUse: 'core',
    category: 'düzeltme',
    group: 'profil',
    subgroup: 'kullanıcı düzeltmesi',
    detailGroup: params.targetTitle || 'yüksek güven',
    kind: 'fact',
    title: params.targetTitle ? `Düzeltme: ${params.targetTitle}` : 'Kullanıcı düzeltmesi',
    summary: trimmed,
    entities: [
      {
        label: profile.displayName,
        type: 'person',
        profileId: profile.profileId,
        relationship: ownerToProfileRelationship(profile),
        gender: profile.gender,
      },
    ],
    entityRelations: [],
    emotions: [],
    mentionedAt: existing?.mentionedAt || now,
    lastSeenAt: now,
    confidence: 0.98,
  };
  const next: UserStatedMemoryFile = {
    ...current,
    observations: [observation, ...current.observations.filter((item) => item.key !== key)].slice(0, MAX_MEMORY_ITEMS),
    recurringTopics: mergeTopicMemory(current.recurringTopics, [
      {
        key,
        label: observation.title,
        group: 'profil',
        subgroup: 'kullanıcı düzeltmesi',
        detailGroup: 'yüksek güven',
        salience: 0.98,
      },
    ]),
    updatedAt: now,
  };
  const correctionEdge: MemoryEdge = {
    edgeId: makeId('edge_correction'),
    accountId: state.accountId,
    profileId: params.profileId,
    fromNodeKey: key,
    toNodeKey: params.targetKey || params.targetTitle || 'profile_memory',
    edgeType: 'corrected_by_user',
    explanation: trimmed,
    confidence: 0.98,
    createdAt: now,
  };
  const currentEdges = await readJsonFile<MemoryEdge[]>(memoryEdgesFile(params.profileId), []);
  await Promise.all([
    writeJsonFile(userMemoryFile(params.profileId), next),
    writeJsonFile(memoryEdgesFile(params.profileId), [correctionEdge, ...currentEdges].slice(0, MAX_MEMORY_EDGE_ITEMS)),
    indexMemoryNodes(state.accountId, params.profileId, [observation]).catch(() => {}),
    indexObservationEmbeddings(state.accountId, params.profileId, [observation]).catch(() => {}),
    indexMemoryEdges([correctionEdge]).catch(() => {}),
  ]);
}

export async function appendUserStatedTestResult(params: {
  profileId: string;
  readingId: string;
  testId: string;
  testName: string;
  resultCode: string;
  resultTitle: string;
  summary: string;
}): Promise<void> {
  const state = await loadAccountState();
  const profile = state.profiles.find((item) => item.profileId === params.profileId);
  if (!profile) return;
  await ensureProfileMemoryFiles(params.profileId, state.accountId);
  const current = withMemoryDefaults(
    await readJsonFile<UserStatedMemoryFile>(
      userMemoryFile(params.profileId),
      emptyUserStatedMemory(params.profileId, state.accountId),
    ),
  );
  const key = `test:${params.testId}:${params.readingId}`;
  const now = nowIso();
  const existing = current.observations.find((item) => item.key === key);
  const observation: MemoryObservation = {
    id: existing?.id || makeId('obs'),
    key,
    source: 'user-stated',
    category: 'kişilik testi',
    group: 'profil',
    subgroup: 'kişilik eğilimi',
    detailGroup: params.testName,
    kind: 'fact',
    title: `${params.testName}: ${params.resultCode}`,
    summary: params.summary,
    entities: [
      {
        label: profile.displayName,
        type: 'person',
        profileId: profile.profileId,
        relationship: ownerToProfileRelationship(profile),
        gender: profile.gender,
      },
    ],
    entityRelations: [],
    emotions: [],
    mentionedAt: existing?.mentionedAt || now,
    lastSeenAt: now,
    confidence: 0.9,
  };
  const next: UserStatedMemoryFile = {
    ...current,
    recurringTopics: mergeTopicMemory(current.recurringTopics, [
      {
        key: `test:${params.testId}:${params.readingId}:name`,
        label: params.testName,
        group: 'profil',
        subgroup: 'test sonucu',
        detailGroup: params.resultCode,
        salience: 0.74,
      },
      {
        key,
        label: `${params.testName} ${params.resultCode}`,
        group: 'profil',
        subgroup: 'kişilik eğilimi',
        detailGroup: params.resultTitle,
        salience: 0.86,
      },
    ]),
    observations: [observation, ...current.observations.filter((item) => item.key !== key)].slice(0, MAX_MEMORY_ITEMS),
    updatedAt: now,
  };
  await Promise.all([
    writeJsonFile(userMemoryFile(params.profileId), next),
    indexMemoryNodes(state.accountId, params.profileId, [observation]).catch(() => {}),
    indexObservationEmbeddings(state.accountId, params.profileId, [observation]).catch(() => {}),
  ]);
}

export async function appendSelfKnowledgeProfileInsight(params: {
  profileId: string;
  readingId: string;
  source: 'birth-chart' | 'numerology-core' | 'personality-test';
  title: string;
  summary: string;
  detailGroup?: string;
  confidence?: number;
}): Promise<void> {
  const state = await loadAccountState();
  const profile = state.profiles.find((item) => item.profileId === params.profileId);
  if (!profile) return;
  const summary = compactText(params.summary, 520);
  if (!summary) return;
  await ensureProfileMemoryFiles(params.profileId, state.accountId);
  const current = withMemoryDefaults(
    await readJsonFile<UserStatedMemoryFile>(
      userMemoryFile(params.profileId),
      emptyUserStatedMemory(params.profileId, state.accountId),
    ),
  );
  const key = `self-knowledge:${params.source}:${params.readingId}`;
  const now = nowIso();
  const observation: MemoryObservation = {
    id: current.observations.find((item) => item.key === key)?.id || makeId('obs'),
    key,
    source: 'reading-derived',
    sourceType: 'test_result',
    visibility: 'user_visible',
    promptUse: 'subtle',
    category: 'profil',
    group: 'profil',
    subgroup: 'kişisel eğilim',
    detailGroup: params.detailGroup || params.source,
    kind: 'fact',
    title: params.title,
    summary,
    entities: [
      {
        label: profile.displayName,
        type: 'person',
        profileId: profile.profileId,
        relationship: ownerToProfileRelationship(profile),
        gender: profile.gender,
      },
    ],
    entityRelations: [],
    emotions: [],
    mentionedAt: now,
    lastSeenAt: now,
    confidence: Math.min(0.82, Math.max(0.45, params.confidence || 0.62)),
  };
  const topic: ProfileTopicMemory = {
    key,
    label: params.title,
    group: 'profil',
    subgroup: 'kişisel eğilim',
    detailGroup: params.detailGroup || params.source,
    salience: Math.min(0.78, Math.max(0.42, params.confidence || 0.58)),
    lastSeenAt: now,
  };
  const next: UserStatedMemoryFile = {
    ...current,
    recurringTopics: mergeTopicMemory(current.recurringTopics, [topic]),
    observations: [observation, ...current.observations.filter((item) => item.key !== key)].slice(0, MAX_MEMORY_ITEMS),
    updatedAt: now,
  };
  await Promise.all([
    writeJsonFile(userMemoryFile(params.profileId), next),
    indexMemoryNodes(state.accountId, params.profileId, [observation]).catch(() => {}),
    indexObservationEmbeddings(state.accountId, params.profileId, [observation]).catch(() => {}),
  ]);
}

async function deleteUserStatedTestMemoryForReading(reading: ReadingSummary, state: AccountState): Promise<void> {
  if (reading.readingType !== 'personality-test' || !reading.testResult?.testId) return;
  await ensureProfileMemoryFiles(reading.profileId, state.accountId);
  const current = withMemoryDefaults(
    await readJsonFile<UserStatedMemoryFile>(
      userMemoryFile(reading.profileId),
      emptyUserStatedMemory(reading.profileId, state.accountId),
    ),
  );
  const exactPrefix = `test:${reading.testResult.testId}:${reading.readingId}`;
  const legacyKey = `test:${reading.testResult.testId}:${reading.testResult.resultCode}`;
  const next: UserStatedMemoryFile = {
    ...current,
    recurringTopics: current.recurringTopics.filter(
      (item) => !item.key.startsWith(exactPrefix) && item.key !== legacyKey && item.key !== `test-${reading.testResult?.testId}`,
    ),
    observations: current.observations.filter((item) => item.key !== exactPrefix && item.key !== legacyKey),
    updatedAt: nowIso(),
  };
  await writeJsonFile(userMemoryFile(reading.profileId), next);
}

export async function applyMemoryAnalysisResult(
  profileId: string,
  result: MemoryAnalysisResult,
): Promise<void> {
  const state = await loadAccountState();
  await ensureProfileMemoryFiles(profileId, state.accountId);

  const currentUserMemory = await readJsonFile<UserStatedMemoryFile>(
    userMemoryFile(profileId),
    emptyUserStatedMemory(profileId, state.accountId),
  );
  const currentReadingMemory = await readJsonFile<ReadingDerivedMemoryFile>(
    readingMemoryFile(profileId),
    emptyReadingDerivedMemory(profileId, state.accountId),
  );
  const safeUserMemory = withMemoryDefaults(currentUserMemory);
  const safeReadingMemory = withMemoryDefaults(currentReadingMemory);

  const nextUserMemory: UserStatedMemoryFile = {
    ...safeUserMemory,
    recurringTopics: mergeTopicMemory(safeUserMemory.recurringTopics, result.userStated.recurringTopics || []),
    importantPeople: mergePeopleMemory(safeUserMemory.importantPeople, result.userStated.importantPeople || [], state.profiles),
    emotionalPatterns: mergePatternMemory(
      safeUserMemory.emotionalPatterns,
      result.userStated.emotionalPatterns || [],
    ),
    observations: mergeObservationMemory(
      safeUserMemory.observations,
      result.userStated.observations || [],
      'user-stated',
      state.profiles,
    ),
    categoryCandidates: mergeCategoryCandidates(
      safeUserMemory.categoryCandidates,
      result.userStated.categoryCandidates || [],
    ),
    updatedAt: nowIso(),
  };

  const nextReadingMemory: ReadingDerivedMemoryFile = {
    ...safeReadingMemory,
    recurringTopics: mergeTopicMemory(
      safeReadingMemory.recurringTopics,
      dampenReadingTopics(result.readingDerived.recurringTopics || []),
    ),
    importantPeople: mergePeopleMemory(
      safeReadingMemory.importantPeople,
      dampenReadingPeople(result.readingDerived.importantPeople || []),
      state.profiles,
    ),
    emotionalPatterns: mergePatternMemory(
      safeReadingMemory.emotionalPatterns,
      dampenReadingPatterns(result.readingDerived.emotionalPatterns || []),
    ),
    observations: mergeObservationMemory(
      safeReadingMemory.observations,
      dampenReadingObservations(result.readingDerived.observations || []),
      'reading-derived',
      state.profiles,
    ),
    categoryCandidates: mergeCategoryCandidates(
      safeReadingMemory.categoryCandidates,
      result.readingDerived.categoryCandidates || [],
    ),
    updatedAt: nowIso(),
  };

  await writeJsonFile(userMemoryFile(profileId), nextUserMemory);
  await writeJsonFile(readingMemoryFile(profileId), nextReadingMemory);
  await indexMemoryNodes(state.accountId, profileId, [
    ...nextUserMemory.observations,
    ...nextReadingMemory.observations,
  ]).catch(() => {});
  await indexObservationEmbeddings(state.accountId, profileId, [
    ...(result.userStated.observations || []),
    ...(result.readingDerived.observations || []),
  ]).catch(() => {});
  await applyMemoryV2AnalysisArtifacts(profileId, state.accountId, result);
  await runMemoryConsolidationForProfile(profileId).catch(() => {});
}

export async function appendReadingDerivedTheme(
  profileId: string,
  label: string,
  key = label,
): Promise<void> {
  const trimmed = label.trim();
  if (!trimmed) return;
  const state = await loadAccountState();
  await ensureProfileMemoryFiles(profileId, state.accountId);
  const currentReadingMemory = await readJsonFile<ReadingDerivedMemoryFile>(
    readingMemoryFile(profileId),
    emptyReadingDerivedMemory(profileId, state.accountId),
  );
  const nextReadingMemory: ReadingDerivedMemoryFile = {
    ...currentReadingMemory,
    recurringTopics: mergeTopicMemory(currentReadingMemory.recurringTopics, [
      {
        key: normalizeForMatching(key || trimmed) || trimmed.toLocaleLowerCase('tr-TR'),
        label: trimmed,
        salience: 0.28,
      },
    ]),
    updatedAt: nowIso(),
  };
  await writeJsonFile(readingMemoryFile(profileId), nextReadingMemory);
}

export async function appendReadingSpecificityUsage(
  profileId: string,
  usage: {
    events?: Array<{ group: string; label: string }>;
    cues?: string[];
  },
): Promise<void> {
  if (!usage.events?.length && !usage.cues?.length) return;
  const state = await loadAccountState();
  await ensureProfileMemoryFiles(profileId, state.accountId);
  const currentReadingMemory = withMemoryDefaults(
    await readJsonFile<ReadingDerivedMemoryFile>(
      readingMemoryFile(profileId),
      emptyReadingDerivedMemory(profileId, state.accountId),
    ),
  ) as ReadingDerivedMemoryFile;
  const nextReadingMemory: ReadingDerivedMemoryFile = {
    ...currentReadingMemory,
    usedLifeEvents: mergeUsedLifeEvents(currentReadingMemory.usedLifeEvents || [], usage.events || []),
    usedSurfaceCues: mergeUsedSurfaceCues(currentReadingMemory.usedSurfaceCues || [], usage.cues || []),
    updatedAt: nowIso(),
  };
  await writeJsonFile(readingMemoryFile(profileId), nextReadingMemory);
}

export function getRecentReadingsForProfile(
  state: AccountState,
  profileId: string,
  limit = 5,
): ReadingSummary[] {
  return state.readings.filter((reading) => reading.profileId === profileId).slice(0, limit);
}

export function getAllReadingsForProfile(state: AccountState, profileId: string): ReadingSummary[] {
  return state.readings.filter((reading) => reading.profileId === profileId);
}

export async function appendReadingSummary(
  reading: Omit<ReadingSummary, 'readingId' | 'createdAt' | 'accountId'>,
): Promise<AccountState> {
  const state = await loadAccountState();
  const entry: ReadingSummary = {
    readingId: makeId('reading'),
    accountId: state.accountId,
    createdAt: nowIso(),
    ...reading,
  };
  if (state.readings.some((item) => readingDedupeKey(item) === readingDedupeKey(entry))) {
    return state;
  }

  await ensureProfileMemoryFiles(reading.profileId, state.accountId);
  const currentReadingMemory = await readJsonFile<ReadingDerivedMemoryFile>(
    readingMemoryFile(reading.profileId),
    emptyReadingDerivedMemory(reading.profileId, state.accountId),
  );
  const isSurfaceFortune = reading.readingType === 'coffee' || reading.readingType === 'palm';
  const nextReadingMemory = dampenReadingDerivedMemory(updateMemoryFromText(currentReadingMemory, reading.summary, {
    includeTopics: !isSurfaceFortune,
    includePatterns: !isSurfaceFortune,
    includePeople: false,
  }));
  await writeJsonFile(readingMemoryFile(reading.profileId), nextReadingMemory);
  await appendMemoryV2Artifacts(entry);

  const nextState: AccountState = {
    ...state,
    readings: [entry, ...state.readings].slice(0, 100),
  };
  await saveState(nextState);
  return nextState;
}

export async function appendReplacingProfileTestResult(
  reading: Omit<ReadingSummary, 'readingId' | 'createdAt' | 'accountId'> & {
    readingType: 'personality-test';
    testResult: NonNullable<ReadingSummary['testResult']>;
  },
): Promise<AccountState> {
  const state = await loadAccountState();
  const shouldReplaceExisting = reading.testResult.testId !== 'compatibility';
  const readingsToRemove = shouldReplaceExisting
    ? state.readings.filter(
        (item) =>
          item.profileId === reading.profileId &&
          item.readingType === 'personality-test' &&
          item.testResult?.testId === reading.testResult.testId,
      )
    : [];
  for (const existing of readingsToRemove) {
    await deleteUserStatedTestMemoryForReading(existing, state).catch(() => {});
    await deleteMemoryV2ArtifactsForReading(existing).catch(() => {});
  }
  const entry: ReadingSummary = {
    readingId: makeId('reading'),
    accountId: state.accountId,
    createdAt: nowIso(),
    ...reading,
  };
  await ensureProfileMemoryFiles(reading.profileId, state.accountId);
  const nextState: AccountState = {
    ...state,
    readings: [
      entry,
      ...state.readings.filter((item) => !readingsToRemove.some((removed) => removed.readingId === item.readingId)),
    ].slice(0, 100),
  };
  await appendMemoryV2Artifacts(entry);
  await saveState(nextState);
  return nextState;
}

async function deleteMemoryV2ArtifactsForReading(reading: ReadingSummary): Promise<void> {
  await ensureProfileMemoryFiles(reading.profileId, reading.accountId);
  const [rawArchive, journals, fingerprints] = await Promise.all([
    readJsonFile<RawArchiveEntry[]>(rawArchiveFile(reading.profileId), []),
    readJsonFile<SessionJournalEntry[]>(sessionJournalFile(reading.profileId), []),
    readJsonFile<ReadingFingerprint[]>(readingFingerprintsFile(reading.profileId), []),
  ]);
  await Promise.all([
    writeJsonFile(rawArchiveFile(reading.profileId), rawArchive.filter((item) => item.readingId !== reading.readingId)),
    writeJsonFile(sessionJournalFile(reading.profileId), journals.filter((item) => item.readingId !== reading.readingId)),
    writeJsonFile(readingFingerprintsFile(reading.profileId), fingerprints.filter((item) => item.readingId !== reading.readingId)),
    writeJsonFile(sourceChunksFile(reading.profileId), (await readJsonFile<SourceChunk[]>(sourceChunksFile(reading.profileId), [])).filter((item) => item.readingId !== reading.readingId)),
    deleteSqliteArtifactsForReading(reading.profileId, reading.readingId),
  ]);
}

export async function deleteReading(readingId: string): Promise<AccountState> {
  const state = await loadAccountState();
  const reading = state.readings.find((item) => item.readingId === readingId);
  if (reading) {
    await deleteUserStatedTestMemoryForReading(reading, state).catch(() => {});
    await deleteMemoryV2ArtifactsForReading(reading).catch(() => {});
  }
  const nextState: AccountState = {
    ...state,
    readings: state.readings.filter((reading) => reading.readingId !== readingId),
  };
  await saveState(nextState);
  return nextState;
}

export async function deleteAllReadingsForProfile(profileId: string): Promise<AccountState> {
  const state = await loadAccountState();
  const readingsToDelete = state.readings.filter((item) => item.profileId === profileId);
  for (const reading of readingsToDelete) {
    await deleteUserStatedTestMemoryForReading(reading, state).catch(() => {});
    await deleteMemoryV2ArtifactsForReading(reading).catch(() => {});
  }
  const nextState: AccountState = {
    ...state,
    readings: state.readings.filter((reading) => reading.profileId !== profileId),
  };
  await saveState(nextState);
  return nextState;
}

export async function clearProfileMemoryAndReadings(profileId: string): Promise<AccountState> {
  const state = await deleteAllReadingsForProfile(profileId);
  const profile = state.profiles.find((item) => item.profileId === profileId);
  if (!profile) return state;
  await ensureProfileMemoryFiles(profileId, state.accountId);
  await Promise.all([
    writeJsonFile(userMemoryFile(profileId), emptyUserStatedMemory(profileId, state.accountId)),
    writeJsonFile(readingMemoryFile(profileId), emptyReadingDerivedMemory(profileId, state.accountId)),
    writeJsonFile(rawArchiveFile(profileId), []),
    writeJsonFile(sessionJournalFile(profileId), []),
    writeJsonFile(readingFingerprintsFile(profileId), []),
    writeJsonFile(memoryEdgesFile(profileId), []),
    writeJsonFile(sourceChunksFile(profileId), []),
    writeJsonFile(promptAuditFile(profileId), []),
    writeJsonFile(userSemanticWikiFile(profileId), {
      accountId: state.accountId,
      profileId,
      scope: 'user_memory',
      sections: [],
      updatedAt: nowIso(),
    }),
    deleteSqliteArtifactsForProfile(profileId).catch(() => {}),
  ]);
  return state;
}

export async function deleteProfile(
  profileId: string,
  mode: 'profile-only' | 'profile-and-data',
): Promise<AccountState> {
  const state = await loadAccountState();
  const target = state.profiles.find((profile) => profile.profileId === profileId);
  if (!target) return state;
  const deletesPrimaryProfile = target.isPrimary || state.primaryProfileId === profileId || target.relationshipPrimary === 'kendi';

  if (deletesPrimaryProfile) {
    const nextState: AccountState = {
      ...state,
      primaryProfileId: null,
      profiles: [],
      readings: [],
    };

    await saveState(nextState);
    for (const profile of state.profiles) {
      const dir = profileDir(profile.profileId);
      const info = await FileSystem.getInfoAsync(dir);
      if (info.exists) {
        await FileSystem.deleteAsync(dir, { idempotent: true });
      }
    }
    return nextState;
  }

  const nextState: AccountState = {
    ...state,
    primaryProfileId: state.primaryProfileId === profileId ? null : state.primaryProfileId,
    profiles: state.profiles.filter((profile) => profile.profileId !== profileId),
    readings:
      mode === 'profile-and-data'
        ? state.readings.filter(
            (reading) =>
              reading.profileId !== profileId &&
              !reading.astroRelationship?.subjects.some((subject) => subject.profileId === profileId),
          )
        : state.readings,
  };

  await saveState(nextState);
  await ensureProfileRelationshipMemoryLinks(nextState);

  if (mode === 'profile-and-data') {
    const dir = profileDir(profileId);
    const info = await FileSystem.getInfoAsync(dir);
    if (info.exists) {
      await FileSystem.deleteAsync(dir, { idempotent: true });
    }
  }

  return nextState;
}

export async function resetAllProfilesAndData(): Promise<AccountState> {
  const emptyState = createEmptyState();
  const info = await FileSystem.getInfoAsync(DATA_DIR);
  if (info.exists) {
    await FileSystem.deleteAsync(DATA_DIR, { idempotent: true });
  }
  await saveState(emptyState);
  return emptyState;
}

export function getReadingTypeLabel(reading: ReadingSummary): string {
  const surfaces = Array.isArray(reading.surfacesRead) ? reading.surfacesRead : [];
  const periodLabel = reading.period
    ? {
        daily: 'Günlük',
        weekly: 'Haftalık',
        monthly: 'Aylık',
        yearly: 'Yıllık',
      }[reading.period]
    : null;
  if (reading.readingType === 'personal-astro') {
    if (reading.astroFocusQuestion) return 'Konu Odaklı Astroloji';
    return periodLabel ? `Kişiye Özel Astroloji - ${periodLabel}` : 'Kişiye Özel Astroloji';
  }
  if (reading.readingType === 'personal-numerology') {
    return periodLabel ? `Kişiye Özel Numeroloji - ${periodLabel}` : 'Temel Numeroloji Haritası';
  }
  if (reading.readingType === 'birth-chart') {
    return 'Doğum Haritası';
  }
  if (reading.readingType === 'dream-interpretation') {
    return 'Rüya Yorumu';
  }
  if (reading.readingType === 'personal-tarot') {
    return reading.tarotSpread?.spreadName ? `Tarot - ${reading.tarotSpread.spreadName}` : 'Kişiye Özel Tarot';
  }
  if (reading.readingType === 'personality-test') {
    return reading.testResult?.testName ? `Test - ${reading.testResult.testName}` : 'Kişilik Testi';
  }
  if (reading.readingType === 'general-astro') {
    return periodLabel ? `Genel Astroloji - ${periodLabel}` : 'Genel Astroloji';
  }
  if (reading.readingType === 'astro-compatibility') {
    return 'Astrolojik Uyum Analizi';
  }
  if (reading.readingType === 'astro-family') {
    return 'Astrolojik Aile Okuması';
  }
  if (reading.readingType === 'palm') {
    return 'El Okuması';
  }
  if (reading.readingType === 'coffee') {
    if (reading.coffeeMode === 'ai-brew') return 'Kahve Yorumu - Benim yerime iç';
    if (surfaces.length === 2) return 'Kahve Yorumu - Fincan ve Tabak';
    if (surfaces[0] === 'cup') return 'Kahve Yorumu - Fincan';
    if (surfaces[0] === 'saucer') return 'Kahve Yorumu - Tabak';
    return 'Kahve Yorumu';
  }
  return 'Okuma';
}
