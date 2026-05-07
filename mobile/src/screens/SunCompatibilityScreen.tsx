import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { BrandedPicker } from '../components/BrandedPicker';
import { BrandedScrollView } from '../components/BrandedScrollView';
import {
  createSunCompatibilityReading,
  ZODIAC_SIGNS,
  type SunCompatibilityReading,
  type ZodiacSignId,
} from '../services/sunCompatibilityService';

type Props = NativeStackScreenProps<RootStackParamList, 'SunCompatibility'>;

export function SunCompatibilityScreen({}: Props) {
  const insets = useSafeAreaInsets();
  const [firstSign, setFirstSign] = useState<ZodiacSignId>('aries');
  const [secondSign, setSecondSign] = useState<ZodiacSignId>('libra');
  const [reading, setReading] = useState<SunCompatibilityReading | null>(null);

  const prepareReading = useCallback(async () => {
    const next = await createSunCompatibilityReading(firstSign, secondSign);
    setReading(next);
  }, [firstSign, secondSign]);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <BrandedScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]} showScrollToTop>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Genel Burç Uyumu</Text>
          <Text style={styles.helperText}>
            Detaysız genel uyumdur; yalnızca iki kişinin Güneş burcu seçilir ve hiçbir LLM çağrısı yapılmaz.
          </Text>
          <Text style={styles.label}>1. kişinin Güneş burcu</Text>
          <BrandedPicker selectedValue={firstSign} onValueChange={setFirstSign} options={ZODIAC_SIGNS.map((sign) => ({ label: sign.label, value: sign.id }))} />
          <Text style={styles.label}>2. kişinin Güneş burcu</Text>
          <BrandedPicker selectedValue={secondSign} onValueChange={setSecondSign} options={ZODIAC_SIGNS.map((sign) => ({ label: sign.label, value: sign.id }))} />
          <TouchableOpacity style={styles.primaryButton} onPress={() => void prepareReading()}>
            <Text style={styles.primaryButtonText}>Uyumu Göster</Text>
          </TouchableOpacity>
        </View>

        {reading ? (
          <View style={styles.panel}>
            <Text style={styles.resultTitle}>{reading.title}</Text>
            {reading.sections.map((section) => (
              <View key={section.id} style={styles.sectionBlock}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <Text style={[styles.scoreText, { color: section.color }]}>%{section.score}</Text>
                </View>
                <Text style={styles.sectionText}>{section.text}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </BrandedScrollView>
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
    backgroundColor: 'rgba(30,30,40,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.18)',
  },
  panelTitle: { color: '#E8C49A', fontSize: 17, fontWeight: '800', marginBottom: 8 },
  helperText: { color: 'rgba(255,255,255,0.68)', fontSize: 13, lineHeight: 19, marginBottom: 12 },
  label: { color: '#D4A574', fontSize: 13, fontWeight: '700', marginBottom: 6 },
  primaryButton: {
    borderRadius: 12,
    backgroundColor: '#D4A574',
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 2,
  },
  primaryButtonText: { color: '#14141E', fontSize: 14, fontWeight: '800' },
  resultTitle: { color: '#FFF5E8', fontSize: 16, fontWeight: '800', marginBottom: 12 },
  sectionBlock: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.2)',
    backgroundColor: 'rgba(0,0,0,0.14)',
    padding: 12,
    marginBottom: 10,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { color: '#E8C49A', fontSize: 14, fontWeight: '800', flex: 1, paddingRight: 10 },
  scoreText: { fontSize: 18, fontWeight: '900' },
  sectionText: { color: '#FFF5E8', fontSize: 14, lineHeight: 21 },
});
