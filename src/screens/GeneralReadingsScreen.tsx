import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import type { SubjectProfile } from '../types/memory';
import { getPrimaryProfile, loadAccountState } from '../services/profileMemoryService';
import { createDailyGeneralReading, type GeneralDivinationType } from '../services/divinationEngine';
import { BrandedConfirmModal } from '../components/BrandedConfirmModal';
import { APP_NAME } from '../config/constants';

type Props = NativeStackScreenProps<RootStackParamList, 'GeneralReadings'>;

type GeneralReadingItem = {
  id: GeneralDivinationType | 'astro-daily' | 'astro-weekly' | 'astro-monthly';
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [pendingItem, setPendingItem] = useState<GeneralReadingItem | null>(null);
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

  const items: GeneralReadingItem[] = useMemo(
    () => [
      {
        id: 'astro-daily',
        title: 'Genel Astro Günlük',
        description: 'Yükselen veya ay burcunu dikkate almayan, 3-4 ana konuya değinen kısa genel yorum.',
        isPaid: false,
        refreshLabel: 'Her gün yenilenir',
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
        id: 'daily-affirmation',
        title: 'Günlük Olumlamalar',
        description: 'Her gün için kısa, güçlendirici olumlama metni.',
        isPaid: false,
        refreshLabel: 'Günlük',
      },
      {
        id: 'daily-quote',
        title: 'Günlük Quote',
        description: 'Ünlü isimlerden ilham veren gerçek alıntılar.',
        isPaid: false,
        refreshLabel: 'Günlük',
      },
      {
        id: 'daily-runes',
        title: 'Günlük Runes',
        description: 'Günün runesi ve kısa anlamı.',
        isPaid: false,
        refreshLabel: 'Günlük',
      },
      {
        id: 'daily-i-ching',
        title: 'Günlük I-Ching',
        description: 'Günlük hexagram odaklı kısa içgörü.',
        isPaid: false,
        refreshLabel: 'Günlük',
      },
      {
        id: 'daily-tarot',
        title: 'Günlük Tek Tarot Karti',
        description: 'Günlük enerjiye yönelik tek kartlık genel açılım.',
        isPaid: true,
        refreshLabel: 'Günlük',
      },
      {
        id: 'daily-angel',
        title: 'Günlük Melek Kartı',
        description: 'Günlük niyet ve rehberlik odaklı tek kartlık okuma.',
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
      {
        id: 'daily-angel-number',
        title: 'Günün Uğurlu Melek Sayısı',
        description: 'Güne özel melek sayısı ve kısa anlamı.',
        isPaid: false,
        refreshLabel: 'Günlük',
      },
    ],
    [],
  );

  const runGeneralReading = useCallback(
    async (item: GeneralReadingItem) => {
      if (!selectedProfile) {
        setInfoModal({
          visible: true,
          title: APP_NAME,
          message: 'Önce bir profil seçmelisin.',
        });
        return;
      }

      if (
        item.id !== 'fortune-cookie' &&
        item.id !== 'magic-ball' &&
        item.id !== 'daily-affirmation' &&
        item.id !== 'daily-quote' &&
        item.id !== 'daily-runes' &&
        item.id !== 'daily-i-ching' &&
        item.id !== 'daily-numerology' &&
        item.id !== 'daily-tarot' &&
        item.id !== 'daily-angel' &&
        item.id !== 'daily-angel-number'
      ) {
        setInfoModal({
          visible: true,
          title: 'Hazırlanıyor',
          message: `${item.title} servisi bağlantı planında. Bu ekran akışı hazır.`,
        });
        return;
      }

      if (isGenerating) return;
      setIsGenerating(true);
      try {
        const result = await createDailyGeneralReading({
          type: item.id,
          profileId: selectedProfile.profileId,
        });
        setInfoModal({
          visible: true,
          title: item.title,
          message: result.text,
        });
      } catch (err: any) {
        setInfoModal({
          visible: true,
          title: APP_NAME,
          message: err?.message || 'Şu an metin üretilemedi, lütfen tekrar dene.',
        });
      } finally {
        setIsGenerating(false);
      }
    },
    [isGenerating, selectedProfile],
  );

  const handleGeneralReadingPress = useCallback(
    (item: GeneralReadingItem) => {
      if (!selectedProfile) {
        setInfoModal({
          visible: true,
          title: APP_NAME,
          message: 'Önce bir profil seçmelisin.',
        });
        return;
      }
      setPendingItem(item);
      setConfirmVisible(true);
    },
    [selectedProfile],
  );

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
                  }}
                >
                  <Text style={styles.profileName}>{profile.displayName}</Text>
                  <Text style={styles.profileMeta}>{profileBadge(profile)}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Genel Fal Türleri</Text>
          <View style={styles.grid}>
            {items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.readingSquareCard}
                onPress={() => {
                  handleGeneralReadingPress(item);
                }}
                disabled={isGenerating}
              >
                <Text style={styles.readingSquareTitle}>{item.title}</Text>
                <Text style={item.isPaid ? styles.paidTag : styles.freeTag}>{item.isPaid ? 'Ücretli' : 'Ücretsiz'}</Text>
                <Text style={styles.refreshText}>{item.refreshLabel}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <BrandedConfirmModal
        visible={confirmVisible}
        title={APP_NAME}
        message={
          pendingItem && selectedProfile
            ? `${selectedProfile.displayName} için bakıyoruz, değil mi?`
            : 'Bu profil için bakıyoruz, değil mi?'
        }
        confirmLabel="Evet"
        cancelLabel="Hayır"
        onConfirm={() => {
          const item = pendingItem;
          setConfirmVisible(false);
          setPendingItem(null);
          if (item) {
            void runGeneralReading(item);
          }
        }}
        onCancel={() => {
          setConfirmVisible(false);
          setPendingItem(null);
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  readingSquareCard: {
    width: '31.5%',
    aspectRatio: 1,
    borderRadius: 14,
    padding: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.2)',
    backgroundColor: 'rgba(0,0,0,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readingSquareTitle: {
    color: '#FFF5E8',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  refreshText: { color: 'rgba(212,165,116,0.8)', fontSize: 9, textAlign: 'center', marginTop: 6 },
  freeTag: {
    color: '#7DDC9A',
    borderColor: 'rgba(125,220,154,0.45)',
    borderWidth: 1,
    borderRadius: 9,
    fontSize: 9,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  paidTag: {
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

