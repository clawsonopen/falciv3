import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { AVAILABLE_ASSISTANTS, applyAssistantPreset } from '../config/constants';
import { BrandedConfirmModal } from '../components/BrandedConfirmModal';

type Props = NativeStackScreenProps<RootStackParamList, 'PersonalAssistantSelect'>;

export function PersonalAssistantSelectScreen({ navigation, route }: Props) {
  const { devSettings, profileId, readingType } = route.params;
  const [selectedAssistantId, setSelectedAssistantId] = useState<string>(AVAILABLE_ASSISTANTS[0].id);
  const [confirmVisible, setConfirmVisible] = useState(false);

  const selectedAssistant = useMemo(
    () => AVAILABLE_ASSISTANTS.find((assistant) => assistant.id === selectedAssistantId) || AVAILABLE_ASSISTANTS[0],
    [selectedAssistantId],
  );

  const selectedReadingLabel = useMemo(() => {
    if (readingType === 'coffee') return 'Kahve Falı';
    if (readingType === 'palm') return 'El / Pati Falı';
    if (readingType === 'astro-personal') return 'Astroloji';
    if (readingType === 'tarot-personal') return 'Kişiye Özel Tarot';
    if (readingType === 'numerology-personal') return 'Kişiye Özel Numeroloji';
    if (readingType === 'angel-personal') return 'Kişiye Özel Melek Kartlari';
    return 'Sohbetli Manifestleme';
  }, [readingType]);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>4. Falcı Seçimi</Text>
          <Text style={styles.helperText}>Seçilen fal tipi: {selectedReadingLabel}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
          </ScrollView>
          <TouchableOpacity style={styles.primaryButton} onPress={() => setConfirmVisible(true)}>
            <Text style={styles.primaryButtonText}>Evet - Devam</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <BrandedConfirmModal
        visible={confirmVisible}
        title="Falcı Onayı"
        message={`${selectedAssistant.label} ile devam edilsin mi?`}
        confirmLabel="Evet - Devam"
        cancelLabel="Hayır"
        onCancel={() => setConfirmVisible(false)}
        onConfirm={() => {
          setConfirmVisible(false);
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
  assistantCard: {
    width: 190,
    padding: 12,
    borderRadius: 14,
    marginRight: 10,
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

