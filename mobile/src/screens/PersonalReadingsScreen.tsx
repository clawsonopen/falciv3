import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { APP_NAME, DEFAULT_DEV_SETTINGS } from '../config/constants';
import { BrandedConfirmModal } from '../components/BrandedConfirmModal';
import { getPrimaryProfile, loadAccountState } from '../services/profileMemoryService';
import { hasRequiredAstroBirthInputs } from '../services/astroEngine';
import type { SubjectProfile } from '../types/memory';

type Props = NativeStackScreenProps<RootStackParamList, 'PersonalReadings'>;

type ReadingTypeItem = {
  id:
    | 'birth-chart'
    | 'coffee'
    | 'palm'
    | 'astro-personal'
    | 'tarot-personal'
    | 'numerology-personal'
    | 'angel-personal'
    | 'manifest-chat';
  title: string;
  shortTitle: string;
  currentlyAvailable: boolean;
};

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

export function PersonalReadingsScreen({ navigation, route }: Props) {
  const devSettings = route.params?.devSettings || DEFAULT_DEV_SETTINGS;
  const [profiles, setProfiles] = useState<SubjectProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [pendingType, setPendingType] = useState<ReadingTypeItem | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [infoModal, setInfoModal] = useState<{ visible: boolean; message: string; title: string }>({
    visible: false,
    message: '',
    title: APP_NAME,
  });

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

  const types: ReadingTypeItem[] = useMemo(
    () => [
      {
        id: 'birth-chart',
        title: 'Doğum Haritası',
        shortTitle: 'DOĞUM HARİTASI',
        currentlyAvailable: true,
      },
      {
        id: 'coffee',
        title: 'Kahve Falı',
        shortTitle: 'Kahve',
        currentlyAvailable: true,
      },
      {
        id: 'palm',
        title: 'El / Pati Falı',
        shortTitle: 'El / Pati',
        currentlyAvailable: true,
      },
      {
        id: 'astro-personal',
        title: 'Astroloji',
        shortTitle: 'Astroloji',
        currentlyAvailable: true,
      },
      {
        id: 'tarot-personal',
        title: 'Kişiye Özel Tarot',
        shortTitle: 'Tarot',
        currentlyAvailable: false,
      },
      {
        id: 'numerology-personal',
        title: 'Kişiye Özel Numeroloji',
        shortTitle: 'Numeroloji',
        currentlyAvailable: false,
      },
      {
        id: 'angel-personal',
        title: 'Kişiye Özel Melek Kartları',
        shortTitle: 'Melek',
        currentlyAvailable: false,
      },
      {
        id: 'manifest-chat',
        title: 'Sohbetli Manifestleme',
        shortTitle: 'Manifest',
        currentlyAvailable: false,
      },
    ],
    [],
  );

  const handleTypePress = useCallback(
    (item: ReadingTypeItem) => {
      if (!selectedProfile) {
        setInfoModal({
          visible: true,
          title: APP_NAME,
          message: 'Önce bir profil seçmelisin.',
        });
        return;
      }

      if (!item.currentlyAvailable) {
        setInfoModal({
          visible: true,
          title: 'Yakında',
          message: `${item.title} çok yakında aktif olacak.`,
        });
        return;
      }

      if (item.id === 'birth-chart') {
        if (!hasRequiredAstroBirthInputs(selectedProfile)) {
          setInfoModal({
            visible: true,
            title: 'Profil Bilgisi Gerekli',
            message:
              'Doğum haritası için bu profilde doğum tarihi + doğum ülkesi + doğum şehri olmalı. Profil Ayarları ekranından tamamlayabilirsin.',
          });
          return;
        }
        navigation.navigate('PersonalBirthChart', {
          profileId: selectedProfile.profileId,
        });
        return;
      }

      if (item.id === 'astro-personal' && !hasRequiredAstroBirthInputs(selectedProfile)) {
        setInfoModal({
          visible: true,
          title: 'Profil Bilgisi Gerekli',
          message:
            'Kişiye özel astro için bu profilde doğum tarihi + doğum ülkesi + doğum şehri olmalı. Profil Ayarları ekranından tamamlayabilirsin.',
        });
        return;
      }

      setPendingType(item);
      setConfirmVisible(true);
    },
    [selectedProfile],
  );

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Kimin İçin Baktıracaksın?</Text>
          <Text style={styles.helperText}>Kişiye özel akışta önce profili seç, sonra aynı ekrandan fal tipine geç.</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {profiles.map((profile) => {
              const selected = profile.profileId === selectedProfileId;
              return (
                <TouchableOpacity
                  key={profile.profileId}
                  style={[styles.profileCard, selected && styles.profileCardSelected]}
                  onPress={() => setSelectedProfileId(profile.profileId)}
                >
                  <Text style={styles.profileName}>{profile.displayName}</Text>
                  <Text style={styles.profileMeta}>{profileBadge(profile)}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Kişiye Özel Fal Türleri</Text>
          <View style={styles.grid}>
            {types.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.typeSquareCard, !item.currentlyAvailable && styles.typeSquareCardDisabled]}
                onPress={() => handleTypePress(item)}
              >
                <Text style={styles.typeSquareTitle}>{item.shortTitle}</Text>
                <Text style={item.currentlyAvailable ? styles.typeSquareStateActive : styles.typeSquareStateSoon}>
                  {item.currentlyAvailable ? 'Şimdi aktif' : 'Yakında'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <BrandedConfirmModal
        visible={confirmVisible}
        title={APP_NAME}
        message={
          pendingType && selectedProfile
            ? `${selectedProfile.displayName} için ${pendingType.title} seçildi. Devam edelim mi?`
            : 'Bu profil için devam edelim mi?'
        }
        confirmLabel="Evet"
        cancelLabel="Hayır"
        onConfirm={() => {
          if (!pendingType || !selectedProfile) return;
          const selectedType = pendingType;
          setPendingType(null);
          setConfirmVisible(false);
          if (selectedType.id === 'birth-chart') {
            navigation.navigate('PersonalBirthChart', {
              profileId: selectedProfile.profileId,
            });
            return;
          }
          navigation.navigate('PersonalAssistantSelect', {
            devSettings,
            profileId: selectedProfile.profileId,
            readingType: selectedType.id,
          });
        }}
        onCancel={() => {
          setPendingType(null);
          setConfirmVisible(false);
        }}
      />

      <BrandedConfirmModal
        visible={infoModal.visible}
        title={infoModal.title}
        message={infoModal.message}
        confirmLabel="Tamam"
        cancelLabel="Kapat"
        onConfirm={() => setInfoModal({ visible: false, message: '', title: APP_NAME })}
        onCancel={() => setInfoModal({ visible: false, message: '', title: APP_NAME })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#14141E' },
  content: { padding: 18, paddingBottom: 30 },
  panel: {
    marginBottom: 14,
    borderRadius: 18,
    padding: 16,
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  typeSquareCard: {
    width: '31.5%',
    aspectRatio: 1,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.2)',
    backgroundColor: 'rgba(0,0,0,0.16)',
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeSquareCardDisabled: { opacity: 0.72 },
  typeSquareTitle: {
    color: '#FFF5E8',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  typeSquareStateActive: {
    color: '#7DDC9A',
    borderColor: 'rgba(125,220,154,0.45)',
    borderWidth: 1,
    borderRadius: 9,
    fontSize: 9,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  typeSquareStateSoon: {
    color: '#F6C38B',
    borderColor: 'rgba(246,195,139,0.45)',
    borderWidth: 1,
    borderRadius: 9,
    fontSize: 9,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});
