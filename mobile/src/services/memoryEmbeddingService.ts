import type { MemoryObservation, RawArchiveEntry, SemanticWikiSection } from '../types/memory';
import { embedGeminiText, GEMINI_EMBEDDING_MODEL, stableTextHash } from './geminiEmbeddingService';
import {
  getMemoryEmbeddingsForProfile,
  type MemoryEmbeddingEntry,
  upsertMemoryEmbedding,
} from './memorySqliteService';
import { addPersonalTokenUsage } from './tokenLedgerService';

export type MemoryEmbeddingMatch = MemoryEmbeddingEntry & { score: number };

const MIN_QUERY_SCORE = 0.46;

function compactEmbeddingText(text: string, limit = 1800) {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

function observationEmbeddingText(item: MemoryObservation) {
  return compactEmbeddingText(
    [
      item.title,
      item.summary,
      item.category,
      item.group,
      item.subgroup,
      item.detailGroup,
      item.entities?.map((entity) => entity.label).join(', '),
    ].filter(Boolean).join('\n'),
  );
}

function rawArchiveEmbeddingText(item: RawArchiveEntry) {
  return compactEmbeddingText(
    [
      `Okuma türü: ${String(item.metadata?.readingType || item.sourceType || '')}`,
      `Dönem: ${String(item.metadata?.period || '')}`,
      item.text,
    ].filter(Boolean).join('\n'),
  );
}

function semanticSectionEmbeddingText(item: SemanticWikiSection) {
  return compactEmbeddingText([item.title, item.pageKey, item.sectionKey, item.body].filter(Boolean).join('\n'));
}

function cosineSimilarity(a: number[], b: number[]) {
  const length = Math.min(a.length, b.length);
  if (!length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < length; index += 1) {
    const av = a[index] || 0;
    const bv = b[index] || 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function recordEmbeddingUsage(
  result: Awaited<ReturnType<typeof embedGeminiText>>,
  readingName: string,
) {
  const inputTokens = Number(result.usage?.inputTokens ?? result.usage?.rawInputTokens ?? 0);
  const rawInputTokens = Number(result.usage?.rawInputTokens ?? inputTokens);
  const rawTotalTokens = Number(result.usage?.rawTotalTokens ?? rawInputTokens);
  if (!inputTokens && !rawInputTokens && !rawTotalTokens) return;
  await addPersonalTokenUsage({
    modelName: result.model || GEMINI_EMBEDDING_MODEL,
    readingName,
    textInputTokens: inputTokens,
    outputTokens: 0,
    rawPromptTokens: rawInputTokens,
    rawOutputTokens: 0,
    rawTotalTokens,
  }).catch(() => {});
}

async function upsertEmbedding(params: {
  accountId: string;
  profileId: string;
  sourceTable: MemoryEmbeddingEntry['sourceTable'];
  sourceId: string;
  text: string;
}) {
  const text = compactEmbeddingText(params.text);
  if (!text) return;
  const textHash = stableTextHash(text);
  const result = await embedGeminiText(text, 30000, 'RETRIEVAL_DOCUMENT');
  await recordEmbeddingUsage(result, 'Hafıza Embedding');
  await upsertMemoryEmbedding({
    refId: `${params.profileId}:${params.sourceTable}:${params.sourceId}:${GEMINI_EMBEDDING_MODEL}`,
    accountId: params.accountId,
    profileId: params.profileId,
    sourceTable: params.sourceTable,
    sourceId: params.sourceId,
    model: result.model || GEMINI_EMBEDDING_MODEL,
    textHash,
    dimensions: result.embedding.length,
    vector: result.embedding,
  });
}

export async function indexObservationEmbeddings(accountId: string, profileId: string, observations: MemoryObservation[]) {
  const existing = new Map(
    (await getMemoryEmbeddingsForProfile(profileId, {
      model: GEMINI_EMBEDDING_MODEL,
      sourceTables: ['memory_nodes'],
    })).map((item) => [item.sourceId, item.textHash]),
  );
  for (const item of observations) {
    if (item.promptUse === 'never' || item.visibility === 'debug_only') continue;
    const text = observationEmbeddingText(item);
    if (existing.get(item.id) === stableTextHash(text)) continue;
    await upsertEmbedding({
      accountId,
      profileId,
      sourceTable: 'memory_nodes',
      sourceId: item.id,
      text,
    });
  }
}

export async function indexRawArchiveEmbedding(entry: RawArchiveEntry) {
  const text = rawArchiveEmbeddingText(entry);
  const existing = await getMemoryEmbeddingsForProfile(entry.profileId, {
    model: GEMINI_EMBEDDING_MODEL,
    sourceTables: ['raw_sources'],
  });
  if (existing.find((item) => item.sourceId === entry.rawId && item.textHash === stableTextHash(text))) return;
  await upsertEmbedding({
    accountId: entry.accountId,
    profileId: entry.profileId,
    sourceTable: 'raw_sources',
    sourceId: entry.rawId,
    text,
  });
}

export async function indexSemanticSectionEmbeddings(accountId: string, profileId: string, sections: SemanticWikiSection[]) {
  const existing = new Map(
    (await getMemoryEmbeddingsForProfile(profileId, {
      model: GEMINI_EMBEDDING_MODEL,
      sourceTables: ['semantic_wiki'],
    })).map((item) => [item.sourceId, item.textHash]),
  );
  for (const item of sections) {
    if (item.promptUse === 'never' || item.promptUse === 'avoid') continue;
    const text = semanticSectionEmbeddingText(item);
    if (existing.get(item.sectionId) === stableTextHash(text)) continue;
    await upsertEmbedding({
      accountId,
      profileId,
      sourceTable: 'semantic_wiki',
      sourceId: item.sectionId,
      text,
    });
  }
}

export async function searchMemoryEmbeddings(params: {
  profileId: string;
  query: string;
  sourceTables?: MemoryEmbeddingEntry['sourceTable'][];
  limit?: number;
  minScore?: number;
}): Promise<MemoryEmbeddingMatch[]> {
  const query = params.query.trim();
  if (!query) return [];
  const queryEmbedding = await embedGeminiText(query, 30000, 'RETRIEVAL_QUERY');
  await recordEmbeddingUsage(queryEmbedding, 'Hafıza Arama Embedding');
  const rows = await getMemoryEmbeddingsForProfile(params.profileId, {
    model: GEMINI_EMBEDDING_MODEL,
    sourceTables: params.sourceTables,
  });
  return rows
    .map((row) => ({ ...row, score: cosineSimilarity(queryEmbedding.embedding, row.vector) }))
    .filter((row) => row.score >= (params.minScore ?? MIN_QUERY_SCORE))
    .sort((a, b) => b.score - a.score)
    .slice(0, params.limit || 12);
}
