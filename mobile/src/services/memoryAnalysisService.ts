import type {
  MemoryCategoryCandidate,
  MemoryEdge,
  MemoryObservation,
  MemoryPromptUse,
  MemorySourceType,
  MemoryVisibility,
  ProfileMemorySnippet,
  ReadingFingerprint,
} from '../types/memory';
import { generateGeminiTextDirect } from './geminiDirectService';

export interface MemoryAnalysisTranscriptEntry {
  role: 'user' | 'assistant';
  text: string;
  timestamp?: number;
}

export interface MemoryAnalysisItem {
  key: string;
  label: string;
  relationship?: string;
  salience?: number;
  confidence?: number;
}

export interface MemoryAnalysisResult {
  userStated: {
    recurringTopics: MemoryAnalysisItem[];
    importantPeople: MemoryAnalysisItem[];
    emotionalPatterns: MemoryAnalysisItem[];
    observations: MemoryObservation[];
    categoryCandidates: MemoryCategoryCandidate[];
  };
  readingDerived: {
    recurringTopics: MemoryAnalysisItem[];
    importantPeople: MemoryAnalysisItem[];
    emotionalPatterns: MemoryAnalysisItem[];
    observations: MemoryObservation[];
    categoryCandidates: MemoryCategoryCandidate[];
  };
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  v2: {
    journalEvents: string[];
    memoryActions: string[];
    fingerprintPatch: Partial<Pick<ReadingFingerprint, 'themes' | 'symbols' | 'phrasesToAvoid' | 'emotionalArc' | 'nextAngleSuggestion'>>;
    edges: Partial<MemoryEdge>[];
  };
}

interface MemoryAnalysisRequest {
  profileName: string;
  profileId: string;
  readingType: 'coffee' | 'palm' | 'personal-astro' | 'personal-numerology' | 'birth-chart' | string;
  memorySnippet?: ProfileMemorySnippet | null;
  transcript: MemoryAnalysisTranscriptEntry[];
}

function emptyResult(usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }): MemoryAnalysisResult {
  return {
    userStated: {
      recurringTopics: [],
      importantPeople: [],
      emotionalPatterns: [],
      observations: [],
      categoryCandidates: [],
    },
    readingDerived: {
      recurringTopics: [],
      importantPeople: [],
      emotionalPatterns: [],
      observations: [],
      categoryCandidates: [],
    },
    usage,
    v2: {
      journalEvents: [],
      memoryActions: [],
      fingerprintPatch: {},
      edges: [],
    },
  };
}

function stripJsonFence(text: string) {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function asArray<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function normalizeItem(item: Partial<MemoryAnalysisItem>): MemoryAnalysisItem | null {
  const key = String(item.key || '').trim();
  const label = String(item.label || '').trim();
  if (!key || !label) return null;
  return {
    key,
    label,
    relationship: item.relationship ? String(item.relationship) : undefined,
    salience: typeof item.salience === 'number' ? Math.max(0, Math.min(1, item.salience)) : undefined,
    confidence: typeof item.confidence === 'number' ? Math.max(0, Math.min(1, item.confidence)) : undefined,
  };
}

function normalizeSourceType(value: unknown, fallback: MemorySourceType): MemorySourceType {
  return value === 'user_input' ||
    value === 'reading_output' ||
    value === 'profile_edit' ||
    value === 'test_result' ||
    value === 'system'
    ? value
    : fallback;
}

function normalizeVisibility(value: unknown, fallback: MemoryVisibility): MemoryVisibility {
  return value === 'user_visible' || value === 'internal' || value === 'debug_only' ? value : fallback;
}

function normalizePromptUse(value: unknown, fallback: MemoryPromptUse): MemoryPromptUse {
  return value === 'core' || value === 'subtle' || value === 'avoid' || value === 'never' ? value : fallback;
}

function normalizeItems(items: Partial<MemoryAnalysisItem>[] | undefined) {
  return asArray(items).map(normalizeItem).filter(Boolean) as MemoryAnalysisItem[];
}

function normalizeObservation(
  item: Partial<MemoryObservation>,
  fallback: { sourceType: MemorySourceType; visibility: MemoryVisibility; promptUse: MemoryPromptUse },
): MemoryObservation | null {
  const title = String(item.title || '').trim();
  const summary = String(item.summary || '').trim();
  if (!title || !summary) return null;
  return {
    ...item,
    title,
    summary,
    key: String(item.key || title).trim(),
    group: String(item.group || item.category || 'Genel').trim(),
    subgroup: String(item.subgroup || 'Diğer konuşulanlar').trim(),
    category: String(item.category || item.group || 'Genel').trim(),
    sourceType: normalizeSourceType(item.sourceType, fallback.sourceType),
    visibility: normalizeVisibility(item.visibility, fallback.visibility),
    promptUse: normalizePromptUse(item.promptUse, fallback.promptUse),
    sourceReadingId: item.sourceReadingId ? String(item.sourceReadingId) : undefined,
    sourceRawId: item.sourceRawId ? String(item.sourceRawId) : undefined,
    emotions: Array.isArray(item.emotions) ? item.emotions.map(String).slice(0, 4) : [],
    confidence: typeof item.confidence === 'number' ? Math.max(0, Math.min(1, item.confidence)) : 0.62,
  } as MemoryObservation;
}

function normalizeCandidates(items: Partial<MemoryCategoryCandidate>[] | undefined) {
  return asArray(items)
    .map((item: Partial<MemoryCategoryCandidate> & { label?: string; score?: number }) => {
      const group = String(item.group || 'Genel').trim();
      const subgroup = String(item.subgroup || item.label || 'Diğer konuşulanlar').trim();
      const reason = String(item.reason || item.label || subgroup).trim();
      if (!subgroup || !reason) return null;
      return {
        key: String(item.key || `${group}:${subgroup}`).trim(),
        group,
        subgroup,
        reason,
        count: typeof item.count === 'number' ? Math.max(1, Math.round(item.count)) : 1,
        firstSeenAt: item.firstSeenAt || new Date().toISOString(),
        lastSeenAt: item.lastSeenAt || new Date().toISOString(),
        confidence: typeof item.confidence === 'number'
          ? Math.max(0, Math.min(1, item.confidence))
          : typeof item.score === 'number'
            ? Math.max(0, Math.min(1, item.score))
            : 0.5,
      } as MemoryCategoryCandidate;
    })
    .filter(Boolean) as MemoryCategoryCandidate[];
}

function normalizeSection(
  section: any,
  fallback: { sourceType: MemorySourceType; visibility: MemoryVisibility; promptUse: MemoryPromptUse },
) {
  return {
    recurringTopics: normalizeItems(section?.recurringTopics),
    importantPeople: normalizeItems(section?.importantPeople),
    emotionalPatterns: normalizeItems(section?.emotionalPatterns),
    observations: asArray<Partial<MemoryObservation>>(section?.observations)
      .map((item) => normalizeObservation(item, fallback))
      .filter(Boolean) as MemoryObservation[],
    categoryCandidates: normalizeCandidates(section?.categoryCandidates),
  };
}

function normalizeStringList(value: unknown, limit: number) {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, limit)
    : [];
}

function normalizeEdges(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((item: Partial<MemoryEdge>) => {
          const fromNodeKey = String(item.fromNodeKey || '').trim();
          const toNodeKey = String(item.toNodeKey || '').trim();
          const edgeType = String(item.edgeType || '').trim() as MemoryEdge['edgeType'];
          const explanation = String(item.explanation || '').trim();
          if (!fromNodeKey || !toNodeKey || !edgeType || !explanation) return null;
          return {
            fromNodeKey,
            toNodeKey,
            edgeType,
            explanation,
            confidence: typeof item.confidence === 'number' ? Math.max(0, Math.min(1, item.confidence)) : 0.68,
            sourceReadingId: item.sourceReadingId ? String(item.sourceReadingId) : undefined,
            sourceRawId: item.sourceRawId ? String(item.sourceRawId) : undefined,
          } as Partial<MemoryEdge>;
        })
        .filter(Boolean) as Partial<MemoryEdge>[]
    : [];
}

function buildMemoryPayload(body: MemoryAnalysisRequest) {
  const systemText = [
    'Sen mobil cihaz içinde çalışan bir hafıza analizcisisin.',
    'Sadece verilen konuşmadan çıkarım yap; yeni okuma yorumu yazma.',
    'Kısa, güvenli ve yapılandırılmış JSON döndür. Markdown kullanma.',
  ].join(' ');
  const userText = [
    `Profil: ${body.profileName}`,
    `Profil id: ${body.profileId}`,
    `Okuma türü: ${body.readingType}`,
    body.memorySnippet ? `Mevcut hafıza özeti JSON:\n${JSON.stringify(body.memorySnippet)}` : '',
    `Konuşma JSON:\n${JSON.stringify(body.transcript.slice(-12))}`,
    [
      'Şu JSON şemasına birebir uy:',
      '{"userStated":{"recurringTopics":[],"importantPeople":[],"emotionalPatterns":[],"observations":[],"categoryCandidates":[]},"readingDerived":{"recurringTopics":[],"importantPeople":[],"emotionalPatterns":[],"observations":[],"categoryCandidates":[]},"v2":{"journalEvents":[],"memoryActions":[],"fingerprintPatch":{"themes":[],"symbols":[],"phrasesToAvoid":[],"emotionalArc":"","nextAngleSuggestion":""},"edges":[]}}',
      'userStated yalnızca kullanıcının doğrudan söylediği bilgileri içersin.',
      'readingDerived yalnızca okuma/yorum metninden çıkan tekrar edilebilir temaları içersin.',
      'Observation nesnelerine sourceType, visibility ve promptUse koy. Kullanıcı onayı/düzeltmesi varsa sourceType=user_input, visibility=internal, promptUse=subtle/core olabilir.',
      'Falcının tahmininden çıkan observation için sourceType=reading_output, visibility=internal, promptUse=subtle veya avoid kullan; gerçek hayat bilgisi gibi kesinleştirme.',
      'edges içinde confirmed_by_user, corrected_by_user, derived_from_reading, related_to_person, affects_tone, avoid_repeating gibi typed edge üret; emin değilsen boş bırak.',
      'journalEvents bu oturumda ne olduğunun kısa iç zaman çizgisi olsun. fingerprintPatch tekrar edilmemesi gereken tema/sembol/kalıpları içersin.',
      'Her listeyi en fazla 4 öğe ile sınırla. Emin değilsen boş liste döndür.',
    ].join('\n'),
  ].filter(Boolean).join('\n\n');

  return {
    system_instruction: { parts: [{ text: systemText }] },
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 900,
      responseMimeType: 'application/json',
    },
  };
}

export async function analyzeMemoryTranscript(body: MemoryAnalysisRequest): Promise<MemoryAnalysisResult> {
  const data = await generateGeminiTextDirect(buildMemoryPayload(body), 45000);
  try {
    const parsed = JSON.parse(stripJsonFence(data.text));
    return {
      userStated: normalizeSection(parsed.userStated, {
        sourceType: 'user_input',
        visibility: 'internal',
        promptUse: 'subtle',
      }),
      readingDerived: normalizeSection(parsed.readingDerived, {
        sourceType: 'reading_output',
        visibility: 'internal',
        promptUse: 'subtle',
      }),
      usage: data.usage,
      v2: {
        journalEvents: normalizeStringList(parsed.v2?.journalEvents, 6),
        memoryActions: normalizeStringList(parsed.v2?.memoryActions, 6),
        fingerprintPatch: {
          themes: normalizeStringList(parsed.v2?.fingerprintPatch?.themes, 6),
          symbols: normalizeStringList(parsed.v2?.fingerprintPatch?.symbols, 8),
          phrasesToAvoid: normalizeStringList(parsed.v2?.fingerprintPatch?.phrasesToAvoid, 8),
          emotionalArc: String(parsed.v2?.fingerprintPatch?.emotionalArc || '').trim() || undefined,
          nextAngleSuggestion: String(parsed.v2?.fingerprintPatch?.nextAngleSuggestion || '').trim() || undefined,
        },
        edges: normalizeEdges(parsed.v2?.edges).slice(0, 8),
      },
    };
  } catch {
    return emptyResult(data.usage);
  }
}
