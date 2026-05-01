import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { loadAccountState, loadProfileMemoryBundle, loadProfileMemorySnippet } from '../services/profileMemoryService';
import type { ProfileMemoryBundle, ProfileMemorySnippet, ProfilePatternMemory, ProfilePersonMemory, ProfileTopicMemory } from '../types/memory';

type Props = NativeStackScreenProps<RootStackParamList, 'MemoryDebug'>;

function renderTopicList(title: string, items: ProfileTopicMemory[]) {
  const groups = new Map<string, ProfileTopicMemory[]>();
  for (const item of items.slice(-10)) {
    const groupKey = `${item.group || 'Genel'} / ${item.subgroup || 'Diğer konuşulanlar'}`;
    groups.set(groupKey, [...(groups.get(groupKey) || []), item]);
  }
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.length ? Array.from(groups.entries()).map(([groupKey, groupItems]) => (
        <View key={groupKey} style={styles.topicGroup}>
          <Text style={styles.groupTitle}>{groupKey}</Text>
          {groupItems.map((item) => (
            <Text key={item.key} style={styles.itemText}>
              {item.label}{item.detailGroup ? ` - ${item.detailGroup}` : ''}
            </Text>
          ))}
        </View>
      )) : <Text style={styles.emptyText}>Kayıt yok</Text>}
    </View>
  );
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

function renderPatternList(title: string, items: ProfilePatternMemory[]) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.length ? items.map((item) => (
        <Text key={item.key} style={styles.itemText}>{item.label}</Text>
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
      <Text style={styles.itemText}>
        Doğum: {birth.birthDate || 'kayıt yok'} {birth.hasExactBirthTime ? `- ${birth.birthTime}` : birth.birthDate ? '- saat bilinmiyor' : ''}
      </Text>
      <Text style={styles.itemText}>Yer: {location || birth.freeformLocation || 'kayıt yok'}</Text>
      <Text style={styles.itemText}>Harita hassasiyeti: {birth.chartPrecision}</Text>
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
          <Text style={styles.cardTitle}>Kullanıcının Yazdıkları</Text>
          {bundle ? (
            <>
              {renderTopicList('Konuşulan konular (son 10)', bundle.userStated.recurringTopics)}
              {renderPeopleList('Öne çıkan ilişkiler (son 10)', bundle.userStated.importantPeople)}
              {renderPatternList('Duygusal kalıplar (son 10)', bundle.userStated.emotionalPatterns)}
            </>
          ) : (
            <Text style={styles.emptyText}>Yükleniyor...</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fallarda Çıkanlar</Text>
          {bundle ? (
            <>
              {renderTopicList('Tekrar eden konular (son 10)', bundle.readingDerived.recurringTopics)}
              {renderPeopleList('Öne çıkan ilişkiler (son 10)', bundle.readingDerived.importantPeople)}
            </>
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
