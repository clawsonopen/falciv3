import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { BrandedConfirmModal } from '../components/BrandedConfirmModal';
import { BrandedScrollView } from '../components/BrandedScrollView';

type Props = NativeStackScreenProps<RootStackParamList, 'PersonalReadingTypeSelect'>;

type ReadingTypeItem = {
  id: 'coffee' | 'palm' | 'astro-personal' | 'tarot-personal' | 'numerology-personal' | 'angel-personal' | 'manifest-chat';
  title: string;
  description: string;
  currentlyAvailable: boolean;
};

export function PersonalReadingTypeSelectScreen({ navigation, route }: Props) {
  const { devSettings, profileId } = route.params;
  const [selectedTypeId, setSelectedTypeId] = useState<ReadingTypeItem['id'] | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);

  const types: ReadingTypeItem[] = useMemo(
    () => [
      {
        id: 'coffee',
        title: 'Kahve Yorumu',
        description: 'Mevcut kahve akışı: fotoğraf yükleme, analiz ve geri bildirim.',
        currentlyAvailable: true,
      },
      {
        id: 'palm',
        title: 'El / Pati Okuması',
        description: 'Mevcut el-pati akışı: fotoğraf yükleme, analiz ve geri bildirim.',
        currentlyAvailable: true,
      },
      {
        id: 'astro-personal',
        title: 'Astroloji',
        description: 'Doğum haritası ve profil bazlı periyodik astro yorumları.',
        currentlyAvailable: true,
      },
      {
        id: 'tarot-personal',
        title: 'Kişiye Özel Tarot',
        description: '3 Kart, 5 Kart Köprü Açılımı, 9 Kart Celtic Cross Açılımı.',
        currentlyAvailable: false,
      },
      {
        id: 'numerology-personal',
        title: 'Kişiye Özel Numeroloji',
        description: 'Doğum tarihi ve isim üzerinden kişisel sayı haritası.',
        currentlyAvailable: true,
      },
      {
        id: 'angel-personal',
        title: 'Kişiye Özel Melek Kartları',
        description: '3 kartlık melek kartı okumaları.',
        currentlyAvailable: false,
      },
      {
        id: 'manifest-chat',
        title: 'Sohbetli Manifestleme',
        description: 'Canlı sohbet ve ileri medya yetenekleri için hazır alan.',
        currentlyAvailable: false,
      },
    ],
    [],
  );

  const selectedType = types.find((item) => item.id === selectedTypeId) || null;

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <BrandedScrollView contentContainerStyle={styles.content} showScrollToTop>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>3. Okuma Tipi Seçimi</Text>
          <Text style={styles.helperText}>Okuma tipini seç. Devam butonunda markalı onay penceresi açılır.</Text>
          {types.map((item) => {
            const selected = selectedTypeId === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.typeCard, selected && styles.typeCardSelected]}
                onPress={() => setSelectedTypeId(item.id)}
              >
                <View style={styles.rowBetween}>
                  <Text style={styles.typeTitle}>{item.title}</Text>
                  <Text style={item.currentlyAvailable ? styles.availableTag : styles.soonTag}>
                    {item.currentlyAvailable ? 'Şimdi aktif' : 'Yakında'}
                  </Text>
                </View>
                <Text style={styles.typeText}>{item.description}</Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={[
              styles.primaryButton,
              (!selectedType || !selectedType.currentlyAvailable) && styles.primaryButtonDisabled,
            ]}
            onPress={() => setConfirmVisible(true)}
            disabled={!selectedType || !selectedType.currentlyAvailable}
          >
            <Text style={styles.primaryButtonText}>Evet - Devam</Text>
          </TouchableOpacity>
          {selectedType && !selectedType.currentlyAvailable ? (
            <Text style={styles.blockedHint}>Bu okuma tipi yakında aktif olacak.</Text>
          ) : null}
        </View>
      </BrandedScrollView>

      <BrandedConfirmModal
        visible={confirmVisible}
        title="Okuma Tipi Onayı"
        message={selectedType ? `${selectedType.title} seçildi. Emin misin?` : 'Önce bir okuma tipi seçmelisin.'}
        confirmLabel="Evet - Devam"
        cancelLabel="Hayır"
        onCancel={() => setConfirmVisible(false)}
        onConfirm={() => {
          if (!selectedType) return;
          setConfirmVisible(false);
          navigation.navigate('PersonalAssistantSelect', {
            devSettings,
            profileId,
            readingType: selectedType.id,
          });
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#14141E' },
  content: { padding: 18, paddingBottom: 30 },
  panel: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: 'rgba(30,30,40,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.18)',
  },
  panelTitle: { color: '#E8C49A', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  helperText: { color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 20, marginBottom: 10 },
  typeCard: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.2)',
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  typeCardSelected: { borderColor: '#D4A574', backgroundColor: 'rgba(212,165,116,0.14)' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  typeTitle: { color: '#FFF5E8', fontSize: 14, fontWeight: '700', flex: 1, paddingRight: 8 },
  typeText: { color: 'rgba(255,255,255,0.76)', fontSize: 12, lineHeight: 18 },
  availableTag: {
    color: '#7DDC9A',
    borderColor: 'rgba(125,220,154,0.45)',
    borderWidth: 1,
    borderRadius: 9,
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  soonTag: {
    color: '#F6C38B',
    borderColor: 'rgba(246,195,139,0.45)',
    borderWidth: 1,
    borderRadius: 9,
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  primaryButton: {
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: '#D4A574',
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonDisabled: { opacity: 0.45 },
  primaryButtonText: { color: '#14141E', fontSize: 14, fontWeight: '800' },
  blockedHint: { marginTop: 8, color: '#F6C38B', fontSize: 12 },
});
