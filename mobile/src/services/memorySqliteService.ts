import * as SQLite from 'expo-sqlite';
import type {
  LoreEdge,
  LoreNode,
  MemoryEdge,
  MemoryObservation,
  RawArchiveEntry,
  ReadingFingerprint,
  SessionJournalEntry,
  SourceChunk,
} from '../types/memory';

export interface MemoryEmbeddingEntry {
  refId: string;
  accountId: string;
  profileId: string;
  sourceTable: 'memory_nodes' | 'raw_sources' | 'semantic_wiki' | 'persona_relationships';
  sourceId: string;
  model: string;
  textHash: string;
  dimensions: number;
  vector: number[];
  createdAt?: string;
  updatedAt?: string;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function db() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('falci-memory-v2.db').then(async (database) => {
      const legacySourceSegmentsTable = ['source', 'chunks'].join('_');
      await database.execAsync(`
        PRAGMA journal_mode = WAL;
        DROP TABLE IF EXISTS ${legacySourceSegmentsTable};
        CREATE TABLE IF NOT EXISTS raw_sources (
          id TEXT PRIMARY KEY NOT NULL,
          account_id TEXT NOT NULL,
          profile_id TEXT NOT NULL,
          reading_id TEXT,
          source_type TEXT NOT NULL,
          source_text TEXT NOT NULL,
          created_at TEXT NOT NULL,
          metadata_json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS session_journals (
          id TEXT PRIMARY KEY NOT NULL,
          account_id TEXT NOT NULL,
          profile_id TEXT NOT NULL,
          reading_id TEXT,
          assistant_id TEXT,
          reading_type TEXT,
          created_at TEXT NOT NULL,
          summary TEXT NOT NULL,
          events_json TEXT NOT NULL,
          memory_actions_json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS memory_nodes (
          id TEXT PRIMARY KEY NOT NULL,
          account_id TEXT NOT NULL,
          profile_id TEXT NOT NULL,
          source TEXT NOT NULL,
          node_type TEXT NOT NULL,
          title TEXT NOT NULL,
          summary TEXT NOT NULL,
          category TEXT NOT NULL,
          node_group TEXT NOT NULL,
          subgroup TEXT NOT NULL,
          source_type TEXT,
          visibility TEXT,
          prompt_use TEXT,
          source_reading_id TEXT,
          source_raw_id TEXT,
          confidence REAL NOT NULL,
          metadata_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          last_used_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_memory_nodes_profile ON memory_nodes(profile_id, confidence, updated_at);
        CREATE TABLE IF NOT EXISTS memory_edges (
          id TEXT PRIMARY KEY NOT NULL,
          account_id TEXT NOT NULL,
          profile_id TEXT NOT NULL,
          from_node_key TEXT NOT NULL,
          to_node_key TEXT NOT NULL,
          edge_type TEXT NOT NULL,
          explanation TEXT NOT NULL,
          confidence REAL NOT NULL,
          source_reading_id TEXT,
          source_raw_id TEXT,
          created_at TEXT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_edges_unique ON memory_edges(profile_id, from_node_key, edge_type, to_node_key);
        CREATE TABLE IF NOT EXISTS memory_embeddings (
          ref_id TEXT PRIMARY KEY NOT NULL,
          account_id TEXT NOT NULL,
          profile_id TEXT NOT NULL,
          source_table TEXT NOT NULL,
          source_id TEXT NOT NULL,
          model TEXT NOT NULL,
          text_hash TEXT NOT NULL,
          dimensions INTEGER NOT NULL,
          vector_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_memory_embeddings_profile ON memory_embeddings(profile_id, source_table, updated_at);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_embeddings_source_model ON memory_embeddings(profile_id, source_table, source_id, model);
        CREATE TABLE IF NOT EXISTS reading_fingerprints (
          id TEXT PRIMARY KEY NOT NULL,
          account_id TEXT NOT NULL,
          profile_id TEXT NOT NULL,
          reading_id TEXT NOT NULL,
          assistant_id TEXT NOT NULL,
          reading_type TEXT NOT NULL,
          themes_json TEXT NOT NULL,
          symbols_json TEXT NOT NULL,
          phrases_to_avoid_json TEXT NOT NULL,
          emotional_arc TEXT,
          next_angle_suggestion TEXT,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS lore_nodes (
          id TEXT PRIMARY KEY NOT NULL,
          persona_id TEXT,
          node_type TEXT NOT NULL,
          title TEXT NOT NULL,
          summary TEXT NOT NULL,
          source_text TEXT,
          source_url TEXT,
          valid_from TEXT,
          valid_to TEXT,
          metadata_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS lore_edges (
          id TEXT PRIMARY KEY NOT NULL,
          from_lore_id TEXT NOT NULL,
          to_lore_id TEXT NOT NULL,
          edge_type TEXT NOT NULL,
          explanation TEXT NOT NULL
        );
      `);
      return database;
    });
  }
  return dbPromise;
}

function json(value: unknown) {
  return JSON.stringify(value ?? null);
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function indexRawArchiveEntry(entry: RawArchiveEntry) {
  const database = await db();
  await database.runAsync(
    `INSERT OR REPLACE INTO raw_sources
      (id, account_id, profile_id, reading_id, source_type, source_text, created_at, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    entry.rawId,
    entry.accountId,
    entry.profileId,
    entry.readingId || null,
    entry.sourceType,
    entry.text,
    entry.createdAt,
    json(entry.metadata),
  );
}

export async function upsertMemoryEmbedding(entry: MemoryEmbeddingEntry) {
  const database = await db();
  const now = new Date().toISOString();
  await database.runAsync(
    `INSERT OR REPLACE INTO memory_embeddings
      (ref_id, account_id, profile_id, source_table, source_id, model, text_hash, dimensions, vector_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM memory_embeddings WHERE ref_id = ?), ?), ?)`,
    entry.refId,
    entry.accountId,
    entry.profileId,
    entry.sourceTable,
    entry.sourceId,
    entry.model,
    entry.textHash,
    entry.dimensions,
    json(entry.vector),
    entry.refId,
    entry.createdAt || now,
    entry.updatedAt || now,
  );
}

export async function getMemoryEmbeddingsForProfile(
  profileId: string,
  options?: { model?: string; sourceTables?: MemoryEmbeddingEntry['sourceTable'][] },
): Promise<MemoryEmbeddingEntry[]> {
  const database = await db();
  const rows = await database.getAllAsync<any>(
    'SELECT * FROM memory_embeddings WHERE profile_id = ? ORDER BY updated_at DESC',
    profileId,
  );
  const model = options?.model;
  const sourceTables = options?.sourceTables ? new Set(options.sourceTables) : null;
  return rows
    .filter((row) => (!model || row.model === model) && (!sourceTables || sourceTables.has(row.source_table)))
    .map((row) => ({
      refId: row.ref_id,
      accountId: row.account_id,
      profileId: row.profile_id,
      sourceTable: row.source_table,
      sourceId: row.source_id,
      model: row.model,
      textHash: row.text_hash,
      dimensions: Number(row.dimensions || 0),
      vector: parseJson<number[]>(row.vector_json, []),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
    .filter((row) => row.vector.length > 0);
}

export async function searchSourceChunks(
  profileId: string,
  queryTokens: string[],
  limit = 3,
): Promise<SourceChunk[]> {
  const database = await db();
  const rows = await database.getAllAsync<any>(
    'SELECT * FROM raw_sources WHERE profile_id = ? ORDER BY created_at DESC LIMIT 80',
    profileId,
  );
  const tokens = new Set(queryTokens.map((item) => item.toLocaleLowerCase('tr-TR')).filter(Boolean));
  return rows
    .map((row) => {
      const text = String(row.source_text || '');
      const haystack = text.toLocaleLowerCase('tr-TR');
      const score = [...tokens].reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
      const chunk: SourceChunk = {
        chunkId: `${row.id}:0`,
        rawId: row.id,
        accountId: row.account_id,
        profileId: row.profile_id,
        readingId: row.reading_id || undefined,
        sourceType: row.source_type,
        chunkIndex: 0,
        text,
        tokens: [...tokens],
        createdAt: row.created_at,
      };
      return { chunk, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.chunk);
}

export async function indexSessionJournal(entry: SessionJournalEntry) {
  const database = await db();
  await database.runAsync(
    `INSERT OR REPLACE INTO session_journals
      (id, account_id, profile_id, reading_id, assistant_id, reading_type, created_at, summary, events_json, memory_actions_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    entry.journalId,
    entry.accountId,
    entry.profileId,
    entry.readingId || null,
    entry.assistantId || null,
    entry.readingType || null,
    entry.createdAt,
    entry.summary,
    json(entry.events),
    json(entry.memoryActions),
  );
}

export async function indexReadingFingerprint(entry: ReadingFingerprint) {
  const database = await db();
  await database.runAsync(
    `INSERT OR REPLACE INTO reading_fingerprints
      (id, account_id, profile_id, reading_id, assistant_id, reading_type, themes_json, symbols_json, phrases_to_avoid_json, emotional_arc, next_angle_suggestion, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    entry.fingerprintId,
    entry.accountId,
    entry.profileId,
    entry.readingId,
    entry.assistantId,
    entry.readingType,
    json(entry.themes),
    json(entry.symbols),
    json(entry.phrasesToAvoid),
    entry.emotionalArc || null,
    entry.nextAngleSuggestion || null,
    entry.createdAt,
  );
}

export async function indexMemoryNodes(accountId: string, profileId: string, observations: MemoryObservation[]) {
  const database = await db();
  const now = new Date().toISOString();
  for (const item of observations) {
    await database.runAsync(
      `INSERT OR REPLACE INTO memory_nodes
        (id, account_id, profile_id, source, node_type, title, summary, category, node_group, subgroup, source_type, visibility, prompt_use, source_reading_id, source_raw_id, confidence, metadata_json, created_at, updated_at, last_used_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM memory_nodes WHERE id = ?), ?), ?, NULL)`,
      item.id,
      accountId,
      profileId,
      item.source,
      item.kind,
      item.title,
      item.summary,
      item.category,
      item.group,
      item.subgroup,
      item.sourceType || null,
      item.visibility || null,
      item.promptUse || null,
      item.sourceReadingId || null,
      item.sourceRawId || null,
      item.confidence,
      json({
        key: item.key,
        detailGroup: item.detailGroup,
        entities: item.entities,
        entityRelations: item.entityRelations,
        emotions: item.emotions,
        timeText: item.timeText,
        placeText: item.placeText,
      }),
      item.id,
      item.mentionedAt || now,
      item.lastSeenAt || now,
    );
  }
}

export async function indexMemoryEdges(edges: MemoryEdge[]) {
  const database = await db();
  for (const edge of edges) {
    await database.runAsync(
      `INSERT OR REPLACE INTO memory_edges
        (id, account_id, profile_id, from_node_key, to_node_key, edge_type, explanation, confidence, source_reading_id, source_raw_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      edge.edgeId,
      edge.accountId,
      edge.profileId,
      edge.fromNodeKey,
      edge.toNodeKey,
      edge.edgeType,
      edge.explanation,
      edge.confidence,
      edge.sourceReadingId || null,
      edge.sourceRawId || null,
      edge.createdAt,
    );
  }
}

export async function deleteSqliteArtifactsForReading(profileId: string, readingId: string) {
  const database = await db();
  await database.runAsync('DELETE FROM raw_sources WHERE profile_id = ? AND reading_id = ?', profileId, readingId);
  await database.runAsync('DELETE FROM session_journals WHERE profile_id = ? AND reading_id = ?', profileId, readingId);
  await database.runAsync('DELETE FROM reading_fingerprints WHERE profile_id = ? AND reading_id = ?', profileId, readingId);
  await database.runAsync(
    'DELETE FROM memory_embeddings WHERE profile_id = ? AND source_table = ? AND source_id NOT IN (SELECT id FROM raw_sources WHERE profile_id = ?)',
    profileId,
    'raw_sources',
    profileId,
  );
}

export async function deleteSqliteArtifactsForProfile(profileId: string) {
  const database = await db();
  await database.runAsync('DELETE FROM raw_sources WHERE profile_id = ?', profileId);
  await database.runAsync('DELETE FROM session_journals WHERE profile_id = ?', profileId);
  await database.runAsync('DELETE FROM reading_fingerprints WHERE profile_id = ?', profileId);
  await database.runAsync('DELETE FROM memory_nodes WHERE profile_id = ?', profileId);
  await database.runAsync('DELETE FROM memory_edges WHERE profile_id = ?', profileId);
  await database.runAsync('DELETE FROM memory_embeddings WHERE profile_id = ?', profileId);
}

export async function indexLoreGraph(nodes: LoreNode[], edges: LoreEdge[]) {
  const database = await db();
  const now = new Date().toISOString();
  for (const node of nodes) {
    await database.runAsync(
      `INSERT OR REPLACE INTO lore_nodes
        (id, persona_id, node_type, title, summary, source_text, source_url, valid_from, valid_to, metadata_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      node.loreId,
      node.personaId || null,
      node.type,
      node.title,
      node.summary,
      node.sourceText || null,
      node.sourceUrl || null,
      node.validFrom || null,
      node.validTo || null,
      json(node.metadata),
      now,
    );
  }
  for (const edge of edges) {
    await database.runAsync(
      `INSERT OR REPLACE INTO lore_edges (id, from_lore_id, to_lore_id, edge_type, explanation)
       VALUES (?, ?, ?, ?, ?)`,
      edge.edgeId,
      edge.fromLoreId,
      edge.toLoreId,
      edge.edgeType,
      edge.explanation,
    );
  }
}
