import type { LoreEdge, LoreGraph, LoreNode } from '../types/memory';
import { COMMON_FORTUNE_IDENTITY_BODY, FORTUNE_PERSONA_DATA } from './fortunePersonaData';
import { indexLoreGraph } from './memorySqliteService';

let cachedLoreGraph: LoreGraph | null = null;
let indexed = false;

function makeLoreId(...parts: string[]) {
  return parts.join(':').replace(/[^a-z0-9:_-]+/gi, '-').toLowerCase();
}

function section(body: string, heading: string) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return body.match(new RegExp(`# ${escaped}\\n\\n([\\s\\S]*?)(?:\\n\\n# |$)`))?.[1]?.trim() || '';
}

function bulletSummary(text: string, limit = 4) {
  return text
    .split('\n')
    .map((line) => line.replace(/^[-*\d.\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, limit);
}

export function buildLoreGraph(): LoreGraph {
  if (cachedLoreGraph) return cachedLoreGraph;
  const nodes: LoreNode[] = [];
  const edges: LoreEdge[] = [];
  for (const [personaId, persona] of Object.entries(FORTUNE_PERSONA_DATA)) {
    const voice = bulletSummary(section(persona.systemBody, 'Voice And Temperament'), 5);
    const domain = bulletSummary(section(persona.systemBody, 'Domain Rules'), 4);
    const safety = bulletSummary(section(COMMON_FORTUNE_IDENTITY_BODY, 'Safety And Boundaries'), 4);
    const personaRoot = makeLoreId('persona', personaId);
    nodes.push({
      loreId: personaRoot,
      personaId,
      type: 'persona_trait',
      title: 'Seçili yorumcu özü',
      summary: `${persona.primaryDomainLabel} merkezli, ${voice.slice(0, 2).join(' ')}`.trim(),
      sourceText: persona.systemBody.slice(0, 1200),
      metadata: { displayName: persona.displayName, primaryDomainLabel: persona.primaryDomainLabel },
    });
    [
      ['tone_rule', 'Ses ve tavır', voice],
      ['domain_rule', 'Alan kuralları', domain],
      ['policy', 'Güvenlik sınırları', safety],
    ].forEach(([type, title, items]) => {
      const list = items as string[];
      if (!list.length) return;
      const loreId = makeLoreId('persona', personaId, String(type));
      nodes.push({
        loreId,
        personaId,
        type: type as LoreNode['type'],
        title: String(title),
        summary: list.join(' '),
        sourceText: list.join('\n'),
        metadata: { personaId },
      });
      edges.push({
        edgeId: makeLoreId('edge', personaRoot, loreId),
        fromLoreId: personaRoot,
        toLoreId: loreId,
        edgeType: type === 'tone_rule' ? 'affects_tone' : 'part_of',
        explanation: `${title} seçili yorumcu evreninin parçasıdır.`,
      });
    });
  }
  cachedLoreGraph = { nodes, edges, updatedAt: new Date().toISOString() };
  return cachedLoreGraph;
}

export async function ensureLoreGraphIndexed() {
  if (indexed) return;
  const graph = buildLoreGraph();
  await indexLoreGraph(graph.nodes, graph.edges).catch(() => {});
  indexed = true;
}

function scoreLore(summary: string, query: string) {
  const source = `${summary} ${query}`.toLocaleLowerCase('tr-TR');
  let score = 0;
  if (/(ilişki|aşk|kalp|eş|sevgili|romantik)/i.test(source)) score += summary.includes('ilişki') || summary.includes('kalp') ? 2 : 0;
  if (/(iş|para|kariyer|maddi)/i.test(source)) score += summary.includes('iş') || summary.includes('para') ? 2 : 0;
  if (/(rüya|tarot|astro|numeroloji|el|kahve)/i.test(source)) score += 1;
  return score;
}

export function selectLoreCrumbs(params: { assistantId?: string; query?: string; limit?: number }) {
  const graph = buildLoreGraph();
  const personaNodes = graph.nodes.filter((node) => !params.assistantId || node.personaId === params.assistantId);
  const query = params.query || '';
  return personaNodes
    .filter((node) => node.type === 'tone_rule' || node.type === 'domain_rule' || node.type === 'persona_trait')
    .map((node) => ({ node, score: scoreLore(node.summary, query) + (node.type === 'persona_trait' ? 1 : 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, params.limit || 2)
    .map(({ node }) => ({
      loreId: node.loreId,
      text: `Lore crumb: ${node.summary}. Bunu açıklama gibi değil, sadece üslup ve küçük tat olarak kullan; kullanıcıya yorumcu adını söyleme.`,
    }));
}
