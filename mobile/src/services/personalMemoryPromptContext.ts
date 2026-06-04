import type { ProfileMemorySnippet } from '../types/memory';
import { formatPromptMemoryPack } from './memoryPromptPackFormatter';

const PET_RELATION_TERMS = /\b(evcil|hayvan|kedi|köpek|kopek|pati|kuş|kus|tavşan|tavsan|sahibi|pet)\b/iu;

function normalizeLookupText(value: string) {
  return (value || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9çğöşü\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function relationSummary(memorySnippet?: ProfileMemorySnippet | null, limit = 10) {
  const relations = memorySnippet?.prominentRelations || [];
  if (!relations.length) return '';
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of relations) {
    const key = normalizeLookupText(`${item.label}:${item.relationship || ''}`);
    if (!item.label || seen.has(key)) continue;
    seen.add(key);
    out.push(`${item.label} (${item.relationship || 'ilişkili kişi'})`);
    if (out.length >= limit) break;
  }
  return out.join(', ');
}

export function formatPetMentionMemoryContext(question?: string | null, memorySnippet?: ProfileMemorySnippet | null) {
  const normalizedQuestion = normalizeLookupText(question || '');
  if (!normalizedQuestion || !memorySnippet?.prominentRelations?.length) return '';
  const hits = memorySnippet.prominentRelations
    .filter((item) => item.label && PET_RELATION_TERMS.test(item.relationship || ''))
    .filter((item) => {
      const label = normalizeLookupText(item.label);
      return Boolean(label) && new RegExp(`(^|\\s)${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'u').test(normalizedQuestion);
    })
    .slice(0, 3);
  if (!hits.length) return '';
  return [
    `- Kullanıcının sorusunda geçen ${hits.map((item) => item.label).join(', ')} hafızada evcil hayvan ilişkisiyle kayıtlıdır: ${hits.map((item) => `${item.label} = ${item.relationship || 'evcil hayvan'}`).join('; ')}.`,
    '- Bu isimleri insan profili gibi yorumlama; soru seçili insan profili için açılsa bile bu adlar geçtiğinde evcil hayvan bağını, sahibinin merakını, ev içi güven/oyun/dinlenme ritmini ve gerekirse veteriner güvenlik sınırını koru.',
  ].join('\n');
}

export function formatStandardPersonalMemoryContext(params: {
  profileName?: string | null;
  readingLabel: string;
  memorySnippet?: ProfileMemorySnippet | null;
  questionText?: string | null;
  includePromptPack?: boolean;
  relationLimit?: number;
  observationLimit?: number;
}) {
  const snippet = params.memorySnippet;
  if (!snippet) return '';
  const profileName = params.profileName || snippet.profileName || snippet.profileInfo?.displayName || 'seçili profil';
  const hasQuestion = Boolean((params.questionText || '').trim());
  const lines: string[] = [
    '## Standart Kişisel Hafıza Bağlamı',
    `- Bu bölüm ${params.readingLabel} için ortak hafıza sözleşmesidir; ham kayıt gibi açıklanmaz, yalnızca doğal tanışıklık ve bağlam zekası olarak kullanılır.`,
    `- Seçili profil sabit: ${profileName}. Okuma başka bir kişiye kaymasın.`,
  ];

  if (snippet.relationshipLabel) lines.push(`- Hesap sahibiyle yakınlık: ${snippet.relationshipLabel}.`);
  const relations = relationSummary(snippet, params.relationLimit ?? 10);
  if (relations) {
    lines.push(`- Tekilleştirilmiş öne çıkan ilişkiler: ${relations}. Soru, rüya, niyet veya takip mesajında bu isimlerden biri geçerse parantez içindeki ilişki etiketini aktif bağlam olarak kullan.`);
  }

  const petMention = formatPetMentionMemoryContext(params.questionText, snippet);
  if (petMention) lines.push(petMention);

  if (params.includePromptPack !== false) {
    const pack = formatPromptMemoryPack(snippet, { questionText: params.questionText });
    if (pack) lines.push(pack);
  }

  if (hasQuestion) {
    lines.push('- Memory source priority: mevcut kullanıcı konusu/sorusu/niyeti/takip mesajı en üst sinyaldir; sonra seçili profil ve aktif okuma verisi, sonra kullanıcı kaynaklı hafıza, sonra Kendini Tanı profil essence, sonra seçilmiş life/pet life event, en sonda reading-derived tekrar/çeşitlilik sinyalleri gelir.');
    lines.push('- Kullanıcının mevcut sorusu, rüyası, niyeti veya takip mesajı birincil sinyaldir; hafıza yalnızca bu sinyalle gerçek bağ kuruyorsa kullanılmalı.');
  } else {
    lines.push('- Kullanıcı bu okuma öncesinde özel konu/soru/niyet girmedi. Bu durumda en üst sinyal seçili profil ve aktif okuma verisidir; hafıza yalnızca düşük sesli kişisel bağlam olarak kullanılmalı, eski olaylar kendiliğinden ana konuya çevrilmemeli.');
    lines.push('- Konu girişi yoksa user-stated profil bilgileri ve Kendini Tanı essence tonu yönlendirebilir; life event/pet life event ancak okuma verisiyle doğal bağ kuruyorsa kısa ve dolaylı kullanılmalı.');
  }

  lines.push('- Avoid repeat yasak konu değildir: kullanıcı özellikle gündeme getirirse bu tema cevaplanmalı, hatta direkt soruluyorsa ana eksen olabilir.');
  lines.push('- Kullanıcı özellikle gündeme getirmediyse eski life event, pet life event, önceki okuma teması veya aynı ilişki dinamiği tekrar ana konu yapılmamalı.');
  lines.push('- Kendini Tanı çıktıları profil essence olarak düşük-orta ağırlıktadır; MBTI, kişilik testi, temel numeroloji veya doğum haritası sonucunu kaynak adıyla söyleme, yalnızca kişinin mizacını ve hassasiyetini anlamak için kullan.');
  lines.push('- Aynı kapanış cümlesi, aynı örnek olay, aynı sembol veya aynı tavsiye yakın okumalarda tekrar edilmemeli; gerekiyorsa yeni açıyla ve kısa bir dokunuşla geçilmeli.');
  lines.push('- Hafıza kaynağını açık etme; "hafızanda", "önceki okumanda", "profilinde gördüğüm" gibi ifadeler kullanma.');
  return lines.join('\n');
}
