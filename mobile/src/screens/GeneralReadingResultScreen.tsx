import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { AssistantLoading } from '../components/AssistantLoading';
import { BrandedScrollView } from '../components/BrandedScrollView';
import AngelCardSymbol from '../components/AngelCardSymbol';
import AngelNumberCard from '../components/AngelNumberCard';
import AffirmationCard from '../components/AffirmationCard';
import FortuneCookieCard from '../components/FortuneCookieCard';
import GeneralAstroCard from '../components/GeneralAstroCard';
import IChingCard from '../components/IChingCard';
import InspirationCard from '../components/InspirationCard';
import MagicSphereCard from '../components/MagicSphereCard';
import RuneCard from '../components/RuneCard';
import TarotReadingCard from '../components/TarotReadingCard';
import type { AngelCard, AngelNumber } from '../data/divinationData';
import { createDailyGeneralReading, type GeneralDivinationType } from '../services/divinationEngine';
import { fetchGeneralAstroDirect } from '../services/generalAstroApiService';
import { loadAccountState } from '../services/profileMemoryService';
import { getRetryLaterMessage, isRetryableLlmError } from '../services/llmRetryMessages';

type Props = NativeStackScreenProps<RootStackParamList, 'GeneralReadingResult'>;

type GeneralReadingId = RootStackParamList['GeneralReadingResult']['readingId'];

const ASTRO_IDS = ['astro-daily', 'astro-weekly', 'astro-monthly'] as const;

function isAstroId(id: GeneralReadingId) {
  return (ASTRO_IDS as readonly string[]).includes(id);
}

function astroPeriod(id: GeneralReadingId) {
  if (id === 'astro-daily') return 'daily';
  if (id === 'astro-weekly') return 'weekly';
  return 'monthly';
}

export function GeneralReadingResultScreen({ navigation, route }: Props) {
  const { profileId, readingId, title } = route.params;
  const [isLoading, setIsLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [readingText, setReadingText] = useState('');
  const [tarotReveal, setTarotReveal] = useState<{ cardName: string; isReversed: boolean; nonce: number } | null>(null);
  const [runeReveal, setRuneReveal] = useState<{ path: string; keyword: string; message: string; runeName: string } | null>(null);
  const [iChingReveal, setIChingReveal] = useState<{
    baseLines: number[];
    endLines: number[];
    hasChanges: boolean;
    baseHexName: string;
    endHexName?: string;
    text: string;
  } | null>(null);
  const [angelReveal, setAngelReveal] = useState<AngelCard | null>(null);
  const [angelNumberReveal, setAngelNumberReveal] = useState<AngelNumber | null>(null);
  const [affirmationReveal, setAffirmationReveal] = useState<{ opener: string; middle: string; closer: string } | null>(null);
  const [numerologyReveal, setNumerologyReveal] = useState<{ number: string; meaning: string; guidance?: string } | null>(null);
  const [fortuneCookieReveal, setFortuneCookieReveal] = useState<{ text: string; sign: string } | null>(null);
  const [magicBallReveal, setMagicBallReveal] = useState<{ text: string; sign: string } | null>(null);
  const [inspirationReveal, setInspirationReveal] = useState<string | null>(null);
  const [astroReveal, setAstroReveal] = useState<{ title: string; text: string } | null>(null);

  const loadReading = useCallback(async () => {
    setIsLoading(true);
    setErrorText(null);
    setReadingText('');
    setTarotReveal(null);
    setRuneReveal(null);
    setIChingReveal(null);
    setAngelReveal(null);
    setAngelNumberReveal(null);
    setAffirmationReveal(null);
    setNumerologyReveal(null);
    setFortuneCookieReveal(null);
    setMagicBallReveal(null);
    setInspirationReveal(null);
    setAstroReveal(null);

    try {
      const accountState = await loadAccountState();
      const profile = accountState.profiles.find((item) => item.profileId === profileId);
      if (!profile) {
        throw new Error('Profil bulunamadı. Lütfen profil seçimini kontrol edip tekrar dene.');
      }

      if (isAstroId(readingId)) {
        const result = await fetchGeneralAstroDirect({
          period: astroPeriod(readingId),
          profile,
        });
        if (!result) {
          throw new Error('Genel astro şu an hazırlanamadı. Lütfen birazdan tekrar dene.');
        }
        setReadingText(result.text);
        setAstroReveal({ title, text: result.text });
        return;
      }

      const divinationType = readingId as GeneralDivinationType;
      const result = await createDailyGeneralReading({
        type: divinationType,
        profileId,
      });
      setReadingText(result.text);

      if (divinationType === 'daily-tarot' && result.meta?.tarot) {
        setTarotReveal({
          cardName: result.meta.tarot.cardName,
          isReversed: result.meta.tarot.orientation === 'reversed',
          nonce: Date.now(),
        });
      } else if (divinationType === 'daily-runes' && result.meta?.rune) {
        setRuneReveal(result.meta.rune);
      } else if (divinationType === 'daily-i-ching' && result.meta?.iChing) {
        setIChingReveal(result.meta.iChing);
      } else if (divinationType === 'daily-angel' && result.meta?.angel) {
        setAngelReveal(result.meta.angel);
      } else if (divinationType === 'daily-angel-number' && result.meta?.angelNumber) {
        setAngelNumberReveal(result.meta.angelNumber);
      } else if (divinationType === 'daily-affirmation' && result.meta?.affirmation) {
        setAffirmationReveal(result.meta.affirmation);
      } else if (divinationType === 'daily-numerology' && result.meta?.numerology) {
        setNumerologyReveal(result.meta.numerology);
      } else if (divinationType === 'fortune-cookie' && result.meta?.fortuneCookie) {
        setFortuneCookieReveal(result.meta.fortuneCookie);
      } else if (divinationType === 'magic-ball' && result.meta?.magicBall) {
        setMagicBallReveal(result.meta.magicBall);
      } else if (divinationType === 'daily-quote') {
        setInspirationReveal(result.text);
      }
    } catch (err: any) {
      const retryMessage = isRetryableLlmError(err) ? getRetryLaterMessage('general-astro', readingId) : null;
      setErrorText(retryMessage?.message || err?.message || 'Şu an metin üretilemedi, lütfen tekrar dene.');
    } finally {
      setIsLoading(false);
    }
  }, [profileId, readingId, title]);

  useEffect(() => {
    void loadReading();
  }, [loadReading]);

  const resultCard = tarotReveal ? (
    <TarotReadingCard cardName={tarotReveal.cardName} isReversed={tarotReveal.isReversed} nonce={tarotReveal.nonce} text={readingText} />
  ) : runeReveal ? (
    <RuneCard rune={runeReveal} />
  ) : iChingReveal ? (
    <IChingCard data={iChingReveal} />
  ) : angelReveal ? (
    <AngelCardSymbol card={angelReveal} />
  ) : angelNumberReveal ? (
    <AngelNumberCard card={angelNumberReveal} />
  ) : affirmationReveal ? (
    <AffirmationCard affirmation={affirmationReveal} />
  ) : numerologyReveal ? (
    <AngelNumberCard card={numerologyReveal as any} />
  ) : fortuneCookieReveal ? (
    <FortuneCookieCard data={fortuneCookieReveal} />
  ) : magicBallReveal ? (
    <MagicSphereCard data={magicBallReveal} />
  ) : inspirationReveal ? (
    <InspirationCard text={inspirationReveal} />
  ) : astroReveal ? (
    <GeneralAstroCard title={astroReveal.title} text={astroReveal.text} />
  ) : null;

  const hidePlainText = Boolean(resultCard);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <BrandedScrollView contentContainerStyle={styles.content} showScrollToTop>
        <View style={styles.panel}>
          <Text style={styles.title}>{title}</Text>
          {isLoading ? (
            <AssistantLoading label="Hazırlanıyor" detail="Yorum hazırlanırken bu ekranda bekleyebilirsin." />
          ) : errorText ? (
            <>
              <Text style={styles.errorText}>{errorText}</Text>
              <TouchableOpacity style={styles.primaryButton} onPress={() => void loadReading()}>
                <Text style={styles.primaryButtonText}>Tekrar Dene</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {resultCard}
              {!hidePlainText ? <Text style={styles.readingText}>{readingText}</Text> : null}
            </>
          )}
        </View>

        {!isLoading ? (
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryButtonText}>Genel Okumalara Dön</Text>
          </TouchableOpacity>
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
    backgroundColor: 'rgba(30, 30, 40, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.18)',
  },
  title: { color: '#E8C49A', fontSize: 17, fontWeight: '800', marginBottom: 12 },
  readingText: { color: '#FFF5E8', fontSize: 14, lineHeight: 22 },
  errorText: { color: '#FFF5E8', fontSize: 14, lineHeight: 21, marginBottom: 12 },
  primaryButton: {
    borderRadius: 14,
    backgroundColor: '#D4A574',
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#14141E', fontSize: 14, fontWeight: '800' },
  secondaryButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.45)',
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  secondaryButtonText: { color: '#E8C49A', fontSize: 14, fontWeight: '800' },
});
