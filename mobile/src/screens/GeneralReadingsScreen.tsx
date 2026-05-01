import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import type { SubjectProfile } from '../types/memory';
import { getPrimaryProfile, loadAccountState } from '../services/profileMemoryService';
import { createDailyGeneralReading, type GeneralDivinationType } from '../services/divinationEngine';
import { fetchGeneralAstroFromBackend } from '../services/generalAstroApiService';
import {
  getAssistantSpeechProgress,
  isAssistantSpeaking,
  prepareAssistantSpeech,
  startOrResumeAssistantSpeech,
  stopAssistantSpeech,
} from '../services/ttsService';
import { BrandedConfirmModal } from '../components/BrandedConfirmModal';
import { TarotRevealCard } from '../components/TarotRevealCard';
import RuneStone from '../components/RuneStone';
import IChingSymbol from '../components/IChingSymbol';
import AngelCardSymbol from '../components/AngelCardSymbol';
import AngelNumberCard from '../components/AngelNumberCard';
import AffirmationCard from '../components/AffirmationCard';
import RuneCard from '../components/RuneCard';
import FortuneCookieCard from '../components/FortuneCookieCard';
import MagicSphereCard from '../components/MagicSphereCard';
import InspirationCard from '../components/InspirationCard';
import TarotReadingCard from '../components/TarotReadingCard';
import IChingCard from '../components/IChingCard';
import { APP_NAME } from '../config/constants';
import { getRetryLaterMessage, isRetryableLlmError } from '../services/llmRetryMessages';
import type { AngelCard, AngelNumber } from '../data/divinationData';
import GeneralAstroCard from '../components/GeneralAstroCard';

type Props = NativeStackScreenProps<RootStackParamList, 'GeneralReadings'>;

type GeneralReadingItem = {
  id: GeneralDivinationType | 'astro-daily' | 'astro-weekly' | 'astro-monthly';
  title: string;
  description: string;
  isPaid: boolean;
  refreshLabel: string;
};

function weekRangeLabel(date = new Date()) {
  const day = date.getDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const format = (d: Date) => d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
  return `${format(monday)} - ${format(sunday)}`;
}

function monthLabel(date = new Date()) {
  return date.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
}

function profileBadge(profile: SubjectProfile) {
  if (profile.relationshipPrimary === 'kendi') return 'Kendim';
  if (profile.relationshipPrimary === 'cocuk') return 'Çocuk';
  if (profile.relationshipPrimary === 'es') return 'Eş';
  return profile.relationshipPrimary;
}

function sortProfiles(profiles: SubjectProfile[], primaryProfileId: string | null) {
  return [...profiles].sort((a, b) => {
    const aSelf = a.profileId === primaryProfileId || a.relationshipPrimary === 'kendi' || a.isPrimary;
    const bSelf = b.profileId === primaryProfileId || b.relationshipPrimary === 'kendi' || b.isPrimary;
    if (aSelf !== bSelf) return aSelf ? -1 : 1;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export function GeneralReadingsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [profiles, setProfiles] = useState<SubjectProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pendingItem, setPendingItem] = useState<GeneralReadingItem | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [infoModal, setInfoModal] = useState<{ visible: boolean; message: string; title: string }>({
    visible: false,
    message: '',
    title: APP_NAME,
  });
  const [speechMode, setSpeechMode] = useState<'hidden' | 'idle' | 'playing' | 'paused'>('hidden');
  const [tarotReveal, setTarotReveal] = useState<{
    cardName: string;
    isReversed: boolean;
    nonce: number;
  } | null>(null);
  const [runeReveal, setRuneReveal] = useState<{
    path: string;
    keyword: string;
    message: string;
    runeName: string;
  } | null>(null);
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
  const speechRunRef = useRef(0);

  const stopSpeechAndReset = useCallback(() => {
    speechRunRef.current += 1;
    stopAssistantSpeech();
    setSpeechMode('hidden');
  }, []);

  const closeInfoModal = useCallback(() => {
    stopSpeechAndReset();
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
    setInfoModal((prev) => ({ ...prev, visible: false, message: '', title: APP_NAME }));
  }, [stopSpeechAndReset]);

  const loadProfiles = useCallback(async () => {
    const state = await loadAccountState();
    const sorted = sortProfiles(state.profiles, state.primaryProfileId);
    setProfiles(sorted);
    const fallback = getPrimaryProfile(state)?.profileId || sorted[0]?.profileId || null;
    setSelectedProfileId((current) => (current && sorted.some((p) => p.profileId === current) ? current : fallback));
  }, []);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      void loadProfiles();
    });
    return unsubscribe;
  }, [loadProfiles, navigation]);

  useEffect(() => {
    return () => {
      stopAssistantSpeech();
    };
  }, []);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.profileId === selectedProfileId) || null,
    [profiles, selectedProfileId],
  );

  const items: GeneralReadingItem[] = useMemo(
    () => [
      {
        id: 'astro-daily',
        title: 'Genel Astro Günlük',
        description: 'Yükselen veya ay burcunu dikkate almayan, 3-4 ana konuya değinen kısa genel yorum.',
        isPaid: false,
        refreshLabel: 'Her gün yenilenir',
      },
      {
        id: 'astro-weekly',
        title: 'Genel Astro Haftalık',
        description: 'Haftanın genel ritmi, fırsatlar ve dikkat edilmesi gereken ana başlıklar.',
        isPaid: false,
        refreshLabel: `Pazar akşamı yenilenir (${weekRangeLabel()})`,
      },
      {
        id: 'astro-monthly',
        title: 'Genel Astro Aylık',
        description: 'Ayın genel gündemi. 3 aylık ve yıllık bu bölümde yer almaz.',
        isPaid: false,
        refreshLabel: `Ayın son günü yenilenir (${monthLabel()})`,
      },
      {
        id: 'fortune-cookie',
        title: 'Şans Kurabiyesi',
        description: 'Kısa ve motive edici günlük mesaj.',
        isPaid: false,
        refreshLabel: 'Her gün yenilenir',
      },
      {
        id: 'magic-ball',
        title: 'Sihirli Küre',
        description: 'Tek soru için hızlı ve eğlenceli yanıt.',
        isPaid: false,
        refreshLabel: 'Her gün yenilenir',
      },
      {
        id: 'daily-affirmation',
        title: 'Günlük Olumlamalar',
        description: 'Her gün için kısa, güçlendirici olumlama metni.',
        isPaid: false,
        refreshLabel: 'Her gün yenilenir',
      },
      {
        id: 'daily-quote',
        title: 'Günlük İlham',
        description: 'Ünlü isimlerden ilham veren gerçek alıntılar.',
        isPaid: false,
        refreshLabel: 'Her gün yenilenir',
      },
      {
        id: 'daily-runes',
        title: 'Günlük Rune Taşı Mesajı',
        description: 'Günün runesi ve kısa anlamı.',
        isPaid: false,
        refreshLabel: 'Her gün yenilenir',
      },
      {
        id: 'daily-i-ching',
        title: 'Günlük I-Ching',
        description: 'Günlük hexagram odaklı kısa içgörü.',
        isPaid: false,
        refreshLabel: 'Her gün yenilenir',
      },
      {
        id: 'daily-tarot',
        title: 'Günlük Tek Tarot Kartı',
        description: 'Günlük enerjiye yönelik tek kartlık genel açılım.',
        isPaid: true,
        refreshLabel: 'Her gün yenilenir',
      },
      {
        id: 'daily-angel',
        title: 'Günlük Melek Kartı',
        description: 'Günlük niyet ve rehberlik odaklı tek kartlık okuma.',
        isPaid: true,
        refreshLabel: 'Her gün yenilenir',
      },
      {
        id: 'daily-numerology',
        title: 'Günün Numerolojisi',
        description: 'Tarihten hesaplanan genel gün enerjisi yorumu.',
        isPaid: false,
        refreshLabel: 'Her gün yenilenir',
      },
      {
        id: 'daily-angel-number',
        title: 'Günün Uğurlu Melek Sayısı',
        description: 'Güne özel melek sayısı ve kısa anlamı.',
        isPaid: false,
        refreshLabel: 'Her gün yenilenir',
      },
    ],
    [],
  );

  const runGeneralReading = useCallback(
    async (item: GeneralReadingItem) => {
      if (!selectedProfile) {
        setInfoModal({
          visible: true,
          title: APP_NAME,
          message: 'Önce bir profil seçmelisin.',
        });
        setSpeechMode('hidden');
        return;
      }

      if (isGenerating) return;
      setIsGenerating(true);
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
        const isAstro = item.id === 'astro-daily' || item.id === 'astro-weekly' || item.id === 'astro-monthly';
        let result;
        if (isAstro) {
          const period = item.id === 'astro-daily' ? 'daily' : item.id === 'astro-weekly' ? 'weekly' : 'monthly';
          result = await fetchGeneralAstroFromBackend({
            period,
            profile: selectedProfile,
          });
          if (!result) {
            throw new Error('Genel astro şu an hazırlanamadı. Lütfen birazdan tekrar dene.');
          }
          setAstroReveal({ title: item.title, text: result.text });
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
        } else {
          setAstroReveal(null);
          const divinationType = item.id as GeneralDivinationType;
          result = await createDailyGeneralReading({
            type: divinationType,
            profileId: selectedProfile.profileId,
          });
          if (divinationType === 'daily-tarot' && result.meta?.tarot) {
            setTarotReveal({
              cardName: result.meta.tarot.cardName,
              isReversed: result.meta.tarot.orientation === 'reversed',
              nonce: Date.now(),
            });
            setRuneReveal(null);
            setIChingReveal(null);
          } else if (divinationType === 'daily-runes' && result.meta?.rune) {
            setRuneReveal({
              path: result.meta.rune.path,
              keyword: result.meta.rune.keyword,
              message: result.meta.rune.message,
              runeName: result.meta.rune.runeName,
            });
            setTarotReveal(null);
            setIChingReveal(null);
            setAngelReveal(null);
            setAngelNumberReveal(null);
            setAffirmationReveal(null);
            setNumerologyReveal(null);
          } else if (divinationType === 'daily-i-ching' && result.meta?.iChing) {
            setIChingReveal({
              baseLines: result.meta.iChing.baseLines,
              endLines: result.meta.iChing.endLines,
              hasChanges: result.meta.iChing.hasChanges,
              baseHexName: result.meta.iChing.baseHexName,
              endHexName: result.meta.iChing.endHexName,
              text: result.meta.iChing.text,
            });
            setTarotReveal(null);
            setRuneReveal(null);
            setAngelReveal(null);
          } else if (divinationType === 'daily-angel' && result.meta?.angel) {
            setAngelReveal(result.meta.angel);
            setTarotReveal(null);
            setRuneReveal(null);
            setIChingReveal(null);
            setAngelNumberReveal(null);
          } else if (divinationType === 'daily-angel-number' && result.meta?.angelNumber) {
            setAngelNumberReveal(result.meta.angelNumber);
            setAngelReveal(null);
            setTarotReveal(null);
            setRuneReveal(null);
            setIChingReveal(null);
            setAffirmationReveal(null);
          } else if (divinationType === 'daily-affirmation' && result.meta?.affirmation) {
            setAffirmationReveal(result.meta.affirmation);
            setNumerologyReveal(null);
            setAngelNumberReveal(null);
            setAngelReveal(null);
            setTarotReveal(null);
            setRuneReveal(null);
            setIChingReveal(null);
          } else if (divinationType === 'daily-numerology' && result.meta?.numerology) {
            setNumerologyReveal(result.meta.numerology);
            setAffirmationReveal(null);
            setAngelNumberReveal(null);
            setAngelReveal(null);
            setTarotReveal(null);
            setRuneReveal(null);
            setIChingReveal(null);
          } else if (divinationType === 'fortune-cookie' && result.meta?.fortuneCookie) {
            setFortuneCookieReveal(result.meta.fortuneCookie);
            setMagicBallReveal(null);
            setNumerologyReveal(null);
            setAffirmationReveal(null);
            setAngelNumberReveal(null);
            setAngelReveal(null);
            setTarotReveal(null);
            setRuneReveal(null);
            setIChingReveal(null);
            setInspirationReveal(null);
          } else if (divinationType === 'magic-ball' && result.meta?.magicBall) {
            setMagicBallReveal(result.meta.magicBall);
            setFortuneCookieReveal(null);
            setNumerologyReveal(null);
            setAffirmationReveal(null);
            setAngelNumberReveal(null);
            setAngelReveal(null);
            setTarotReveal(null);
            setRuneReveal(null);
            setIChingReveal(null);
            setInspirationReveal(null);
          } else if (divinationType === 'daily-quote') {
            setInspirationReveal(result.text);
            setMagicBallReveal(null);
            setFortuneCookieReveal(null);
            setNumerologyReveal(null);
            setAffirmationReveal(null);
            setAngelNumberReveal(null);
            setAngelReveal(null);
            setTarotReveal(null);
            setRuneReveal(null);
            setIChingReveal(null);
          } else {
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
          }
        }

        setInfoModal({
          visible: true,
          title: item.title,
          message: result.text,
        });

        setSpeechMode(isAstro ? 'idle' : 'hidden');
      } catch (err: any) {
        setTarotReveal(null);
        setAstroReveal(null);
        const retryMessage = isRetryableLlmError(err) ? getRetryLaterMessage('general-astro', item.id) : null;
        setInfoModal({
          visible: true,
          title: retryMessage?.title || APP_NAME,
          message: retryMessage?.message || err?.message || 'Şu an metin üretilemedi, lütfen tekrar dene.',
        });
        setSpeechMode('hidden');
      } finally {
        setIsGenerating(false);
      }
    },
    [isGenerating, selectedProfile],
  );

  const handleGeneralReadingPress = useCallback(
    (item: GeneralReadingItem) => {
      if (!selectedProfile) {
        setInfoModal({
          visible: true,
          title: APP_NAME,
          message: 'Önce bir profil seçmelisin.',
        });
        setSpeechMode('hidden');
        return;
      }
      setPendingItem(item);
      setConfirmVisible(true);
    },
    [selectedProfile],
  );

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}> 
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Kimin İçin Baktıracaksın?</Text>
          <Text style={styles.helperText}>Genel okumalar daha kısa ve daha geneldir; yükselen veya ay burcu hesaba katılmaz.</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {profiles.map((profile) => {
              const selected = profile.profileId === selectedProfileId;
              return (
                <TouchableOpacity
                  key={profile.profileId}
                  style={[styles.profileCard, selected && styles.profileCardSelected]}
                  onPress={() => {
                    setSelectedProfileId(profile.profileId);
                  }}
                >
                  <Text style={styles.profileName}>{profile.displayName}</Text>
                  <Text style={styles.profileMeta}>{profileBadge(profile)}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Genel Fal Türleri</Text>
          <View style={styles.grid}>
            {items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.readingSquareCard}
                onPress={() => {
                  handleGeneralReadingPress(item);
                }}
                disabled={isGenerating}
              >
                <Text style={styles.readingSquareTitle}>{item.title}</Text>
                <Text style={styles.refreshText}>{item.refreshLabel}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <BrandedConfirmModal
        visible={confirmVisible}
        title={APP_NAME}
        message={
          pendingItem && selectedProfile
            ? `${selectedProfile.displayName} için bakıyoruz, değil mi?`
            : 'Bu profil için bakıyoruz, değil mi?'
        }
        confirmLabel="Evet"
        cancelLabel="Hayır"
        onConfirm={() => {
          const item = pendingItem;
          setConfirmVisible(false);
          setPendingItem(null);
          if (item) {
            void runGeneralReading(item);
          }
        }}
        onCancel={() => {
          setConfirmVisible(false);
          setPendingItem(null);
        }}
      />

      <BrandedConfirmModal
        visible={infoModal.visible}
        title={infoModal.title}
        message={infoModal.message}
        topContent={
          tarotReveal ? (
            <TarotReadingCard
              cardName={tarotReveal.cardName}
              isReversed={tarotReveal.isReversed}
              nonce={tarotReveal.nonce}
              text={infoModal.message}
            />
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
          ) : undefined
        }
        hideMessageText={!!tarotReveal || !!angelReveal || !!angelNumberReveal || !!affirmationReveal || !!numerologyReveal || !!runeReveal || !!fortuneCookieReveal || !!magicBallReveal || !!iChingReveal || !!inspirationReveal || !!astroReveal}
        confirmLabel="Tamam"
        cancelLabel={null}
        speechMode={speechMode}
        onSpeechStart={() => {
          const progress = getAssistantSpeechProgress();
          if (speechMode !== 'paused' || progress.finished || progress.totalChunks === 0) {
            prepareAssistantSpeech(infoModal.message);
          }
          const runId = speechRunRef.current + 1;
          speechRunRef.current = runId;
          setSpeechMode('playing');
          void startOrResumeAssistantSpeech().finally(() => {
            if (runId !== speechRunRef.current) return;
            if (!isAssistantSpeaking()) {
              setSpeechMode('idle');
            }
          });
        }}
        onSpeechPause={() => {
          speechRunRef.current += 1;
          stopAssistantSpeech();
          setSpeechMode('paused');
        }}
        onSpeechResume={() => {
          const runId = speechRunRef.current + 1;
          speechRunRef.current = runId;
          setSpeechMode('playing');
          void startOrResumeAssistantSpeech().finally(() => {
            if (runId !== speechRunRef.current) return;
            if (!isAssistantSpeaking()) {
              setSpeechMode('idle');
            }
          });
        }}
        onConfirm={closeInfoModal}
        onCancel={closeInfoModal}
      />
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
  panelTitle: { color: '#E8C49A', fontSize: 16, fontWeight: '700', marginBottom: 10 },
  helperText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 18, marginBottom: 10 },
  profileCard: {
    width: 140,
    minHeight: 90,
    marginRight: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.18)',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  profileCardSelected: { borderColor: '#D4A574', backgroundColor: 'rgba(212,165,116,0.14)' },
  profileName: { color: '#FFF5E8', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  profileMeta: { color: 'rgba(212,165,116,0.72)', fontSize: 12 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  readingSquareCard: {
    width: '31.5%',
    aspectRatio: 1,
    borderRadius: 14,
    padding: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.2)',
    backgroundColor: 'rgba(0,0,0,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readingSquareTitle: {
    color: '#D4A574',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  refreshText: { color: 'rgba(212,165,116,0.8)', fontSize: 9, textAlign: 'center', marginTop: 6 },
  freeTag: {
    color: '#7DDC9A',
    borderColor: 'rgba(125,220,154,0.45)',
    borderWidth: 1,
    borderRadius: 9,
    fontSize: 9,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  paidTag: {
    color: '#F6C38B',
    borderColor: 'rgba(246,195,139,0.45)',
    borderWidth: 1,
    borderRadius: 9,
    fontSize: 9,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});
