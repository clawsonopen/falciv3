import type { MemoryObservation, ProfileMemorySnippet } from '../types/memory';

type PromptMemoryPackFormatOptions = {
  questionText?: string | null;
  readingType?: string | null;
};

function normalizeForDedupe(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?()[\]{}"']/g, '')
    .trim();
}

function compact(value: string, maxLength = 220) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}…`;
}

function pushUnique(target: string[], seen: Set<string>, values?: Array<string | null | undefined>, maxLength = 220) {
  for (const value of values || []) {
    const trimmed = compact(String(value || ''), maxLength);
    const key = normalizeForDedupe(trimmed);
    if (!trimmed || !key || seen.has(key)) continue;
    seen.add(key);
    target.push(trimmed);
  }
}

function looksLikeReadingTypeList(value: string) {
  return /\bokuma türleri\s*:/iu.test(value) || /\breading types\s*:/iu.test(value);
}

function relationLines(snippet?: ProfileMemorySnippet | null) {
  const seen = new Set<string>();
  const relations: string[] = [];
  for (const item of snippet?.prominentRelations || []) {
    const label = compact(item.label, 64);
    const relationship = compact(item.relationship || 'ilişkili kişi', 64);
    const key = normalizeForDedupe(`${label}:${relationship}`);
    if (!label || seen.has(key)) continue;
    seen.add(key);
    relations.push(`${label} (${relationship})`);
  }
  return relations.slice(0, 8);
}

function relationKeysForFilter(snippet?: ProfileMemorySnippet | null) {
  const keys = new Set<string>();
  for (const item of snippet?.prominentRelations || []) {
    const label = compact(item.label, 64);
    const relationship = compact(item.relationship || 'ilişkili kişi', 64);
    if (!label) continue;
    keys.add(normalizeForDedupe(`${label} (${relationship})`));
    keys.add(normalizeForDedupe(`${label}: ${relationship}`));
  }
  return keys;
}

function observationLine(item: MemoryObservation) {
  const source = item.source === 'user-stated' ? 'kullanıcı' : 'yorum';
  return [source, `${item.group || item.category || 'Genel'} / ${item.subgroup || 'Diğer'}`, item.title, item.summary]
    .filter(Boolean)
    .join(' | ');
}

function relevantObservationLines(snippet?: ProfileMemorySnippet | null, hasUserInput = false) {
  const observations = snippet?.relevantObservations || [];
  const userItems = observations.filter((item) => item.source === 'user-stated');
  const readingItems = observations.filter((item) => item.source === 'reading-derived');
  return [
    ...userItems.slice(0, 4),
    ...(hasUserInput ? readingItems.slice(0, 3) : readingItems.slice(0, 1)),
  ].map(observationLine);
}

function topicAvoidanceLines(snippet?: ProfileMemorySnippet | null) {
  const groups = snippet?.readingTopicGroups || [];
  return groups
    .filter((item) => item.label)
    .sort((a, b) => (b.salience || 0) - (a.salience || 0))
    .slice(0, 5)
    .map((item) => `${item.group || 'Genel'} / ${item.subgroup || 'Diğer'}: ${item.label}`);
}

function semanticValues(snippet?: ProfileMemorySnippet | null) {
  const semantic = snippet?.promptMemoryPack?.semanticBriefs;
  if (!semantic) return {
    profile: [] as string[],
    user: [] as string[],
    self: [] as string[],
    persona: [] as string[],
    variety: [] as string[],
  };
  const clean = (items?: string[]) => (items || []).filter((item) => item && !looksLikeReadingTypeList(item));
  return {
    profile: clean(semantic.profileContext),
    user: clean(semantic.userMemory),
    self: clean(semantic.selfKnowledge),
    persona: clean(semantic.personaRelationship),
    variety: clean(semantic.repetitionAndVariety),
  };
}

function redundantMemoryFilter(snippet?: ProfileMemorySnippet | null) {
  const relationKeys = relationKeysForFilter(snippet);
  const profileName = normalizeForDedupe(snippet?.profileName || '');
  return (value: string) => {
    const key = normalizeForDedupe(value);
    if (!key) return false;
    if (relationKeys.has(key)) return false;
    if (profileName && key.includes(profileName) && key.includes('secili profildir')) return false;
    if (key.includes('birincil iliski profilleri')) return false;
    if (key.includes('hesap sahibiyle iliski')) return false;
    return true;
  };
}

function isSurfaceFortuneType(readingType?: string | null) {
  return readingType === 'coffee' || readingType === 'palm';
}

function looksLikeAstroSelfKnowledge(value: string) {
  const key = normalizeForDedupe(value);
  return (
    key.includes('dogum haritasi') ||
    key.includes('gunes burcu') ||
    key.includes('yukselen') ||
    key.includes('baskin ev') ||
    key.includes('gezegen konumlari') ||
    key.includes('birth chart') ||
    key.includes('birthchart')
  );
}

function surfaceMemoryFilter(value: string) {
  if (!value) return false;
  if (looksLikeAstroSelfKnowledge(value)) return false;
  return true;
}

function looksLikePriorSurfaceReadingSummary(value: string) {
  const key = normalizeForDedupe(value);
  return (
    key.includes('ozet el okumasinda') ||
    key.includes('ozet kahve yorumunda') ||
    key.includes('mikro izler') ||
    key.includes('yorumlandi')
  );
}

export function formatPromptMemoryPack(
  snippet?: ProfileMemorySnippet | null,
  options: PromptMemoryPackFormatOptions = {},
) {
  const pack = snippet?.promptMemoryPack;
  if (!snippet && !pack) return '';
  const hasUserInput = Boolean(options.questionText?.trim());
  const surfaceFortune = isSurfaceFortuneType(options.readingType);
  const lines: string[] = ['## Final Memory Pack'];
  const values = semanticValues(snippet);
  const selection = pack?.semanticSelection;
  const keepMemoryLine = redundantMemoryFilter(snippet);

  const profileBits: string[] = [];
  pushUnique(profileBits, new Set(), [
    snippet?.profileName ? `Seçili profil: ${snippet.profileName}` : '',
    snippet?.relationshipLabel ? `hesap sahibiyle bağ: ${snippet.relationshipLabel}` : '',
    snippet?.isSelf ? 'profil hesap sahibinin kendisi' : '',
    ...(values.profile || []),
  ], 260);
  if (profileBits.length) lines.push(`- PROFILE=${profileBits.slice(0, 3).join(' | ')}`);

  const relations = relationLines(snippet);
  if (relations.length) lines.push(`- RELATIONS=${relations.join('; ')}`);

  const userSignals: string[] = [];
  pushUnique(userSignals, new Set(), [
    ...(snippet?.userStatedTopics || []),
    ...(snippet?.userStatedPatterns || []),
    ...(pack?.profileEssence || []),
    ...(values.user || []),
  ].filter((item) => !surfaceFortune || (surfaceMemoryFilter(item) && (hasUserInput || !looksLikePriorSurfaceReadingSummary(item)))), 220);
  if (userSignals.length) lines.push(`- USER_SIGNALS=${userSignals.slice(0, 5).join(' | ')}`);

  const selfSignals: string[] = [];
  pushUnique(selfSignals, new Set(), surfaceFortune ? [] : values.self, 220);
  if (selfSignals.length) lines.push(`- SELF_KNOWLEDGE=${selfSignals.slice(0, 3).join(' | ')}`);

  const relevantSignals: string[] = [];
  pushUnique(relevantSignals, new Set(), (selection?.use?.length ? selection.use : [
    ...relevantObservationLines(snippet, hasUserInput),
    ...(values.persona || []),
  ])
    .filter(keepMemoryLine)
    .filter((item) => !surfaceFortune || (surfaceMemoryFilter(item) && (hasUserInput || !looksLikePriorSurfaceReadingSummary(item)))), 240);
  if (relevantSignals.length) lines.push(`- SELECTED_MEMORY=${relevantSignals.slice(0, hasUserInput ? 6 : 3).join(' | ')}`);

  const backgroundSignals: string[] = [];
  pushUnique(backgroundSignals, new Set(), (selection?.background || [])
    .filter(keepMemoryLine)
    .filter((item) => !surfaceFortune || (surfaceMemoryFilter(item) && !looksLikePriorSurfaceReadingSummary(item))), 220);
  if (backgroundSignals.length) lines.push(`- BACKGROUND=${backgroundSignals.slice(0, 4).join(' | ')}`);

  const avoidSignals: string[] = [];
  pushUnique(avoidSignals, new Set(), selection?.avoidRepeat?.length ? selection.avoidRepeat : [
    ...(pack?.avoidRepetition || []),
    ...(values.variety || []),
    ...topicAvoidanceLines(snippet),
  ].filter((item) => !surfaceFortune || surfaceMemoryFilter(item)), 190);
  if (avoidSignals.length) {
    lines.push(`- AVOID_REPEAT=Kullanıcı özellikle sormadıkça otomatik merkeze alma: ${avoidSignals.slice(0, 5).join(' | ')}`);
  }

  const overrideSignals: string[] = [];
  pushUnique(overrideSignals, new Set(), selection?.userOverride || [], 190);
  lines.push(
    overrideSignals.length
      ? `- USER_OVERRIDE=Kullanıcı konu/soru/niyet/follow-up içinde açıkça getirirse cevapla; direkt sorulan tema ana eksen olabilir: ${overrideSignals.slice(0, 3).join(' | ')}`
      : '- USER_OVERRIDE=Kullanıcı konu/soru/niyet/follow-up içinde bu kişi veya temalardan birini açıkça getirirse cevapla; direkt sorulan tema ana eksen olabilir.',
  );
  lines.push('- MEMORY_CONTRACT=Hafızayı kaynak gibi açıklama; doğal tanışıklık olarak kullan. Aynı kişi, tema, örnek olay veya kapanış cümlesini tekrar ettirme.');

  return lines.join('\n');
}
