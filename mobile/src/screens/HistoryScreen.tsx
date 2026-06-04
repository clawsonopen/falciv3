import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { BrandedScrollView } from '../components/BrandedScrollView';
import { getAssistantLabel } from '../config/constants';
import { BrandedConfirmModal } from '../components/BrandedConfirmModal';
import { deleteAllReadingsForProfile, deleteReading, getAllReadingsForProfile, getReadingTypeLabel, loadAccountState } from '../services/profileMemoryService';
import type { ReadingSummary } from '../types/memory';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

export function HistoryScreen({ route, navigation }: Props) {
  const { profileId, profileName } = route.params;
  const [readings, setReadings] = useState<ReadingSummary[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<ReadingSummary | null>(null);
  const [deleteAllVisible, setDeleteAllVisible] = useState(false);

  const refresh = useCallback(() => {
    loadAccountState().then((state) => {
      setReadings(getAllReadingsForProfile(state, profileId));
    });
  }, [profileId]);

  useEffect(() => {
    navigation.setOptions({ title: `${profileName} - Son Kayıtlar` });
    refresh();
  }, [navigation, profileName, refresh]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', refresh);
    return unsubscribe;
  }, [navigation, refresh]);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <BrandedScrollView contentContainerStyle={styles.content} showScrollToTop>
        {readings.length ? (
          <TouchableOpacity style={styles.deleteAllButton} activeOpacity={0.82} onPress={() => setDeleteAllVisible(true)}>
            <Text style={styles.deleteAllButtonText}>Son Okumaların Hepsini Sil</Text>
          </TouchableOpacity>
        ) : null}
        {readings.length ? (
          readings.map((reading) => (
            <View key={reading.readingId} style={styles.card}>
              <TouchableOpacity
                style={styles.cardMain}
                onPress={() => navigation.navigate('ReadingDetail', { reading, profileName })}
              >
                <Text style={styles.assistant}>
                  {reading.readingType === 'personality-test' ? 'Testler' : getAssistantLabel(reading.assistantId)}
                </Text>
                <Text style={styles.meta}>{getReadingTypeLabel(reading)}</Text>
                <Text style={styles.metaMuted}>
                  {reading.readingType === 'personality-test'
                    ? reading.testResult?.resultCode
                      ? `Sonuç: ${reading.testResult.resultCode}`
                      : 'Test sonucu'
                    : reading.transcript?.length
                      ? `${reading.transcript.length} mesaj kaydı`
                      : 'Eski kayıt'}
                </Text>
                <Text style={styles.date}>{new Date(reading.createdAt).toLocaleString('tr-TR')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deletePill}
                onPress={() => setDeleteTarget(reading)}
              >
                <Text style={styles.deletePillText}>Sil</Text>
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Henüz kayıt yok</Text>
            <Text style={styles.emptyText}>Bu profil için biten okumalar ve test sonuçları burada listelenecek.</Text>
          </View>
        )}
      </BrandedScrollView>
      <BrandedConfirmModal
        visible={Boolean(deleteTarget)}
        title="Okumayı Sil"
        message="Bu kaydı cihazından silmek istediğine emin misin?"
        confirmLabel="Evet, Sil"
        cancelLabel="Hayır, Silme"
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteReading(deleteTarget.readingId);
            setDeleteTarget(null);
            refresh();
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
      <BrandedConfirmModal
        visible={deleteAllVisible}
        title="Tüm Son Okumaları Sil"
        message="Bu profilin cihazdaki tüm son okuma kayıtlarını silmek istediğine emin misin? Bu işlem şimdilik yalnız cihazdaki kayıtları temizler; Google Drive yedekleme daha sonra eklenecek."
        confirmLabel="Evet, Hepsini Sil"
        cancelLabel="Hayır, Vazgeç"
        onConfirm={async () => {
          await deleteAllReadingsForProfile(profileId);
          setDeleteAllVisible(false);
          refresh();
        }}
        onCancel={() => setDeleteAllVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#14141E' },
  content: { padding: 18, paddingBottom: 36 },
  deleteAllButton: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.42)',
    backgroundColor: 'rgba(255,107,107,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    paddingHorizontal: 12,
  },
  deleteAllButtonText: { color: '#FFB3B3', fontSize: 13, fontWeight: '900' },
  card: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: 'rgba(30,30,40,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.18)',
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardMain: { flex: 1 },
  assistant: { color: '#FFF5E8', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  meta: { color: '#D4A574', fontSize: 13, marginBottom: 4 },
  metaMuted: { color: 'rgba(255,255,255,0.54)', fontSize: 12, marginBottom: 4 },
  date: { color: 'rgba(255,255,255,0.58)', fontSize: 12 },
  deletePill: {
    marginLeft: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.4)',
    backgroundColor: 'rgba(255,107,107,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deletePillText: { color: '#FF8F8F', fontSize: 12, fontWeight: '700' },
  emptyCard: {
    borderRadius: 16,
    padding: 18,
    backgroundColor: 'rgba(30,30,40,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.18)',
  },
  emptyTitle: { color: '#E8C49A', fontSize: 15, fontWeight: '700', marginBottom: 6 },
  emptyText: { color: 'rgba(255,255,255,0.68)', fontSize: 13, lineHeight: 20 },
});
