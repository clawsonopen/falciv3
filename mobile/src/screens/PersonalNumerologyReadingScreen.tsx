import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { BrandedConfirmModal } from '../components/BrandedConfirmModal';
import { AssistantLoading } from '../components/AssistantLoading';
import { TokenUsage } from '../components/TokenUsage';
import { SelectableFormattedText } from '../components/SelectableFormattedText';
import { BrandedScrollView } from '../components/BrandedScrollView';
import { APP_NAME, getAssistantLabel } from '../config/constants';
import { FOLLOW_UP_QUESTION_MAX_CHARS, FOLLOW_UP_QUESTION_MIN_CHARS, normalizeLimitedInput } from '../config/llmTokenPolicy';
import { applyMemoryAnalysisResult, appendReadingDerivedTheme, appendReadingSpecificityUsage, appendReadingSummary, appendSelfKnowledgeProfileInsight, appendUserConversationMemory, loadAccountState, loadProfileMemorySnippet } from '../services/profileMemoryService';
import { getRetryLaterMessage, isRetryableLlmError } from '../services/llmRetryMessages';
import { analyzeMemoryTranscript } from '../services/memoryAnalysisService';
import {
  createPersonalNumerologyFollowUp,
  createPersonalNumerologyReading,
  getCachedPersonalNumerologyReading,
  hasRequiredNumerologyInputs,
  type PersonalNumerologyCore,
  type PersonalNumerologyMode,
} from '../services/personalNumerologyEngine';
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

type Props = NativeStackScreenProps<RootStackParamList, 'PersonalNumerologyReading'>;

const MODE_LABELS: Record<PersonalNumerologyMode, string> = {
  core: 'Temel Sayı Haritası',
  daily: 'Günlük Numeroloji',
  weekly: 'Haftalık Numeroloji',
  monthly: 'Aylık Numeroloji',
};

const CORE_LABELS: Array<[keyof PersonalNumerologyCore, string]> = [
  ['lifePath', 'Yaşam Yolu'],
  ['destiny', 'Kader / İfade'],
  ['soulUrge', 'Ruh Arzusu'],
  ['personality', 'Kişilik'],
  ['birthday', 'Doğum Günü'],
  ['maturity', 'Olgunluk'],
];

type FollowUpMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

function compactSummary(text: string) {
  return text.replace(/\s+/g, ' ').trim().slice(0, 420);
}

export function PersonalNumerologyReadingScreen({ route, navigation }: Props) {
  const { profileId, assistantId, initialMode } = route.params;
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<PersonalNumerologyMode | null>(initialMode || null);
  const [isLoading, setIsLoading] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [text, setText] = useState('');
  const [core, setCore] = useState<PersonalNumerologyCore | null>(null);
  const [readingTheme, setReadingTheme] = useState<{ label: string; key: string; period?: 'daily' | 'weekly' | 'monthly' } | null>(null);
  const [specificityUsage, setSpecificityUsage] = useState<{ events?: Array<{ group: string; label: string }> } | null>(null);
  const [tokenUsage, setTokenUsage] = useState<TokenUsageData>({ inputTokens: 0, outputTokens: 0, textInputTokens: 0, imageInputTokens: 0 });
  const [questionText, setQuestionText] = useState('');
  const [followUps, setFollowUps] = useState<FollowUpMessage[]>([]);
  const [isSendingQuestion, setIsSendingQuestion] = useState(false);
  const [isRecordingQuestion, setIsRecordingQuestion] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const [speechMode, setSpeechMode] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [infoModal, setInfoModal] = useState({ visible: false, title: APP_NAME, message: '' });
  const speechRunRef = useRef(0);
  const questionBaseRef = useRef('');
  const pageScrollRef = useRef<ScrollView>(null);
  const initialModeLoadedRef = useRef(false);

  const assistantLabel = useMemo(() => getAssistantLabel(assistantId), [assistantId]);
  const availableModes = useMemo<PersonalNumerologyMode[]>(
    () => (initialMode === 'core' ? ['core'] : ['daily', 'weekly', 'monthly']),
    [initialMode],
  );
  const modeHeaderLabel = useMemo(() => (mode ? MODE_LABELS[mode] : 'Bölüm seç'), [mode]);
  const isBusy = isLoading || isSendingQuestion;
  const hasPreparedReading = Boolean(text && mode);
  const canPrepareReading = Boolean(mode && !isBusy && !hasPreparedReading);
  const actionLabel = hasPreparedReading ? 'Yorum Hazır' : mode ? 'Yorumu Hazırla' : 'Önce Bölüm Seç';

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

  const applyReadingToScreen = useCallback((reading: Awaited<ReturnType<typeof createPersonalNumerologyReading>>) => {
    setText(reading.text);
    setCore(reading.core);
    setSpecificityUsage(reading.specificityUsage || null);
    setFollowUps([]);

    const theme =
      reading.mode === 'core'
        ? `temel numeroloji: yaşam yolu ${reading.core.lifePath}, kader ${reading.core.destiny}, olgunluk ${reading.core.maturity}`
        : `${MODE_LABELS[reading.mode].toLocaleLowerCase('tr-TR')}: ${reading.periodKey || reading.context.targetDateIso}`;
    const themeKey =
      reading.mode === 'core'
        ? 'personal-numerology-core'
        : `personal-numerology-${reading.mode}-${reading.periodKey || reading.context.targetDateIso}`;
    setReadingTheme({ label: theme, key: themeKey, period: reading.mode === 'core' ? undefined : reading.mode });
  }, []);

  const handleSelectMode = useCallback(
    async (nextMode: PersonalNumerologyMode) => {
      if (isBusy) return;
      setMode(nextMode);
      setText('');
      setCore(null);
      setSpecificityUsage(null);
      setReadingTheme(null);
      setFollowUps([]);
      setQuestionText('');
      try {
        const state = await loadAccountState();
        const profile = state.profiles.find((item) => item.profileId === profileId) || null;
        if (!profile) return;
        setProfileName(profile.displayName);
        if (!hasRequiredNumerologyInputs(profile)) return;
        const cached = await getCachedPersonalNumerologyReading({ profile, assistantId, mode: nextMode });
        if (cached) applyReadingToScreen(cached);
      } catch {
        // Cache kontrolü sessiz kalmalı; üretim butonu normal akışı sürdürecek.
      }
    },
    [applyReadingToScreen, assistantId, isBusy, profileId],
  );

  useEffect(() => {
    if (!initialMode || initialModeLoadedRef.current) return;
    initialModeLoadedRef.current = true;
    void handleSelectMode(initialMode);
  }, [handleSelectMode, initialMode]);

  const loadReading = useCallback(async () => {
    if (isBusy || text) return;
    if (!mode) {
      setText('');
      setCore(null);
      setSpecificityUsage(null);
      setReadingTheme(null);
      return;
    }

    setIsLoading(true);
    try {
      const state = await loadAccountState();
      const profile = state.profiles.find((item) => item.profileId === profileId) || null;
      if (!profile) {
        setInfoModal({ visible: true, title: APP_NAME, message: 'Profil bulunamadı.' });
        setText('');
        setSpecificityUsage(null);
        return;
      }
      setProfileName(profile.displayName);
      if (!hasRequiredNumerologyInputs(profile)) {
        setInfoModal({
          visible: true,
          title: 'Profil Bilgisi Gerekli',
          message: 'Kişisel numeroloji için profil adı ve doğum tarihi gerekli. Doğum saati veya doğum yeri kullanılmıyor.',
        });
        setText('');
        setSpecificityUsage(null);
        return;
      }

      const memorySnippet = await loadProfileMemorySnippet(state, profileId, {
        semanticQuery: mode === 'core' ? 'temel numeroloji haritası' : MODE_LABELS[mode],
      }).catch(() => null);
      const reading = await createPersonalNumerologyReading({
        profile,
        assistantId,
        assistantLabel,
        mode,
        memorySnippet,
      });
      if (!reading.cached && reading.usage) {
        const inputTokens = reading.usage.inputTokens || 0;
        const outputTokens = reading.usage.outputTokens || 0;
        setTokenUsage((current) => ({
          inputTokens: current.inputTokens + inputTokens,
          outputTokens: current.outputTokens + outputTokens,
          textInputTokens: (current.textInputTokens || 0) + inputTokens,
          imageInputTokens: current.imageInputTokens || 0,
        }));
        await addPersonalTokenUsage({
          modelName: reading.modelName || 'gemini-2.5-flash-lite',
          readingName: mode === 'core' ? 'Kişisel Numeroloji - Temel' : `Kişisel Numeroloji - ${MODE_LABELS[mode]}`,
          textInputTokens: inputTokens,
          outputTokens,
        }).catch(() => {});
      }
      applyReadingToScreen(reading);
    } catch (err: any) {
      const retryMessage = isRetryableLlmError(err) ? getRetryLaterMessage('personal-numerology', `${profileId}-${mode}`) : null;
      setInfoModal({
        visible: true,
        title: retryMessage?.title || APP_NAME,
        message: retryMessage?.message || err?.message || 'Kişisel numeroloji yorumu üretilemedi.',
      });
      setText('');
      setSpecificityUsage(null);
    } finally {
      setIsLoading(false);
    }
  }, [applyReadingToScreen, assistantId, assistantLabel, isBusy, mode, profileId, text]);

  useEffect(() => {
    return () => {
      stopAssistantSpeech();
      void stopNativeRecording();
    };
  }, []);

  useEffect(() => {
    if (!isSendingQuestion) return;
    const t1 = setTimeout(() => pageScrollRef.current?.scrollToEnd({ animated: true }), 0);
    const t2 = setTimeout(() => pageScrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isSendingQuestion, followUps.length]);

  const latestReadableText = useMemo(() => {
    const lastAssistant = [...followUps].reverse().find((message) => message.role === 'assistant');
    return lastAssistant?.text || text;
  }, [followUps, text]);

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
      if (!isAssistantSpeaking()) {
        setSpeechMode('idle');
      }
    });
  }, [latestReadableText, speechMode]);

  const handleSendQuestion = useCallback(async () => {
    const question = normalizeLimitedInput(questionText, FOLLOW_UP_QUESTION_MAX_CHARS);
    if (question.length < FOLLOW_UP_QUESTION_MIN_CHARS || !text || !mode || isSendingQuestion) return;
    const userMessage: FollowUpMessage = { id: `u-${Date.now()}`, role: 'user', text: question };
    const previousFollowUps = followUps.map(({ role, text }) => ({ role, text }));
    setFollowUps((current) => [...current, userMessage]);
    setQuestionText('');
    setEditorVisible(false);
    setIsSendingQuestion(true);
    try {
      await appendUserConversationMemory(profileId, question).catch(() => {});
      const semanticMemorySnippet = await loadAccountState()
        .then((state) => loadProfileMemorySnippet(state, profileId, { semanticQuery: question }))
        .catch(() => null);
      const answer = await createPersonalNumerologyFollowUp({
        profileName: profileName || 'Profil',
        assistantId,
        assistantLabel,
        mode,
        readingText: text,
        question,
        previousFollowUps,
        memorySnippet: semanticMemorySnippet,
      });
      setFollowUps((current) => [...current, { id: `a-${Date.now()}`, role: 'assistant', text: answer.text }]);
      const inputTokens = answer.usage.inputTokens || 0;
      const outputTokens = answer.usage.outputTokens || 0;
      setTokenUsage((current) => ({
        inputTokens: current.inputTokens + inputTokens,
        outputTokens: current.outputTokens + outputTokens,
        textInputTokens: (current.textInputTokens || 0) + inputTokens,
        imageInputTokens: current.imageInputTokens || 0,
      }));
      await addPersonalTokenUsage({
        modelName: answer.modelName || 'gemini-2.5-flash-lite',
        readingName: mode === 'core' ? 'Kişisel Numeroloji - Temel' : `Kişisel Numeroloji - ${MODE_LABELS[mode]}`,
        textInputTokens: inputTokens,
        outputTokens,
      }).catch(() => {});
      setSpeechMode('idle');
    } catch (err: any) {
      setInfoModal({
        visible: true,
        title: APP_NAME,
        message: err?.message || 'Soruna şu an yanıt üretilemedi.',
      });
    } finally {
      setIsSendingQuestion(false);
    }
  }, [assistantId, assistantLabel, followUps, isSendingQuestion, mode, profileName, questionText, text]);

  const buildTranscript = useCallback(
    () => [
      { role: 'assistant' as const, text, timestamp: Date.now() },
      ...followUps.map((message) => ({ role: message.role, text: message.text, timestamp: Date.now() })),
    ],
    [followUps, text],
  );

  const persistReadingAndEnd = useCallback(async () => {
    if (!text || !mode) return;
    stopAssistantSpeech();
    await stopNativeRecording().catch(() => {});
    const transcript = buildTranscript();
    const nextState = await appendReadingSummary({
      profileId,
      assistantId,
      readingType: 'personal-numerology',
      period: readingTheme?.period,
      surfacesRead: [],
      summary: compactSummary(text),
      transcript,
    }).catch(() => {});
    if (mode === 'core') {
      await appendSelfKnowledgeProfileInsight({
        profileId,
        readingId: nextState?.readings?.[0]?.readingId || `numerology-core-${profileId}`,
        source: 'numerology-core',
        title: 'Temel numeroloji profili',
        summary: compactSummary(text),
        detailGroup: 'temel numeroloji',
        confidence: 0.58,
      }).catch(() => {});
    }
    if (readingTheme) {
      await appendReadingDerivedTheme(profileId, readingTheme.label, readingTheme.key).catch(() => {});
    }
    if (specificityUsage?.events?.length) {
      await appendReadingSpecificityUsage(profileId, specificityUsage).catch(() => {});
    }
    void loadAccountState()
      .then((state) => loadProfileMemorySnippet(state, profileId))
      .then((memorySnippet) =>
        analyzeMemoryTranscript({
          profileId,
          profileName: profileName || 'Profil',
          readingType: 'personal-numerology',
          memorySnippet,
          transcript,
        }),
      )
      .then((result) => applyMemoryAnalysisResult(profileId, result))
      .catch(() => {});
    navigation.goBack();
  }, [assistantId, buildTranscript, mode, navigation, profileId, profileName, readingTheme, specificityUsage, text]);

  const mergeQuestionTranscript = useCallback((transcript: string) => {
    const cleaned = transcript.replace(/\s+/g, ' ').trim();
    const base = questionBaseRef.current;
    setQuestionText(base && cleaned ? `${base} ${cleaned}` : cleaned || base);
  }, []);

  const handleQuestionRecordStart = useCallback(async () => {
    if (isRecordingQuestion || !text) return;
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
        if (message) {
          setInfoModal({ visible: true, title: APP_NAME, message });
        }
      });
    } catch (err: any) {
      setIsRecordingQuestion(false);
      setInfoModal({
        visible: true,
        title: APP_NAME,
        message: err?.message || 'Sesli yazma başlatılamadı.',
      });
    }
  }, [isRecordingQuestion, mergeQuestionTranscript, questionText, speechMode, text]);

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
      <BrandedScrollView
        ref={pageScrollRef}
        showScrollToTop
        contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
        onContentSizeChange={() => {
          if (isSendingQuestion) {
            pageScrollRef.current?.scrollToEnd({ animated: true });
          }
        }}
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
          <Text style={[styles.sessionHeaderText, styles.modeHeaderText]}>{modeHeaderLabel}</Text>
          <Text style={styles.sessionHeaderText}>{assistantLabel}</Text>
        </View>
        <View style={styles.panel}>
          <View style={styles.modeRow}>
            {availableModes.map((item) => {
              const selected = mode === item;
              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.modeButton, selected && styles.modeButtonSelected, isBusy && styles.disabledAction]}
                  onPress={() => void handleSelectMode(item)}
                  disabled={isBusy}
                >
                  <Text style={[styles.modeButtonText, selected && styles.modeButtonTextSelected]}>{MODE_LABELS[item]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.refreshButton, !canPrepareReading && styles.refreshButtonDisabled]}
            onPress={() => void loadReading()}
            disabled={!canPrepareReading}
          >
            <Text style={styles.refreshButtonText}>{actionLabel}</Text>
          </TouchableOpacity>
        </View>

        {core && mode === 'core' ? (
          <View style={styles.grid}>
            {CORE_LABELS.map(([key, label]) => (
              <View key={key} style={styles.numberTile}>
                <Text style={styles.numberLabel}>{label}</Text>
                <Text style={styles.numberValue}>{core[key]}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Yorum</Text>
          <BrandedScrollView
            containerStyle={styles.readingScrollFrame}
            style={styles.readingScroll}
            contentContainerStyle={styles.readingScrollContent}
            nestedScrollEnabled
            indicatorMode="box"
          >
            {isLoading ? (
              <AssistantLoading label="Yorum hazırlanıyor" detail="Lütfen bekleyiniz. Ekranı kapatmayınız." />
            ) : text ? (
              <SelectableFormattedText text={text} style={styles.readingText} />
            ) : (
              <Text style={styles.loading}>
                {initialMode === 'core'
                  ? 'Temel sayı haritasını hazırlayabilir veya kayıtlı yorumun geldiyse üzerinden soru sorabilirsin.'
                  : 'Günlük, haftalık veya aylık numeroloji seçip yorumu hazırlayabilirsin.'}
              </Text>
            )}
          </BrandedScrollView>
          {text ? (
            <View style={styles.quickActions}>
              <TouchableOpacity style={styles.secondaryAction} onPress={handlePhoneRead}>
                <Text style={styles.secondaryActionText}>{speechMode === 'playing' ? 'Duraklat' : 'Telefon Okusun'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.secondaryAction, styles.disabledAction]} disabled>
                <Text style={styles.secondaryActionText}>{assistantLabel} Okusun</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {text ? (
          <View style={styles.panel}>
            {followUps.map((message) => (
              <View
                key={message.id}
                style={[styles.chatBubble, message.role === 'user' ? styles.userBubble : styles.assistantBubble]}
              >
                <Text style={styles.chatRole}>{message.role === 'user' ? 'Sen' : assistantLabel}</Text>
                <SelectableFormattedText text={message.text} style={styles.chatText} />
              </View>
            ))}
            {isSendingQuestion ? <AssistantLoading compact /> : null}
            <TouchableOpacity style={styles.questionInput} activeOpacity={0.88} onPress={() => setEditorVisible(true)}>
              <Text style={[styles.composePreviewText, !questionText.trim() && styles.composePreviewPlaceholder]}>
                {questionText.trim() || 'Bu yorumla ilgili ne sormak istersin?'}
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
                    placeholder="Sorunu buradan düzenleyebilirsin..."
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
                      style={[styles.editorSendBtn, (!questionText.trim() || isSendingQuestion) && styles.disabledAction]}
                      onPress={() => void handleSendQuestion()}
                      disabled={!questionText.trim() || isSendingQuestion}
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
              >
                <Text style={styles.holdTalkActionText}>{isRecordingQuestion ? 'Bırakınca Yaz' : 'Basılı Tut Konuş'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryAction, (!questionText.trim() || isSendingQuestion) && styles.disabledAction]}
                onPress={() => void handleSendQuestion()}
                disabled={!questionText.trim() || isSendingQuestion}
              >
                <Text style={styles.primaryActionText}>{isSendingQuestion ? 'Soruluyor...' : 'Sor'}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.endButton, isSendingQuestion && styles.disabledAction]}
              onPress={() => void persistReadingAndEnd()}
              disabled={isSendingQuestion}
            >
              <Text style={styles.endButtonText}>Okumayı Bitir</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </BrandedScrollView>

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
  content: { padding: 18, paddingBottom: 30 },
  tokenAckRow: { marginBottom: 12 },
  sessionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  sessionHeaderText: {
    color: '#E8C49A',
    fontSize: 13,
    fontWeight: '800',
  },
  modeHeaderText: {
    fontStyle: 'italic',
  },
  panel: {
    marginBottom: 14,
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(30, 30, 40, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.18)',
  },
  title: { color: '#E8C49A', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  helper: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 10 },
  sectionTitle: { color: '#E8C49A', fontSize: 15, fontWeight: '700', marginBottom: 8 },
  loading: { color: '#FFF5E8', fontSize: 14, lineHeight: 21 },
  readingScrollFrame: { maxHeight: 270, flexGrow: 0 },
  readingScroll: { flexGrow: 0 },
  readingScrollContent: { paddingBottom: 2 },
  readingText: { color: '#FFF5E8', fontSize: 15, lineHeight: 22 },
  chatBubble: {
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  userBubble: {
    borderColor: 'rgba(125,220,154,0.28)',
    backgroundColor: 'rgba(125,220,154,0.08)',
  },
  assistantBubble: {
    borderColor: 'rgba(212,165,116,0.24)',
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  chatRole: { color: '#D4A574', fontSize: 11, fontWeight: '800', marginBottom: 5 },
  chatText: { color: '#FFF5E8', fontSize: 15, lineHeight: 22 },
  questionInput: {
    minHeight: 88,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.28)',
    backgroundColor: 'rgba(0,0,0,0.18)',
    color: '#FFF5E8',
    fontSize: 15,
    lineHeight: 22,
    padding: 12,
    marginTop: 10,
    textAlignVertical: 'top',
  },
  composePreviewText: {
    color: '#FFF5E8',
    fontSize: 15,
    lineHeight: 22,
  },
  composePreviewPlaceholder: {
    color: 'rgba(255,255,255,0.42)',
  },
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
  editorTitle: {
    color: '#E8C49A',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
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
  editorActions: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 10,
  },
  editorGhostBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.5)',
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: 'rgba(212,165,116,0.12)',
  },
  editorGhostText: {
    color: '#E8C49A',
    fontSize: 12,
    fontWeight: '700',
  },
  editorSendBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: '#D4A574',
  },
  editorSendText: {
    color: '#14141E',
    fontSize: 12,
    fontWeight: '800',
  },
  quickActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  primaryAction: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#D4A574',
    paddingVertical: 11,
    alignItems: 'center',
  },
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
  holdTalkAction: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    paddingVertical: 11,
    alignItems: 'center',
  },
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
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  modeButton: {
    flexGrow: 1,
    flexBasis: '46%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.3)',
    backgroundColor: 'rgba(0,0,0,0.15)',
    paddingVertical: 10,
    alignItems: 'center',
  },
  modeButtonSelected: {
    borderColor: '#D4A574',
    backgroundColor: 'rgba(212,165,116,0.16)',
  },
  modeButtonText: { color: '#E8C49A', fontSize: 12, fontWeight: '700' },
  modeButtonTextSelected: { color: '#FFF5E8' },
  refreshButton: {
    borderRadius: 12,
    backgroundColor: '#D4A574',
    paddingVertical: 11,
    alignItems: 'center',
  },
  refreshButtonDisabled: {
    opacity: 0.64,
  },
  refreshButtonText: { color: '#14141E', fontSize: 13, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 4 },
  numberTile: {
    width: '31.5%',
    minHeight: 82,
    marginBottom: 10,
    borderRadius: 14,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberLabel: { color: 'rgba(255,255,255,0.72)', fontSize: 11, textAlign: 'center', marginBottom: 6 },
  numberValue: { color: '#E8C49A', fontSize: 22, fontWeight: '800' },
});
