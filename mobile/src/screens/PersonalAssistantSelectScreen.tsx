import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { AVAILABLE_ASSISTANTS, applyAssistantPreset } from '../config/constants';
import { BrandedScrollView } from '../components/BrandedScrollView';
import { BrandedConfirmModal } from '../components/BrandedConfirmModal';
import {
  deleteLocalGemmaModel,
  downloadLocalGemmaModel,
  getLocalGemmaStatus,
  LOCAL_GEMMA_MODELS,
  type LocalGemmaModelId,
} from '../services/localGemmaService';

type Props = NativeStackScreenProps<RootStackParamList, 'PersonalAssistantSelect'>;

export function PersonalAssistantSelectScreen({ navigation, route }: Props) {
  const { devSettings, profileId, readingType } = route.params;
  const [selectedIqLevel, setSelectedIqLevel] = useState<'free' | 'pro' | 'premium'>('free');
  const [selectedLocalModelId, setSelectedLocalModelId] = useState<LocalGemmaModelId>('gemma-4-e2b-it');
  const [localModelNote, setLocalModelNote] = useState('Yerel model durumları kontrol ediliyor...');
  const [localModelStatuses, setLocalModelStatuses] = useState<Record<LocalGemmaModelId, { exists: boolean; size: number }>>({} as Record<LocalGemmaModelId, { exists: boolean; size: number }>);
  const [downloadProgressByModel, setDownloadProgressByModel] = useState<Partial<Record<LocalGemmaModelId, number>>>({});
  const [soonVisible, setSoonVisible] = useState(false);
  const defaultAssistantId = useMemo(() => {
    if (readingType === 'astro-personal') return 'selin';
    if (readingType === 'numerology-personal' || readingType === 'numerology-core' || readingType === 'numerology-period') return 'berk';
    if (readingType === 'tarot-personal') return 'arin';
    if (readingType === 'palm') return 'teoman';
    return AVAILABLE_ASSISTANTS[0].id;
  }, [readingType]);
  const [selectedAssistantId, setSelectedAssistantId] = useState<string>(defaultAssistantId);

  useEffect(() => {
    setSelectedAssistantId(defaultAssistantId);
  }, [defaultAssistantId]);

  const refreshLocalModelStatus = useCallback(async () => {
    const entries = await Promise.all(
      LOCAL_GEMMA_MODELS.map(async (model) => {
        const status = await getLocalGemmaStatus(model.id).catch(() => null);
        return [model.id, { exists: Boolean(status?.exists), size: status?.size || 0 }] as const;
      }),
    );
    setLocalModelStatuses(Object.fromEntries(entries) as Record<LocalGemmaModelId, { exists: boolean; size: number }>);
    setLocalModelNote('Free IQ, seçili yerel modeli kullanır; model değişince eski engine RAM’den indirilir.');
  }, []);

  useEffect(() => {
    void refreshLocalModelStatus();
  }, [refreshLocalModelStatus]);

  const handleDownloadLocalModel = useCallback(async (modelId: LocalGemmaModelId) => {
    setDownloadProgressByModel((current) => ({ ...current, [modelId]: 0 }));
    try {
      await downloadLocalGemmaModel(modelId, (progress) => {
        setDownloadProgressByModel((current) => ({ ...current, [modelId]: progress }));
      });
      await refreshLocalModelStatus();
    } catch (err: any) {
      setLocalModelNote(err?.message || 'Model indirilemedi.');
    } finally {
      setDownloadProgressByModel((current) => {
        const next = { ...current };
        delete next[modelId];
        return next;
      });
    }
  }, [refreshLocalModelStatus]);

  const handleDeleteLocalModel = useCallback(async (modelId: LocalGemmaModelId) => {
    try {
      await deleteLocalGemmaModel(modelId);
      await refreshLocalModelStatus();
    } catch (err: any) {
      setLocalModelNote(err?.message || 'Model silinemedi.');
    }
  }, [refreshLocalModelStatus]);

  const selectedReadingLabel = useMemo(() => {
    if (readingType === 'coffee') return 'Kahve Yorumu';
    if (readingType === 'palm') return 'El / Pati Okuması';
    if (readingType === 'astro-personal') return 'Astroloji';
    if (readingType === 'tarot-personal') return 'Kişiye Özel Tarot';
    if (readingType === 'numerology-core') return 'Temel Numeroloji Haritası';
    if (readingType === 'numerology-period') return 'Numeroloji';
    if (readingType === 'numerology-personal') return 'Kişiye Özel Numeroloji';
    if (readingType === 'dream-interpretation') return 'Rüya Yorumu';
    if (readingType === 'angel-personal') return 'Kişiye Özel Melek Kartları';
    return 'Sohbetli Manifestleme';
  }, [readingType]);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <BrandedScrollView contentContainerStyle={styles.content} showScrollToTop>
        <View style={styles.readingTypeStrip}>
          <Text style={styles.helperText}>Seçilen okuma tipi: {selectedReadingLabel}</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Yorumcunun Zekasını Seç</Text>
          <View style={styles.segmentRow}>
            {[
              { id: 'free', label: 'Free IQ' },
              { id: 'pro', label: 'Pro IQ' },
              { id: 'premium', label: 'Premium IQ' },
            ].map((item) => {
              const selected = selectedIqLevel === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.segmentButton, selected && styles.segmentButtonSelected]}
                  onPress={() => setSelectedIqLevel(item.id as 'free' | 'pro' | 'premium')}
                >
                  <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {selectedIqLevel === 'free' ? (
            <View style={styles.localModelBox}>
              <Text style={styles.localModelLabel}>Free IQ yerel modeller</Text>
              <Text style={styles.mockHint}>{localModelNote}</Text>
              <View style={styles.modelList}>
                {LOCAL_GEMMA_MODELS.map((model) => {
                  const selected = selectedLocalModelId === model.id;
                  const status = localModelStatuses[model.id];
                  const progress = downloadProgressByModel[model.id];
                  const busy = progress !== undefined;
                  return (
                    <TouchableOpacity
                      key={model.id}
                      activeOpacity={0.86}
                      style={[styles.modelCard, selected && styles.modelCardSelected]}
                      onPress={() => setSelectedLocalModelId(model.id)}
                    >
                      <View style={styles.modelHeaderRow}>
                        <Text style={styles.modelTitle}>{model.label}</Text>
                        <Text style={[styles.modelStatus, status?.exists && styles.modelStatusReady]}>
                          {busy ? `%${Math.round((progress || 0) * 100)}` : status?.exists ? 'Hazır' : 'Yok'}
                        </Text>
                      </View>
                      <Text style={styles.modelMeta}>{model.sizeLabel} · {model.note}</Text>
                      <Text style={styles.modelMeta}>{model.contextLabel}</Text>
                      <View style={styles.modelActionRow}>
                        <TouchableOpacity style={styles.modelActionButton} onPress={() => void handleDownloadLocalModel(model.id)} disabled={busy}>
                          <Text style={styles.modelActionText}>İndir</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.modelActionButton} onPress={() => void handleDeleteLocalModel(model.id)} disabled={busy}>
                          <Text style={styles.modelActionText}>Cihazdan Sil</Text>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : (
            <Text style={styles.mockHint}>Pro IQ ve Premium IQ şimdilik mevcut bulut akışını kullanır.</Text>
          )}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Yorumcu Seçimi</Text>
          <View style={styles.assistantGrid}>
            {AVAILABLE_ASSISTANTS.map((assistant) => {
              const selected = selectedAssistantId === assistant.id;
              return (
                <TouchableOpacity
                  key={assistant.id}
                  style={[styles.assistantCard, selected && styles.assistantCardSelected]}
                  onPress={() => setSelectedAssistantId(assistant.id)}
                >
                  <Text style={styles.assistantName}>{assistant.label}</Text>
                  <Text style={styles.assistantMeta}>Uzmanlık: {assistant.specialty}</Text>
                  <Text style={styles.assistantTagline}>{assistant.tagline}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              if (readingType === 'astro-personal') {
                navigation.navigate('PersonalAstroReading', {
                  profileId,
                  assistantId: selectedAssistantId,
                  iqLevel: selectedIqLevel,
                  localGemmaModelId: selectedLocalModelId,
                });
                return;
              }

              if (readingType === 'numerology-personal' || readingType === 'numerology-core' || readingType === 'numerology-period') {
                navigation.navigate('PersonalNumerologyReading', {
                  profileId,
                  assistantId: selectedAssistantId,
                  initialMode: readingType === 'numerology-core' ? 'core' : readingType === 'numerology-period' ? 'monthly' : undefined,
                });
                return;
              }

              if (readingType === 'dream-interpretation') {
                navigation.navigate('DreamInterpretation', {
                  profileId,
                  assistantId: selectedAssistantId,
                });
                return;
              }

              if (readingType === 'tarot-personal') {
                navigation.navigate('TarotSpreadSelect', {
                  profileId,
                  assistantId: selectedAssistantId,
                });
                return;
              }

              if (readingType !== 'coffee' && readingType !== 'palm') {
                setSoonVisible(true);
                return;
              }

              navigation.navigate('PersonalReadingSetup', {
                preselectedProfileId: profileId,
                preselectedReadingType: readingType,
                preselectedAssistantId: selectedAssistantId,
                preselectedDevSettings: applyAssistantPreset(devSettings, selectedAssistantId),
              });
            }}
          >
            <Text style={styles.primaryButtonText}>Yoruma Geç</Text>
          </TouchableOpacity>
        </View>
      </BrandedScrollView>
      <BrandedConfirmModal
        visible={soonVisible}
        title="Yakında"
        message="Bu alanın seçim modeli hazır; okuma motoruna bağlantısını sonraki adımda ekleyeceğiz."
        confirmLabel="Tamam"
        cancelLabel={null}
        onConfirm={() => setSoonVisible(false)}
        onCancel={() => setSoonVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#14141E' },
  content: { padding: 18, paddingBottom: 28 },
  readingTypeStrip: {
    minHeight: 38,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(212,165,116,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.16)',
    justifyContent: 'center',
  },
  panel: {
    marginBottom: 14,
    borderRadius: 18,
    padding: 16,
    backgroundColor: 'rgba(30,30,40,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.18)',
  },
  panelTitle: { color: '#E8C49A', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  helperText: { color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 18 },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segmentButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.22)',
    backgroundColor: 'rgba(0,0,0,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  segmentButtonSelected: {
    borderColor: '#D4A574',
    backgroundColor: 'rgba(212,165,116,0.14)',
  },
  segmentText: { color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  segmentTextSelected: { color: '#F6C38B' },
  mockHint: { color: 'rgba(255,255,255,0.52)', fontSize: 11, lineHeight: 16, marginTop: 8 },
  localModelBox: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.2)',
    backgroundColor: 'rgba(0,0,0,0.14)',
    padding: 10,
  },
  localModelLabel: { color: '#D4A574', fontSize: 12, fontWeight: '800', marginBottom: 6 },
  modelList: { gap: 10, marginTop: 10 },
  modelCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.18)',
    backgroundColor: 'rgba(20,20,30,0.62)',
    padding: 10,
  },
  modelCardSelected: {
    borderColor: '#D4A574',
    backgroundColor: 'rgba(212,165,116,0.12)',
  },
  modelHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  modelTitle: { color: '#FFF5E8', fontSize: 13, fontWeight: '800', flex: 1 },
  modelStatus: { color: 'rgba(255,255,255,0.62)', fontSize: 11, fontWeight: '800' },
  modelStatusReady: { color: '#9FE0B5' },
  modelMeta: { color: 'rgba(255,255,255,0.58)', fontSize: 11, lineHeight: 15, marginTop: 4 },
  modelActionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  modelActionButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212,165,116,0.12)',
  },
  modelActionText: { color: '#F6C38B', fontSize: 12, fontWeight: '800' },
  assistantGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
  },
  assistantCard: {
    width: '47.5%',
    minHeight: 148,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.18)',
  },
  assistantCardSelected: { borderColor: '#D4A574', backgroundColor: 'rgba(212,165,116,0.14)' },
  assistantName: { color: '#FFF5E8', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  assistantMeta: { color: 'rgba(212,165,116,0.72)', fontSize: 12, marginBottom: 6 },
  assistantTagline: { color: 'rgba(255,255,255,0.74)', fontSize: 12, lineHeight: 18 },
  primaryButton: {
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: '#D4A574',
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#14141E', fontSize: 14, fontWeight: '800' },
});
