import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { APP_NAME, getAssistantLabel } from '../config/constants';
import {
  DREAM_DESCRIPTION_MAX_CHARS,
  FOLLOW_UP_QUESTION_MAX_CHARS,
  FOLLOW_UP_QUESTION_MIN_CHARS,
  normalizeLimitedInput,
} from '../config/llmTokenPolicy';
import { AssistantLoading } from '../components/AssistantLoading';
import { BrandedConfirmModal } from '../components/BrandedConfirmModal';
import { SelectableFormattedText } from '../components/SelectableFormattedText';
import { BrandedScrollView } from '../components/BrandedScrollView';
import { TokenUsage } from '../components/TokenUsage';
import {
  applyMemoryAnalysisResult,
  appendReadingDerivedTheme,
  appendReadingSummary,
  appendUserConversationMemory,
  loadAccountState,
  loadProfileMemorySnippet,
} from '../services/profileMemoryService';
import { analyzeMemoryTranscript } from '../services/memoryAnalysisService';
import {
  createDreamFollowUp,
  createDreamInterpretation,
  createDreamOpening,
  type DreamChatMessage,
} from '../services/dreamInterpretationService';
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
import {
  DAILY_MEMORY_WRITER_BUSY_MESSAGE,
  shouldBlockForDailyMemoryWriterMaintenance,
} from '../services/dailyMemoryWriterMaintenanceService';

type Props = NativeStackScreenProps<RootStackParamList, 'DreamInterpretation'>;

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

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

function dreamThemeFromText(dreamText: string) {
  return `rüya yorumu: ${dreamText.replace(/\s+/g, ' ').trim().slice(0, 140)}`;
}

export function DreamInterpretationScreen({ route, navigation }: Props) {
  const { profileId, assistantId } = route.params;
  const assistantLabel = useMemo(() => getAssistantLabel(assistantId), [assistantId]);
  const [profileName, setProfileName] = useState('');
  const [isAnimalProfileSelected, setIsAnimalProfileSelected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [dreamText, setDreamText] = useState('');
  const [interpretationText, setInterpretationText] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isRecordingQuestion, setIsRecordingQuestion] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const [speechMode, setSpeechMode] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [usedClosings, setUsedClosings] = useState<string[]>([]);
  const [tokenUsage, setTokenUsage] = useState<TokenUsageData>({ inputTokens: 0, outputTokens: 0, textInputTokens: 0, imageInputTokens: 0 });
  const [infoModal, setInfoModal] = useState<{ visible: boolean; title: string; message: string }>({
    visible: false,
    title: APP_NAME,
    message: '',
  });
  const speechRunRef = useRef(0);
  const questionBaseRef = useRef('');
  const readingScrollRef = useRef<ScrollView>(null);

  const hasInterpretation = Boolean(interpretationText);
  const isBusy = isLoadingProfile || isSending;

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

  useEffect(() => {
    let mounted = true;
    void loadAccountState()
      .then((state) => {
        if (!mounted) return;
        const profile = state.profiles.find((item) => item.profileId === profileId) || null;
        if (!profile) {
          setInfoModal({ visible: true, title: APP_NAME, message: 'Profil bulunamadı.' });
          return;
        }
        setProfileName(profile.displayName);
        const isAnimal = profile.relationshipPrimary === 'evcil_hayvan';
        setIsAnimalProfileSelected(isAnimal);
        const opening = createDreamOpening({ assistantId, profileName: profile.displayName, isAnimalProfile: isAnimal });
        setMessages([makeMessage('assistant', opening)]);
      })
      .catch((err: any) => {
        if (mounted) setInfoModal({ visible: true, title: APP_NAME, message: err?.message || 'Profil yüklenemedi.' });
      })
      .finally(() => {
        if (mounted) setIsLoadingProfile(false);
      });
    return () => {
      mounted = false;
      stopAssistantSpeech();
      void stopNativeRecording();
    };
  }, [assistantId, profileId]);

  useEffect(() => {
    const t1 = setTimeout(() => readingScrollRef.current?.scrollToEnd({ animated: true }), 0);
    const t2 = setTimeout(() => readingScrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [messages.length, isSending]);

  const latestReadableText = useMemo(() => {
    const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant');
    return lastAssistant?.text || '';
  }, [messages]);

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

  const handleSend = useCallback(async () => {
    const text = normalizeLimitedInput(questionText, hasInterpretation ? FOLLOW_UP_QUESTION_MAX_CHARS : DREAM_DESCRIPTION_MAX_CHARS);
    if ((!hasInterpretation && !text) || (hasInterpretation && text.length < FOLLOW_UP_QUESTION_MIN_CHARS) || isSending || isLoadingProfile) return;
    const userMessage = makeMessage('user', text);
    setMessages((current) => [...current, userMessage]);
    setQuestionText('');
    setEditorVisible(false);
    setIsSending(true);
    try {
      if (await shouldBlockForDailyMemoryWriterMaintenance()) {
        setInfoModal({ visible: true, title: 'Hafıza Bakımı', message: DAILY_MEMORY_WRITER_BUSY_MESSAGE });
        return;
      }
      await appendUserConversationMemory(profileId, text).catch(() => {});
      const state = await loadAccountState();
      const profile = state.profiles.find((item) => item.profileId === profileId) || null;
      if (!profile) throw new Error('Profil bulunamadı.');
      const memorySnippet = await loadProfileMemorySnippet(state, profileId, { semanticQuery: text }).catch(() => null);
      if (!hasInterpretation) {
        const result = await createDreamInterpretation({
          profile,
          assistantId,
          assistantLabel,
          dreamText: text,
          memorySnippet,
          usedClosings,
        });
        const assistantMessage = makeMessage('assistant', result.text);
        setDreamText(text);
        setInterpretationText(result.text);
        setMessages((current) => [...current, assistantMessage]);
        if (result.closingSentence) setUsedClosings((current) => [...current, result.closingSentence]);
        await addUsage('Rüya Yorumu', result);
      } else {
        const previousFollowUps: DreamChatMessage[] = messages
          .filter((message) => message.text !== dreamText && message.text !== interpretationText)
          .map(({ role, text }) => ({ role, text }));
        const result = await createDreamFollowUp({
          profileName: profileName || profile.displayName,
          assistantId,
          assistantLabel,
          dreamText,
          interpretationText,
          question: text,
          previousFollowUps,
          memorySnippet,
          usedClosings,
        });
        setMessages((current) => [...current, makeMessage('assistant', result.text)]);
        if (result.closingSentence) setUsedClosings((current) => [...current, result.closingSentence]);
        await addUsage('Rüya Yorumu - Soru', result);
      }
      setSpeechMode('idle');
    } catch (err: any) {
      setInfoModal({ visible: true, title: APP_NAME, message: err?.message || 'Rüya yorumu üretilemedi.' });
    } finally {
      setIsSending(false);
    }
  }, [
    addUsage,
    assistantId,
    assistantLabel,
    dreamText,
    hasInterpretation,
    interpretationText,
    isLoadingProfile,
    isSending,
    messages,
    profileId,
    profileName,
    questionText,
    usedClosings,
  ]);

  const persistReadingAndEnd = useCallback(async () => {
    if (!dreamText || !interpretationText) {
      navigation.goBack();
      return;
    }
    stopAssistantSpeech();
    await stopNativeRecording().catch(() => {});
    const transcript = messages.map((message) => ({ role: message.role, text: message.text, timestamp: Date.now() }));
    await appendReadingSummary({
      profileId,
      assistantId,
      readingType: 'dream-interpretation',
      surfacesRead: [],
      summary: compactSummary(interpretationText),
      transcript,
    }).catch(() => {});
    await appendReadingDerivedTheme(profileId, dreamThemeFromText(dreamText), `dream-${Date.now()}`).catch(() => {});
    void loadAccountState()
      .then((state) => loadProfileMemorySnippet(state, profileId))
      .then((memorySnippet) =>
        analyzeMemoryTranscript({
          profileId,
          profileName: profileName || 'Profil',
          readingType: 'dream-interpretation',
          memorySnippet,
          transcript,
        }),
      )
      .then((result) => applyMemoryAnalysisResult(profileId, result))
      .catch(() => {});
    navigation.goBack();
  }, [assistantId, dreamText, interpretationText, messages, navigation, profileId, profileName]);

  const mergeQuestionTranscript = useCallback((transcript: string) => {
    const cleaned = transcript.replace(/\s+/g, ' ').trim();
    const base = questionBaseRef.current;
    setQuestionText(base && cleaned ? `${base} ${cleaned}` : cleaned || base);
  }, []);

  const handleQuestionRecordStart = useCallback(async () => {
    if (isRecordingQuestion || isSending) return;
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
  }, [isRecordingQuestion, isSending, mergeQuestionTranscript, questionText, speechMode]);

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
        <View style={styles.content}>
          <View style={styles.tokenAckRow}>
            <TokenUsage
              usage={tokenUsage}
              inputPrice={GEMINI_FLASH_LITE_INPUT_PRICE_USD_PER_M}
              outputPrice={GEMINI_FLASH_LITE_OUTPUT_PRICE_USD_PER_M}
            />
          </View>
          <View style={styles.sessionHeaderRow}>
            <Text style={styles.sessionHeaderText}>{profileName || 'Profil'}</Text>
            <Text style={[styles.sessionHeaderText, styles.modeHeaderText]}>{isAnimalProfileSelected ? 'Uyku/Rüya Yorumu' : 'Rüya Yorumu'}</Text>
            <Text style={styles.sessionHeaderText}>{assistantLabel}</Text>
          </View>

          <View style={[styles.panel, styles.readingPanel]}>
            <BrandedScrollView
              ref={readingScrollRef}
              containerStyle={styles.readingScrollFrame}
              style={styles.readingScroll}
              contentContainerStyle={styles.readingScrollContent}
              nestedScrollEnabled
              indicatorMode="box"
              onContentSizeChange={() => readingScrollRef.current?.scrollToEnd({ animated: true })}
            >
              {isLoadingProfile ? (
                <AssistantLoading label={isAnimalProfileSelected ? 'Uyku yorumu açılıyor' : 'Rüya yorumu açılıyor'} detail="Lütfen bekleyiniz." />
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
              {isSending ? <AssistantLoading compact /> : null}
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
            <TouchableOpacity style={styles.questionInput} activeOpacity={0.88} onPress={() => setEditorVisible(true)}>
              <Text style={[styles.composePreviewText, !questionText.trim() && styles.composePreviewPlaceholder]}>
                {questionText.trim() ||
                  (hasInterpretation
                    ? isAnimalProfileSelected
                      ? 'Bu uyku yorumuyla ilgili ne sormak istersin?'
                      : 'Bu rüya yorumuyla ilgili ne sormak istersin?'
                    : isAnimalProfileSelected
                      ? 'Uykusunda, hareketlerinde veya küçük dünyasında ne fark ettin?'
                      : 'Rüyanda ne gördün? Sahneyi, kişileri ve hislerini anlat.')}
              </Text>
            </TouchableOpacity>
            <Modal visible={editorVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setEditorVisible(false)}>
              <KeyboardAvoidingView
                style={styles.editorOverlay}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'android' ? 24 : 0}
              >
                <View style={styles.editorCard}>
                  <Text style={styles.editorTitle}>{hasInterpretation ? 'Sorunu Düzenle' : isAnimalProfileSelected ? 'Uyku Notunu Düzenle' : 'Rüyanı Düzenle'}</Text>
                  <TextInput
                    style={styles.editorInput}
                    value={questionText}
                    onChangeText={setQuestionText}
                    maxLength={hasInterpretation ? FOLLOW_UP_QUESTION_MAX_CHARS : DREAM_DESCRIPTION_MAX_CHARS}
                    placeholder={
                      hasInterpretation
                        ? 'Sorunu buradan düzenleyebilirsin...'
                        : isAnimalProfileSelected
                          ? 'Uykusunu, minik hareketlerini, seslerini veya aklına gelen sahneyi anlatabilirsin...'
                          : 'Rüyanı buradan detaylıca anlatabilirsin...'
                    }
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
                      style={[styles.editorSendBtn, (!questionText.trim() || isSending || isLoadingProfile) && styles.disabledAction]}
                      onPress={() => void handleSend()}
                      disabled={!questionText.trim() || isSending || isLoadingProfile}
                    >
                      <Text style={styles.editorSendText}>{isSending ? 'Yorumlanıyor...' : hasInterpretation ? 'Sor' : 'Yorumla'}</Text>
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
                disabled={isSending || isLoadingProfile}
              >
                <Text style={styles.holdTalkActionText}>{isRecordingQuestion ? 'Bırakınca Yaz' : 'Basılı Tut Konuş'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryAction, (!questionText.trim() || isSending || isLoadingProfile) && styles.disabledAction]}
                onPress={() => void handleSend()}
                disabled={!questionText.trim() || isSending || isLoadingProfile}
              >
                <Text style={styles.primaryActionText}>{isSending ? 'Yorumlanıyor...' : hasInterpretation ? 'Sor' : 'Yorumla'}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.endButton, (isSending || !hasInterpretation) && styles.disabledAction]}
              onPress={() => void persistReadingAndEnd()}
              disabled={isSending || !hasInterpretation}
            >
              <Text style={styles.endButtonText}>Yorumu Bitir</Text>
            </TouchableOpacity>
          </View>
        </View>

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
  content: { flex: 1, padding: 18, paddingBottom: 12 },
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
  modeHeaderText: { fontStyle: 'italic' },
  panel: {
    marginBottom: 14,
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(30, 30, 40, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.18)',
  },
  readingPanel: { flex: 1, minHeight: 0 },
  readingScrollFrame: { flex: 1 },
  readingScroll: { flex: 1 },
  readingScrollContent: { paddingBottom: 8 },
  questionPanel: { marginBottom: 0 },
  readActionsBar: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
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
    padding: 12,
    marginTop: 10,
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
});
