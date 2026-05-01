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

export interface AssistantBondMemory {
  bondScore: number;
  notes: string[];
}

export interface BaseProfileMemoryFile {
  profileId: string;
  accountId: string;
  recurringTopics: ProfileTopicMemory[];
  importantPeople: ProfilePersonMemory[];
  emotionalPatterns: ProfilePatternMemory[];
  assistantAffinity: Record<string, AssistantBondMemory>;
  updatedAt: string;
}

export interface UserStatedMemoryFile extends BaseProfileMemoryFile {
  source: 'user-stated';
}

export interface ReadingDerivedMemoryFile extends BaseProfileMemoryFile {
  source: 'reading-derived';
}

export interface ProfileMemoryBundle {
  userStated: UserStatedMemoryFile;
  readingDerived: ReadingDerivedMemoryFile;
}

export interface ReadingSummary {
  readingId: string;
  accountId: string;
  profileId: string;
  assistantId: string;
  readingType: 'coffee' | 'palm' | 'personal-astro' | 'personal-numerology' | 'birth-chart';
  period?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  coffeeMode?: 'upload' | 'ai-brew';
  surfacesRead: ReadingSurface[];
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
}
