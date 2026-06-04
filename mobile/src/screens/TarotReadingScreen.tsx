import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { APP_NAME, getAssistantLabel } from '../config/constants';
import { FOLLOW_UP_QUESTION_MAX_CHARS, FOLLOW_UP_QUESTION_MIN_CHARS, normalizeLimitedInput, OPTIONAL_READING_TOPIC_MAX_CHARS } from '../config/llmTokenPolicy';
import { getTarotSpread } from '../data/tarotSpreads';
import { DEFAULT_TAROT_DECK_ID, getTarotDeckImages, getTarotDeckOption } from '../data/tarotImageMap';
import { AssistantLoading } from '../components/AssistantLoading';
import { BrandedConfirmModal } from '../components/BrandedConfirmModal';
import { BrandedScrollView } from '../components/BrandedScrollView';
import { SelectableFormattedText } from '../components/SelectableFormattedText';
import { TokenUsage } from '../components/TokenUsage';
import {
  applyMemoryAnalysisResult,
  appendReadingDerivedTheme,
  appendReadingSummary,
  appendUserConversationMemory,
  appendUserReadingIntentMemory,
  loadAccountState,
  loadProfileMemorySnippet,
} from '../services/profileMemoryService';
import { analyzeMemoryTranscript } from '../services/memoryAnalysisService';
import {
  createPersonalTarotFollowUp,
  createPersonalTarotReading,
  drawTarotSpreadCards,
  type DrawnTarotCard,
  type TarotFollowUpMessage,
} from '../services/personalTarotService';
import {
  addPersonalTokenUsage,
  GEMINI_FLASH_LITE_INPUT_PRICE_USD_PER_M,
  GEMINI_FLASH_LITE_OUTPUT_PRICE_USD_PER_M,
} from '../services/tokenLedgerService';
import type { TokenUsageData } from '../types';
import {
  getLatestNativeTranscript,
  resetNativeTranscript,
  startNativeRecording,
  stopNativeRecording,
} from '../services/nativeSttService';
import {
  getAssistantSpeechProgress,
  isAssistantSpeaking,
  prepareAssistantSpeech,
  startOrResumeAssistantSpeech,
  stopAssistantSpeech,
} from '../services/ttsService';

type Props = NativeStackScreenProps<RootStackParamList, 'TarotReading'>;

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

const BORDER_IMAGE = require('../../assets/border.png');

function makeMessage(role: 'user' | 'assistant', text: string): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role,
    text,
  };
}

function compactSummary(text: string) {
  return text.replace(/\s+/g, ' ').trim().slice(0, 420);
}

function readingTheme(spreadTitle: string, deckLabel: string, cards: DrawnTarotCard[]) {
  return `tarot ${spreadTitle} / ${deckLabel}: ${cards
    .slice(0, 5)
    .map((card) => `${card.positionTitle}=${card.cardNameTr} ${card.orientation === 'reversed' ? 'ters' : 'düz'}`)
    .join(', ')}`;
}

export function TarotReadingScreen({ route, navigation }: Props) {
  const { profileId, assistantId, spreadId, deckId = DEFAULT_TAROT_DECK_ID } = route.params;
  const spread = useMemo(() => getTarotSpread(spreadId), [spreadId]);
  const assistantLabel = useMemo(() => getAssistantLabel(assistantId), [assistantId]);
  const deck = useMemo(() => getTarotDeckOption(deckId), [deckId]);
  const deckImages = useMemo(() => getTarotDeckImages(deckId), [deckId]);
  const draw = useMemo(() => drawTarotSpreadCards({ spreadId, profileId, assistantId }), [assistantId, profileId, spreadId]);
  const cards = draw.cards;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [profileName, setProfileName] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [readingText, setReadingText] = useState('');
  const [initialQuestion, setInitialQuestion] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isSendingQuestion, setIsSendingQuestion] = useState(false);
  const [isRecordingQuestion, setIsRecordingQuestion] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const [selectedCard, setSelectedCard] = useState<DrawnTarotCard | null>(null);
  const [spreadModalVisible, setSpreadModalVisible] = useState(false);
  const [speechMode, setSpeechMode] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [usedClosings, setUsedClosings] = useState<string[]>([]);
  const [tokenUsage, setTokenUsage] = useState<TokenUsageData>({ inputTokens: 0, outputTokens: 0, textInputTokens: 0, imageInputTokens: 0 });
  const [infoModal, setInfoModal] = useState<{ visible: boolean; title: string; message: string }>({
    visible: false,
    title: APP_NAME,
    message: '',
  });
  const hasRoomierSpreadLayout = spread.id === 'should-i' || spread.id === 'celtic-cross';
  const speechRunRef = useRef(0);
  const questionBaseRef = useRef('');
  const pageScrollRef = useRef<ScrollView>(null);
  const readingScrollRef = useRef<ScrollView>(null);

  const isBusy = isLoading || isSendingQuestion || isProfileLoading;
  const wantsInitialQuestion = true;
  const spreadPreviewWidth = Math.min(width - 60, 330);
  const previewGap = hasRoomierSpreadLayout ? 16 : 10;
  const tileWidth = Math.max(24, Math.min(40, (spreadPreviewWidth - (spread.gridColumns - 1) * previewGap) / spread.gridColumns));
  const tileHeight = tileWidth * 1.58;
  const colStep = tileWidth + previewGap;
  const rowStep = tileHeight + previewGap;
  const spreadCanvasWidth = tileWidth + (spread.gridColumns - 1) * colStep;
  const canvasHeight = tileHeight + (spread.gridRows - 1) * rowStep;
  const modalMaxWidth = width - 36;
  const modalGap = hasRoomierSpreadLayout ? 20 : 12;
  const modalTileWidth = Math.max(34, Math.min(70, (modalMaxWidth - (spread.gridColumns - 1) * modalGap) / spread.gridColumns));
  const modalTileHeight = modalTileWidth * 1.58;
  const modalColStep = modalTileWidth + modalGap;
  const modalRowStep = modalTileHeight + modalGap;
  const modalCanvasWidth = modalTileWidth + (spread.gridColumns - 1) * modalColStep;
  const modalCanvasHeight = modalTileHeight + (spread.gridRows - 1) * modalRowStep;

  useEffect(() => {
    navigation.setOptions({
      headerBackVisible: !isBusy,
      gestureEnabled: !isBusy,
    });
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (!isBusy) return;
      event.preventDefault();
    });
    return unsubscribe;
  }, [isBusy, navigation]);

  const addUsage = useCallback(async (readingName: string, result: { modelName?: string; usage: { inputTokens: number; outputTokens: number } }) => {
    const inputTokens = result.usage.inputTokens || 0;
    const outputTokens = result.usage.outputTokens || 0;
    setTokenUsage((current) => ({
      inputTokens: current.inputTokens + inputTokens,
      outputTokens: current.outputTokens + outputTokens,
      textInputTokens: (current.textInputTokens || 0) + inputTokens,
      imageInputTokens: current.imageInputTokens || 0,
    }));
    await addPersonalTokenUsage({
      modelName: result.modelName || 'gemini-2.5-flash-lite',
      readingName,
      textInputTokens: inputTokens,
      outputTokens,
    }).catch(() => {});
  }, []);

  useEffect(() => {
    let mounted = true;
    void loadAccountState()
      .then((state) => {
        if (!mounted) return;
        const profile = state.profiles.find((item) => item.profileId === profileId) || null;
        if (!profile) throw new Error('Profil bulunamadı.');
        setProfileName(profile.displayName);
      })
      .catch((err: any) => {
        if (mounted) setInfoModal({ visible: true, title: APP_NAME, message: err?.message || 'Profil yüklenemedi.' });
      })
      .finally(() => {
        if (mounted) setIsProfileLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [profileId]);

  const loadReading = useCallback(async (question?: string) => {
    const initialIntent = question?.replace(/\s+/g, ' ').trim() || '';
    setIsLoading(true);
    try {
      const state = await loadAccountState();
      const profile = state.profiles.find((item) => item.profileId === profileId) || null;
      if (!profile) throw new Error('Profil bulunamadı.');
      setProfileName(profile.displayName);
      if (initialIntent) {
        await appendUserReadingIntentMemory({
          profileId,
          text: initialIntent,
          readingType: 'personal-tarot',
        }).catch(() => {});
      }
      const memoryState = initialIntent ? await loadAccountState().catch(() => state) : state;
      const memorySnippet = await loadProfileMemorySnippet(
        memoryState,
        profileId,
        initialIntent ? { semanticQuery: initialIntent } : undefined,
      ).catch(() => null);
      const result = await createPersonalTarotReading({
        profile,
        assistantId,
        assistantLabel,
        spread,
        cards,
        deckName: deck.label,
        question: initialIntent || undefined,
        memorySnippet,
        usedClosings,
      });
      setReadingText(result.text);
      setMessages([
        ...(initialIntent ? [makeMessage('user', initialIntent)] : []),
        makeMessage('assistant', result.text),
      ]);
      if (result.closingSentence) setUsedClosings((current) => [...current, result.closingSentence]);
      await addUsage(`Tarot - ${spread.title}`, result);
    } catch (err: any) {
      setInfoModal({ visible: true, title: APP_NAME, message: err?.message || 'Tarot yorumu üretilemedi.' });
    } finally {
      setIsLoading(false);
    }
  }, [addUsage, assistantId, assistantLabel, cards, deck.label, profileId, spread, usedClosings]);

  useEffect(() => {
    if (isProfileLoading || wantsInitialQuestion || readingText || isLoading) return;
    void loadReading();
  }, [isLoading, isProfileLoading, loadReading, readingText, wantsInitialQuestion]);

  const handleStartReading = useCallback(() => {
    if (isLoading || readingText) return;
    void loadReading(initialQuestion);
  }, [initialQuestion, isLoading, loadReading, readingText]);

  useEffect(() => {
    return () => {
      stopAssistantSpeech();
      void stopNativeRecording();
    };
    // İlk okuma aynı kartlarla bir kez üretilmeli.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t1 = setTimeout(() => readingScrollRef.current?.scrollToEnd({ animated: true }), 0);
    const t2 = setTimeout(() => readingScrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [messages.length, isSendingQuestion]);

  const latestReadableText = useMemo(() => {
    const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant');
    return lastAssistant?.text || readingText;
  }, [messages, readingText]);

  const handlePhoneRead = useCallback(() => {
    const readable = latestReadableText.trim();
    if (!readable) return;
    if (speechMode === 'playing') {
      speechRunRef.current += 1;
      stopAssistantSpeech();
      setSpeechMode('paused');
      return;
    }
    if (speechMode !== 'paused' || getAssistantSpeechProgress().finished) {
      prepareAssistantSpeech(readable);
    }
    const runId = speechRunRef.current + 1;
    speechRunRef.current = runId;
    setSpeechMode('playing');
    void startOrResumeAssistantSpeech().finally(() => {
      if (runId !== speechRunRef.current) return;
      if (!isAssistantSpeaking()) setSpeechMode('idle');
    });
  }, [latestReadableText, speechMode]);

  const handleSendQuestion = useCallback(async () => {
    const question = normalizeLimitedInput(questionText, FOLLOW_UP_QUESTION_MAX_CHARS);
    if (question.length < FOLLOW_UP_QUESTION_MIN_CHARS || !readingText || isSendingQuestion) return;
    const userMessage = makeMessage('user', question);
    const previousFollowUps: TarotFollowUpMessage[] = messages.map(({ role, text }) => ({ role, text }));
    setMessages((current) => [...current, userMessage]);
    setQuestionText('');
    setEditorVisible(false);
    setIsSendingQuestion(true);
    try {
      await appendUserConversationMemory(profileId, question).catch(() => {});
      const state = await loadAccountState();
      const semanticMemorySnippet = await loadProfileMemorySnippet(state, profileId, { semanticQuery: question }).catch(() => null);
      const result = await createPersonalTarotFollowUp({
        profileName: profileName || 'Profil',
        assistantId,
        assistantLabel,
        spread,
        cards,
        deckName: deck.label,
        readingText,
        question,
        previousFollowUps,
        memorySnippet: semanticMemorySnippet,
        usedClosings,
      });
      setMessages((current) => [...current, makeMessage('assistant', result.text)]);
      if (result.closingSentence) setUsedClosings((current) => [...current, result.closingSentence]);
      await addUsage(`Tarot - ${spread.title} - Soru`, result);
      setSpeechMode('idle');
    } catch (err: any) {
      setInfoModal({ visible: true, title: APP_NAME, message: err?.message || 'Soruna şu an yanıt üretilemedi.' });
    } finally {
      setIsSendingQuestion(false);
    }
  }, [
    addUsage,
    assistantId,
    assistantLabel,
    cards,
    deck.label,
    isSendingQuestion,
    messages,
    profileId,
    profileName,
    questionText,
    readingText,
    spread,
    usedClosings,
  ]);

  const persistReadingAndEnd = useCallback(async () => {
    if (!readingText) {
      navigation.goBack();
      return;
    }
    stopAssistantSpeech();
    await stopNativeRecording().catch(() => {});
    const transcript = messages.map((message) => ({ role: message.role, text: message.text, timestamp: Date.now() }));
    await appendReadingSummary({
      profileId,
      assistantId,
      readingType: 'personal-tarot',
      surfacesRead: [],
      summary: compactSummary(readingText),
      transcript,
      tarotSpread: {
        spreadId: spread.id,
        spreadName: spread.title,
        deckId,
        deckName: deck.label,
        cards: cards.map((card) => ({
          positionNo: card.positionNo,
          positionTitle: card.positionTitle,
          cardName: card.cardName,
          cardNameTr: card.cardNameTr,
          orientation: card.orientation,
        })),
      },
    }).catch(() => {});
    await appendReadingDerivedTheme(profileId, readingTheme(spread.title, deck.label, cards), `personal-tarot-${spread.id}-${Date.now()}`).catch(() => {});
    void loadAccountState()
      .then((state) => loadProfileMemorySnippet(state, profileId))
      .then((memorySnippet) =>
        analyzeMemoryTranscript({
          profileId,
          profileName: profileName || 'Profil',
          readingType: 'personal-tarot',
          memorySnippet,
          transcript,
        }),
      )
      .then((result) => applyMemoryAnalysisResult(profileId, result))
      .catch(() => {});
    navigation.goBack();
  }, [assistantId, cards, deck.label, deckId, messages, navigation, profileId, profileName, readingText, spread]);

  const mergeQuestionTranscript = useCallback((transcript: string) => {
    const cleaned = transcript.replace(/\s+/g, ' ').trim();
    const base = questionBaseRef.current;
    setQuestionText(base && cleaned ? `${base} ${cleaned}` : cleaned || base);
  }, []);

  const handleQuestionRecordStart = useCallback(async () => {
    if (isRecordingQuestion || isSendingQuestion || !readingText) return;
    if (speechMode === 'playing') {
      speechRunRef.current += 1;
      stopAssistantSpeech();
      setSpeechMode('paused');
    }
    questionBaseRef.current = questionText.replace(/\s+/g, ' ').trim();
    resetNativeTranscript();
    setIsRecordingQuestion(true);
    try {
      await startNativeRecording(mergeQuestionTranscript, (_code, message) => {
        if (message) setInfoModal({ visible: true, title: APP_NAME, message });
      });
    } catch (err: any) {
      setIsRecordingQuestion(false);
      setInfoModal({ visible: true, title: APP_NAME, message: err?.message || 'Sesli yazma başlatılamadı.' });
    }
  }, [isRecordingQuestion, isSendingQuestion, mergeQuestionTranscript, questionText, readingText, speechMode]);

  const handleQuestionRecordStop = useCallback(async () => {
    await stopNativeRecording().catch(() => {});
    mergeQuestionTranscript(getLatestNativeTranscript());
    resetNativeTranscript();
    setIsRecordingQuestion(false);
  }, [mergeQuestionTranscript]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'android' ? 24 : 0}
    >
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <ScrollView
          ref={pageScrollRef}
          style={styles.pageScroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
          scrollIndicatorInsets={{ right: 1 }}
          onScroll={(event) => {
            const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
            const maxOffset = Math.max(1, contentSize.height - layoutMeasurement.height);
            setScrollProgress(Math.min(1, Math.max(0, contentOffset.y / maxOffset)));
            setShowScrollTop(contentOffset.y > 360);
          }}
          scrollEventThrottle={80}
        >
          <View style={styles.tokenAckRow}>
            <TokenUsage
              usage={tokenUsage}
              inputPrice={GEMINI_FLASH_LITE_INPUT_PRICE_USD_PER_M}
              outputPrice={GEMINI_FLASH_LITE_OUTPUT_PRICE_USD_PER_M}
            />
          </View>
          <View style={styles.sessionHeaderRow}>
            <Text style={styles.sessionHeaderText}>{profileName || 'Profil'}</Text>
            <Text style={[styles.sessionHeaderText, styles.modeHeaderText]}>{spread.title}</Text>
            <Text style={styles.sessionHeaderText}>{assistantLabel}</Text>
          </View>

          <TouchableOpacity style={[styles.panel, styles.spreadPanel]} activeOpacity={0.9} onPress={() => setSpreadModalVisible(true)}>
            <Text style={styles.spreadHint}>{deck.label} - Açılımı büyütmek için dokun</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEnabled={false}>
              <View style={[styles.spreadCanvas, { width: spreadCanvasWidth, height: canvasHeight }]}>
                {cards.map((card) => {
                  const position = spread.positions.find((item) => item.no === card.positionNo);
                  const left = ((position?.col || 1) - 1) * colStep;
                  const top = ((position?.row || 1) - 1) * rowStep;
                  const imageSource = deckImages.front[card.cardName] || deckImages.back;
                  return (
                    <View
                      key={card.id}
                      style={[
                        styles.cardTile,
                        {
                          width: tileWidth,
                          height: tileHeight,
                          left,
                          top,
                          transform: position?.crossed ? [{ rotate: '90deg' }] : undefined,
                        },
                      ]}
                    >
                      <Image
                        source={imageSource}
                        style={[styles.cardImage, card.orientation === 'reversed' ? styles.reversedImage : null]}
                        resizeMode="cover"
                      />
                      <Image source={BORDER_IMAGE} style={styles.borderOverlay} resizeMode="stretch" />
                      <View style={styles.positionBadge}>
                        <Text style={styles.positionBadgeText}>{card.positionNo}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </TouchableOpacity>

          {!readingText && wantsInitialQuestion ? (
            <View style={[styles.panel, styles.intentPanel]}>
              <Text style={styles.intentTitle}>Aklında bir soru var mı?</Text>
              <TextInput
                style={styles.intentInput}
                value={initialQuestion}
                onChangeText={setInitialQuestion}
                placeholder="Aklında bir soru, açılımda yorumlanmasını istediğin bir konu, durum vb. varsa buraya yazabilirsin. Aklında bir şey yoksa boş da bırakabilirsin."
                placeholderTextColor="rgba(255,255,255,0.38)"
                maxLength={OPTIONAL_READING_TOPIC_MAX_CHARS}
                multiline
              />
              <TouchableOpacity
                style={[styles.primaryAction, (isLoading || isProfileLoading) && styles.disabledAction]}
                onPress={handleStartReading}
                disabled={isLoading || isProfileLoading}
              >
                <Text style={styles.primaryActionText}>{isLoading ? 'Yorumlanıyor...' : 'Açılımı Yorumla'}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={[styles.panel, styles.readingPanel]}>
            <BrandedScrollView
              ref={readingScrollRef}
              containerStyle={styles.readingScrollFrame}
              style={styles.readingScroll}
              contentContainerStyle={styles.readingScrollContent}
              nestedScrollEnabled
              indicatorMode="box"
              onContentSizeChange={() => {
                if (isSendingQuestion) readingScrollRef.current?.scrollToEnd({ animated: true });
              }}
            >
              {isLoading || isProfileLoading ? (
                <AssistantLoading label="Tarot açılımın yorumlanıyor" detail="Lütfen bekleyiniz. Ekranı kapatmayınız." />
              ) : !readingText && wantsInitialQuestion ? (
                <Text style={styles.emptyReadingText}>
                  Yorumunuz buraya gelecek. Sonrasında aşağıya kaydırıp her zamanki gibi yorum üzerinden tartışabileceğiniz alanı da görebilirsiniz.
                </Text>
              ) : (
                messages.map((message) => (
                  <View
                    key={message.id}
                    style={[styles.chatBubble, message.role === 'user' ? styles.userBubble : styles.assistantBubble]}
                  >
                    <Text style={styles.chatRole}>{message.role === 'user' ? 'Sen' : assistantLabel}</Text>
                    <SelectableFormattedText text={message.text} style={styles.chatText} />
                  </View>
                ))
              )}
              {isSendingQuestion ? <AssistantLoading compact /> : null}
            </BrandedScrollView>
          </View>

          <View style={styles.readActionsBar}>
            <TouchableOpacity style={styles.secondaryAction} onPress={handlePhoneRead} disabled={!latestReadableText.trim()}>
              <Text style={styles.secondaryActionText}>{speechMode === 'playing' ? 'Duraklat' : 'Telefon Okusun'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryAction, styles.disabledAction]} disabled>
              <Text style={styles.secondaryActionText}>{assistantLabel} Okusun</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.panel, styles.questionPanel]}>
            <TouchableOpacity style={styles.questionInput} activeOpacity={0.88} onPress={() => readingText && setEditorVisible(true)}>
              <Text style={[styles.composePreviewText, !questionText.trim() && styles.composePreviewPlaceholder]}>
                {questionText.trim() || 'Bu tarot açılımıyla ilgili bir soru veya konu yazabilirsin. Aklında bir şey yoksa boş da bırakabilirsin.'}
              </Text>
            </TouchableOpacity>
            <Modal visible={editorVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setEditorVisible(false)}>
              <KeyboardAvoidingView
                style={styles.editorOverlay}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'android' ? 24 : 0}
              >
                <View style={styles.editorCard}>
                  <Text style={styles.editorTitle}>Sorunu Düzenle</Text>
                  <TextInput
                    style={styles.editorInput}
                    value={questionText}
                    onChangeText={setQuestionText}
                    maxLength={FOLLOW_UP_QUESTION_MAX_CHARS}
                    placeholder="Sorunu veya konunu buradan düzenleyebilirsin. Aklında bir şey yoksa boş da bırakabilirsin."
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    multiline
                    autoFocus
                    scrollEnabled
                  />
                  <View style={styles.editorActions}>
                    <TouchableOpacity style={styles.editorGhostBtn} onPress={() => setEditorVisible(false)}>
                      <Text style={styles.editorGhostText}>Kapat</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.editorSendBtn, (!questionText.trim() || isSendingQuestion || isLoading || !readingText) && styles.disabledAction]}
                      onPress={() => void handleSendQuestion()}
                      disabled={!questionText.trim() || isSendingQuestion || isLoading || !readingText}
                    >
                      <Text style={styles.editorSendText}>{isSendingQuestion ? 'Soruluyor...' : 'Sor'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </KeyboardAvoidingView>
            </Modal>
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={[styles.holdTalkAction, isRecordingQuestion && styles.holdTalkActionRecording]}
                onPressIn={() => void handleQuestionRecordStart()}
                onPressOut={() => void handleQuestionRecordStop()}
                disabled={isSendingQuestion || isLoading || !readingText}
              >
                <Text style={styles.holdTalkActionText}>{isRecordingQuestion ? 'Bırakınca Yaz' : 'Basılı Tut Konuş'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryAction, (!questionText.trim() || isSendingQuestion || isLoading || !readingText) && styles.disabledAction]}
                onPress={() => void handleSendQuestion()}
                disabled={!questionText.trim() || isSendingQuestion || isLoading || !readingText}
              >
                <Text style={styles.primaryActionText}>{isSendingQuestion ? 'Soruluyor...' : 'Sor'}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.endButton, (isSendingQuestion || isLoading || !readingText) && styles.disabledAction]}
              onPress={() => void persistReadingAndEnd()}
              disabled={isSendingQuestion || isLoading || !readingText}
            >
              <Text style={styles.endButtonText}>Okumayı Bitir</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <View pointerEvents="none" style={[styles.scrollRail, { top: 44 + insets.top, bottom: 44 + insets.bottom }]}>
          <View style={[styles.scrollThumb, { top: `${Math.min(72, Math.max(0, scrollProgress * 72))}%` }]} />
        </View>

        {showScrollTop ? (
          <TouchableOpacity
            style={[styles.scrollTopButton, { bottom: 18 + insets.bottom }]}
            activeOpacity={0.82}
            onPress={() => pageScrollRef.current?.scrollTo({ y: 0, animated: true })}
          >
            <Text style={styles.scrollTopText}>↑</Text>
          </TouchableOpacity>
        ) : null}

        <Modal visible={spreadModalVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setSpreadModalVisible(false)}>
          <View style={styles.spreadModalOverlay}>
            <View style={styles.spreadModalCard}>
              <Text style={styles.modalTitle}>{spread.title}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={[styles.spreadCanvas, { width: modalCanvasWidth, height: modalCanvasHeight }]}>
                  {cards.map((card) => {
                    const position = spread.positions.find((item) => item.no === card.positionNo);
                    return (
                      <TouchableOpacity
                        key={`modal-${card.id}`}
                        style={[
                          styles.cardTile,
                          {
                            width: modalTileWidth,
                            height: modalTileHeight,
                            left: ((position?.col || 1) - 1) * modalColStep,
                            top: ((position?.row || 1) - 1) * modalRowStep,
                            transform: position?.crossed ? [{ rotate: '90deg' }] : undefined,
                          },
                        ]}
                        onPress={() => setSelectedCard(card)}
                      >
                        <Image
                          source={deckImages.front[card.cardName] || deckImages.back}
                          style={[styles.cardImage, card.orientation === 'reversed' ? styles.reversedImage : null]}
                          resizeMode="cover"
                        />
                        <Image source={BORDER_IMAGE} style={styles.borderOverlay} resizeMode="stretch" />
                        <View style={styles.positionBadge}>
                          <Text style={styles.positionBadgeText}>{card.positionNo}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSpreadModalVisible(false)}>
                <Text style={styles.modalCloseText}>Kapat</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={Boolean(selectedCard)} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setSelectedCard(null)}>
          <View style={styles.cardModalOverlay}>
            <View style={styles.cardModal}>
              {selectedCard ? (
                <>
                  <Image
                    source={deckImages.front[selectedCard.cardName] || deckImages.back}
                    style={[styles.modalCardImage, selectedCard.orientation === 'reversed' ? styles.reversedImage : null]}
                    resizeMode="cover"
                  />
                  <Text style={styles.modalTitle}>
                    {selectedCard.positionNo}. {selectedCard.positionTitle}
                  </Text>
                  <Text style={styles.modalMeta}>
                    {selectedCard.cardNameTr} / {selectedCard.cardName} ({selectedCard.orientation === 'reversed' ? 'Ters' : 'Düz'})
                  </Text>
                  <Text style={styles.modalText}>{selectedCard.positionMeaning}</Text>
                  <Text style={styles.modalText}>{selectedCard.guideQuestion}</Text>
                  <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSelectedCard(null)}>
                    <Text style={styles.modalCloseText}>Kapat</Text>
                  </TouchableOpacity>
                </>
              ) : null}
            </View>
          </View>
        </Modal>

        <BrandedConfirmModal
          visible={infoModal.visible}
          title={infoModal.title}
          message={infoModal.message}
          confirmLabel="Tamam"
          cancelLabel="Kapat"
          onConfirm={() => setInfoModal({ visible: false, title: APP_NAME, message: '' })}
          onCancel={() => setInfoModal({ visible: false, title: APP_NAME, message: '' })}
        />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#14141E' },
  pageScroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 28 },
  scrollTopButton: {
    position: 'absolute',
    right: 18,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D4A574',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 8,
    elevation: 8,
  },
  scrollTopText: { color: '#14141E', fontSize: 22, fontWeight: '900', lineHeight: 24 },
  scrollRail: {
    position: 'absolute',
    right: 5,
    width: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  scrollThumb: {
    position: 'absolute',
    left: 0,
    width: 4,
    height: '28%',
    minHeight: 68,
    borderRadius: 2,
    backgroundColor: 'rgba(212,165,116,0.92)',
  },
  tokenAckRow: { marginBottom: 12 },
  sessionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 6,
    gap: 8,
  },
  sessionHeaderText: { color: '#E8C49A', fontSize: 12, fontWeight: '800' },
  modeHeaderText: { flex: 1, textAlign: 'center', fontStyle: 'italic' },
  panel: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(30, 30, 40, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.18)',
  },
  spreadPanel: { paddingVertical: 10, alignItems: 'center' },
  spreadHint: { color: 'rgba(255,255,255,0.56)', fontSize: 11, fontWeight: '700', marginBottom: 6 },
  spreadCanvas: { position: 'relative', alignSelf: 'center' },
  cardTile: {
    position: 'absolute',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#05050A',
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.34)',
  },
  cardImage: { width: '100%', height: '100%' },
  borderOverlay: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  reversedImage: { transform: [{ rotate: '180deg' }] },
  positionBadge: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(20,20,30,0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.5)',
  },
  positionBadgeText: { color: '#E8C49A', fontSize: 10, fontWeight: '800' },
  intentPanel: { gap: 10 },
  intentTitle: { color: '#E8C49A', fontSize: 14, fontWeight: '800' },
  intentInput: {
    minHeight: 92,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.28)',
    backgroundColor: 'rgba(0,0,0,0.18)',
    color: '#FFF5E8',
    fontSize: 14,
    lineHeight: 20,
    padding: 12,
    textAlignVertical: 'top',
  },
  readingPanel: { minHeight: 420 },
  readingScrollFrame: { minHeight: 380, flexGrow: 0 },
  readingScroll: { flexGrow: 0 },
  readingScrollContent: { paddingBottom: 8 },
  emptyReadingText: { color: 'rgba(255,255,255,0.68)', fontSize: 14, lineHeight: 21 },
  chatBubble: { marginBottom: 10, borderRadius: 12, borderWidth: 1, padding: 12 },
  userBubble: { borderColor: 'rgba(125,220,154,0.28)', backgroundColor: 'rgba(125,220,154,0.08)' },
  assistantBubble: { borderColor: 'rgba(212,165,116,0.24)', backgroundColor: 'rgba(0,0,0,0.16)' },
  chatRole: { color: '#D4A574', fontSize: 11, fontWeight: '800', marginBottom: 5 },
  chatText: { color: '#FFF5E8', fontSize: 15, lineHeight: 22 },
  readActionsBar: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  questionPanel: { marginBottom: 0 },
  questionInput: {
    minHeight: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.28)',
    backgroundColor: 'rgba(0,0,0,0.18)',
    padding: 12,
  },
  composePreviewText: { color: '#FFF5E8', fontSize: 15, lineHeight: 22 },
  composePreviewPlaceholder: { color: 'rgba(255,255,255,0.42)' },
  editorOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 10,
  },
  editorCard: {
    borderRadius: 18,
    backgroundColor: '#1E1E28',
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.28)',
    padding: 14,
    maxHeight: '82%',
  },
  editorTitle: { color: '#E8C49A', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  editorInput: {
    minHeight: 170,
    maxHeight: 260,
    borderRadius: 12,
    borderColor: 'rgba(212,165,116,0.35)',
    borderWidth: 1,
    backgroundColor: 'rgba(30,30,40,0.95)',
    color: '#FFF5E8',
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 10,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  editorActions: { marginTop: 10, flexDirection: 'row', gap: 10 },
  editorGhostBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.5)',
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: 'rgba(212,165,116,0.12)',
  },
  editorGhostText: { color: '#E8C49A', fontSize: 12, fontWeight: '700' },
  editorSendBtn: { flex: 1, borderRadius: 10, paddingVertical: 11, alignItems: 'center', backgroundColor: '#D4A574' },
  editorSendText: { color: '#14141E', fontSize: 12, fontWeight: '800' },
  quickActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  primaryAction: { flex: 1, borderRadius: 12, backgroundColor: '#D4A574', paddingVertical: 11, alignItems: 'center' },
  primaryActionText: { color: '#14141E', fontSize: 13, fontWeight: '800' },
  secondaryAction: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.45)',
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  secondaryActionText: { color: '#E8C49A', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  holdTalkAction: { flex: 1, borderRadius: 12, backgroundColor: '#4CAF50', paddingVertical: 11, alignItems: 'center' },
  holdTalkActionRecording: { backgroundColor: '#FF6B6B' },
  holdTalkActionText: { color: '#14141E', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  endButton: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  endButtonText: { color: '#FFF5E8', fontSize: 13, fontWeight: '800' },
  disabledAction: { opacity: 0.55 },
  spreadModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  spreadModalCard: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '86%',
    borderRadius: 18,
    backgroundColor: '#1E1E28',
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.32)',
    padding: 14,
    alignItems: 'center',
  },
  cardModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  cardModal: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 18,
    backgroundColor: '#1E1E28',
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.32)',
    padding: 14,
    alignItems: 'center',
  },
  modalCardImage: { width: 170, height: 268, borderRadius: 10, marginBottom: 12 },
  modalTitle: { color: '#E8C49A', fontSize: 15, fontWeight: '800', textAlign: 'center', marginBottom: 5 },
  modalMeta: { color: '#FFF5E8', fontSize: 13, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  modalText: { color: 'rgba(255,255,255,0.76)', fontSize: 12, lineHeight: 18, textAlign: 'center', marginBottom: 6 },
  modalCloseBtn: { marginTop: 8, borderRadius: 12, backgroundColor: '#D4A574', paddingVertical: 10, paddingHorizontal: 28 },
  modalCloseText: { color: '#14141E', fontSize: 13, fontWeight: '800' },
});
