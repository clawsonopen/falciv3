import * as FileSystem from 'expo-file-system/legacy';
import type {
  AccountState,
  BirthInfo,
  ChartPrecision,
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
  if (/(saglik|beden|yorgun|stres|kaygi|ruh|enerji)/.test(normalized)) {
    return { group: 'İç Dünya', subgroup: 'Ruh hali ve beden', detailGroup: 'Duygusal ihtiyaç' };
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
        reading.readingType === 'birth-chart'
          ? reading.readingType
          : 'coffee',
      period:
        reading.period === 'daily' ||
        reading.period === 'weekly' ||
        reading.period === 'monthly' ||
        reading.period === 'yearly'
          ? reading.period
          : undefined,
      coffeeMode:
        reading.readingType === 'palm' ||
        reading.readingType === 'personal-astro' ||
        reading.readingType === 'personal-numerology' ||
        reading.readingType === 'birth-chart'
          ? undefined
          : reading.coffeeMode === 'ai-brew'
            ? 'ai-brew'
            : 'upload',
      surfacesRead: Array.isArray(reading.surfacesRead) ? reading.surfacesRead : [],
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
    const current = await readJsonFile<UserStatedMemoryFile>(
      userMemoryFile(profile.profileId),
      emptyUserStatedMemory(profile.profileId, state.accountId),
    );

    const seen = new Set<string>();
    const filtered = current.importantPeople.filter((person) => {
      if (seen.has(person.id)) return false;
      seen.add(person.id);
      const referencedProfileId = extractReferencedProfileId(person.id);
      if (referencedProfileId && !profileIds.has(referencedProfileId)) return false;
      if (ASSISTANT_NAME_SET.has(normalizeForMatching(person.label))) return false;
      return true;
    });

    if (filtered.length !== current.importantPeople.length) {
      await writeJsonFile(userMemoryFile(profile.profileId), {
        ...current,
        importantPeople: filtered,
        updatedAt: nowIso(),
      });
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
  { key: 'health_energy', label: 'sağlık ve enerji', keywords: ['sağlık', 'saglik', 'yorgun', 'stres', 'kaygı', 'kaygi', 'enerji'] },
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
      } else {
        recurringTopics.push({
          key: topic.key,
          label: topic.label,
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

  return { userStated, readingDerived };
}

export async function loadProfileMemorySnippet(
  state: AccountState,
  profileId: string,
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
    readingTopics: bundle.readingDerived.recurringTopics.map((item) => item.label).slice(0, 3),
    readingPeople: readingPeople.map((item) => item.label).slice(0, 3),
    readingPatterns: bundle.readingDerived.emotionalPatterns.map((item) => item.label).slice(0, 3),
  };
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

  const nextUserMemory: UserStatedMemoryFile = {
    ...currentUserMemory,
    recurringTopics: mergeTopicMemory(currentUserMemory.recurringTopics, result.userStated.recurringTopics || []),
    importantPeople: mergePeopleMemory(currentUserMemory.importantPeople, result.userStated.importantPeople || [], state.profiles),
    emotionalPatterns: mergePatternMemory(
      currentUserMemory.emotionalPatterns,
      result.userStated.emotionalPatterns || [],
    ),
    updatedAt: nowIso(),
  };

  const nextReadingMemory: ReadingDerivedMemoryFile = {
    ...currentReadingMemory,
    recurringTopics: mergeTopicMemory(
      currentReadingMemory.recurringTopics,
      result.readingDerived.recurringTopics || [],
    ),
    importantPeople: mergePeopleMemory(
      currentReadingMemory.importantPeople,
      result.readingDerived.importantPeople || [],
      state.profiles,
    ),
    emotionalPatterns: mergePatternMemory(
      currentReadingMemory.emotionalPatterns,
      result.readingDerived.emotionalPatterns || [],
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
        salience: 0.72,
      },
    ]),
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
  const nextReadingMemory = updateMemoryFromText(currentReadingMemory, reading.summary, {
    includeTopics: false,
    includePatterns: false,
    includePeople: false,
  });
  await writeJsonFile(readingMemoryFile(reading.profileId), nextReadingMemory);

  const nextState: AccountState = {
    ...state,
    readings: [entry, ...state.readings].slice(0, 100),
  };
  await saveState(nextState);
  return nextState;
}

export async function deleteReading(readingId: string): Promise<AccountState> {
  const state = await loadAccountState();
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
        ? state.readings.filter((reading) => reading.profileId !== profileId)
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
    return periodLabel ? `Kişiye Özel Astroloji - ${periodLabel}` : 'Kişiye Özel Astroloji';
  }
  if (reading.readingType === 'personal-numerology') {
    return 'Kişiye Özel Numeroloji';
  }
  if (reading.readingType === 'birth-chart') {
    return 'Doğum Haritası';
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
