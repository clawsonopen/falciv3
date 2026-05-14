import * as FileSystem from 'expo-file-system/legacy';
import type {
  AccountState,
  BirthInfo,
  ChartPrecision,
  MemoryCategoryCandidate,
  MemoryObservation,
  UsedSpecificityEventMemory,
  UsedSurfaceCueMemory,
  ProfileGender,
  ProfileMemoryBundle,
  ProfileMemorySnippet,
  ReadingDerivedMemoryFile,
  ReadingSummary,
  ReadingSurface,
  RelationshipPrimary,
  RelationshipRelativeDetail,
  SubjectProfile,
  UserStatedMemoryFile,
} from '../types/memory';
import type { MemoryAnalysisResult } from './memoryAnalysisService';

const DATA_DIR = `${FileSystem.documentDirectory}falci-data/`;
const DATA_FILE = `${DATA_DIR}account-state.json`;
const MEMORY_DIR = `${DATA_DIR}profile-memories/`;
const MAX_MEMORY_ITEMS = 10;
const ASSISTANT_NAME_SET = new Set(['durdane hanim', 'hikmet bey', 'bahar hanim', 'mert bey', 'caner']);
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

  const [userInfo, readingInfo] = await Promise.all([
    FileSystem.getInfoAsync(userPath),
    FileSystem.getInfoAsync(readingPath),
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
  const nextState: AccountState = {
    accountId: parsed.accountId,
    primaryProfileId: parsed.primaryProfileId ?? null,
    profiles: parsed.profiles ?? [],
    readings: (parsed.readings ?? []).map((reading: Partial<ReadingSummary> & { previewText?: string }) => ({
      readingId: reading.readingId || makeId('reading_legacy'),
      accountId: reading.accountId || parsed.accountId,
      profileId: reading.profileId || '',
      assistantId: reading.assistantId || 'durdane-hanim',
      readingType:
        reading.readingType === 'palm' ||
        reading.readingType === 'personal-astro' ||
        reading.readingType === 'personal-numerology' ||
        reading.readingType === 'birth-chart' ||
        reading.readingType === 'dream-interpretation' ||
        reading.readingType === 'personal-tarot' ||
        reading.readingType === 'personality-test' ||
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
    })),
  };

  for (const profile of nextState.profiles) {
    await ensureProfileMemoryFiles(profile.profileId, nextState.accountId);
  }
  await ensureProfileRelationshipMemoryLinks(nextState);

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
  const profile: SubjectProfile = {
    profileId,
    accountId: state.accountId,
    isPrimary: input.isPrimary,
    displayName: input.displayName.trim(),
    relationshipPrimary: input.relationshipPrimary,
    relationshipDetail: input.relationshipDetail,
    relationshipFreeform: input.relationshipFreeform?.trim() || null,
    gender: input.gender,
    birth: input.birth,
    chartPrecision: computeChartPrecision(input.birth),
    createdAt,
    updatedAt: createdAt,
  };

  const nextState: AccountState = {
    ...state,
    primaryProfileId: input.isPrimary ? profileId : state.primaryProfileId,
    profiles: input.isPrimary ? [profile, ...state.profiles] : [...state.profiles, profile],
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
        if (normalizeForMatching(item.label) === normalizedLabel || normalizeForMatching(item.relationship) === normalizeForMatching(normalizedRelationship)) {
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

  return { userStated: withMemoryDefaults(userStated), readingDerived: withMemoryDefaults(readingDerived) };
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
  ).slice(0, 5);
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
  );

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
    userStatedTopics: bundle.userStated.recurringTopics.map((item) => item.label).slice(0, 3),
    userTopicGroups: bundle.userStated.recurringTopics
      .slice(-MAX_MEMORY_ITEMS)
      .map((item) => ({
        key: item.key,
        label: item.label,
        group: item.group || topicGroupFor(item.key, item.label).group,
        subgroup: item.subgroup || topicGroupFor(item.key, item.label).subgroup,
        detailGroup: item.detailGroup || topicGroupFor(item.key, item.label).detailGroup,
        salience: item.salience,
      })),
    userStatedPeople: userPeople.map((item) => item.label).slice(0, 3),
    userStatedPatterns: bundle.userStated.emotionalPatterns.map((item) => item.label).slice(0, 3),
    userObservations,
    userCategoryCandidates: bundle.userStated.categoryCandidates.slice(0, MAX_MEMORY_ITEMS),
    readingTopics: bundle.readingDerived.recurringTopics.map((item) => item.label).slice(0, 3),
    readingTopicGroups: bundle.readingDerived.recurringTopics
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
    readingPeople: readingPeople.map((item) => item.label).slice(0, 3),
    readingPatterns: bundle.readingDerived.emotionalPatterns.map((item) => item.label).slice(0, 3),
    readingObservations,
    readingCategoryCandidates: bundle.readingDerived.categoryCandidates.slice(0, MAX_MEMORY_ITEMS),
    usedLifeEvents: bundle.readingDerived.usedLifeEvents || [],
    usedSurfaceCues: bundle.readingDerived.usedSurfaceCues || [],
    relevantObservations,
  };
}

function selectRelevantObservations(observations: MemoryObservation[], semanticQuery?: string) {
  const queryTokens = new Set(tokenize(semanticQuery || '').filter((token) => !SEMANTIC_STOP_WORDS.has(token)));
  if (!queryTokens.size) {
    return observations
      .sort((a, b) => {
        if (a.source !== b.source) return a.source === 'user-stated' ? -1 : 1;
        const confidenceDiff = b.confidence - a.confidence;
        if (Math.abs(confidenceDiff) > 0.08) return confidenceDiff;
        return b.lastSeenAt.localeCompare(a.lastSeenAt);
      })
      .slice(0, 8);
  }
  return observations
    .map((item) => ({ item, score: observationSemanticScore(item, queryTokens) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      if (Math.abs(b.score - a.score) > 0.01) return b.score - a.score;
      return b.item.lastSeenAt.localeCompare(a.item.lastSeenAt);
    })
    .slice(0, 8)
    .map(({ item }) => item);
}

export async function appendUserConversationMemory(profileId: string, text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  const state = await loadAccountState();
  await ensureProfileMemoryFiles(profileId, state.accountId);
  if (!state.profiles.find((profile) => profile.profileId === profileId)) return;
  const current = await readJsonFile<UserStatedMemoryFile>(
    userMemoryFile(profileId),
    emptyUserStatedMemory(profileId, state.accountId),
  );
  const next = updateMemoryFromText(current, trimmed);
  await writeJsonFile(userMemoryFile(profileId), next);
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
  await writeJsonFile(userMemoryFile(params.profileId), next);
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

  await ensureProfileMemoryFiles(reading.profileId, state.accountId);
  const currentReadingMemory = await readJsonFile<ReadingDerivedMemoryFile>(
    readingMemoryFile(reading.profileId),
    emptyReadingDerivedMemory(reading.profileId, state.accountId),
  );
  const nextReadingMemory = dampenReadingDerivedMemory(updateMemoryFromText(currentReadingMemory, reading.summary, {
    includeTopics: true,
    includePatterns: true,
    includePeople: false,
  }));
  await writeJsonFile(readingMemoryFile(reading.profileId), nextReadingMemory);

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
  await saveState(nextState);
  return nextState;
}

export async function deleteReading(readingId: string): Promise<AccountState> {
  const state = await loadAccountState();
  const reading = state.readings.find((item) => item.readingId === readingId);
  if (reading) {
    await deleteUserStatedTestMemoryForReading(reading, state).catch(() => {});
  }
  const nextState: AccountState = {
    ...state,
    readings: state.readings.filter((reading) => reading.readingId !== readingId),
  };
  await saveState(nextState);
  return nextState;
}

export async function deleteProfile(
  profileId: string,
  mode: 'profile-only' | 'profile-and-data',
): Promise<AccountState> {
  const state = await loadAccountState();
  const target = state.profiles.find((profile) => profile.profileId === profileId);
  if (!target) return state;

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
    return 'Kişiye Özel Numeroloji';
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
  if (reading.readingType === 'astro-compatibility') {
    return 'Astrolojik Uyum Analizi';
  }
  if (reading.readingType === 'astro-family') {
    return 'Astrolojik Aile Okuması';
  }
  if (reading.readingType === 'palm') {
    return 'El Falı';
  }
  if (reading.readingType === 'coffee') {
    if (reading.coffeeMode === 'ai-brew') return 'Kahve Falı - Benim yerime iç';
    if (surfaces.length === 2) return 'Kahve Falı - Fincan ve Tabak';
    if (surfaces[0] === 'cup') return 'Kahve Falı - Fincan';
    if (surfaces[0] === 'saucer') return 'Kahve Falı - Tabak';
    return 'Kahve Falı';
  }
  return 'Fal';
}
