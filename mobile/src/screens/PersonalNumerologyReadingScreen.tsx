import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { BrandedConfirmModal } from '../components/BrandedConfirmModal';
import { APP_NAME, getAssistantLabel } from '../config/constants';
import { appendReadingDerivedTheme, appendReadingSummary, loadAccountState } from '../services/profileMemoryService';
import { getRetryLaterMessage, isRetryableLlmError } from '../services/llmRetryMessages';
import {
  createPersonalNumerologyReading,
  hasRequiredNumerologyInputs,
  type PersonalNumerologyCore,
  type PersonalNumerologyMode,
} from '../services/personalNumerologyEngine';

type Props = NativeStackScreenProps<RootStackParamList, 'PersonalNumerologyReading'>;

const MODE_LABELS: Record<PersonalNumerologyMode, string> = {
  core: 'Temel Sayı Haritası',
  period: 'Aylık Numeroloji',
};

const CORE_LABELS: Array<[keyof PersonalNumerologyCore, string]> = [
  ['lifePath', 'Yaşam Yolu'],
  ['destiny', 'Kader / İfade'],
  ['soulUrge', 'Ruh Arzusu'],
  ['personality', 'Kişilik'],
  ['birthday', 'Doğum Günü'],
  ['maturity', 'Olgunluk'],
];

function compactSummary(text: string) {
  return text.replace(/\s+/g, ' ').trim().slice(0, 420);
}

export function PersonalNumerologyReadingScreen({ route }: Props) {
  const { profileId, assistantId } = route.params;
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<PersonalNumerologyMode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [text, setText] = useState('');
  const [core, setCore] = useState<PersonalNumerologyCore | null>(null);
  const [infoModal, setInfoModal] = useState({ visible: false, title: APP_NAME, message: '' });

  const assistantLabel = useMemo(() => getAssistantLabel(assistantId), [assistantId]);
  const actionLabel = mode ? 'Yorumu Hazırla' : 'Önce Bölüm Seç';

  const loadReading = useCallback(async () => {
    if (!mode) {
      setText('');
      setCore(null);
      return;
    }

    setIsLoading(true);
    try {
      const state = await loadAccountState();
      const profile = state.profiles.find((item) => item.profileId === profileId) || null;
      if (!profile) {
        setInfoModal({ visible: true, title: APP_NAME, message: 'Profil bulunamadı.' });
        setText('');
        return;
      }
      if (!hasRequiredNumerologyInputs(profile)) {
        setInfoModal({
          visible: true,
          title: 'Profil Bilgisi Gerekli',
          message: 'Kişisel numeroloji için profil adı ve doğum tarihi gerekli.',
        });
        setText('');
        return;
      }

      const reading = await createPersonalNumerologyReading({
        profile,
        assistantId,
        assistantLabel,
        mode,
      });
      setText(reading.text);
      setCore(reading.core);

      if (!reading.cached) {
        await appendReadingSummary({
          profileId,
          assistantId,
          readingType: 'personal-numerology',
          period: reading.mode === 'period' ? 'monthly' : undefined,
          surfacesRead: [],
          summary: compactSummary(reading.text),
          transcript: [{ role: 'assistant', text: reading.text, timestamp: Date.now() }],
        });
        const theme =
          mode === 'core'
            ? `temel numeroloji: yaşam yolu ${reading.core.lifePath}, kader ${reading.core.destiny}, olgunluk ${reading.core.maturity}`
            : `aylık numeroloji: ${reading.context.calendarMonthName} ${reading.context.calendarYear} için dört haftalık akış yorumu`;
        const themeKey =
          mode === 'core'
            ? 'personal-numerology-core'
            : `personal-numerology-monthly-${reading.periodKey || reading.context.targetDateIso}`;
        await appendReadingDerivedTheme(profileId, theme, themeKey);
      }
    } catch (err: any) {
      const retryMessage = isRetryableLlmError(err) ? getRetryLaterMessage('personal-numerology', `${profileId}-${mode}`) : null;
      setInfoModal({
        visible: true,
        title: retryMessage?.title || APP_NAME,
        message: retryMessage?.message || err?.message || 'Kişisel numeroloji yorumu üretilemedi.',
      });
      setText('');
    } finally {
      setIsLoading(false);
    }
  }, [assistantId, assistantLabel, mode, profileId]);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}>
        <View style={styles.panel}>
          <Text style={styles.title}>Kişiye Özel Numeroloji</Text>
          <Text style={styles.helper}>Falcı: {assistantLabel}</Text>
          <View style={styles.modeRow}>
            {(['core', 'period'] as PersonalNumerologyMode[]).map((item) => {
              const selected = mode === item;
              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.modeButton, selected && styles.modeButtonSelected]}
                  onPress={() => {
                    setMode(item);
                    setText('');
                    setCore(null);
                  }}
                >
                  <Text style={[styles.modeButtonText, selected && styles.modeButtonTextSelected]}>{MODE_LABELS[item]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={[styles.refreshButton, !mode && styles.refreshButtonDisabled]} onPress={() => void loadReading()}>
            <Text style={styles.refreshButtonText}>{actionLabel}</Text>
          </TouchableOpacity>
        </View>

        {core && mode === 'core' ? (
          <View style={styles.grid}>
            {CORE_LABELS.map(([key, label]) => (
              <View key={key} style={styles.numberTile}>
                <Text style={styles.numberLabel}>{label}</Text>
                <Text style={styles.numberValue}>{core[key]}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Yorum</Text>
          {isLoading ? (
            <Text style={styles.loading}>Hazırlanıyor...</Text>
          ) : text ? (
            <Text style={styles.readingText}>{text}</Text>
          ) : (
            <Text style={styles.loading}>Temel sayı haritası veya aylık numeroloji seçip yorumu hazırlayabilirsin.</Text>
          )}
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
  loading: { color: '#FFF5E8', fontSize: 14, lineHeight: 21 },
  readingText: { color: '#FFF5E8', fontSize: 14, lineHeight: 22 },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  modeButton: {
    flexGrow: 1,
    flexBasis: '46%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.3)',
    backgroundColor: 'rgba(0,0,0,0.15)',
    paddingVertical: 10,
    alignItems: 'center',
  },
  modeButtonSelected: {
    borderColor: '#D4A574',
    backgroundColor: 'rgba(212,165,116,0.16)',
  },
  modeButtonText: { color: '#E8C49A', fontSize: 12, fontWeight: '700' },
  modeButtonTextSelected: { color: '#FFF5E8' },
  refreshButton: {
    borderRadius: 12,
    backgroundColor: '#D4A574',
    paddingVertical: 11,
    alignItems: 'center',
  },
  refreshButtonDisabled: {
    opacity: 0.64,
  },
  refreshButtonText: { color: '#14141E', fontSize: 13, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 4 },
  numberTile: {
    width: '31.5%',
    minHeight: 82,
    marginBottom: 10,
    borderRadius: 14,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberLabel: { color: 'rgba(255,255,255,0.72)', fontSize: 11, textAlign: 'center', marginBottom: 6 },
  numberValue: { color: '#E8C49A', fontSize: 22, fontWeight: '800' },
});
