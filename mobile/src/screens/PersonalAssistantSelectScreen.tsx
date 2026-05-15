import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { AVAILABLE_ASSISTANTS, applyAssistantPreset } from '../config/constants';
import { BrandedScrollView } from '../components/BrandedScrollView';

type Props = NativeStackScreenProps<RootStackParamList, 'PersonalAssistantSelect'>;

export function PersonalAssistantSelectScreen({ navigation, route }: Props) {
  const { devSettings, profileId, readingType } = route.params;
  const defaultAssistantId = useMemo(() => {
    if (readingType === 'astro-personal') return 'bahar-hanim';
    if (readingType === 'numerology-personal' || readingType === 'numerology-core' || readingType === 'numerology-period') return 'mert-bey';
    if (readingType === 'tarot-personal') return 'caner';
    if (readingType === 'palm') return 'hikmet-bey';
    return AVAILABLE_ASSISTANTS[0].id;
  }, [readingType]);
  const [selectedAssistantId, setSelectedAssistantId] = useState<string>(defaultAssistantId);

  useEffect(() => {
    setSelectedAssistantId(defaultAssistantId);
  }, [defaultAssistantId]);

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
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Yorumcu Seçimi</Text>
          <Text style={styles.helperText}>Seçilen okuma tipi: {selectedReadingLabel}</Text>
          <View style={styles.assistantList}>
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
                navigation.navigate('Home');
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
  assistantList: {
    gap: 10,
  },
  assistantCard: {
    width: '100%',
    minHeight: 92,
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
