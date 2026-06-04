import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { BrandedConfirmModal } from '../components/BrandedConfirmModal';
import { APP_NAME } from '../config/constants';
import { hasRequiredAstroBirthInputs } from '../services/astroEngine';
import { hasRequiredNumerologyInputs } from '../services/personalNumerologyEngine';
import { getPrimaryProfile, loadAccountState } from '../services/profileMemoryService';
import type { SubjectProfile } from '../types/memory';
import { BrandedScrollView } from '../components/BrandedScrollView';

type Props = NativeStackScreenProps<RootStackParamList, 'SelfKnowledge'>;

type SelfKnowledgeItem = {
  id: 'birth-chart' | 'numerology-core' | 'tests';
  title: string;
  description: string;
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

export function SelfKnowledgeScreen({ navigation }: Props) {
  const [profiles, setProfiles] = useState<SubjectProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [infoModal, setInfoModal] = useState<{ visible: boolean; title: string; message: string; profileAction: boolean }>({
    visible: false,
    title: APP_NAME,
    message: '',
    profileAction: false,
  });

  const loadProfiles = useCallback(async () => {
    const state = await loadAccountState();
    const sorted = sortProfiles(state.profiles, state.primaryProfileId);
    setProfiles(sorted);
    const fallback = getPrimaryProfile(state)?.profileId || sorted[0]?.profileId || null;
    setSelectedProfileId((current) => (current && sorted.some((profile) => profile.profileId === current) ? current : fallback));
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

  const items: SelfKnowledgeItem[] = useMemo(
    () => [
      {
        id: 'birth-chart',
        title: 'Doğum Haritası',
        description: 'Doğum anındaki gökyüzü yerleşimlerinden karakter, potansiyel ve yaşam temalarını gör.',
      },
      {
        id: 'numerology-core',
        title: 'Temel Numeroloji',
        description: 'İsim ve doğum tarihinden yaşam yolu, kader, ruh arzusu ve ana sayı haritası çıkarılır.',
      },
      {
        id: 'tests',
        title: 'Testler',
        description: 'Kişilik, uyum, bağlanma, değerler ve stresle başa çıkma testleri arasından seçim yap.',
      },
    ],
    [],
  );

  const closeInfoModal = useCallback(() => {
    setInfoModal({ visible: false, title: APP_NAME, message: '', profileAction: false });
  }, []);

  const openProfileSettings = useCallback(() => {
    const targetProfileId = selectedProfile?.profileId;
    closeInfoModal();
    navigation.navigate('ProfileSettings', targetProfileId ? { profileId: targetProfileId } : undefined);
  }, [closeInfoModal, navigation, selectedProfile?.profileId]);

  const handleItemPress = useCallback(
    (item: SelfKnowledgeItem) => {
      if (!selectedProfile) {
        setInfoModal({
          visible: true,
          title: APP_NAME,
          message: 'Kendini tanıma akışları için önce bir profil oluşturmalı veya seçmelisin.',
          profileAction: true,
        });
        return;
      }

      if (item.id === 'birth-chart') {
        if (!hasRequiredAstroBirthInputs(selectedProfile)) {
          setInfoModal({
            visible: true,
            title: 'Profil Bilgisi Gerekli',
            message:
              'Doğum haritası için bu profilde doğum tarihi, doğum ülkesi ve doğum şehri olmalı. Doğum saati varsa yükselen ve evler de netleşir. Profil Ayarları ekranından tamamlayabilirsin.',
            profileAction: true,
          });
          return;
        }
        navigation.navigate('PersonalBirthChart', { profileId: selectedProfile.profileId });
        return;
      }

      if (item.id === 'numerology-core') {
        if (!hasRequiredNumerologyInputs(selectedProfile)) {
          setInfoModal({
            visible: true,
            title: 'Profil Bilgisi Gerekli',
            message: 'Temel numeroloji için profil adı ve doğum tarihi yeterli. Profil Ayarları ekranından tamamlayabilirsin.',
            profileAction: true,
          });
          return;
        }
        navigation.navigate('PersonalNumerologyReading', {
          profileId: selectedProfile.profileId,
          assistantId: 'berk',
          initialMode: 'core',
        });
        return;
      }

      navigation.navigate('MbtiTest', { profileId: selectedProfile.profileId });
    },
    [navigation, selectedProfile],
  );

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <BrandedScrollView contentContainerStyle={styles.content} showScrollToTop>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Kimin İçin Öğreniyoruz?</Text>
          <Text style={styles.helperText}>Harita, numeroloji ve test sonuçları seçili profilin hafızasına işlenir.</Text>
          {profiles.length ? (
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
          ) : (
            <View style={styles.emptyProfileBox}>
              <Text style={styles.emptyProfileText}>Henüz seçim yapabileceğin bir profil yok. Profil Ayarlarına gidip profil oluşturmalısın.</Text>
              <View style={styles.emptyProfileActions}>
                <TouchableOpacity style={styles.emptyProfileButton} onPress={() => navigation.navigate('ProfileSettings')}>
                  <Text style={styles.emptyProfileButtonText}>Profil Ayarlarına Git</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.emptyProfileGhostButton} onPress={() => void loadProfiles()}>
                  <Text style={styles.emptyProfileGhostButtonText}>Profilleri Yenile</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Kendini Tanı</Text>
          <View style={styles.grid}>
            {items.map((item) => (
              <TouchableOpacity key={item.id} style={styles.itemCard} activeOpacity={0.84} onPress={() => handleItemPress(item)}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemDescription}>{item.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </BrandedScrollView>

      <BrandedConfirmModal
        visible={infoModal.visible}
        title={infoModal.title}
        message={infoModal.message}
        confirmLabel={infoModal.profileAction ? null : 'Tamam'}
        cancelLabel="Kapat"
        extraActionLabel={infoModal.profileAction ? 'Profil Ayarlarına Git' : null}
        onExtraAction={infoModal.profileAction ? openProfileSettings : undefined}
        onConfirm={closeInfoModal}
        onCancel={closeInfoModal}
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
    backgroundColor: 'rgba(30,30,40,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.18)',
  },
  panelTitle: { color: '#E8C49A', fontSize: 16, fontWeight: '800', marginBottom: 10 },
  helperText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 18, marginBottom: 10 },
  profileCard: {
    width: 100,
    minHeight: 90,
    marginRight: 10,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.18)',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  profileCardSelected: { borderColor: '#D4A574', backgroundColor: 'rgba(212,165,116,0.14)' },
  profileName: { color: '#FFF5E8', fontSize: 14, fontWeight: '800', marginBottom: 4 },
  profileMeta: { color: 'rgba(212,165,116,0.72)', fontSize: 12 },
  emptyProfileBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.28)',
    backgroundColor: 'rgba(0,0,0,0.16)',
    padding: 12,
  },
  emptyProfileText: { color: 'rgba(255,255,255,0.72)', fontSize: 12, lineHeight: 18, marginBottom: 10 },
  emptyProfileButton: {
    borderRadius: 12,
    backgroundColor: '#D4A574',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  emptyProfileButtonText: { color: '#14141E', fontSize: 12, fontWeight: '900' },
  emptyProfileActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emptyProfileGhostButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.42)',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  emptyProfileGhostButtonText: { color: '#E8C49A', fontSize: 12, fontWeight: '900' },
  grid: { gap: 12 },
  itemCard: {
    minHeight: 108,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.2)',
    backgroundColor: 'rgba(0,0,0,0.16)',
    justifyContent: 'center',
  },
  itemTitle: { color: '#FFF5E8', fontSize: 16, fontWeight: '900', marginBottom: 8 },
  itemDescription: { color: 'rgba(212,165,116,0.74)', fontSize: 12, lineHeight: 18 },
});
