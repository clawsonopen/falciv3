import * as FileSystem from 'expo-file-system/legacy';
import type { LoreEdge, LoreNode } from '../types/memory';
import { indexLoreGraph } from './memorySqliteService';

const DATA_DIR = `${FileSystem.documentDirectory}falci-data/`;
const LORE_DIR = `${DATA_DIR}lore/`;
const ADMIN_LORE_FILE = `${LORE_DIR}admin-lore.json`;

type AdminLoreStore = {
  nodes: LoreNode[];
  edges: LoreEdge[];
  updatedAt: string;
};

function nowIso() {
  return new Date().toISOString();
}

function makeLoreId(...parts: string[]) {
  return parts.join(':').replace(/[^a-z0-9:_-]+/gi, '-').toLowerCase();
}

async function ensureLoreDir() {
  const info = await FileSystem.getInfoAsync(LORE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(LORE_DIR, { intermediates: true });
  }
}

async function readStore(): Promise<AdminLoreStore> {
  await ensureLoreDir();
  const info = await FileSystem.getInfoAsync(ADMIN_LORE_FILE);
  if (!info.exists) return { nodes: [], edges: [], updatedAt: nowIso() };
  return JSON.parse(await FileSystem.readAsStringAsync(ADMIN_LORE_FILE)) as AdminLoreStore;
}

async function writeStore(store: AdminLoreStore) {
  await ensureLoreDir();
  await FileSystem.writeAsStringAsync(ADMIN_LORE_FILE, JSON.stringify(store, null, 2));
}

export async function upsertAdminLoreNode(input: {
  personaId?: string;
  type: LoreNode['type'];
  title: string;
  summary: string;
  sourceText?: string;
  sourceUrl?: string;
  metadata?: Record<string, unknown>;
}) {
  const store = await readStore();
  const loreId = makeLoreId('admin', input.personaId || 'global', input.type, input.title);
  const node: LoreNode = {
    loreId,
    personaId: input.personaId,
    type: input.type,
    title: input.title.trim(),
    summary: input.summary.trim(),
    sourceText: input.sourceText?.trim(),
    sourceUrl: input.sourceUrl?.trim(),
    metadata: input.metadata || {},
  };
  const next: AdminLoreStore = {
    nodes: [node, ...store.nodes.filter((item) => item.loreId !== loreId)],
    edges: store.edges,
    updatedAt: nowIso(),
  };
  await writeStore(next);
  await indexLoreGraph(next.nodes, next.edges).catch(() => {});
  return node;
}

export async function ingestSocialPostLore(input: {
  personaId?: string;
  postText: string;
  sourceUrl?: string;
  tags?: string[];
}) {
  const summary = input.postText.replace(/\s+/g, ' ').trim().slice(0, 420);
  return upsertAdminLoreNode({
    personaId: input.personaId,
    type: 'social_post',
    title: input.tags?.length ? `Sosyal içerik: ${input.tags.join(', ')}` : 'Sosyal içerik',
    summary,
    sourceText: input.postText,
    sourceUrl: input.sourceUrl,
    metadata: { tags: input.tags || [] },
  });
}

export async function loadAdminLoreStore() {
  return readStore();
}
