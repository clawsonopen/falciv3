import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, ImageBackground, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { createDaisyFortuneSession, daisyAnswerForPetal, type DaisyFortuneSession } from '../services/daisyFortuneService';
import { BrandedScrollView } from '../components/BrandedScrollView';

type Props = NativeStackScreenProps<RootStackParamList, 'DaisyFortune'>;

const CARD_WIDTH = Math.min(Dimensions.get('window').width * 0.82, 360);
const CARD_HEIGHT = (CARD_WIDTH * 650) / 400;

export function DaisyFortuneScreen({}: Props) {
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<DaisyFortuneSession | null>(null);
  const [pluckedCount, setPluckedCount] = useState(0);
  const [lastAnswer, setLastAnswer] = useState<'EVET' | 'HAYIR' | null>(null);

  const startNew = useCallback(async () => {
    const next = await createDaisyFortuneSession();
    setSession(next);
    setPluckedCount(0);
    setLastAnswer(null);
  }, []);

  useEffect(() => {
    void startNew();
  }, [startNew]);

  const petals = session?.petalCount || 0;
  const remaining = Math.max(0, petals - pluckedCount);
  const finished = Boolean(session && remaining === 0 && lastAnswer);
  const nextAnswer = useMemo(() => {
    if (!session || finished) return null;
    return daisyAnswerForPetal(session.startsWithYes, pluckedCount) as 'EVET' | 'HAYIR';
  }, [finished, pluckedCount, session]);

  const pluckPetal = useCallback(() => {
    if (!session || finished) return;
    const answer = daisyAnswerForPetal(session.startsWithYes, pluckedCount) as 'EVET' | 'HAYIR';
    setLastAnswer(answer);
    setPluckedCount((current) => Math.min(session.petalCount, current + 1));
  }, [finished, pluckedCount, session]);

  const visiblePetals = Array.from({ length: remaining }, (_, index) => index);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <BrandedScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]} showScrollToTop>
        <View style={styles.cardWrap}>
          <ImageBackground source={require('../../assets/angel_bg.jpg')} style={styles.backgroundImage} imageStyle={{ borderRadius: 20 }}>
            <View style={StyleSheet.absoluteFill}>
              <Svg viewBox="0 0 400 650" width="100%" height="100%">
                <Defs>
                  <LinearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%" stopColor="#c59b6d" />
                    <Stop offset="50%" stopColor="#e0c296" />
                    <Stop offset="100%" stopColor="#c59b6d" />
                  </LinearGradient>
                </Defs>
                <Rect x="15" y="15" width="370" height="620" rx="15" fill="none" stroke="url(#goldGrad)" strokeWidth="1.5" />
                <Rect x="25" y="25" width="350" height="600" rx="10" fill="none" stroke="#c59b6d" strokeWidth="1" opacity="0.6" />
                <Path d="M 15 45 L 15 15 L 45 15" fill="none" stroke="url(#goldGrad)" strokeWidth="3" />
                <Path d="M 385 45 L 385 15 L 355 15" fill="none" stroke="url(#goldGrad)" strokeWidth="3" />
                <Path d="M 15 605 L 15 635 L 45 635" fill="none" stroke="url(#goldGrad)" strokeWidth="3" />
                <Path d="M 385 605 L 385 635 L 355 635" fill="none" stroke="url(#goldGrad)" strokeWidth="3" />
              </Svg>
            </View>

            <View style={styles.cardContent}>
              <Text style={styles.title} adjustsFontSizeToFit numberOfLines={2}>Papatya ile Hızlı EVET/HAYIR Ritüeli</Text>
              <Text style={styles.prompt}>Aklındaki soru için</Text>
              <Text style={styles.yesNo}>EVET / HAYIR</Text>

              <TouchableOpacity style={styles.daisyTouchArea} activeOpacity={0.92} onPress={pluckPetal} disabled={finished || !session}>
                <Svg viewBox="0 0 260 260" width="100%" height="100%">
                  <Defs>
                    <LinearGradient id="petalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <Stop offset="0%" stopColor="#fffdf6" />
                      <Stop offset="72%" stopColor="#f5ead6" />
                      <Stop offset="100%" stopColor="#e6cfa7" />
                    </LinearGradient>
                    <LinearGradient id="stemGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <Stop offset="0%" stopColor="#79a86b" />
                      <Stop offset="100%" stopColor="#426b3d" />
                    </LinearGradient>
                  </Defs>
                  <Path d="M130 145 C126 178 123 207 116 245" stroke="url(#stemGrad)" strokeWidth="9" strokeLinecap="round" fill="none" />
                  <Path d="M128 198 C96 181 78 191 62 213 C91 215 111 213 128 198 Z" fill="#5f8d55" opacity="0.82" />
                  <Path d="M134 190 C160 170 181 176 199 196 C173 202 151 203 134 190 Z" fill="#6d9c60" opacity="0.72" />
                  <G origin="130,120">
                    {visiblePetals.map((_, index) => {
                      const angle = (360 / Math.max(1, remaining)) * index;
                      return (
                        <Ellipse
                          key={`${remaining}-${index}`}
                          cx="130"
                          cy="68"
                          rx="18"
                          ry="47"
                          fill="url(#petalGrad)"
                          stroke="#d8bd8e"
                          strokeWidth="1"
                          transform={`rotate(${angle} 130 120)`}
                          opacity="0.96"
                        />
                      );
                    })}
                  </G>
                  <Ellipse cx="130" cy="120" rx="28" ry="28" fill="#dba43e" stroke="#9d7134" strokeWidth="2" />
                  <Ellipse cx="122" cy="112" rx="6" ry="5" fill="#f0c05a" opacity="0.85" />
                  <Ellipse cx="140" cy="126" rx="5" ry="4" fill="#a66f28" opacity="0.45" />
                </Svg>
              </TouchableOpacity>

              <View style={styles.stateBox}>
                {finished ? (
                  <Text style={styles.resultText}>
                    Aklındaki sorunun yanıtı <Text style={styles.resultStrong}>{lastAnswer}</Text>
                  </Text>
                ) : (
                  <>
                    <Text style={styles.counterText}>{remaining} yaprak kaldı</Text>
                    <Text style={styles.nextText}>Sıradaki yaprak: {nextAnswer}</Text>
                  </>
                )}
              </View>
            </View>
          </ImageBackground>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={() => void startNew()}>
          <Text style={styles.primaryButtonText}>Yeni Papatya</Text>
        </TouchableOpacity>
      </BrandedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#14141E' },
  content: { padding: 18, paddingBottom: 30, alignItems: 'center' },
  cardWrap: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
    borderRadius: 20,
    overflow: 'hidden',
  },
  backgroundImage: { flex: 1, width: '100%', height: '100%' },
  cardContent: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 22,
    paddingTop: 42,
    paddingBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 24,
    fontWeight: 'bold',
    color: '#5a4634',
    letterSpacing: 1,
    textAlign: 'center',
  },
  prompt: {
    marginTop: 14,
    color: '#4a3b2c',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  yesNo: {
    marginTop: 4,
    color: '#8c7355',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
  },
  daisyTouchArea: {
    width: '86%',
    aspectRatio: 1,
    marginTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateBox: {
    marginTop: 20,
    width: '92%',
    minHeight: 76,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e0c296',
    backgroundColor: 'rgba(253,244,227,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  counterText: { color: '#5a4634', fontSize: 16, fontWeight: '800', textAlign: 'center' },
  nextText: { color: '#8c7355', fontSize: 13, fontWeight: '700', marginTop: 5, textAlign: 'center' },
  resultText: { color: '#5a4634', fontSize: 17, lineHeight: 24, fontWeight: '700', textAlign: 'center' },
  resultStrong: { color: '#8c3b2f', fontSize: 22, fontWeight: '900' },
  primaryButton: {
    width: CARD_WIDTH,
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: '#D4A574',
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#14141E', fontSize: 14, fontWeight: '900' },
});
