import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { BrandedConfirmModal } from '../components/BrandedConfirmModal';
import { BrandedScrollView } from '../components/BrandedScrollView';

type Props = NativeStackScreenProps<RootStackParamList, 'SimyaLab'>;

export function SimyaLabScreen({}: Props) {
  const [infoVisible, setInfoVisible] = useState(false);

  const showMockInfo = useCallback(() => {
    setInfoVisible(true);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <BrandedScrollView contentContainerStyle={styles.content} showScrollToTop>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Simya Laboratuvarı</Text>
          <Text style={styles.helperText}>
            Niyet, okuma tasarımı ve farklı araçları birleştiren deneysel alan. Buradaki bazı seçenekler şimdilik iskelet olarak hazır duruyor.
          </Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Manifest</Text>
          <TouchableOpacity
            style={styles.wideCard}
            activeOpacity={0.84}
            onPress={showMockInfo}
          >
            <Text style={styles.cardTitle}>Sohbetli Manifestleme</Text>
            <Text style={styles.cardText}>Niyetini netleştir, dirençleri fark et ve adım adım odak kur.</Text>
            <Text style={styles.cardMeta}>Bağlantı daha sonra ayrı manifest akışına taşınacak.</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Kendi Okumanı Oluştur</Text>
          <View style={styles.grid}>
            <TouchableOpacity style={styles.createCard} activeOpacity={0.84} onPress={showMockInfo}>
              <Text style={styles.cardTitle}>Baştan Yarat</Text>
              <Text style={styles.cardText}>Konu, araç, derinlik ve yorumcu seçimlerini sıfırdan kur.</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.createCard} activeOpacity={0.84} onPress={showMockInfo}>
              <Text style={styles.cardTitle}>Combo Yarat</Text>
              <Text style={styles.cardText}>Tarot, astroloji, numeroloji ve sezgisel araçları tek akışta birleştir.</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BrandedScrollView>

      <BrandedConfirmModal
        visible={infoVisible}
        title="Yakında"
        message="Bu alanın seçim modeli hazır; okuma motoruna bağlantısını sonraki adımda ekleyeceğiz."
        confirmLabel="Tamam"
        cancelLabel={null}
        onConfirm={() => setInfoVisible(false)}
        onCancel={() => setInfoVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#14141E' },
  content: { padding: 18, paddingBottom: 30 },
  panel: {
    marginBottom: 14,
    borderRadius: 18,
    padding: 16,
    backgroundColor: 'rgba(30,30,40,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.18)',
  },
  panelTitle: { color: '#E8C49A', fontSize: 16, fontWeight: '900', marginBottom: 10 },
  helperText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 18 },
  wideCard: {
    minHeight: 118,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.2)',
    backgroundColor: 'rgba(0,0,0,0.16)',
    justifyContent: 'center',
  },
  grid: { flexDirection: 'row', gap: 12 },
  createCard: {
    flex: 1,
    minHeight: 146,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.2)',
    backgroundColor: 'rgba(0,0,0,0.16)',
    justifyContent: 'space-between',
  },
  cardTitle: { color: '#FFF5E8', fontSize: 15, fontWeight: '900', marginBottom: 8 },
  cardText: { color: 'rgba(212,165,116,0.76)', fontSize: 12, lineHeight: 18 },
  cardMeta: { color: '#F6C38B', fontSize: 11, fontWeight: '800', lineHeight: 16, marginTop: 10 },
});
