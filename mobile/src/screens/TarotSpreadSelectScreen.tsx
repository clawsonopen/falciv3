import React, { useMemo, useState } from 'react';
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { TAROT_DECK_OPTIONS, type TarotDeckId } from '../data/tarotImageMap';
import { TAROT_SPREADS } from '../data/tarotSpreads';
import { getAssistantLabel } from '../config/constants';
import { BrandedScrollView } from '../components/BrandedScrollView';

type Props = NativeStackScreenProps<RootStackParamList, 'TarotSpreadSelect'>;

export function TarotSpreadSelectScreen({ navigation, route }: Props) {
  const { profileId, assistantId } = route.params;
  const assistantLabel = getAssistantLabel(assistantId);
  const [pendingSpreadId, setPendingSpreadId] = useState<string | null>(null);
  const pendingSpread = useMemo(
    () => TAROT_SPREADS.find((spread) => spread.id === pendingSpreadId) || null,
    [pendingSpreadId],
  );

  const handleDeckSelect = (deckId: TarotDeckId) => {
    if (!pendingSpreadId) return;
    const spreadId = pendingSpreadId;
    setPendingSpreadId(null);
    navigation.navigate('TarotReading', {
      profileId,
      assistantId,
      spreadId,
      deckId,
    });
  };

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
              onPress={() => setPendingSpreadId(spread.id)}
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

      <Modal
        visible={Boolean(pendingSpreadId)}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setPendingSpreadId(null)}
      >
        <View style={styles.deckModalOverlay}>
          <View style={styles.deckModalCard}>
            <Text style={styles.deckModalTitle}>Deste Seç</Text>
            <Text style={styles.deckModalSubtitle}>
              {pendingSpread ? `${pendingSpread.title} açılımı için görsel dili seç.` : 'Açılım için görsel dili seç.'}
            </Text>
            <View style={styles.deckOptionsRow}>
              {TAROT_DECK_OPTIONS.map((deck) => (
                <TouchableOpacity
                  key={deck.id}
                  style={styles.deckOption}
                  activeOpacity={0.86}
                  onPress={() => handleDeckSelect(deck.id)}
                >
                  <View style={styles.deckPreviewStack}>
                    <Image source={deck.backImage} style={styles.deckBackPreview} resizeMode="cover" />
                    <Image source={deck.previewImage} style={styles.deckFrontPreview} resizeMode="cover" />
                  </View>
                  <Text style={styles.deckLabel}>{deck.label}</Text>
                  <Text style={styles.deckDescription}>{deck.description}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.deckCancelButton} onPress={() => setPendingSpreadId(null)}>
              <Text style={styles.deckCancelText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  deckModalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  deckModalCard: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#1E1E28',
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.32)',
  },
  deckModalTitle: { color: '#E8C49A', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  deckModalSubtitle: {
    marginTop: 4,
    marginBottom: 14,
    color: 'rgba(255,255,255,0.68)',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  deckOptionsRow: { flexDirection: 'row', gap: 10 },
  deckOption: {
    flex: 1,
    minWidth: 0,
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.24)',
  },
  deckPreviewStack: {
    width: 112,
    height: 150,
    marginBottom: 10,
  },
  deckBackPreview: {
    position: 'absolute',
    left: 2,
    top: 10,
    width: 74,
    height: 116,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    transform: [{ rotate: '-7deg' }],
  },
  deckFrontPreview: {
    position: 'absolute',
    right: 2,
    top: 0,
    width: 84,
    height: 132,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.42)',
  },
  deckLabel: { color: '#FFF5E8', fontSize: 13, lineHeight: 17, fontWeight: '900', textAlign: 'center' },
  deckDescription: {
    marginTop: 5,
    color: 'rgba(255,255,255,0.62)',
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
  },
  deckCancelButton: {
    marginTop: 14,
    alignSelf: 'center',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 28,
    backgroundColor: '#D4A574',
  },
  deckCancelText: { color: '#14141E', fontSize: 13, fontWeight: '900' },
});
