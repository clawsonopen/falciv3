import * as FileSystem from 'expo-file-system/legacy';
import type {
  AccountState,
  MemoryWriterProposal,
  MemoryWriterSemanticSectionPatch,
  ProfileMemoryBundle,
  ProfileMemorySnippet,
  SemanticWikiSection,
} from '../types/memory';
import { generateGeminiTextDirect } from './geminiDirectService';
import { promptTextFromGeminiPayload } from './promptDebugService';
import { addPersonalTokenUsage } from './tokenLedgerService';
import {
  applyMemoryWriterProposal,
  loadAccountState,
  loadProfileMemoryBundle,
  loadProfileMemorySnippet,
} from './profileMemoryService';

const DATA_DIR = `${FileSystem.documentDirectory}falci-data/`;
const MEMORY_WRITER_DEBUG_FILE = `${DATA_DIR}memory-writer-debug-jobs.json`;
const WRITER_OUTPUT_SAFETY_LIMITS = {
  semanticSections: 96,
  personaRelationships: 32,
  graphEdges: 128,
};
const PRIMARY_RELATIONSHIP_PROFILE_TYPES = new Set(['es', 'cocuk', 'evcil_hayvan', 'anne', 'baba', 'kardes']);

export type MemoryWriterDebugJobStatus = 'draft' | 'running' | 'succeeded' | 'skipped' | 'failed' | 'applied';
export type MemoryWriterDebugJobKind = 'profile_identity_refresh';

export type MemoryWriterDebugJob = {
  jobId: string;
  profileId: string;
  profileName: string;
  kind: MemoryWriterDebugJobKind;
  status: MemoryWriterDebugJobStatus;
  provider: 'gemini';
  modelName: string;
  prompt: string;
  rawResponse?: string;
  proposal?: MemoryWriterProposal;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  error?: string;
  createdAt: string;
  updatedAt: string;
};

type MemoryWriterDebugStore = {
  schemaVersion: 1;
  jobs: MemoryWriterDebugJob[];
};

function nowIso() {
  return new Date().toISOString();
}

function makeJobId() {
  return `memory_writer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(DATA_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DATA_DIR, { intermediates: true });
  }
}

async function readStore(): Promise<MemoryWriterDebugStore> {
  await ensureDir();
  try {
    const info = await FileSystem.getInfoAsync(MEMORY_WRITER_DEBUG_FILE);
    if (!info.exists) return { schemaVersion: 1, jobs: [] };
    const parsed = JSON.parse(await FileSystem.readAsStringAsync(MEMORY_WRITER_DEBUG_FILE)) as MemoryWriterDebugStore;
    return {
      schemaVersion: 1,
      jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
    };
  } catch {
    return { schemaVersion: 1, jobs: [] };
  }
}

async function writeStore(store: MemoryWriterDebugStore) {
  await ensureDir();
  await FileSystem.writeAsStringAsync(
    MEMORY_WRITER_DEBUG_FILE,
    JSON.stringify({ schemaVersion: 1, jobs: store.jobs.slice(0, 40) }, null, 2),
  );
}

export async function loadMemoryWriterDebugJobs(profileId?: string): Promise<MemoryWriterDebugJob[]> {
  const store = await readStore();
  return profileId ? store.jobs.filter((job) => job.profileId === profileId) : store.jobs;
}

export async function clearMemoryWriterDebugJobs(profileId?: string): Promise<void> {
  const store = await readStore();
  const jobs = profileId ? store.jobs.filter((job) => job.profileId !== profileId) : [];
  await writeStore({ schemaVersion: 1, jobs });
}

function escapeRegExp(value: string) {
  return value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function stripJsonFence(text: string) {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function uniqueStrings(values: string[], limit: number) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = String(value || '').replace(/\s+/g, ' ').trim();
    const key = trimmed.toLocaleLowerCase('tr-TR');
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
    if (result.length >= limit) break;
  }
  return result;
}

function uniqueBy<T>(values: T[], keyOf: (value: T) => string, limit: number) {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const value of values) {
    const key = keyOf(value).replace(/\s+/g, ' ').trim().toLocaleLowerCase('tr-TR');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
    if (result.length >= limit) break;
  }
  return result;
}

function calculateAge(dateValue?: string | null) {
  if (!dateValue) return null;
  const birth = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDelta = today.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age >= 0 && age < 130 ? age : null;
}

function pruneEmpty<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map((item) => pruneEmpty(item))
      .filter((item) => {
        if (item == null) return false;
        if (Array.isArray(item)) return item.length > 0;
        if (typeof item === 'object') return Object.keys(item as Record<string, unknown>).length > 0;
        if (typeof item === 'string') return item.trim().length > 0;
        return true;
      }) as T;
  }
  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      const item = pruneEmpty(raw);
      if (item == null) continue;
      if (Array.isArray(item) && item.length === 0) continue;
      if (typeof item === 'object' && !Array.isArray(item) && Object.keys(item as Record<string, unknown>).length === 0) continue;
      if (typeof item === 'string' && item.trim().length === 0) continue;
      next[key] = item;
    }
    return next as T;
  }
  return value;
}

function sectionBrief(section: SemanticWikiSection) {
  return {
    pageKey: section.pageKey,
    sectionKey: section.sectionKey,
    title: section.title,
    body: section.body,
    importance: section.importance,
    promptUse: section.promptUse,
    sourceStrength: section.sourceStrength,
  };
}

function sanitizeTestResult(testResult: any) {
  if (!testResult) return undefined;
  return pruneEmpty({
    testId: testResult.testId,
    testName: testResult.testName,
    resultCode: testResult.resultCode,
    resultTitle: testResult.resultTitle,
  });
}

function isSelfKnowledgeReadingType(readingType?: string | null) {
  return readingType === 'birth-chart' || readingType === 'personal-numerology' || readingType === 'personality-test';
}

function isRawSelfKnowledgeSection(section: Pick<SemanticWikiSection, 'pageKey' | 'sectionKey' | 'sourceStrength' | 'title' | 'body'>) {
  if (section.pageKey !== 'self_knowledge') return false;
  if (section.sectionKey === 'self_knowledge_essence') return false;
  if (section.sourceStrength !== 'self_knowledge_result') return false;
  return looksLikeSelfKnowledgeText(`${section.title} ${section.body}`);
}

function sanitizeSelfKnowledgeSummary(summary: string, title?: string) {
  const compact = compactSelfKnowledgeBody(summary || title || '');
  return compact || title || '';
}

function summarizeTranscriptFollowUps(transcript: AccountState['readings'][number]['transcript']) {
  const messages = Array.isArray(transcript) ? transcript : [];
  const firstAssistantIndex = messages.findIndex((item) => item.role === 'assistant');
  const followUps = firstAssistantIndex >= 0 ? messages.slice(firstAssistantIndex + 1) : messages;
  return followUps
    .filter((item) => item.role === 'user')
    .map((item) => String(item.text || '').replace(/\s+/g, ' ').trim())
    .filter((text) => text.length > 0 && !/^(teşekkürler|teşekkür ederim|sağ ol|sağol|harika|tamam|ok|anladım)[.!?\s]*$/iu.test(text))
    .slice(-6);
}

function buildRecentReadingContext(readings: AccountState['readings']) {
  return readings.map((item) =>
    pruneEmpty({
      readingId: item.readingId,
      assistantId: item.assistantId,
      readingType: item.readingType,
      period: item.period,
      summaryBrief: isSelfKnowledgeReadingType(item.readingType) || looksLikeSelfKnowledgeText(item.summary)
        ? sanitizeSelfKnowledgeSummary(item.summary)
        : compactReadingSummaryForWriter(item.summary),
      followUpQuestions: summarizeTranscriptFollowUps(item.transcript),
      testResult: sanitizeTestResult(item.testResult),
      astroFocusQuestion: item.astroFocusQuestion,
    }),
  );
}

function compactReadingSummaryForWriter(text: string) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return normalized.length > 220 ? `${normalized.slice(0, 220).trim()}...` : normalized;
}

function buildRepetitionAndVarietyContext(fingerprints: NonNullable<ProfileMemoryBundle['readingFingerprints']>, readings: AccountState['readings']) {
  const themeCounts = new Map<string, number>();
  const typeCounts = new Map<string, number>();
  const symbols = new Set<string>();
  const phrasesToAvoid = new Set<string>();
  const suggestions: string[] = [];
  for (const item of fingerprints) {
    for (const theme of item.themes || []) themeCounts.set(theme, (themeCounts.get(theme) || 0) + 1);
    if (item.readingType) typeCounts.set(item.readingType, (typeCounts.get(item.readingType) || 0) + 1);
    for (const symbol of item.symbols || []) symbols.add(symbol);
    for (const phrase of item.phrasesToAvoid || []) phrasesToAvoid.add(phrase);
    if (item.nextAngleSuggestion) suggestions.push(item.nextAngleSuggestion);
  }
  const recentFollowUpQuestions = readings.flatMap((item) => summarizeTranscriptFollowUps(item.transcript)).slice(-8);
  const countedThemes = [...themeCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'tr'))
    .map(([theme, count]) => `${theme} (${count})`);
  const countedTypes = [...typeCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'tr'))
    .map(([type, count]) => `${type} (${count})`);
  return pruneEmpty({
    recentReadingTypes: countedTypes.slice(0, 8),
    repeatedThemes: countedThemes.slice(0, 12),
    repeatedSymbols: [...symbols].slice(0, 12),
    phrasesToAvoid: [...phrasesToAvoid].slice(0, 12),
    varietyDirections: uniqueStrings(suggestions, 6),
    recentFollowUpQuestions,
  });
}

function relationshipLabelForProfile(profile: AccountState['profiles'][number]) {
  if (profile.relationshipPrimary === 'evcil_hayvan') return profile.relationshipFreeform || 'evcil hayvan';
  if (profile.relationshipPrimary === 'akraba') return profile.relationshipDetail || profile.relationshipFreeform || 'akraba';
  return profile.relationshipPrimary;
}

function reverseOwnerRelationship(profile: AccountState['profiles'][number]) {
  switch (profile.relationshipPrimary) {
    case 'es':
    case 'sevgili':
    case 'eski_sevgili':
    case 'sevgili_adayi':
    case 'arkadas':
      return relationshipLabelForProfile(profile);
    case 'anne':
    case 'baba':
      return 'çocuk';
    case 'cocuk':
      return 'ebeveyn';
    case 'kardes':
      return 'kardeş';
    case 'evcil_hayvan':
      return 'ailesi/sahibi';
    case 'akraba':
      return 'akraba';
    default:
      return 'ilişkili profil';
  }
}

function relationshipToSelectedProfile(
  target: AccountState['profiles'][number],
  selected: AccountState['profiles'][number] | undefined,
  primaryProfileId: string | null,
) {
  if (!selected || selected.profileId === target.profileId) return 'seçili profil';
  const selectedIsOwner = selected.profileId === primaryProfileId || selected.isPrimary || selected.relationshipPrimary === 'kendi';
  const targetIsOwner = target.profileId === primaryProfileId || target.isPrimary || target.relationshipPrimary === 'kendi';
  if (selectedIsOwner) return relationshipLabelForProfile(target);
  if (targetIsOwner) return reverseOwnerRelationship(selected);
  return `${relationshipLabelForProfile(target)} (hesap sahibi üzerinden)`;
}

function profileFact(
  profile: AccountState['profiles'][number],
  primaryProfileId: string | null,
  selectedProfile?: AccountState['profiles'][number],
) {
  const hasBirthDate = Boolean(profile.birth?.date);
  const hasBirthPlace = Boolean(
    profile.birth?.location?.country ||
      profile.birth?.location?.cityOrRegion ||
      profile.birth?.location?.district ||
      profile.birth?.location?.freeform,
  );
  return pruneEmpty({
    profileId: profile.profileId,
    displayName: profile.displayName,
    isPrimary: profile.profileId === primaryProfileId || profile.isPrimary,
    relationshipPrimary: profile.relationshipPrimary,
    relationshipToSelected: relationshipToSelectedProfile(profile, selectedProfile, primaryProfileId),
    relationshipTier: PRIMARY_RELATIONSHIP_PROFILE_TYPES.has(profile.relationshipPrimary) ? 'primary_relationship_profile' : 'secondary_relationship_profile',
    relationshipDetail: profile.relationshipDetail,
    relationshipFreeform: profile.relationshipFreeform,
    gender: profile.gender,
    age: calculateAge(profile.birth?.date),
    chartPrecision: profile.chartPrecision,
    birthDataStatus: {
      hasBirthDate,
      hasBirthPlace,
      hasExactBirthTime: Boolean(profile.birth?.timeKnown && profile.birth?.time),
    },
  });
}

function buildMemoryWriterContext(
  snippet: ProfileMemorySnippet | null,
  bundle: ProfileMemoryBundle | null,
  state: AccountState,
  profileId: string,
) {
  const profile = state.profiles.find((item) => item.profileId === profileId);
  const sourceRecentReadings = state.readings
    .filter((item) => item.profileId === profileId)
    .slice(0, 8)
    .filter((item: any) => {
      if (item.readingType === 'birth-chart') return false;
      return true;
    });
  const recentReadings = buildRecentReadingContext(sourceRecentReadings);
  const semanticWiki = (snippet?.userSemanticWiki?.sections || bundle?.userSemanticWiki?.sections || [])
    .filter((section) => {
      if (section.sourceStrength === 'profile_data' && section.sectionKey === 'profile_basis') return false;
      if (section.sourceStrength === 'profile_data' && section.sectionKey === 'account_profile_map') return false;
      if (section.sourceStrength === 'profile_data' && section.sectionKey === 'prominent_relations') return false;
      if (section.pageKey === 'user_preferences' && looksLikeSelfKnowledgeText(`${section.title} ${section.body}`)) return false;
      if (isRawSelfKnowledgeSection(section)) return false;
      if (section.pageKey === 'repetition_and_variety') return false;
      if (section.pageKey === 'reading_memory' && section.sectionKey === 'recent_reading_theme_summary') return false;
      return true;
    })
    .map((section) => {
      const brief = sectionBrief(section);
      if (section.pageKey === 'self_knowledge' && looksLikeSelfKnowledgeText(`${section.title} ${section.body}`)) {
        return { ...brief, sectionKey: 'self_knowledge_essence', body: compactSelfKnowledgeBody(section.body) };
      }
      return brief;
    });
  const personaRelationships = (snippet?.personaRelationships || bundle?.personaRelationships || []).slice(0, 40);
  const relevantObservations = uniqueBy(
    (snippet?.relevantObservations || []).map((item) =>
      pruneEmpty({
        id: item.id,
        key: item.key,
        source: item.source,
        sourceType: item.sourceType,
        promptUse: item.promptUse,
        group: item.group,
        subgroup: item.subgroup,
        title: item.title,
        summary: item.sourceType === 'test_result' || item.key.startsWith('self-knowledge:') || looksLikeSelfKnowledgeText(`${item.title} ${item.summary}`)
          ? sanitizeSelfKnowledgeSummary(item.summary || item.title, item.title)
          : item.summary,
        confidence: item.confidence,
      }),
    ),
    (item: any) => `${item.key}:${item.summary}`,
    80,
  );
  const compactSemanticWiki = uniqueBy(
    semanticWiki,
    (section: any) => `${section.pageKey}:${section.sectionKey}:${section.body}`,
    80,
  );
  const graphEdges = (bundle?.memoryEdges || []).slice(0, 80);
  const recentFingerprints = (bundle?.readingFingerprints || []).slice(0, 40);
  const repetitionAndVariety = buildRepetitionAndVarietyContext(recentFingerprints, sourceRecentReadings);
  const requiredSemanticSeeds = buildRequiredSemanticSeeds(repetitionAndVariety);
  const relatedProfiles = state.profiles
    .filter((item) => item.profileId !== profileId)
    .map((item) => profileFact(item, state.primaryProfileId, profile));
  const hasSelfKnowledge = recentReadings.some((item: any) => Boolean(item.testResult));
  const hasSemanticEvidence =
    semanticWiki.length > 0 ||
    personaRelationships.length > 0 ||
    relevantObservations.length > 0 ||
    graphEdges.length > 0 ||
    recentFingerprints.length > 0 ||
    recentReadings.length > 0;

  return pruneEmpty({
    selectedProfile: profile ? profileFact(profile, state.primaryProfileId, profile) : null,
    relatedProfiles,
    evidenceStatus: {
      hasOnlyProfileMetadata: !hasSemanticEvidence,
      hasReadings: recentReadings.length > 0,
      hasSelfKnowledge,
      hasSemanticWiki: semanticWiki.length > 0,
      hasPersonaRelationships: personaRelationships.length > 0,
      hasGraphEdges: graphEdges.length > 0,
      hasRelevantObservations: relevantObservations.length > 0,
      relatedProfileCount: relatedProfiles.length,
    },
    evidence: {
      semanticWiki: compactSemanticWiki,
      personaRelationships,
      relevantObservations,
      graphEdges,
      repetitionAndVariety,
      requiredSemanticSeeds,
      recentReadings,
    },
  });
}

function buildRequiredSemanticSeeds(repetitionAndVariety: any) {
  const followUpQuestions = uniqueStrings(
    Array.isArray(repetitionAndVariety?.recentFollowUpQuestions)
      ? repetitionAndVariety.recentFollowUpQuestions
      : [],
    10,
  );
  if (!followUpQuestions.length) return [];
  return [
    {
      pageKey: 'reading_memory',
      sectionKey: 'recent_followup_questions',
      title: 'Son takip soruları',
      body: followUpQuestions.join('; '),
      importance: 'high',
      promptUse: 'subtle',
      sourceStrength: 'user_stated',
      sourceRefs: ['recentReadings.followUpQuestions'],
      metadata: { deterministicSeed: true },
    },
  ];
}

function contextHasSemanticEvidence(context: ReturnType<typeof buildMemoryWriterContext>) {
  return !Boolean((context as any).evidenceStatus?.hasOnlyProfileMetadata);
}

function buildDeterministicProfileProposal(context: ReturnType<typeof buildMemoryWriterContext>): MemoryWriterProposal {
  const selectedProfile = (context as any).selectedProfile;
  const relatedProfiles = Array.isArray((context as any).relatedProfiles) ? (context as any).relatedProfiles : [];
  const relationLine = relatedProfiles
    .map((item: any) => `${item.displayName}: ${item.relationshipToSelected || item.relationshipPrimary || 'ilişki belirtilmemiş'} (${item.relationshipTier || 'secondary_relationship_profile'})`)
    .join('; ');
  const proposal: MemoryWriterProposal = {
    profileIdentitySummary: '',
    cavemanBrief: '',
    semanticSections: [],
    personaRelationships: [],
    graphEdges: [],
    repetitionNotes: [],
    dedupeNotes: ['Yalnızca profil metadata bulunduğu için LLM çağrısı yapılmadı; kimlik/persona çıkarımı üretilmedi.'],
    ignoredSignals: ['Doğum tarihi, saat ve yer bilgisi tek başına kullanıcı kişiliği kanıtı sayılmadı.'],
  };
  if (selectedProfile && relatedProfiles.length > 0) {
    proposal.semanticSections = [
      {
        pageKey: 'profiles_and_relationships',
        sectionKey: 'account_profile_map',
        title: 'Profil ilişki haritası',
        body: `${selectedProfile.displayName} seçili profil. Hesaptaki ek profiller: ${relationLine}. Eş, çocuk, evcil hayvan, anne, baba ve kardeş birincil ilişki profili sayılır. Bu bilgi yorumda kişilik çıkarımı yerine ilişki bağlamı olarak kullanılır.`,
        importance: 'high',
        promptUse: 'background_only',
        sourceStrength: 'profile_data',
        sourceRefs: ['account.profiles'],
        metadata: { deterministicSeed: true },
      },
    ];
  }
  return proposal;
}

function buildProfileIdentityPayload(params: {
  state: AccountState;
  profileId: string;
  snippet: ProfileMemorySnippet;
  bundle: ProfileMemoryBundle;
}) {
  const context = buildMemoryWriterContext(params.snippet, params.bundle, params.state, params.profileId);
  const systemText = [
    'Sen FALCI uygulamasının görünmez Memory Writer ajanısın.',
    'Sadece JSON döndür. Kullanıcıya hitap etme, yorum yazma, fal metni üretme.',
    'Her semantic section atomik olsun; dev paragraf yazma. Aynı anlamı iki kez yazma.',
    'Yazma aşamasında hafızayı küçültme; anlamlı kullanıcı/profil sinyali varsa doğru pageKey, sectionKey, sourceStrength ve edge type ile grupla.',
    'Retrieval daha sonra seçim yapacak. Senin işin kanıta dayalı hafızayı doğru raflara yerleştirmek, duplicate ve yanlış çıkarımı önlemek.',
    'Gruplama rehberi: user_overview kimlik özü; profiles_and_relationships kişi/profil ilişkileri; self_knowledge test ve Kendini Tanı özleri; user_preferences açık tercih ve kullanıcı beyanı; persona_relationships kullanıcı-yorumcu etkileşim tarzı; reading_memory okuma kaynaklı ama kesinleştirilmeyen örüntü; repetition_and_variety tekrar/çeşitlilik notları; social_and_sharing paylaşım ve sosyal medya tercihleri; wellness_and_lifestyle yaşam düzeni.',
    'Profil metadata ve deterministik profil ilişki haritası zaten contextte var; bunları semanticSections içinde profile_data olarak tekrar döndürme.',
    'Doğum haritası, numeroloji, MBTI ve test sonuçları user_preferences değildir; self_knowledge altında ve sourceStrength self_knowledge_result olarak gruplanır.',
    'Doğum haritası/test içeriğini birden fazla sectionda tekrar etme; ham gezegen listesini kopyalama, kısa essence çıkar.',
    'user_preferences yalnızca kullanıcının açıkça söylediği tercih, beyan, alışkanlık veya istekler içindir.',
    'evidenceStatus.hasOnlyProfileMetadata true ise kimlik/persona çıkarımı üretme; sadece gerekli ise deterministik profil ilişki bağlamını taşı.',
    'Graph edge sadece context seçmeye yarayan anlamlı ilişkiyi anlatsın. Ham okuma metnini veya uzun geçmişi tekrar etme.',
    'Anlamlı sinyal yoksa boş dizi/boş alanlarla dön. Çok sayıda gerçek sinyal varsa aynı anlamı taşıyanları atomik ve iyi başlıklı semantic section altında birleştir.',
    'JSON shape: profileIdentitySummary, cavemanBrief, semanticSections, personaRelationships, graphEdges, repetitionNotes, dedupeNotes, ignoredSignals.',
  ].join('\n');
  const userText = ['Memory writer context JSON:', JSON.stringify(context, null, 2)].join('\n\n');
  return {
    system_instruction: { parts: [{ text: systemText }] },
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    generationConfig: {
      temperature: 0.18,
      maxOutputTokens: 6000,
      responseMimeType: 'application/json',
    },
  };
}

function looksLikeSelfKnowledgeText(text: string) {
  return /doğum haritası|güneş burcu|yükselen|baskın ev|gezegen|merkür|venüs|mars|jüpiter|satürn|uranüs|neptün|plüton|numeroloji|mbti|kişilik testi/i.test(text);
}

function compactSelfKnowledgeBody(text: string) {
  const raw = String(text || '').replace(/\\n/g, '\n').replace(/\r/g, '').trim();
  const flat = raw.replace(/\s+/g, ' ').trim();
  const labels = [
    'Güneş Burcu',
    'Yükselen',
    'Baskın Ev',
    'Zaman dilimi',
    'MBTI',
    'Numeroloji',
    'Gezegen Konumları',
    'Güneş',
    'Ay',
    'Merkür',
    'Venüs',
    'Mars',
    'Jüpiter',
    'Satürn',
    'Uranüs',
    'Neptün',
    'Plüton',
  ];
  const escapedLabels = labels.map((label) => escapeRegExp(label)).join('|');
  const extract = (label: string) => {
    const escaped = escapeRegExp(label);
    const match = raw.match(new RegExp(`${escaped}\\s*:\\s*([\\s\\S]*?)(?=\\n\\s*(?:${escapedLabels})\\s*:|\\s+(?:${escapedLabels})\\s*:|$)`, 'i'));
    return match?.[1]?.replace(/\s+/g, ' ').trim();
  };
  const cleanValue = (value?: string) => {
    if (!value) return '';
    return value
      .split(/Gezegen Konumları\s*:/i)[0]
      .replace(/\bGüneş\s*:\s*.*$/i, '')
      .replace(/\bAy\s*:\s*.*$/i, '')
      .replace(/[.;,\s]+$/g, '')
      .trim();
  };
  const sun = cleanValue(extract('Güneş Burcu'));
  const rising = cleanValue(extract('Yükselen'));
  const dominantHouse = cleanValue(extract('Baskın Ev'));
  const timezone = cleanValue(extract('Zaman dilimi'));
  const mbti = cleanValue(extract('MBTI'));
  const numerology = cleanValue(extract('Numeroloji'));
  const parts = [
    sun ? `Güneş burcu ${sun}` : '',
    rising ? `yükseleni ${rising}` : '',
    dominantHouse ? `baskın ev ${dominantHouse}` : '',
    timezone ? `zaman dilimi ${timezone}` : '',
    mbti ? `MBTI ${mbti}` : '',
    numerology ? `numeroloji ${numerology}` : '',
  ].filter(Boolean);
  if (parts.length) return parts.join(', ') + '.';
  const withoutPlanetList = flat.split(/Gezegen Konumları\s*:/i)[0].trim();
  const fallback = withoutPlanetList || flat;
  return fallback.length > 240 ? `${fallback.slice(0, 240).trim()}...` : fallback;
}

function normalizeSectionPatch(section: any): MemoryWriterSemanticSectionPatch | null {
  const pageKey = String(section?.pageKey || '').trim();
  const sectionKey = String(section?.sectionKey || '').trim();
  const title = String(section?.title || '').trim();
  const body = String(section?.body || '').trim();
  if (!pageKey || !sectionKey || !title || !body) return null;
  const combined = `${title} ${body}`;
  const isSelfKnowledge = looksLikeSelfKnowledgeText(combined);
  if (
    pageKey === 'profiles_and_relationships' &&
    (sectionKey === 'account_profile_map' || sectionKey === 'prominent_relations')
  ) {
    return null;
  }
  if (pageKey === 'repetition_and_variety') {
    return {
      ...section,
      sectionKey: 'recent_variety_direction',
      title: 'Yakın okumalarda çeşitlilik yönü',
      body,
      sourceStrength: section.sourceStrength || 'session_summary',
      promptUse: section.promptUse || 'subtle',
      metadata: { ...(section.metadata || {}), normalizedRepetitionAndVariety: true },
    };
  }
  if (pageKey === 'user_preferences' && isSelfKnowledge) {
    return {
      ...section,
      pageKey: 'self_knowledge',
      sectionKey: sectionKey === 'user_stated_signals' ? 'self_knowledge_essence' : sectionKey,
      title: title === 'Kullanıcı Tercihleri ve Sinyalleri' ? 'Kendini Tanı özü' : title,
      body: compactSelfKnowledgeBody(body),
      sourceStrength: 'self_knowledge_result',
      promptUse: section.promptUse || 'subtle',
      metadata: { ...(section.metadata || {}), normalizedFromPageKey: pageKey },
    };
  }
  if (pageKey === 'self_knowledge' && isSelfKnowledge) {
    return {
      ...section,
      sectionKey: 'self_knowledge_essence',
      title: 'Kendini Tanı özü',
      body: compactSelfKnowledgeBody(body),
      sourceStrength: 'self_knowledge_result',
      promptUse: section.promptUse || 'subtle',
      metadata: { ...(section.metadata || {}), normalizedSelfKnowledge: true },
    };
  }
  if (pageKey === 'user_overview' && sectionKey === 'profile_basis') {
    return {
      ...section,
      body,
      promptUse: 'never',
      metadata: { ...(section.metadata || {}), duplicateOfDeterministicProfileContext: true },
    };
  }
  return { ...section, body };
}

function isInvalidEdge(edge: any) {
  const from = String(edge?.fromNodeKey || '');
  const to = String(edge?.toNodeKey || '');
  const explanation = String(edge?.explanation || '');
  if (edge?.edgeType === 'related_to_person') {
    return !from.startsWith('profile:') || !to.startsWith('profile:');
  }
  if (to.includes('user_preferences') && looksLikeSelfKnowledgeText(`${from} ${to} ${explanation}`)) {
    return true;
  }
  return false;
}

function mergeSemanticSections(sections: MemoryWriterSemanticSectionPatch[]) {
  const byKey = new Map<string, MemoryWriterSemanticSectionPatch>();
  for (const section of sections) {
    const key = `${section.pageKey}:${section.sectionKey}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, section);
      continue;
    }
    const body = [existing.body, section.body]
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .filter((item, index, all) => all.findIndex((candidate) => candidate.toLocaleLowerCase('tr-TR') === item.toLocaleLowerCase('tr-TR')) === index)
      .join(' ');
    byKey.set(key, {
      ...existing,
      body,
      sourceRefs: uniqueStrings([...(existing.sourceRefs || []), ...(section.sourceRefs || [])], 24),
      metadata: { ...(existing.metadata || {}), ...(section.metadata || {}), mergedDuplicateSection: true },
    });
  }
  return [...byKey.values()];
}

function mergeProposalWithDeterministicContext(
  proposal: MemoryWriterProposal,
  context: ReturnType<typeof buildMemoryWriterContext>,
): MemoryWriterProposal {
  const deterministic = buildDeterministicProfileProposal(context);
  const deterministicSections = deterministic.semanticSections || [];
  const deterministicEdges = deterministic.graphEdges || [];
  const withoutDeterministicSectionDupes = (proposal.semanticSections || []).filter((section) => {
    return !deterministicSections.some((deterministicSection) => deterministicSection.pageKey === section.pageKey && deterministicSection.sectionKey === section.sectionKey);
  });
  return {
    ...proposal,
    semanticSections: mergeSemanticSections([...deterministicSections, ...withoutDeterministicSectionDupes]),
    graphEdges: [
      ...deterministicEdges,
      ...(proposal.graphEdges || []).filter((edge) =>
        !deterministicEdges.some((deterministicEdge) =>
          deterministicEdge.fromNodeKey === edge.fromNodeKey &&
          deterministicEdge.toNodeKey === edge.toNodeKey &&
          deterministicEdge.edgeType === edge.edgeType,
        ),
      ),
    ],
    dedupeNotes: uniqueStrings([
      ...(proposal.dedupeNotes || []),
      ...(deterministicSections.length ? ['Profil ilişki haritası deterministik contextten tekilleştirildi.'] : []),
    ], 8),
  };
}

function normalizeProposal(value: any): MemoryWriterProposal {
  const semanticSections = Array.isArray(value?.semanticSections)
    ? value.semanticSections
        .map(normalizeSectionPatch)
        .filter(Boolean)
        .slice(0, WRITER_OUTPUT_SAFETY_LIMITS.semanticSections)
    : [];
  const rawGraphEdges = Array.isArray(value?.graphEdges) ? value.graphEdges : [];
  const invalidEdges = rawGraphEdges.filter(isInvalidEdge);
  const validGraphEdges = uniqueBy(
    rawGraphEdges.filter((edge: any) => !isInvalidEdge(edge)),
    (edge: any) => `${edge.fromNodeKey}:${edge.edgeType}:${edge.toNodeKey}:${edge.explanation}`,
    WRITER_OUTPUT_SAFETY_LIMITS.graphEdges,
  );
  const proposal: MemoryWriterProposal = {
    profileIdentitySummary: String(value?.profileIdentitySummary || '').trim(),
    cavemanBrief: '',
    semanticSections: mergeSemanticSections(semanticSections as MemoryWriterSemanticSectionPatch[]),
    personaRelationships: Array.isArray(value?.personaRelationships)
      ? value.personaRelationships.slice(0, WRITER_OUTPUT_SAFETY_LIMITS.personaRelationships)
      : [],
    graphEdges: validGraphEdges,
    repetitionNotes: uniqueStrings(Array.isArray(value?.repetitionNotes) ? value.repetitionNotes : [], 8),
    dedupeNotes: uniqueStrings(
      [
        ...(Array.isArray(value?.dedupeNotes) ? value.dedupeNotes : []),
        ...(semanticSections.some((section: any) => section?.metadata?.normalizedFromPageKey)
          ? ['Doğum haritası/test içeriği user_preferences yerine self_knowledge altına taşındı.']
          : []),
      ],
      8,
    ),
    ignoredSignals: uniqueStrings(
      [
        ...(Array.isArray(value?.ignoredSignals) ? value.ignoredSignals : []),
        ...(invalidEdges.length ? ['Hatalı veya yanlış rafa bağlanan graph edge önerileri uygulanmadı.'] : []),
      ],
      8,
    ),
  };
  return proposal;
}

async function upsertJob(job: MemoryWriterDebugJob) {
  const store = await readStore();
  await writeStore({
    schemaVersion: 1,
    jobs: [job, ...store.jobs.filter((item) => item.jobId !== job.jobId)],
  });
}

export async function createProfileIdentityMemoryWriterDraft(profileId: string): Promise<MemoryWriterDebugJob> {
  const state = await loadAccountState();
  const profile = state.profiles.find((item) => item.profileId === profileId);
  if (!profile) throw new Error('Profil bulunamadı.');
  const [snippet, bundle] = await Promise.all([
    loadProfileMemorySnippet(state, profileId),
    loadProfileMemoryBundle(state, profileId),
  ]);
  if (!snippet || !bundle) throw new Error('Profil hafızası bulunamadı.');
  const payload = buildProfileIdentityPayload({ state, profileId, snippet, bundle });
  const now = nowIso();
  const job: MemoryWriterDebugJob = {
    jobId: makeJobId(),
    profileId,
    profileName: profile.displayName,
    kind: 'profile_identity_refresh',
    status: 'draft',
    provider: 'gemini',
    modelName: 'gemini-2.5-flash-lite',
    prompt: promptTextFromGeminiPayload(payload),
    createdAt: now,
    updatedAt: now,
  };
  await upsertJob(job);
  return job;
}

export async function runProfileIdentityMemoryWriter(profileId: string): Promise<MemoryWriterDebugJob> {
  const state = await loadAccountState();
  const profile = state.profiles.find((item) => item.profileId === profileId);
  if (!profile) throw new Error('Profil bulunamadı.');
  const [snippet, bundle] = await Promise.all([
    loadProfileMemorySnippet(state, profileId),
    loadProfileMemoryBundle(state, profileId),
  ]);
  if (!snippet || !bundle) throw new Error('Profil hafızası bulunamadı.');
  const payload = buildProfileIdentityPayload({ state, profileId, snippet, bundle });
  const context = buildMemoryWriterContext(snippet, bundle, state, profileId);
  const now = nowIso();
  let job: MemoryWriterDebugJob = {
    jobId: makeJobId(),
    profileId,
    profileName: profile.displayName,
    kind: 'profile_identity_refresh',
    status: 'running',
    provider: 'gemini',
    modelName: 'gemini-2.5-flash-lite',
    prompt: promptTextFromGeminiPayload(payload),
    createdAt: now,
    updatedAt: now,
  };
  await upsertJob(job);

  if (!contextHasSemanticEvidence(context)) {
    const proposal = buildDeterministicProfileProposal(context);
    job = {
      ...job,
      status: 'skipped',
      rawResponse: JSON.stringify(proposal, null, 2),
      proposal,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      updatedAt: nowIso(),
    };
    await upsertJob(job);
    return job;
  }

  try {
    const response = await generateGeminiTextDirect(payload, 90000, { usageMode: 'raw' });
    const parsed = JSON.parse(stripJsonFence(response.text));
    const proposal = mergeProposalWithDeterministicContext(normalizeProposal(parsed), context);
    job = {
      ...job,
      status: 'succeeded',
      modelName: response.model || job.modelName,
      rawResponse: response.text,
      proposal,
      usage: response.usage,
      updatedAt: nowIso(),
    };
    await addPersonalTokenUsage({
      modelName: job.modelName,
      readingName: 'Memory Writer Debug',
      textInputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      rawPromptTokens: response.usage.inputTokens,
      rawOutputTokens: response.usage.outputTokens,
      rawTotalTokens: response.usage.totalTokens,
    }).catch(() => {});
    await upsertJob(job);
    return job;
  } catch (error: any) {
    job = {
      ...job,
      status: 'failed',
      error: error?.message || 'Memory Writer çağrısı başarısız oldu.',
      updatedAt: nowIso(),
    };
    await upsertJob(job);
    return job;
  }
}

export async function runAndApplyProfileIdentityMemoryWriter(profileId: string): Promise<{
  status: 'applied' | 'skipped' | 'failed';
  modelName?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  error?: string;
}> {
  const state = await loadAccountState();
  const profile = state.profiles.find((item) => item.profileId === profileId);
  if (!profile) return { status: 'failed', error: 'Profil bulunamadı.' };
  const [snippet, bundle] = await Promise.all([
    loadProfileMemorySnippet(state, profileId),
    loadProfileMemoryBundle(state, profileId),
  ]);
  if (!snippet || !bundle) return { status: 'failed', error: 'Profil hafızası bulunamadı.' };
  const payload = buildProfileIdentityPayload({ state, profileId, snippet, bundle });
  const context = buildMemoryWriterContext(snippet, bundle, state, profileId);

  try {
    if (!contextHasSemanticEvidence(context)) {
      const proposal = buildDeterministicProfileProposal(context);
      await applyMemoryWriterProposal(profileId, proposal);
      return { status: 'skipped', modelName: 'deterministic-memory-writer' };
    }

    const response = await generateGeminiTextDirect(payload, 90000, { usageMode: 'raw' });
    const parsed = JSON.parse(stripJsonFence(response.text));
    const proposal = mergeProposalWithDeterministicContext(normalizeProposal(parsed), context);
    await applyMemoryWriterProposal(profileId, proposal);
    await addPersonalTokenUsage({
      modelName: response.model || 'gemini-2.5-flash-lite',
      readingName: 'Günlük Hafıza Bakımı',
      textInputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      rawPromptTokens: response.usage.inputTokens,
      rawOutputTokens: response.usage.outputTokens,
      rawTotalTokens: response.usage.totalTokens,
    }).catch(() => {});
    return {
      status: 'applied',
      modelName: response.model || 'gemini-2.5-flash-lite',
      usage: response.usage,
    };
  } catch (error: any) {
    return { status: 'failed', error: error?.message || 'Memory Writer çağrısı başarısız oldu.' };
  }
}

export async function applyMemoryWriterDebugJob(jobId: string): Promise<MemoryWriterDebugJob | null> {
  const store = await readStore();
  const job = store.jobs.find((item) => item.jobId === jobId);
  if (!job?.proposal) return job || null;
  await applyMemoryWriterProposal(job.profileId, job.proposal);
  const next = { ...job, status: 'applied' as const, updatedAt: nowIso() };
  await upsertJob(next);
  return next;
}
