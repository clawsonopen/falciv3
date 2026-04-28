import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { getAssistantLabel } from '../config/constants';
import { BrandedConfirmModal } from '../components/BrandedConfirmModal';
import { loadAccountState } from '../services/profileMemoryService';
import {
  createPersonalAstroReading,
  hasRequiredAstroBirthInputs,
  type AstroPeriod,
} from '../services/astroEngine';
import { APP_NAME } from '../config/constants';

type Props = NativeStackScreenProps<RootStackParamList, 'PersonalAstroReading'>;

export function PersonalAstroReadingScreen({ route }: Props) {
  const { profileId, assistantId } = route.params;
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<AstroPeriod>('daily');
  const [isLoading, setIsLoading] = useState(true);
  const [text, setText] = useState('');
  const [meta, setMeta] = useState<{ sign: string; timezone: string } | null>(null);
  const [infoModal, setInfoModal] = useState<{ visible: boolean; title: string; message: string }>({
    visible: false,
    title: APP_NAME,
    message: '',
  });

  const assistantLabel = useMemo(() => getAssistantLabel(assistantId), [assistantId]);

  const loadReading = useCallback(async () => {
    setIsLoading(true);
    try {
      const state = await loadAccountState();
      const profile = state.profiles.find((item) => item.profileId === profileId) || null;
      if (!profile) {
        setInfoModal({
          visible: true,
          title: APP_NAME,
          message: 'Profil bulunamadı.',
        });
        setText('');
        return;
      }

      if (!hasRequiredAstroBirthInputs(profile)) {
        setInfoModal({
          visible: true,
          title: 'Profil Bilgisi Gerekli',
          message:
            'Kişiye özel astro için doğum tarihi + doğum ülkesi + doğum şehri gerekli. Lütfen profil bilgilerini tamamla.',
        });
        setText('');
        return;
      }

      const reading = await createPersonalAstroReading({
        period,
        profile,
        assistantId,
        assistantLabel,
      });
      setText(reading.text);
      setMeta({ sign: reading.sign, timezone: reading.timezoneUsed });
    } catch (err: any) {
      setInfoModal({
        visible: true,
        title: APP_NAME,
        message: err?.message || 'Kişiye özel astro yorumu üretilemedi.',
      });
      setText('');
    } finally {
      setIsLoading(false);
    }
  }, [assistantId, assistantLabel, period, profileId]);

  useEffect(() => {
    void loadReading();
  }, [loadReading]);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}>
        <View style={styles.panel}>
          <Text style={styles.title}>Kişiye Özel Astroloji</Text>
          <Text style={styles.helper}>Falcı: {assistantLabel}</Text>
          <View style={styles.periodRow}>
            {(['daily', 'weekly', 'monthly'] as AstroPeriod[]).map((item) => {
              const selected = period === item;
              const label = item === 'daily' ? 'Günlük' : item === 'weekly' ? 'Haftalık' : 'Aylık';
              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.periodButton, selected && styles.periodButtonSelected]}
                  onPress={() => setPeriod(item)}
                >
                  <Text style={[styles.periodButtonText, selected && styles.periodButtonTextSelected]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity style={styles.refreshButton} onPress={() => void loadReading()}>
            <Text style={styles.refreshButtonText}>Yorumu Yenile</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Yorum</Text>
          {isLoading ? <Text style={styles.loading}>Hazırlanıyor...</Text> : <Text style={styles.readingText}>{text}</Text>}
          {meta ? <Text style={styles.meta}>Burç: {meta.sign} | Timezone: {meta.timezone}</Text> : null}
        </View>
      </ScrollView>

      <BrandedConfirmModal
        visible={infoModal.visible}
        title={infoModal.title}
        message={infoModal.message}
        confirmLabel="Tamam"
        cancelLabel="Kapat"
        onConfirm={() => setInfoModal({ visible: false, title: APP_NAME, message: '' })}
        onCancel={() => setInfoModal({ visible: false, title: APP_NAME, message: '' })}
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
  title: { color: '#E8C49A', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  helper: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 10 },
  sectionTitle: { color: '#E8C49A', fontSize: 15, fontWeight: '700', marginBottom: 8 },
  loading: { color: '#FFF5E8', fontSize: 14 },
  readingText: { color: '#FFF5E8', fontSize: 14, lineHeight: 22 },
  meta: { marginTop: 12, color: 'rgba(212,165,116,0.8)', fontSize: 12 },
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  periodButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.3)',
    backgroundColor: 'rgba(0,0,0,0.15)',
    paddingVertical: 10,
    alignItems: 'center',
  },
  periodButtonSelected: {
    borderColor: '#D4A574',
    backgroundColor: 'rgba(212,165,116,0.16)',
  },
  periodButtonText: { color: '#E8C49A', fontSize: 12, fontWeight: '700' },
  periodButtonTextSelected: { color: '#FFF5E8' },
  refreshButton: {
    borderRadius: 12,
    backgroundColor: '#D4A574',
    paddingVertical: 11,
    alignItems: 'center',
  },
  refreshButtonText: { color: '#14141E', fontSize: 13, fontWeight: '800' },
});
