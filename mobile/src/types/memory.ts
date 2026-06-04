export type RelationshipPrimary =
  | 'kendi'
  | 'es'
  | 'sevgili'
  | 'eski_sevgili'
  | 'sevgili_adayi'
  | 'anne'
  | 'baba'
  | 'kardes'
  | 'cocuk'
  | 'arkadas'
  | 'evcil_hayvan'
  | 'akraba'
  | 'diger';

export type RelationshipRelativeDetail =
  | 'teyze'
  | 'dayi'
  | 'hala'
  | 'amca'
  | 'kuzen'
  | 'dede'
  | 'nine'
  | 'anneanne'
  | 'babaanne'
  | 'torun'
  | 'yegen'
  | 'diger_akraba';

export type ProfileGender = 'kadin' | 'erkek' | 'hicbiri' | 'belirtmek_istemiyorum';

export type ChartPrecision = 'unknown' | 'date_only' | 'date_plus_place' | 'full';
export type ReadingSurface = 'cup' | 'saucer' | 'palm';

export interface BirthLocation {
  country: string | null;
  cityOrRegion: string | null;
  district: string | null;
  subdistrict: string | null;
  freeform: string | null;
}

export interface BirthInfo {
  date: string | null;
  time: string | null;
  timeKnown: boolean;
  location: BirthLocation;
}

export interface SubjectProfile {
  profileId: string;
  accountId: string;
  isPrimary: boolean;
  displayName: string;
  relationshipPrimary: RelationshipPrimary;
  relationshipDetail: RelationshipRelativeDetail | null;
  relationshipFreeform: string | null;
  gender: ProfileGender | null;
  birth: BirthInfo;
  chartPrecision: ChartPrecision;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileTopicMemory {
  key: string;
  label: string;
  group?: string;
  subgroup?: string;
  detailGroup?: string;
  salience: number;
  lastSeenAt: string;
}

export interface ProfilePersonMemory {
  id: string;
  label: string;
  relationship: string;
  salience: number;
}

export interface ProfilePatternMemory {
  key: string;
  label: string;
  confidence: number;
}

export type MemoryObservationKind =
  | 'event'
  | 'fact'
  | 'person'
  | 'emotion'
  | 'state'
  | 'question'
  | 'decision'
  | 'environment';

export interface MemoryObservationEntity {
  label: string;
  type: 'person' | 'place' | 'work' | 'family' | 'body' | 'money' | 'concept' | 'environment' | 'other';
  relationshipHint?: string;
  profileId?: string;
  relationship?: string;
  gender?: ProfileGender | null;
}

export interface MemoryObservationRelation {
  from: string;
  to: string;
  type: 'causes' | 'relates_to' | 'conflicts_with' | 'supports' | 'follows' | 'blocks' | 'affects' | 'mentions';
  summary: string;
  confidence: number;
}

export interface MemoryCategoryCandidate {
  key: string;
  group: string;
  subgroup: string;
  reason: string;
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
  confidence: number;
}

export type MemorySourceType = 'user_input' | 'reading_output' | 'profile_edit' | 'test_result' | 'system';
export type MemoryVisibility = 'user_visible' | 'internal' | 'debug_only';
export type MemoryPromptUse = 'core' | 'subtle' | 'avoid' | 'never' | 'background_only';
export type MemoryEdgeType =
  | 'confirmed_by_user'
  | 'corrected_by_user'
  | 'derived_from_reading'
  | 'derived_from_test'
  | 'related_to_person'
  | 'affects_tone'
  | 'affects_topic_selection'
  | 'avoid_repeating'
  | 'safe_to_hint'
  | 'do_not_surface'
  | 'supports'
  | 'contradicts'
  | 'part_of'
  | 'updated_by';

export interface MemoryObservation {
  id: string;
  key: string;
  source: 'user-stated' | 'reading-derived';
  sourceType?: MemorySourceType;
  visibility?: MemoryVisibility;
  promptUse?: MemoryPromptUse;
  sourceReadingId?: string;
  sourceRawId?: string;
  category: string;
  group: string;
  subgroup: string;
  detailGroup?: string;
  suggestedCategory?: {
    group: string;
    subgroup: string;
    reason?: string;
  };
  kind: MemoryObservationKind;
  title: string;
  summary: string;
  entities: MemoryObservationEntity[];
  entityRelations: MemoryObservationRelation[];
  emotions: string[];
  timeText?: string | null;
  placeText?: string | null;
  mentionedAt: string;
  lastSeenAt: string;
  confidence: number;
}

export interface AssistantBondMemory {
  bondScore: number;
  notes: string[];
}

export interface UsedSpecificityEventMemory {
  group: string;
  label: string;
  usedAt: string;
  count: number;
}

export interface UsedSurfaceCueMemory {
  cue: string;
  usedAt: string;
  count: number;
}

export interface BaseProfileMemoryFile {
  profileId: string;
  accountId: string;
  recurringTopics: ProfileTopicMemory[];
  importantPeople: ProfilePersonMemory[];
  emotionalPatterns: ProfilePatternMemory[];
  observations: MemoryObservation[];
  categoryCandidates: MemoryCategoryCandidate[];
  assistantAffinity: Record<string, AssistantBondMemory>;
  updatedAt: string;
}

export interface UserStatedMemoryFile extends BaseProfileMemoryFile {
  source: 'user-stated';
}

export interface ReadingDerivedMemoryFile extends BaseProfileMemoryFile {
  source: 'reading-derived';
  usedLifeEvents?: UsedSpecificityEventMemory[];
  usedSurfaceCues?: UsedSurfaceCueMemory[];
}

export interface ProfileMemoryBundle {
  userStated: UserStatedMemoryFile;
  readingDerived: ReadingDerivedMemoryFile;
  rawArchive?: RawArchiveEntry[];
  sourceChunks?: SourceChunk[];
  sessionJournals?: SessionJournalEntry[];
  readingFingerprints?: ReadingFingerprint[];
  memoryEdges?: MemoryEdge[];
  userSemanticWiki?: UserSemanticWikiFile;
  personaRelationships?: PersonaUserRelationshipMemory[];
  promptAudits?: MemoryPromptAuditEntry[];
}

export interface RawArchiveEntry {
  rawId: string;
  accountId: string;
  profileId: string;
  readingId?: string;
  sourceType: MemorySourceType;
  createdAt: string;
  text: string;
  metadata: Record<string, unknown>;
}

export interface SessionJournalEntry {
  journalId: string;
  accountId: string;
  profileId: string;
  readingId?: string;
  assistantId?: string;
  readingType?: ReadingSummary['readingType'];
  createdAt: string;
  summary: string;
  events: string[];
  memoryActions: string[];
}

export type SemanticWikiScope = 'user_memory' | 'lore';
export type SemanticWikiPageKey =
  | 'user_overview'
  | 'profiles_and_relationships'
  | 'self_knowledge'
  | 'user_preferences'
  | 'persona_relationships'
  | 'reading_memory'
  | 'repetition_and_variety'
  | 'social_and_sharing'
  | 'wellness_and_lifestyle';

export interface SemanticWikiSection {
  sectionId: string;
  pageKey: SemanticWikiPageKey;
  sectionKey: string;
  title: string;
  body: string;
  importance: 'low' | 'medium' | 'high' | 'core';
  promptUse: MemoryPromptUse;
  sourceStrength:
    | 'user_corrected'
    | 'user_stated'
    | 'profile_data'
    | 'self_knowledge_result'
    | 'behavior_observed'
    | 'session_summary'
    | 'reading_derived'
    | 'system_inferred';
  sourceRefs: string[];
  embeddingRef?: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface UserSemanticWikiFile {
  accountId: string;
  profileId: string;
  scope: 'user_memory';
  sections: SemanticWikiSection[];
  updatedAt: string;
}

export interface PersonaUserRelationshipMemory {
  relationshipId: string;
  accountId: string;
  profileId: string;
  personaId: string;
  domain?: string;
  summary: string;
  worksWellFor: string[];
  wantsLessOf: string[];
  wantsMoreOf: string[];
  trustScore: number;
  sourceRefs: string[];
  embeddingRef?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryWriterSemanticSectionPatch {
  pageKey: SemanticWikiPageKey;
  sectionKey: string;
  title: string;
  body: string;
  importance: SemanticWikiSection['importance'];
  promptUse: MemoryPromptUse;
  sourceStrength: SemanticWikiSection['sourceStrength'];
  sourceRefs?: string[];
  metadata?: Record<string, unknown>;
}

export interface SourceChunk {
  chunkId: string;
  rawId: string;
  accountId: string;
  profileId: string;
  readingId?: string;
  sourceType: MemorySourceType;
  chunkIndex: number;
  text: string;
  tokens: string[];
  createdAt: string;
}

export interface MemoryWriterPersonaRelationshipPatch {
  personaId: string;
  domain?: string;
  summary: string;
  worksWellFor?: string[];
  wantsLessOf?: string[];
  wantsMoreOf?: string[];
  trustScore?: number;
  sourceRefs?: string[];
}

export interface MemoryWriterEdgePatch {
  fromNodeKey: string;
  toNodeKey: string;
  edgeType: MemoryEdgeType;
  explanation: string;
  confidence?: number;
  sourceReadingId?: string;
  sourceRawId?: string;
}

export interface MemoryWriterProposal {
  profileIdentitySummary?: string;
  cavemanBrief?: string;
  semanticSections?: MemoryWriterSemanticSectionPatch[];
  personaRelationships?: MemoryWriterPersonaRelationshipPatch[];
  graphEdges?: MemoryWriterEdgePatch[];
  repetitionNotes?: string[];
  dedupeNotes?: string[];
  ignoredSignals?: string[];
}

export interface MemoryEdge {
  edgeId: string;
  accountId: string;
  profileId: string;
  fromNodeKey: string;
  toNodeKey: string;
  edgeType: MemoryEdgeType;
  explanation: string;
  confidence: number;
  sourceReadingId?: string;
  sourceRawId?: string;
  createdAt: string;
}

export interface LoreNode {
  loreId: string;
  personaId?: string;
  type:
    | 'persona_trait'
    | 'domain_rule'
    | 'tone_rule'
    | 'family_lore'
    | 'policy'
    | 'social_post'
    | 'developer_note'
    | 'section_lore'
    | 'ritual'
    | 'recipe'
    | 'content_theme'
    | 'brand_rule'
    | 'canonical_fact'
    | 'event_source'
    | 'trend';
  title: string;
  summary: string;
  sourceText?: string;
  sourceUrl?: string;
  validFrom?: string;
  validTo?: string;
  metadata: Record<string, unknown>;
}

export interface LoreEdge {
  edgeId: string;
  fromLoreId: string;
  toLoreId: string;
  edgeType: 'supports' | 'contradicts' | 'part_of' | 'related_to' | 'affects_tone';
  explanation: string;
}

export interface LoreGraph {
  nodes: LoreNode[];
  edges: LoreEdge[];
  updatedAt: string;
}

export interface ReadingFingerprint {
  fingerprintId: string;
  accountId: string;
  profileId: string;
  readingId: string;
  assistantId: string;
  readingType: ReadingSummary['readingType'];
  createdAt: string;
  themes: string[];
  symbols: string[];
  phrasesToAvoid: string[];
  emotionalArc?: string;
  nextAngleSuggestion?: string;
}

export interface PromptMemoryPack {
  profileEssence: string[];
  relevantPatterns: string[];
  avoidRepetition: string[];
  toneRules: string[];
  cavemanBrief?: string;
  semanticSelection?: {
    use: string[];
    background: string[];
    avoidRepeat: string[];
    userOverride: string[];
    excluded: string[];
    modelName?: string;
  };
  semanticBriefs?: {
    profileContext: string[];
    userMemory: string[];
    selfKnowledge: string[];
    personaRelationship: string[];
    repetitionAndVariety: string[];
  };
  debug?: {
    recentFingerprintIds: string[];
    selectedChunkIds?: string[];
    selectedLoreIds?: string[];
  };
}

export interface MemoryPromptAuditEntry {
  auditId: string;
  profileId: string;
  createdAt: string;
  semanticQuery?: string;
  retrievalMode: 'none' | 'semantic' | 'token-overlap';
  selectedObservationIds: string[];
  selectedFingerprintIds: string[];
  selectedLoreIds: string[];
  selectedChunkIds?: string[];
  embeddingRetrieval?: {
    modelName: string;
    query: string;
    matches: Array<{
      sourceTable: string;
      sourceId: string;
      score: number;
      promptUse: 'semantic_memory' | 'raw_archive_evidence' | 'not_used';
      label: string;
      reason: string;
    }>;
  };
  semanticSelector?: {
    modelName?: string;
    candidateCount: number;
    candidates: Array<{
      id: string;
      kind: string;
      source: string;
      score: number;
      text: string;
    }>;
    use: string[];
    background: string[];
    avoidRepeat: string[];
    userOverride: string[];
    excluded: string[];
    fallback: boolean;
  };
  reasons: string[];
}

export interface ReadingSummary {
  readingId: string;
  accountId: string;
  profileId: string;
  assistantId: string;
  readingType:
    | 'coffee'
    | 'palm'
    | 'personal-astro'
    | 'personal-numerology'
    | 'birth-chart'
    | 'dream-interpretation'
    | 'personal-tarot'
    | 'personality-test'
    | 'general-astro'
    | 'astro-compatibility'
    | 'astro-family';
  period?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  astroFocusQuestion?: string;
  astroRelationship?: {
    mode: 'compatibility' | 'family';
    context?: string | null;
    subjects: Array<{
      profileId?: string | null;
      displayName: string;
      relationshipLabel?: string | null;
      isPet?: boolean;
    }>;
  };
  coffeeMode?: 'upload' | 'ai-brew';
  surfacesRead: ReadingSurface[];
  tarotSpread?: {
    spreadId: string;
    spreadName: string;
    deckId?: string;
    deckName?: string;
    cards: Array<{
      positionNo: number;
      positionTitle: string;
      cardName: string;
      cardNameTr: string;
      orientation: 'upright' | 'reversed';
    }>;
  };
  testResult?: {
    testId: string;
    testName: string;
    resultCode: string;
    resultTitle: string;
    dimensions?: Record<string, string | number>;
  };
  createdAt: string;
  summary: string;
  transcript?: Array<{
    role: 'user' | 'assistant';
    text: string;
    timestamp?: number;
  }>;
}

export interface AccountState {
  accountId: string;
  primaryProfileId: string | null;
  profiles: SubjectProfile[];
  readings: ReadingSummary[];
}

export interface ProfileMemorySnippet {
  profileName: string;
  isSelf: boolean;
  relationshipLabel: string;
  relationshipPrimary: RelationshipPrimary;
  profileGender: ProfileGender | null;
  petSpecies: string | null;
  chartPrecision: ChartPrecision;
  profileInfo: {
    profileId: string;
    displayName: string;
    isAccountOwner: boolean;
    relationshipToAccountOwner: string;
    gender: ProfileGender | null;
    createdAt: string;
    updatedAt: string;
  };
  accountOwnerProfile: {
    profileId: string;
    displayName: string;
  } | null;
  birthChartData: {
    birthDate: string | null;
    birthTime: string | null;
    timeKnown: boolean;
    country: string | null;
    cityOrRegion: string | null;
    district: string | null;
    subdistrict: string | null;
    freeformLocation: string | null;
    chartPrecision: ChartPrecision;
    hasBirthDate: boolean;
    hasBirthPlace: boolean;
    hasExactBirthTime: boolean;
  };
  prominentRelations: Array<{
    id: string;
    label: string;
    relationship: string;
    salience: number;
  }>;
  userStatedTopics: string[];
  userTopicGroups: Array<{
    key: string;
    label: string;
    group: string;
    subgroup: string;
    detailGroup: string;
    salience: number;
  }>;
  userStatedPeople: string[];
  userStatedPatterns: string[];
  userObservations: MemoryObservation[];
  userCategoryCandidates: MemoryCategoryCandidate[];
  readingTopics: string[];
  readingTopicGroups: Array<{
    key: string;
    label: string;
    group: string;
    subgroup: string;
    detailGroup: string;
    salience: number;
  }>;
  readingPeople: string[];
  readingPatterns: string[];
  readingObservations: MemoryObservation[];
  readingCategoryCandidates: MemoryCategoryCandidate[];
  usedLifeEvents?: UsedSpecificityEventMemory[];
  usedSurfaceCues?: UsedSurfaceCueMemory[];
  recentFingerprints?: ReadingFingerprint[];
  userSemanticWiki?: UserSemanticWikiFile;
  personaRelationships?: PersonaUserRelationshipMemory[];
  promptMemoryPack?: PromptMemoryPack;
  selectedLoreCrumbs?: string[];
  selectedSourceChunks?: SourceChunk[];
  relevantObservations: MemoryObservation[];
}
