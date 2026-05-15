import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { BrandedScrollView } from '../components/BrandedScrollView';
import { SelectableFormattedText } from '../components/SelectableFormattedText';
import { BrandedConfirmModal } from '../components/BrandedConfirmModal';
import { getAssistantLabel } from '../config/constants';
import { deleteReading, getReadingTypeLabel } from '../services/profileMemoryService';

type Props = NativeStackScreenProps<RootStackParamList, 'ReadingDetail'>;

export function ReadingDetailScreen({ route, navigation }: Props) {
  const { reading, profileName } = route.params;
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const mainText = (() => {
    const firstAssistantText = reading.transcript?.find((item) => item.role === 'assistant')?.text?.trim() || '';
    return firstAssistantText.length > reading.summary.length ? firstAssistantText : reading.summary;
  })();
  const qaPairs = (() => {
    const transcript = Array.isArray(reading.transcript) ? reading.transcript : [];
    const firstAssistantIndex = transcript.findIndex((item) => item.role === 'assistant');
    if (firstAssistantIndex < 0) return [] as Array<{ question: string; answer: string }>;
    const followup = transcript.slice(firstAssistantIndex + 1);
    const pairs: Array<{ question: string; answer: string }> = [];
    for (let i = 0; i < followup.length; i += 1) {
      const item = followup[i];
      if (item.role !== 'user') continue;
      const answer = followup.slice(i + 1).find((next) => next.role === 'assistant');
      pairs.push({ question: item.text, answer: answer?.text || '' });
    }
    return pairs;
  })();

  const handleDelete = () => {
    setDeleteConfirmVisible(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <BrandedScrollView contentContainerStyle={styles.content} showScrollToTop>
        <View style={styles.metaCard}>
          <Text style={styles.assistant}>
            {reading.readingType === 'personality-test' ? 'Testler' : getAssistantLabel(reading.assistantId)}
          </Text>
          <Text style={styles.meta}>{getReadingTypeLabel(reading)}</Text>
          <Text style={styles.meta}>{profileName}</Text>
          <Text style={styles.date}>{new Date(reading.createdAt).toLocaleString('tr-TR')}</Text>
        </View>

        <View style={styles.readingCard}>
          <Text style={styles.sectionTitle}>{reading.readingType === 'personality-test' ? 'Test Özeti' : 'Okuma Özeti'}</Text>
          <SelectableFormattedText text={mainText} style={styles.readingText} />
        </View>

        {qaPairs.length ? (
          <View style={styles.readingCard}>
            <Text style={styles.sectionTitle}>Soru-Cevap</Text>
            {qaPairs.map((item, index) => (
              <View key={`${index}-${item.question.slice(0, 16)}`} style={styles.qaBlock}>
                <Text style={styles.qaLabel}>Soru</Text>
                <SelectableFormattedText text={item.question} style={styles.readingText} />
                <Text style={[styles.qaLabel, styles.qaLabelTop]}>Cevap</Text>
                <SelectableFormattedText text={item.answer || 'Bu soruya kayıtlı cevap bulunamadı.'} style={styles.readingText} />
              </View>
            ))}
          </View>
        ) : null}

        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>Bu Okumayı Sil</Text>
        </TouchableOpacity>
      </BrandedScrollView>
      <BrandedConfirmModal
        visible={deleteConfirmVisible}
        title="Okumayı Sil"
        message="Bu okuma kaydını cihazından silmek istediğine emin misin?"
        confirmLabel="Evet, Sil"
        cancelLabel="Hayır, Silme"
        onConfirm={async () => {
          await deleteReading(reading.readingId);
          setDeleteConfirmVisible(false);
          navigation.goBack();
        }}
        onCancel={() => setDeleteConfirmVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#14141E' },
  content: { padding: 18, paddingBottom: 36 },
  metaCard: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: 'rgba(30,30,40,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.18)',
    marginBottom: 14,
  },
  assistant: { color: '#FFF5E8', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  meta: { color: '#D4A574', fontSize: 13, marginBottom: 4 },
  date: { color: 'rgba(255,255,255,0.58)', fontSize: 12 },
  readingCard: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: 'rgba(30,30,40,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.18)',
    marginBottom: 16,
  },
  sectionTitle: { color: '#E8C49A', fontSize: 15, fontWeight: '700', marginBottom: 12 },
  readingText: { color: '#FFF5E8', fontSize: 15, lineHeight: 24 },
  qaBlock: {
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  qaLabel: { color: '#D4A574', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  qaLabelTop: { marginTop: 8 },
  deleteButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.45)',
    backgroundColor: 'rgba(255,107,107,0.12)',
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteButtonText: { color: '#FF8F8F', fontWeight: '700', fontSize: 14 },
});
