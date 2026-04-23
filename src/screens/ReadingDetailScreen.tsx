import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { getAssistantLabel } from '../config/constants';
import { deleteReading, getReadingTypeLabel } from '../services/profileMemoryService';

type Props = NativeStackScreenProps<RootStackParamList, 'ReadingDetail'>;

export function ReadingDetailScreen({ route, navigation }: Props) {
  const { reading, profileName } = route.params;

  const handleDelete = () => {
    Alert.alert(
      'Falı Sil',
      'Bu fal kaydını cihazından silmek istediğine emin misin?',
      [
        { text: 'Hayır, silme', style: 'cancel' },
        {
          text: 'Evet, sil',
          style: 'destructive',
          onPress: async () => {
            await deleteReading(reading.readingId);
            navigation.goBack();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.metaCard}>
          <Text style={styles.assistant}>{getAssistantLabel(reading.assistantId)}</Text>
          <Text style={styles.meta}>{getReadingTypeLabel(reading)}</Text>
          <Text style={styles.meta}>{profileName}</Text>
          <Text style={styles.date}>{new Date(reading.createdAt).toLocaleString('tr-TR')}</Text>
        </View>

        <View style={styles.readingCard}>
          <Text style={styles.sectionTitle}>Fal Özeti</Text>
          <Text style={styles.readingText}>{reading.summary}</Text>
        </View>

        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>Bu Falı Sil</Text>
        </TouchableOpacity>
      </ScrollView>
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
