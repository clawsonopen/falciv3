import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { loadAccountState, loadProfileMemoryBundle, loadProfileMemorySnippet } from '../services/profileMemoryService';
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

export function MemoryDebugScreen({ route, navigation }: Props) {
  const { profileId, profileName } = route.params;
  const [bundle, setBundle] = useState<ProfileMemoryBundle | null>(null);
  const [snippet, setSnippet] = useState<ProfileMemorySnippet | null>(null);

  const loadBundle = useCallback(async () => {
    const state = await loadAccountState();
    const [next, nextSnippet] = await Promise.all([
      loadProfileMemoryBundle(state, profileId),
      loadProfileMemorySnippet(state, profileId),
    ]);
    setBundle(next);
    setSnippet(nextSnippet);
  }, [profileId]);

  useEffect(() => {
    navigation.setOptions({ title: `${profileName} - Hafıza` });
    void loadBundle();

    const unsubscribe = navigation.addListener('focus', () => {
      void loadBundle();
    });

    return unsubscribe;
  }, [loadBundle, navigation, profileName]);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          {renderBirthLine(snippet)}
          {snippet?.prominentRelations.length ? renderPeopleList('Tekilleştirilmiş öne çıkan ilişkiler', snippet.prominentRelations) : null}
        </View>

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
          <Text style={styles.cardTitle}>Fal Kaynaklı Taksonomi</Text>
          {bundle ? (
            renderTaxonomyMemory(
              'Fallarda çıkanlar',
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
      </ScrollView>
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
  emptyText: { color: 'rgba(255,255,255,0.62)', fontSize: 12, lineHeight: 18 },
});
