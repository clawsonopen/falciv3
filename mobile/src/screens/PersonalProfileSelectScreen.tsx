import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { BrandedConfirmModal } from '../components/BrandedConfirmModal';
import { BrandedScrollView } from '../components/BrandedScrollView';
import { getPrimaryProfile, loadAccountState } from '../services/profileMemoryService';
import type { SubjectProfile } from '../types/memory';

type Props = NativeStackScreenProps<RootStackParamList, 'PersonalProfileSelect'>;

function sortProfiles(profiles: SubjectProfile[], primaryProfileId: string | null) {
  return [...profiles].sort((a, b) => {
    const aSelf = a.profileId === primaryProfileId || a.relationshipPrimary === 'kendi' || a.isPrimary;
    const bSelf = b.profileId === primaryProfileId || b.relationshipPrimary === 'kendi' || b.isPrimary;
    if (aSelf !== bSelf) return aSelf ? -1 : 1;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

function profileBadge(profile: SubjectProfile) {
  if (profile.relationshipPrimary === 'kendi') return 'Kendim';
  if (profile.relationshipPrimary === 'es') return 'Eş';
  if (profile.relationshipPrimary === 'cocuk') return 'Çocuk';
  return profile.relationshipPrimary;
}

export function PersonalProfileSelectScreen({ navigation, route }: Props) {
  const { devSettings } = route.params;
  const [profiles, setProfiles] = useState<SubjectProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);

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

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.profileId === selectedProfileId) || null,
    [profiles, selectedProfileId],
  );

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <BrandedScrollView contentContainerStyle={styles.content} showScrollToTop>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>2. Profil Seçim Ekranı</Text>
          <Text style={styles.helperText}>Kimin için baktıracağını seç. Devam ile markalı onay penceresi açılır.</Text>
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
          {!profiles.length ? (
            <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('ProfileSettings')}>
              <Text style={styles.secondaryButtonText}>Profil Oluştur</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.primaryButton, !selectedProfile && styles.primaryButtonDisabled]}
            onPress={() => {
              if (!selectedProfile) {
                navigation.navigate('ProfileSettings');
                return;
              }
              setConfirmVisible(true);
            }}
          >
            <Text style={styles.primaryButtonText}>{selectedProfile ? 'Evet - Devam' : 'Profil Ayarlarına Git'}</Text>
          </TouchableOpacity>
        </View>
      </BrandedScrollView>

      <BrandedConfirmModal
        visible={confirmVisible}
        title="Profil Onayı"
        message={selectedProfile ? `${selectedProfile.displayName} için bakıyoruz. Emin misin?` : 'Önce bir profil seçmelisin.'}
        confirmLabel="Evet - Devam"
        cancelLabel="Hayır"
        onCancel={() => setConfirmVisible(false)}
        onConfirm={() => {
          if (!selectedProfile) return;
          setConfirmVisible(false);
          navigation.navigate('PersonalReadingTypeSelect', {
            devSettings,
            profileId: selectedProfile.profileId,
          });
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#14141E' },
  content: { padding: 18, paddingBottom: 28 },
  panel: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: 'rgba(30,30,40,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.18)',
  },
  panelTitle: { color: '#E8C49A', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  helperText: { color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 20, marginBottom: 10 },
  profileCard: {
    width: 100,
    minHeight: 90,
    padding: 10,
    borderRadius: 14,
    marginRight: 10,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.18)',
  },
  profileCardSelected: { borderColor: '#D4A574', backgroundColor: 'rgba(212,165,116,0.14)' },
  profileName: { color: '#FFF5E8', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  profileMeta: { color: 'rgba(212,165,116,0.72)', fontSize: 12 },
  primaryButton: {
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: '#D4A574',
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonDisabled: { opacity: 0.72 },
  primaryButtonText: { color: '#14141E', fontSize: 14, fontWeight: '800' },
  secondaryButton: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.45)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#E8C49A', fontSize: 14, fontWeight: '800' },
});
