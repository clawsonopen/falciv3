import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandedScrollView } from '../components/BrandedScrollView';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { clearProfileMemoryAndReadings, loadAccountState, loadProfileMemoryBundle, loadProfileMemorySnippet } from '../services/profileMemoryService';
import { runMemoryMaintenanceForAllProfiles } from '../services/memoryMaintenanceService';
import { formatPromptMemoryPack } from '../services/memoryPromptPackFormatter';
import {
  applyMemoryWriterDebugJob,
  clearMemoryWriterDebugJobs,
  createProfileIdentityMemoryWriterDraft,
  loadMemoryWriterDebugJobs,
  runProfileIdentityMemoryWriter,
  type MemoryWriterDebugJob,
} from '../services/memoryWriterDebugService';
import { clearAstroCachesForProfile } from '../services/astroEngine';
import { clearPersonalNumerologyCachesForProfile } from '../services/personalNumerologyEngine';
import { deleteBirthChartInterpretationSession } from '../services/birthChartInterpretationStore';
import type {
  MemoryCategoryCandidate,
  MemoryObservation,
  ProfileMemoryBundle,
  ProfileMemorySnippet,
  ProfilePatternMemory,
  ProfilePersonMemory,
  ProfileTopicMemory,
} from '../types/memory';

type Props = NativeStackScreenProps<RootStackParamList, 'MemoryDebug'>;

const TOPIC_TAXONOMY = [
  { group: 'İlişkiler', subgroup: 'Romantik bağlar' },
  { group: 'İlişkiler', subgroup: 'Aile ve yakın çevre' },
  { group: 'İlişkiler', subgroup: 'Arkadaşlık ve sosyal çevre' },
  { group: 'İlişkiler', subgroup: 'Evcil hayvanlar' },
  { group: 'İş ve Para', subgroup: 'Kariyer' },
  { group: 'İş ve Para', subgroup: 'Finans' },
  { group: 'İç Dünya', subgroup: 'Ruh hali ve beden' },
  { group: 'Yaşam Düzeni', subgroup: 'Değişim ve planlar' },
  { group: 'Genel', subgroup: 'Diğer konuşulanlar' },
];

function genderLabel(raw: string | null | undefined) {
  const map: Record<string, string> = {
    erkek: 'Erkek',
    kadin: 'Kadın',
    hicbiri: 'Hiçbiri',
    belirtmek_istemiyorum: 'Belirtmek istemiyor',
  };
  return raw ? map[raw] || raw : 'kayıt yok';
}

function chartPrecisionLabel(raw: string | null | undefined) {
  const map: Record<string, string> = {
    full: 'Doğum saati ve yeri var',
    date_plus_place: 'Doğum tarihi ve yeri var',
    date_only: 'Sadece doğum tarihi var',
    unknown: 'Doğum bilgisi eksik',
    'date-only': 'Sadece doğum tarihi var',
    missing: 'Doğum bilgisi eksik',
  };
  return raw ? map[raw] || raw : 'kayıt yok';
}

function peopleForTaxonomy(items: ProfilePersonMemory[], group: string, subgroup: string) {
  if (group !== 'İlişkiler') return [];
  return items.filter((item) => {
    const rel = (item.relationship || '').toLowerCase();
    if (subgroup === 'Romantik bağlar') return /(sevgili|eş|esi|partner|spouse|partner)/.test(rel);
    if (subgroup === 'Aile ve yakın çevre') return /(anne|baba|kardeş|kardes|çocuk|cocuk|oglu|oğlu|kizi|kızı|akraba|aile|mother|father|child|sibling|relative)/.test(rel);
    if (subgroup === 'Arkadaşlık ve sosyal çevre') return /(arkadaş|arkadas|dost|iş arkadaşı|is arkadasi|friend|colleague)/.test(rel);
    if (subgroup === 'Evcil hayvanlar') return /(evcil|hayvan|kedi|köpek|kopek|pati|kuş|kus|tavşan|tavsan|pet)/.test(rel);
    return false;
  });
}

function renderTaxonomyMemory(
  title: string,
  topics: ProfileTopicMemory[],
  people: ProfilePersonMemory[],
  patterns: ProfilePatternMemory[],
  observations: MemoryObservation[],
  categoryCandidates: MemoryCategoryCandidate[],
) {
  const groups = new Map<string, ProfileTopicMemory[]>();
  for (const item of topics.slice(-10)) {
    const groupKey = `${item.group || 'Genel'} / ${item.subgroup || 'Diğer konuşulanlar'}`;
    groups.set(groupKey, [...(groups.get(groupKey) || []), item]);
  }
  const observationsByGroup = new Map<string, MemoryObservation[]>();
  for (const item of observations.slice(0, 10)) {
    const groupKey = `${item.group || 'Genel'} / ${item.subgroup || 'Diğer konuşulanlar'}`;
    observationsByGroup.set(groupKey, [...(observationsByGroup.get(groupKey) || []), item]);
  }

  const hasAnyMemory = topics.length > 0 || people.length > 0 || patterns.length > 0 || observations.length > 0;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {TOPIC_TAXONOMY.map((taxonomy) => {
        const groupKey = `${taxonomy.group} / ${taxonomy.subgroup}`;
        const groupTopics = groups.get(groupKey) || [];
        const groupPeople = peopleForTaxonomy(people, taxonomy.group, taxonomy.subgroup).slice(0, 10);
        const groupPatterns = taxonomy.group === 'İç Dünya' ? patterns.slice(0, 10) : [];
        const groupObservations = observationsByGroup.get(groupKey) || [];
        const hasGroupMemory = groupTopics.length > 0 || groupPeople.length > 0 || groupPatterns.length > 0 || groupObservations.length > 0;
        return (
          <View key={groupKey} style={styles.topicGroup}>
            <Text style={styles.groupTitle}>{groupKey}</Text>
            {hasGroupMemory ? (
              <>
                {groupTopics.map((item) => (
                  <Text key={`topic-${item.key}`} style={styles.itemText}>
                    Konu: {item.label}{item.detailGroup ? ` - ${item.detailGroup}` : ''}
                  </Text>
                ))}
                {groupPeople.map((item) => (
                  <Text key={`person-${item.id}`} style={styles.itemText}>
                    İlişki: {item.label} - {relationLabel(item.relationship)}
                  </Text>
                ))}
                {groupPatterns.map((item) => (
                  <Text key={`pattern-${item.key}`} style={styles.itemText}>Kalıp: {item.label}</Text>
                ))}
                {groupObservations.map((item) => (
                  <Text key={`observation-${item.id}`} style={styles.itemText}>
                    {observationKindLabel(item.kind)}: {item.title} - {item.summary}
                    {item.timeText ? ` | Zaman: ${item.timeText}` : ''}
                    {item.placeText ? ` | Yer: ${item.placeText}` : ''}
                    {item.entities.length ? ` | Varlık: ${item.entities.map((entity) => `${entity.label}${entity.relationship ? `/${entity.relationship}` : ''}`).join(', ')}` : ''}
                    {item.emotions.length ? ` | Duygu: ${item.emotions.join(', ')}` : ''}
                    {item.entityRelations.length ? ` | Bağ: ${item.entityRelations.map((relation) => `${relation.from} -> ${relation.to}`).join(', ')}` : ''}
                  </Text>
                ))}
              </>
            ) : (
              <Text style={styles.emptyText}>Kayıt yok</Text>
            )}
          </View>
        );
      })}
      {!hasAnyMemory ? <Text style={styles.emptyText}>Bu kaynakta henüz hafıza kaydı yok</Text> : null}
      {categoryCandidates.length ? (
        <View style={styles.topicGroup}>
          <Text style={styles.groupTitle}>Önerilen yeni kategoriler</Text>
          {categoryCandidates.map((item) => (
            <Text key={item.key} style={styles.itemText}>
              {item.group} / {item.subgroup} - {item.count} kez - {item.reason}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function observationKindLabel(kind: MemoryObservation['kind']) {
  const map: Record<MemoryObservation['kind'], string> = {
    event: 'Olay',
    fact: 'Olgu',
    person: 'Kişi',
    emotion: 'Duygu',
    state: 'Durum',
    question: 'Soru',
    decision: 'Karar',
    environment: 'Çevre',
  };
  return map[kind] || 'Kayıt';
}

function relationLabel(raw: string) {
  const value = (raw || '').trim().toLowerCase();
  const map: Record<string, string> = {
    mother: 'annesi',
    father: 'babası',
    partner: 'sevgilisi',
    spouse: 'eşi',
    child: 'çocuğu',
    sibling: 'kardeşi',
    friend: 'arkadaşı',
    relative: 'akrabası',
    colleague: 'iş arkadaşı',
  };
  return map[value] || raw;
}

function renderPeopleList(title: string, items: ProfilePersonMemory[]) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.length ? items.map((item) => (
        <Text key={item.id} style={styles.itemText}>{item.label} - {relationLabel(item.relationship)}</Text>
      )) : <Text style={styles.emptyText}>Kayıt yok</Text>}
    </View>
  );
}

function renderBirthLine(snippet: ProfileMemorySnippet | null) {
  if (!snippet) return null;
  const birth = snippet.birthChartData;
  const location = [birth.cityOrRegion, birth.country].filter(Boolean).join(', ');
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Profil Bilgileri ve Doğum Verisi</Text>
      <Text style={styles.itemText}>
        {snippet.profileInfo.displayName} - {snippet.profileInfo.isAccountOwner ? 'hesap sahibi' : snippet.profileInfo.relationshipToAccountOwner}
      </Text>
      <Text style={styles.itemText}>Cinsiyet: {genderLabel(snippet.profileInfo.gender)}</Text>
      <Text style={styles.itemText}>
        Doğum: {birth.birthDate || 'kayıt yok'} {birth.hasExactBirthTime ? `- ${birth.birthTime}` : birth.birthDate ? '- saat bilinmiyor' : ''}
      </Text>
      <Text style={styles.itemText}>Yer: {location || birth.freeformLocation || 'kayıt yok'}</Text>
      <Text style={styles.itemText}>Harita hassasiyeti: {chartPrecisionLabel(birth.chartPrecision)}</Text>
    </View>
  );
}

function renderTestResults(observations: MemoryObservation[]) {
  const testItemsByTitle = new Map<string, MemoryObservation>();
  observations
    .filter((item) => item.key.startsWith('test:') || item.subgroup === 'kişilik eğilimi')
    .forEach((item) => {
      if (!testItemsByTitle.has(item.title)) {
        testItemsByTitle.set(item.title, item);
      }
    });
  const testItems = [...testItemsByTitle.values()];
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Test Sonuçları</Text>
      {testItems.length ? (
        testItems.map((item) => (
          <View key={`test-${item.id}`} style={styles.testResultBox}>
            <Text style={styles.testResultTitle}>{item.title}</Text>
            <Text style={styles.itemText}>{item.summary}</Text>
          </View>
        ))
      ) : (
        <Text style={styles.emptyText}>Kayıt yok</Text>
      )}
    </View>
  );
}

function renderPromptPack(snippet: ProfileMemorySnippet | null) {
  const formatted = formatPromptMemoryPack(snippet);
  if (!formatted) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Okuma Promptuna Gidecek Hafıza Özeti</Text>
      {formatted.split('\n').map((item) => <Text key={`prompt-pack-${item}`} style={styles.itemText}>{item}</Text>)}
    </View>
  );
}

function renderV2Audit(bundle: ProfileMemoryBundle | null, snippet: ProfileMemorySnippet | null) {
  if (!bundle) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Memory V2 Audit</Text>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Prompt Kullanım Kuralları</Text>
        {snippet?.promptMemoryPack?.toneRules?.length ? (
          snippet.promptMemoryPack.toneRules.map((item) => <Text key={`tone-${item}`} style={styles.emptyText}>{item}</Text>)
        ) : (
          <Text style={styles.emptyText}>Kayıt yok</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Son Journal Kayıtları</Text>
        {bundle.sessionJournals?.length ? (
          bundle.sessionJournals.slice(0, 5).map((item) => (
            <View key={item.journalId} style={styles.testResultBox}>
              <Text style={styles.testResultTitle}>{new Date(item.createdAt).toLocaleString('tr-TR')}</Text>
              <Text style={styles.itemText}>{item.summary}</Text>
              {item.events.map((event) => <Text key={`${item.journalId}-event-${event}`} style={styles.emptyText}>Olay: {event}</Text>)}
              {item.memoryActions.map((action) => <Text key={`${item.journalId}-action-${action}`} style={styles.emptyText}>İşlem: {action}</Text>)}
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Kayıt yok</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Son Fingerprint Kayıtları</Text>
        {bundle.readingFingerprints?.length ? (
          bundle.readingFingerprints.slice(0, 5).map((item) => (
            <View key={item.fingerprintId} style={styles.testResultBox}>
              <Text style={styles.testResultTitle}>{item.readingType} - {new Date(item.createdAt).toLocaleString('tr-TR')}</Text>
              <Text style={styles.itemText}>Temalar: {item.themes.join(', ') || 'kayıt yok'}</Text>
              <Text style={styles.itemText}>Semboller: {item.symbols.join(', ') || 'kayıt yok'}</Text>
              <Text style={styles.itemText}>Kaçın: {item.phrasesToAvoid.join(', ') || 'kayıt yok'}</Text>
              {item.nextAngleSuggestion ? <Text style={styles.emptyText}>{item.nextAngleSuggestion}</Text> : null}
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Kayıt yok</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Typed Edge Kayıtları</Text>
        {bundle.memoryEdges?.length ? (
          bundle.memoryEdges.slice(0, 8).map((item) => (
            <Text key={item.edgeId} style={styles.itemText}>
              {item.edgeType}: {item.fromNodeKey} → {item.toNodeKey} - {item.explanation}
            </Text>
          ))
        ) : (
          <Text style={styles.emptyText}>Kayıt yok</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>User Semantic Wiki</Text>
        {snippet?.userSemanticWiki?.sections.length ? (
          snippet.userSemanticWiki.sections.slice(0, 8).map((item) => (
            <View key={item.sectionId} style={styles.testResultBox}>
              <Text style={styles.testResultTitle}>{item.pageKey} / {item.title}</Text>
              <Text style={styles.itemText}>{item.body}</Text>
              <Text style={styles.emptyText}>Önem: {item.importance} - Kullanım: {item.promptUse}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Kayıt yok</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Persona-User Relationship</Text>
        {snippet?.personaRelationships?.length ? (
          snippet.personaRelationships.slice(0, 8).map((item) => (
            <View key={item.relationshipId} style={styles.testResultBox}>
              <Text style={styles.testResultTitle}>{item.personaId}</Text>
              <Text style={styles.itemText}>{item.summary}</Text>
              {item.wantsMoreOf.length ? <Text style={styles.emptyText}>Daha çok: {item.wantsMoreOf.join(', ')}</Text> : null}
              {item.wantsLessOf.length ? <Text style={styles.emptyText}>Daha az: {item.wantsLessOf.join(', ')}</Text> : null}
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Kayıt yok</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Prompt Audit</Text>
        {bundle.promptAudits?.length ? (
          bundle.promptAudits.slice(0, 5).map((item) => (
            <View key={item.auditId} style={styles.testResultBox}>
              <Text style={styles.testResultTitle}>{new Date(item.createdAt).toLocaleString('tr-TR')} - {item.retrievalMode}</Text>
              {item.embeddingRetrieval ? (
                <View style={styles.inspectorRow}>
                  <Text style={styles.inspectorTitle}>Embedding Retrieval Inspector</Text>
                  <Text style={styles.emptyText}>Model: {item.embeddingRetrieval.modelName}</Text>
                  <Text style={styles.emptyText}>Query: {item.embeddingRetrieval.query || 'yok'}</Text>
                  {item.embeddingRetrieval.matches.length ? (
                    item.embeddingRetrieval.matches.map((match, index) => (
                      <View key={`${item.auditId}-embedding-${index}-${match.sourceTable}-${match.sourceId}`} style={styles.embeddingMatchBox}>
                        <Text style={styles.itemText}>
                          {match.sourceTable} · skor {match.score} · {match.promptUse}
                        </Text>
                        <Text style={styles.emptyText}>{match.label}</Text>
                        <Text style={styles.emptyText}>{match.reason}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>Eşleşme yok</Text>
                  )}
                </View>
              ) : null}
              {item.semanticSelector ? (
                <View style={styles.inspectorRow}>
                  <Text style={styles.inspectorTitle}>Semantic Selector Inspector</Text>
                  <Text style={styles.emptyText}>Model: {item.semanticSelector.modelName || 'fallback'}</Text>
                  <Text style={styles.emptyText}>Aday: {item.semanticSelector.candidateCount} · Fallback: {item.semanticSelector.fallback ? 'evet' : 'hayır'}</Text>
                  <Text style={styles.itemText}>USE: {item.semanticSelector.use.join(' | ') || 'yok'}</Text>
                  <Text style={styles.itemText}>BACKGROUND: {item.semanticSelector.background.join(' | ') || 'yok'}</Text>
                  <Text style={styles.itemText}>AVOID: {item.semanticSelector.avoidRepeat.join(' | ') || 'yok'}</Text>
                  <Text style={styles.itemText}>USER OVERRIDE: {item.semanticSelector.userOverride.join(' | ') || 'yok'}</Text>
                  {item.semanticSelector.candidates.length ? (
                    item.semanticSelector.candidates.slice(0, 15).map((candidate) => (
                      <View key={`${item.auditId}-selector-${candidate.id}`} style={styles.embeddingMatchBox}>
                        <Text style={styles.itemText}>
                          {candidate.id} · {candidate.kind} · {candidate.source} · skor {candidate.score}
                        </Text>
                        <Text style={styles.emptyText}>{candidate.text}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>Aday yok</Text>
                  )}
                </View>
              ) : null}
              <Text style={styles.itemText}>Observation: {item.selectedObservationIds.join(', ') || 'yok'}</Text>
              {item.reasons.map((reason) => <Text key={`${item.auditId}-${reason}`} style={styles.emptyText}>{reason}</Text>)}
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Kayıt yok</Text>
        )}
      </View>
    </View>
  );
}

function renderMemoryWriterDebug(params: {
  jobs: MemoryWriterDebugJob[];
  isBusy: boolean;
  note: string | null;
  onDraft: () => void;
  onRun: () => void;
  onApply: (jobId: string) => void;
  onClear: () => void;
}) {
  const latest = params.jobs[0] || null;
  const usage = latest?.usage;
  const inspectorSections = latest?.proposal?.semanticSections || [];
  const inspectorEdges = latest?.proposal?.graphEdges || [];
  const sectionWarnings = inspectorSections
    .map((item) => {
      const text = `${item.title} ${item.body}`;
      if (item.pageKey === 'user_preferences' && /doğum haritası|güneş burcu|yükselen|gezegen|numeroloji|mbti|kişilik testi/i.test(text)) {
        return `${item.pageKey}/${item.sectionKey}: Kendini Tanı/test içeriği user_preferences altında görünüyor.`;
      }
      if (item.pageKey === 'user_overview' && item.sectionKey === 'profile_basis') {
        return `${item.pageKey}/${item.sectionKey}: Deterministik profil bağlamı duplicate olabilir.`;
      }
      return null;
    })
    .filter(Boolean) as string[];
  const edgeWarnings = inspectorEdges
    .map((item) => {
      if (item.edgeType === 'related_to_person' && (!item.fromNodeKey.startsWith('profile:') || !item.toNodeKey.startsWith('profile:'))) {
        return `${item.fromNodeKey} → ${item.toNodeKey}: related_to_person sadece iki profil node arasında kullanılmalı.`;
      }
      return null;
    })
    .filter(Boolean) as string[];
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Memory Writer Debug</Text>
      <Text style={styles.emptyText}>
        Standart Gemini 2.5 Flash-Lite çağrısı ile profile identity, semantic wiki ve graph edge önerisi üretir.
      </Text>
      <View style={styles.actionRow}>
        <Pressable style={[styles.actionButton, styles.actionButtonSmall]} onPress={params.onDraft} disabled={params.isBusy}>
          <Text style={styles.actionButtonText}>Promptu Hazırla</Text>
        </Pressable>
        <Pressable style={[styles.actionButton, styles.actionButtonSmall]} onPress={params.onRun} disabled={params.isBusy}>
          <Text style={styles.actionButtonText}>Standart Call Çalıştır</Text>
        </Pressable>
      </View>
      <View style={styles.actionRow}>
        <Pressable
          style={[styles.actionButton, styles.actionButtonSmall, (!latest?.proposal || params.isBusy) && styles.actionButtonDisabled]}
          onPress={() => latest?.jobId && params.onApply(latest.jobId)}
          disabled={!latest?.proposal || params.isBusy}
        >
          <Text style={styles.actionButtonText}>Son Öneriyi Uygula</Text>
        </Pressable>
        <Pressable style={[styles.actionButton, styles.actionButtonSmall]} onPress={params.onClear} disabled={params.isBusy}>
          <Text style={styles.actionButtonText}>Debug Temizle</Text>
        </Pressable>
      </View>
      {params.note ? <Text style={styles.emptyText}>{params.note}</Text> : null}
      {latest ? (
        <View style={styles.testResultBox}>
          <Text style={styles.testResultTitle}>{latest.status} - {new Date(latest.updatedAt).toLocaleString('tr-TR')}</Text>
          <Text style={styles.itemText}>Model: {latest.modelName}</Text>
          {usage ? (
            <Text style={styles.itemText}>
              Token: input {usage.inputTokens} / output {usage.outputTokens} / total {usage.totalTokens}
            </Text>
          ) : null}
          {latest.error ? <Text style={styles.itemText}>Hata: {latest.error}</Text> : null}
          {latest.proposal?.profileIdentitySummary ? (
            <Text style={styles.itemText}>Identity: {latest.proposal.profileIdentitySummary}</Text>
          ) : null}
          {latest.proposal?.cavemanBrief ? (
            <Text style={styles.itemText}>Caveman: {latest.proposal.cavemanBrief}</Text>
          ) : null}
          {latest.proposal?.dedupeNotes?.length ? (
            <Text style={styles.emptyText}>Dedupe: {latest.proposal.dedupeNotes.join(' | ')}</Text>
          ) : null}
          {latest.proposal?.ignoredSignals?.length ? (
            <Text style={styles.emptyText}>Yok sayılan: {latest.proposal.ignoredSignals.join(' | ')}</Text>
          ) : null}
          {latest.proposal ? (
            <View style={styles.topicGroup}>
              <Text style={styles.groupTitle}>Proposal Inspector</Text>
              <Text style={styles.emptyText}>
                Sections: {inspectorSections.length} / Edges: {inspectorEdges.length} / Persona ilişkisi: {latest.proposal.personaRelationships?.length || 0}
              </Text>
              {sectionWarnings.length || edgeWarnings.length ? (
                [...sectionWarnings, ...edgeWarnings].map((warning) => (
                  <Text key={`inspector-warning-${warning}`} style={styles.warningText}>Uyarı: {warning}</Text>
                ))
              ) : (
                <Text style={styles.emptyText}>Belirgin raf/edge uyarısı yok.</Text>
              )}
              {inspectorSections.map((item, index) => (
                <View key={`inspector-section-${index}-${item.pageKey}-${item.sectionKey}-${item.title}`} style={styles.inspectorRow}>
                  <Text style={styles.inspectorTitle}>Section: {item.pageKey}/{item.sectionKey}</Text>
                  <Text style={styles.emptyText}>sourceStrength: {item.sourceStrength} / promptUse: {item.promptUse} / importance: {item.importance}</Text>
                  <Text style={styles.itemText}>{item.title}</Text>
                </View>
              ))}
              {inspectorEdges.map((item, index) => (
                <View key={`inspector-edge-${index}-${item.fromNodeKey}-${item.edgeType}-${item.toNodeKey}`} style={styles.inspectorRow}>
                  <Text style={styles.inspectorTitle}>Edge: {item.edgeType}</Text>
                  <Text style={styles.emptyText}>{item.fromNodeKey} → {item.toNodeKey}</Text>
                  <Text style={styles.itemText}>{item.explanation}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {latest.proposal?.semanticSections?.length ? (
            <View style={styles.topicGroup}>
              <Text style={styles.groupTitle}>Semantic section önerileri</Text>
              {latest.proposal.semanticSections.map((item, index) => (
                <Text key={`semantic-section-${index}-${item.pageKey}-${item.sectionKey}-${item.title}`} style={styles.emptyText}>
                  {item.pageKey}/{item.sectionKey}: {item.body}
                </Text>
              ))}
            </View>
          ) : null}
          {latest.proposal?.graphEdges?.length ? (
            <View style={styles.topicGroup}>
              <Text style={styles.groupTitle}>Graph edge önerileri</Text>
              {latest.proposal.graphEdges.map((item, index) => (
                <Text key={`graph-edge-${index}-${item.fromNodeKey}-${item.edgeType}-${item.toNodeKey}`} style={styles.emptyText}>
                  {item.fromNodeKey} --{item.edgeType}→ {item.toNodeKey}: {item.explanation}
                </Text>
              ))}
            </View>
          ) : null}
          <View style={styles.topicGroup}>
            <Text style={styles.groupTitle}>{latest.status === 'skipped' ? 'Hazırlanan prompt (API çağrısı yapılmadı)' : "LLM'e giden prompt"}</Text>
            <Text style={styles.promptText}>{latest.prompt}</Text>
          </View>
          {latest.rawResponse ? (
            <View style={styles.topicGroup}>
              <Text style={styles.groupTitle}>Ham yanıt (normalize edilmemiş)</Text>
              <Text style={styles.promptText}>{latest.rawResponse}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <Text style={styles.emptyText}>Henüz Memory Writer job yok</Text>
      )}
    </View>
  );
}

export function MemoryDebugScreen({ route, navigation }: Props) {
  const { profileId, profileName } = route.params;
  const [bundle, setBundle] = useState<ProfileMemoryBundle | null>(null);
  const [snippet, setSnippet] = useState<ProfileMemorySnippet | null>(null);
  const [maintenanceNote, setMaintenanceNote] = useState<string | null>(null);
  const [writerJobs, setWriterJobs] = useState<MemoryWriterDebugJob[]>([]);
  const [writerNote, setWriterNote] = useState<string | null>(null);
  const [writerBusy, setWriterBusy] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);
  const [clearNote, setClearNote] = useState<string | null>(null);

  const loadBundle = useCallback(async () => {
    const state = await loadAccountState();
    const [next, nextSnippet] = await Promise.all([
      loadProfileMemoryBundle(state, profileId),
      loadProfileMemorySnippet(state, profileId),
    ]);
    const jobs = await loadMemoryWriterDebugJobs(profileId);
    setBundle(next);
    setSnippet(nextSnippet);
    setWriterJobs(jobs);
  }, [profileId]);

  useEffect(() => {
    navigation.setOptions({ title: `${profileName} - Hafıza` });
    void loadBundle();

    const unsubscribe = navigation.addListener('focus', () => {
      void loadBundle();
    });

    return unsubscribe;
  }, [loadBundle, navigation, profileName]);

  const runMaintenance = useCallback(async () => {
    setMaintenanceNote('Hafıza bakımı çalışıyor...');
    const result = await runMemoryMaintenanceForAllProfiles();
    setMaintenanceNote(`${result.length} profil için bakım tamamlandı.`);
    await loadBundle();
  }, [loadBundle]);

  const createWriterDraft = useCallback(async () => {
    setWriterBusy(true);
    setWriterNote('Memory Writer promptu hazırlanıyor...');
    try {
      const job = await createProfileIdentityMemoryWriterDraft(profileId);
      setWriterJobs([job, ...writerJobs.filter((item) => item.jobId !== job.jobId)]);
      setWriterNote('Prompt hazırlandı. API çağrısı yapılmadı.');
    } finally {
      setWriterBusy(false);
    }
  }, [profileId, writerJobs]);

  const runWriter = useCallback(async () => {
    setWriterBusy(true);
    setWriterNote('Memory Writer standart çağrı çalışıyor...');
    try {
      const job = await runProfileIdentityMemoryWriter(profileId);
      setWriterJobs([job, ...writerJobs.filter((item) => item.jobId !== job.jobId)]);
      setWriterNote(
        job.status === 'succeeded'
          ? 'Memory Writer önerisi geldi.'
          : job.status === 'skipped'
            ? 'Yeterli semantik kanıt yoktu; API çağrısı yapılmadan deterministik öneri üretildi.'
            : 'Memory Writer çağrısı tamamlanamadı.',
      );
    } finally {
      setWriterBusy(false);
    }
  }, [profileId, writerJobs]);

  const applyWriterJob = useCallback(async (jobId: string) => {
    setWriterBusy(true);
    setWriterNote('Memory Writer önerisi uygulanıyor...');
    try {
      const job = await applyMemoryWriterDebugJob(jobId);
      if (job) {
        setWriterJobs([job, ...writerJobs.filter((item) => item.jobId !== job.jobId)]);
      }
      await loadBundle();
      setWriterNote('Öneri uygulandı ve hafıza yeniden yüklendi.');
    } finally {
      setWriterBusy(false);
    }
  }, [loadBundle, writerJobs]);

  const clearWriterJobs = useCallback(async () => {
    await clearMemoryWriterDebugJobs(profileId);
    setWriterJobs([]);
    setWriterNote('Memory Writer debug temizlendi.');
  }, [profileId]);

  const clearAllMemory = useCallback(() => {
    Alert.alert(
      'Hafızayı sil',
      'Bu işlem seçili profile ait okuma geçmişini, follow-up sorularını, okuma öncesi konu girişlerini ve tüm hafıza kayıtlarını siler. Profilin kendisi ve profil bilgileri silinmez.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Hafızayı sil',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setClearBusy(true);
              setClearNote('Hafıza siliniyor...');
              try {
                await clearProfileMemoryAndReadings(profileId);
                await Promise.all([
                  clearMemoryWriterDebugJobs(profileId),
                  clearAstroCachesForProfile(profileId),
                  clearPersonalNumerologyCachesForProfile(profileId),
                  deleteBirthChartInterpretationSession(profileId),
                ]);
                setWriterJobs([]);
                await loadBundle();
                setClearNote('Hafıza, okuma geçmişi ve takip soruları silindi. Profil kayıtları korundu.');
              } catch (err) {
                setClearNote(err instanceof Error ? err.message : 'Hafıza silinirken hata oluştu.');
              } finally {
                setClearBusy(false);
              }
            })();
          },
        },
      ],
    );
  }, [loadBundle, profileId]);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <BrandedScrollView contentContainerStyle={styles.content} showScrollToTop>
        <View style={styles.card}>
          <Pressable
            style={[styles.actionButton, styles.dangerButton, clearBusy && styles.actionButtonDisabled]}
            onPress={clearAllMemory}
            disabled={clearBusy}
          >
            <Text style={styles.dangerButtonText}>Hafızayı Sil</Text>
          </Pressable>
          <Text style={styles.emptyText}>
            Profil silinmez; yalnızca bu profile ait hafıza, okuma geçmişi, follow-up soruları ve okuma öncesi konu girişleri temizlenir.
          </Text>
          {clearNote ? <Text style={styles.emptyText}>{clearNote}</Text> : null}
        </View>

        <View style={styles.card}>
          <Pressable style={styles.actionButton} onPress={runMaintenance}>
            <Text style={styles.actionButtonText}>Hafıza Bakımını Çalıştır</Text>
          </Pressable>
          {maintenanceNote ? <Text style={styles.emptyText}>{maintenanceNote}</Text> : null}
          {renderBirthLine(snippet)}
          {bundle ? renderTestResults(bundle.userStated.observations) : null}
          {snippet?.prominentRelations.length ? renderPeopleList('Tekilleştirilmiş öne çıkan ilişkiler', snippet.prominentRelations) : null}
          {renderPromptPack(snippet)}
        </View>

        {renderMemoryWriterDebug({
          jobs: writerJobs,
          isBusy: writerBusy,
          note: writerNote,
          onDraft: () => void createWriterDraft(),
          onRun: () => void runWriter(),
          onApply: (jobId) => void applyWriterJob(jobId),
          onClear: () => void clearWriterJobs(),
        })}

        {renderV2Audit(bundle, snippet)}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Kullanıcı Kaynaklı Taksonomi</Text>
          {bundle ? (
            renderTaxonomyMemory(
              'Kullanıcının yazdıkları',
              bundle.userStated.recurringTopics,
              bundle.userStated.importantPeople,
              bundle.userStated.emotionalPatterns,
              bundle.userStated.observations,
              bundle.userStated.categoryCandidates,
            )
          ) : (
            <Text style={styles.emptyText}>Yükleniyor...</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Okuma Kaynaklı Taksonomi</Text>
          {bundle ? (
            renderTaxonomyMemory(
              'Okumalarda çıkanlar',
              bundle.readingDerived.recurringTopics,
              bundle.readingDerived.importantPeople,
              bundle.readingDerived.emotionalPatterns,
              bundle.readingDerived.observations,
              bundle.readingDerived.categoryCandidates,
            )
          ) : (
            <Text style={styles.emptyText}>Yükleniyor...</Text>
          )}
        </View>
      </BrandedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#14141E' },
  content: { padding: 18, paddingBottom: 36 },
  card: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: 'rgba(30,30,40,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.18)',
    marginBottom: 14,
  },
  cardTitle: { color: '#E8C49A', fontSize: 16, fontWeight: '700', marginBottom: 10 },
  section: { marginBottom: 14 },
  sectionTitle: { color: '#D4A574', fontSize: 13, fontWeight: '700', marginBottom: 6 },
  topicGroup: { marginBottom: 8 },
  groupTitle: { color: 'rgba(232,196,154,0.8)', fontSize: 12, fontWeight: '800', marginBottom: 3 },
  itemText: { color: '#FFF5E8', fontSize: 13, lineHeight: 20, marginBottom: 4 },
  testResultBox: {
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.16)',
  },
  testResultTitle: { color: '#F6C38B', fontSize: 13, fontWeight: '800', marginBottom: 4 },
  emptyText: { color: 'rgba(255,255,255,0.62)', fontSize: 12, lineHeight: 18 },
  actionButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: 'rgba(212,165,116,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.35)',
  },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionButtonSmall: { flex: 1, paddingHorizontal: 8 },
  actionButtonDisabled: { opacity: 0.45 },
  actionButtonText: { color: '#F6C38B', fontSize: 13, fontWeight: '800' },
  dangerButton: {
    backgroundColor: 'rgba(180,64,52,0.22)',
    borderColor: 'rgba(255,130,112,0.45)',
  },
  dangerButtonText: { color: '#FFB4A8', fontSize: 13, fontWeight: '900' },
  promptText: { color: 'rgba(255,255,255,0.72)', fontSize: 10, lineHeight: 15 },
  inspectorRow: {
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(246,195,139,0.45)',
    paddingLeft: 8,
    marginTop: 8,
  },
  embeddingMatchBox: {
    borderRadius: 8,
    padding: 8,
    marginTop: 6,
    backgroundColor: 'rgba(212,165,116,0.08)',
  },
  inspectorTitle: { color: '#F6C38B', fontSize: 12, fontWeight: '800', marginBottom: 2 },
  warningText: { color: '#FFB4A8', fontSize: 12, lineHeight: 18 },
});
