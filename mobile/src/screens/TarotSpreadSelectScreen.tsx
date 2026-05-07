import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { TAROT_SPREADS } from '../data/tarotSpreads';
import { getAssistantLabel } from '../config/constants';
import { BrandedScrollView } from '../components/BrandedScrollView';

type Props = NativeStackScreenProps<RootStackParamList, 'TarotSpreadSelect'>;

export function TarotSpreadSelectScreen({ navigation, route }: Props) {
  const { profileId, assistantId } = route.params;
  const assistantLabel = getAssistantLabel(assistantId);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <BrandedScrollView contentContainerStyle={styles.content} showScrollToTop>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Tarot Açılımı Seç</Text>
          <Text style={styles.headerMeta}>{assistantLabel}</Text>
        </View>
        <View style={styles.grid}>
          {TAROT_SPREADS.map((spread) => (
            <TouchableOpacity
              key={spread.id}
              style={styles.spreadCard}
              onPress={() =>
                navigation.navigate('TarotReading', {
                  profileId,
                  assistantId,
                  spreadId: spread.id,
                })
              }
            >
              <View style={styles.spreadTopRow}>
                <Text style={styles.spreadTitle}>{spread.title}</Text>
                <Text style={styles.cardCount}>{spread.cardCount} kart</Text>
              </View>
              <Text style={styles.spreadPurpose}>{spread.purpose}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </BrandedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#14141E' },
  content: { padding: 18, paddingBottom: 28 },
  headerRow: {
    paddingHorizontal: 4,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { color: '#E8C49A', fontSize: 18, fontWeight: '800' },
  headerMeta: { color: 'rgba(255,255,255,0.68)', fontSize: 12, fontWeight: '700' },
  grid: { gap: 10 },
  spreadCard: {
    minHeight: 112,
    borderRadius: 14,
    padding: 14,
    backgroundColor: 'rgba(30,30,40,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.2)',
  },
  spreadTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  spreadTitle: { flex: 1, color: '#FFF5E8', fontSize: 15, fontWeight: '800', lineHeight: 20 },
  cardCount: {
    color: '#14141E',
    backgroundColor: '#D4A574',
    borderRadius: 9,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 11,
    fontWeight: '800',
  },
  spreadPurpose: { color: 'rgba(255,255,255,0.74)', fontSize: 12, lineHeight: 18 },
});
