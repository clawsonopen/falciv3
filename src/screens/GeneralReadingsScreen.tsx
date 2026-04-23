import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import type { SubjectProfile } from '../types/memory';
import { getPrimaryProfile, loadAccountState } from '../services/profileMemoryService';

type Props = NativeStackScreenProps<RootStackParamList, 'GeneralReadings'>;

type GeneralReadingItem = {
  id: string;
  title: string;
  description: string;
  isPaid: boolean;
  refreshLabel: string;
};

function weekRangeLabel(date = new Date()) {
  const day = date.getDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const format = (d: Date) => d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
  return `${format(monday)} - ${format(sunday)}`;
}

function monthLabel(date = new Date()) {
  return date.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
}

function profileBadge(profile: SubjectProfile) {
  if (profile.relationshipPrimary === 'kendi') return 'Kendim';
  if (profile.relationshipPrimary === 'cocuk') return 'Çocuk';
  if (profile.relationshipPrimary === 'es') return 'Eş';
  return profile.relationshipPrimary;
}

function sortProfiles(profiles: SubjectProfile[], primaryProfileId: string | null) {
  return [...profiles].sort((a, b) => {
    const aSelf = a.profileId === primaryProfileId || a.relationshipPrimary === 'kendi' || a.isPrimary;
    const bSelf = b.profileId === primaryProfileId || b.relationshipPrimary === 'kendi' || b.isPrimary;
    if (aSelf !== bSelf) return aSelf ? -1 : 1;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export function GeneralReadingsScreen({ navigation }: Props) {
  const [profiles, setProfiles] = useState<SubjectProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [confirmedProfileId, setConfirmedProfileId] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    const state = await loadAccountState();
    const sorted = sortProfiles(state.profiles, state.primaryProfileId);
    setProfiles(sorted);
    const fallback = getPrimaryProfile(state)?.profileId || sorted[0]?.profileId || null;
    setSelectedProfileId((current) => (current && sorted.some((p) => p.profileId === current) ? current : fallback));
  }, []);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      void loadProfiles();
    });
    return unsubscribe;
  }, [loadProfiles, navigation]);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.profileId === selectedProfileId) || null,
    [profiles, selectedProfileId],
  );

  const confirmedProfile = useMemo(
    () => profiles.find((profile) => profile.profileId === confirmedProfileId) || null,
    [confirmedProfileId, profiles],
  );

  const items: GeneralReadingItem[] = useMemo(
    () => [
      {
        id: 'astro-daily',
        title: 'Genel Astro Günlük',
        description: 'Yükselen veya ay burcunu dikkate almayan, 3-4 ana konuya değinen kısa genel yorum.',
        isPaid: false,
        refreshLabel: 'Her gun yenilenir',
      },
      {
        id: 'astro-weekly',
        title: 'Genel Astro Haftalık',
        description: 'Haftanın genel ritmi, fırsatlar ve dikkat edilmesi gereken ana başlıklar.',
        isPaid: false,
        refreshLabel: `Pazar akşamı yenilenir (${weekRangeLabel()})`,
      },
      {
        id: 'astro-monthly',
        title: 'Genel Astro Aylık',
        description: 'Ayın genel gündemi. 3 aylık ve yıllık bu bölümde yer almaz.',
        isPaid: true,
        refreshLabel: `Ayın son günü yenilenir (${monthLabel()})`,
      },
      {
        id: 'fortune-cookie',
        title: 'Kısmet Kurabiyesi',
        description: 'Kısa ve motive edici günlük mesaj.',
        isPaid: false,
        refreshLabel: 'Günlük',
      },
      {
        id: 'magic-ball',
        title: 'Sihirli Küre',
        description: 'Tek soru için hızlı ve eğlenceli yanıt.',
        isPaid: false,
        refreshLabel: 'Günlük',
      },
      {
        id: 'daily-tarot',
        title: 'Günlük Tek Tarot Karti',
        description: 'Günlük enerjiye yönelik tek kartlik genel açılım.',
        isPaid: true,
        refreshLabel: 'Günlük',
      },
      {
        id: 'daily-angel',
        title: 'Günlük Melek Karti',
        description: 'Günlük niyet ve rehberlik odaklı tek kartlik okuma.',
        isPaid: true,
        refreshLabel: 'Günlük',
      },
      {
        id: 'daily-numerology',
        title: 'Günün Numerolojisi',
        description: 'Tarihten hesaplanan genel gün enerjisi yorumu.',
        isPaid: false,
        refreshLabel: 'Günlük',
      },
    ],
    [],
  );

  const confirmProfile = useCallback(() => {
    if (!selectedProfile) {
      Alert.alert('Eksik', 'Önce profil seçmelisin.');
      return;
    }

    Alert.alert(
      'Profil Onayı',
      `${selectedProfile.displayName} için bakıyoruz, emin misin?`,
      [
        { text: 'Hayır, geri git', style: 'cancel', onPress: () => setConfirmedProfileId(null) },
        { text: 'Evet, devam', onPress: () => setConfirmedProfileId(selectedProfile.profileId) },
      ],
    );
  }, [selectedProfile]);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Kimin İçin Baktıracaksın?</Text>
          <Text style={styles.helperText}>Genel okumalar daha kısa ve daha geneldir; yükselen veya ay burcu hesaba katılmaz.</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {profiles.map((profile) => {
              const selected = profile.profileId === selectedProfileId;
              return (
                <TouchableOpacity
                  key={profile.profileId}
                  style={[styles.profileCard, selected && styles.profileCardSelected]}
                  onPress={() => {
                    setSelectedProfileId(profile.profileId);
                    setConfirmedProfileId(null);
                  }}
                >
                  <Text style={styles.profileName}>{profile.displayName}</Text>
                  <Text style={styles.profileMeta}>{profileBadge(profile)}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity style={styles.primaryButton} onPress={confirmProfile}>
            <Text style={styles.primaryButtonText}>Profili Onayla</Text>
          </TouchableOpacity>
          {confirmedProfile ? <Text style={styles.confirmText}>Onaylandı: {confirmedProfile.displayName}</Text> : null}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Genel Fal Türleri</Text>
          {items.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.readingCard}
              onPress={() => {
                if (!confirmedProfile) {
                  Alert.alert('Eksik', 'Önce profil seçimini onaylamalısın.');
                  return;
                }
                Alert.alert('Hazırlanıyor', `${item.title} servisi bağlantı planında. Bu ekran akışı hazır.`);
              }}
            >
              <View style={styles.rowBetween}>
                <Text style={styles.readingTitle}>{item.title}</Text>
                <Text style={item.isPaid ? styles.paidTag : styles.freeTag}>{item.isPaid ? 'Ücretli' : 'Ücretsiz'}</Text>
              </View>
              <Text style={styles.readingDescription}>{item.description}</Text>
              <Text style={styles.refreshText}>{item.refreshLabel}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#14141E' },
  content: { padding: 18, paddingBottom: 30 },
  panel: {
    marginBottom: 14,
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(30, 30, 40, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.18)',
  },
  panelTitle: { color: '#E8C49A', fontSize: 16, fontWeight: '700', marginBottom: 10 },
  helperText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 18, marginBottom: 10 },
  profileCard: {
    width: 140,
    minHeight: 90,
    marginRight: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.18)',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  profileCardSelected: { borderColor: '#D4A574', backgroundColor: 'rgba(212,165,116,0.14)' },
  profileName: { color: '#FFF5E8', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  profileMeta: { color: 'rgba(212,165,116,0.72)', fontSize: 12 },
  primaryButton: {
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: '#D4A574',
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#14141E', fontSize: 14, fontWeight: '800' },
  confirmText: { marginTop: 8, color: '#F6C38B', fontSize: 12, fontWeight: '700' },
  readingCard: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.2)',
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  readingTitle: { color: '#FFF5E8', fontSize: 14, fontWeight: '700', flex: 1, paddingRight: 6 },
  readingDescription: { color: 'rgba(255,255,255,0.76)', fontSize: 12, lineHeight: 18, marginBottom: 4 },
  refreshText: { color: 'rgba(212,165,116,0.8)', fontSize: 11 },
  freeTag: {
    color: '#7DDC9A',
    borderColor: 'rgba(125,220,154,0.45)',
    borderWidth: 1,
    borderRadius: 9,
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  paidTag: {
    color: '#F6C38B',
    borderColor: 'rgba(246,195,139,0.45)',
    borderWidth: 1,
    borderRadius: 9,
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
});

