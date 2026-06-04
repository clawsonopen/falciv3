import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { APP_NAME } from '../config/constants';
import { BrandedConfirmModal } from '../components/BrandedConfirmModal';
import { AssistantLoading } from '../components/AssistantLoading';
import { TokenUsage } from '../components/TokenUsage';
import { SelectableFormattedText } from '../components/SelectableFormattedText';
import { BrandedScrollView } from '../components/BrandedScrollView';
import {
  createBirthChartFollowUp,
  createBirthChartInterpretation,
  createBirthChartSnapshot,
  formatTimezoneForDisplay,
  hasRequiredAstroBirthInputs,
} from '../services/astroEngine';
import {
  birthChartProfileFingerprint,
  createBirthChartInterpretationSession,
  loadBirthChartInterpretationSession,
  saveBirthChartInterpretationSession,
  type BirthChartFollowUpMessage,
  type BirthChartInterpretationSession,
} from '../services/birthChartInterpretationStore';
import { appendUserConversationMemory, loadAccountState, loadProfileMemorySnippet } from '../services/profileMemoryService';
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

type Props = NativeStackScreenProps<RootStackParamList, 'BirthChartInterpretation'>;
const GEMINI_FLASH_LITE_INPUT_TOKEN_LIMIT = 1048576;
const GEMINI_FLASH_LITE_OUTPUT_TOKEN_LIMIT = 65536;
const BIRTH_CHART_CONTEXT_LOCK_RATIO = 0.92;
const BIRTH_CHART_CONTEXT_LOCK_TOKENS = Math.floor(GEMINI_FLASH_LITE_INPUT_TOKEN_LIMIT * BIRTH_CHART_CONTEXT_LOCK_RATIO);

function estimateTokens(text: string) {
  return Math.ceil(text.replace(/\s+/g, ' ').trim().length / 3);
}

function estimateBirthChartContextTokens(session: BirthChartInterpretationSession | null, draftQuestion = '') {
  if (!session) return 0;
  const chartText = JSON.stringify({
    sign: session.chart.sign,
    moonSign: session.chart.moonSign,
    ascendant: session.chart.ascendant,
    planets: session.chart.planets,
    points: session.chart.points,
    aspects: session.chart.aspects,
    precisionNote: session.chart.precisionNote,
  });
  const followUpText = session.followUps.map((message) => `${message.role}: ${message.text}`).join('\n');
  return estimateTokens([chartText, session.interpretationText, followUpText, draftQuestion].filter(Boolean).join('\n\n'));
}

function makeMessage(role: 'user' | 'assistant', text: string): BirthChartFollowUpMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role,
    text,
    timestamp: Date.now(),
  };
}

export function BirthChartInterpretationScreen({ route, navigation }: Props) {
  const { profileId } = route.params;
  const [session, setSession] = useState<BirthChartInterpretationSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingQuestion, setIsSendingQuestion] = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [tokenUsage, setTokenUsage] = useState<TokenUsageData>({ inputTokens: 0, outputTokens: 0, textInputTokens: 0, imageInputTokens: 0 });
  const [isRecordingQuestion, setIsRecordingQuestion] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const [speechMode, setSpeechMode] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [infoModal, setInfoModal] = useState<{ visible: boolean; title: string; message: string }>({
    visible: false,
    title: APP_NAME,
    message: '',
  });
  const speechRunRef = useRef(0);
  const questionBaseRef = useRef('');
  const readingScrollRef = useRef<ScrollView>(null);
  const contextWarningShownRef = useRef(false);

  const assistantLabel = 'Selin';
  const contextTokens = useMemo(() => estimateBirthChartContextTokens(session, questionText), [questionText, session]);
  const contextRatio = Math.min(1, contextTokens / GEMINI_FLASH_LITE_INPUT_TOKEN_LIMIT);
  const contextPercent = contextTokens > 0 ? Math.max(1, Math.round(contextRatio * 100)) : 0;
  const outputRatio = Math.min(1, tokenUsage.outputTokens / GEMINI_FLASH_LITE_OUTPUT_TOKEN_LIMIT);
  const outputPercent = tokenUsage.outputTokens > 0 ? Math.max(1, Math.round(outputRatio * 100)) : 0;
  const isContextLocked = contextTokens >= BIRTH_CHART_CONTEXT_LOCK_TOKENS;

  const openProfileSettings = useCallback(() => {
    navigation.navigate('ProfileSettings', { profileId });
  }, [navigation, profileId]);

  const loadOrCreateSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const account = await loadAccountState();
      const profile = account.profiles.find((item) => item.profileId === profileId) || null;
      if (!profile) {
        setInfoModal({ visible: true, title: APP_NAME, message: 'Profil bulunamadı.' });
        return;
      }
      if (!hasRequiredAstroBirthInputs(profile)) {
        setInfoModal({
          visible: true,
          title: 'Profil Bilgisi Gerekli',
          message:
            'Doğum haritası yorumu için doğum tarihi, ülke ve şehir bilgilerini tamamlamalısın. Doğum saati yoksa yükselen ve evler net okunamaz.',
        });
        return;
      }

      const fingerprint = birthChartProfileFingerprint(profile);
      const existing = await loadBirthChartInterpretationSession(profileId, fingerprint);
      if (existing) {
        setSession(existing);
        return;
      }

      const chart = await createBirthChartSnapshot(profile);
      const memorySnippet = await loadProfileMemorySnippet(account, profileId, {
        semanticQuery: `${profile.displayName} doğum haritası kişisel astroloji`,
      }).catch(() => null);
      const reading = await createBirthChartInterpretation({ profile, chart, memorySnippet });
      if (reading.usage) {
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
          readingName: 'Doğum Haritası Yorumu',
          textInputTokens: inputTokens,
          outputTokens,
        }).catch(() => {});
      }
      const created = await createBirthChartInterpretationSession({
        profile,
        chart,
        interpretationText: reading.text,
      });
      setSession(created);
    } catch (err: any) {
      setInfoModal({
        visible: true,
        title: APP_NAME,
        message: err?.message || 'Doğum haritası yorumu üretilemedi.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    void loadOrCreateSession();
  }, [loadOrCreateSession]);

  useEffect(() => {
    return () => {
      stopAssistantSpeech();
      void stopNativeRecording();
    };
  }, []);

  useEffect(() => {
    if (!isSendingQuestion) return;
    const t1 = setTimeout(() => readingScrollRef.current?.scrollToEnd({ animated: true }), 0);
    const t2 = setTimeout(() => readingScrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isSendingQuestion, session?.followUps.length]);

  useEffect(() => {
    if (!session?.followUps.length) return;
    const t1 = setTimeout(() => readingScrollRef.current?.scrollToEnd({ animated: true }), 0);
    const t2 = setTimeout(() => readingScrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [session?.followUps.length]);

  useEffect(() => {
    if (!session || !isContextLocked || contextWarningShownRef.current) return;
    contextWarningShownRef.current = true;
    setInfoModal({
      visible: true,
      title: 'Bağlam Penceresi Doldu',
      message:
        'Bu doğum haritası yorumunda konuşma bağlamı modelin input penceresine yaklaştı. Haritan ve mevcut yorumun saklı kalacak; bu ekranda artık yeni soru eklenemez.',
    });
  }, [isContextLocked, session]);

  const latestReadableText = useMemo(() => {
    const lastAssistant = [...(session?.followUps || [])].reverse().find((message) => message.role === 'assistant');
    return lastAssistant?.text || session?.interpretationText || '';
  }, [session]);

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
    const question = questionText.replace(/\s+/g, ' ').trim();
    if (!question || !session || isSendingQuestion) return;
    if (estimateBirthChartContextTokens(session, question) >= BIRTH_CHART_CONTEXT_LOCK_TOKENS) {
      setInfoModal({
        visible: true,
        title: 'Bağlam Penceresi Doldu',
        message:
          'Bu doğum haritası yorumunda konuşma bağlamı modelin input penceresine yaklaştı. Haritan ve mevcut yorumun saklı kalacak; bu ekranda artık yeni soru eklenemez.',
      });
      return;
    }
    const userMessage = makeMessage('user', question);
    const previousFollowUps = session.followUps.map(({ role, text }) => ({ role, text }));
    const optimistic: BirthChartInterpretationSession = {
      ...session,
      followUps: [...session.followUps, userMessage],
    };
    setSession(optimistic);
    setQuestionText('');
    setEditorVisible(false);
    setIsSendingQuestion(true);
    try {
      await appendUserConversationMemory(profileId, question).catch(() => {});
      const account = await loadAccountState();
      const memorySnippet = await loadProfileMemorySnippet(account, profileId, { semanticQuery: question }).catch(() => null);
      const answer = await createBirthChartFollowUp({
        profileName: session.profileName,
        chart: session.chart,
        interpretationText: session.interpretationText,
        question,
        previousFollowUps,
        memorySnippet,
      });
      const assistantMessage = makeMessage('assistant', answer.text);
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
        readingName: 'Doğum Haritası Yorumu',
        textInputTokens: inputTokens,
        outputTokens,
      }).catch(() => {});
      const updated = await saveBirthChartInterpretationSession({
        ...session,
        followUps: [...session.followUps, userMessage, assistantMessage],
      });
      setSession(updated);
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
  }, [isSendingQuestion, questionText, session]);

  const mergeQuestionTranscript = useCallback((transcript: string) => {
    const cleaned = transcript.replace(/\s+/g, ' ').trim();
    const base = questionBaseRef.current;
    setQuestionText(base && cleaned ? `${base} ${cleaned}` : cleaned || base);
  }, []);

  const handleQuestionRecordStart = useCallback(async () => {
    if (isRecordingQuestion || !session) return;
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
  }, [isRecordingQuestion, mergeQuestionTranscript, questionText, session, speechMode]);

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
            <Text style={styles.sessionHeaderText}>{session?.profileName || 'Profil'}</Text>
            <Text style={styles.sessionHeaderText}>{assistantLabel}</Text>
          </View>
          {session ? (
          <View style={[styles.panel, styles.metaPanel]}>
            <View style={styles.metaRow}>
              <Text style={[styles.meta, styles.metaText]}>
                  Güneş: {session.chart.sign} | Ay: {session.chart.moonSign || 'Hesaplanamadı'} | Yükselen:{' '}
                  {session.chart.ascendant || 'Doğum saati gerekli'} | Zaman dilimi: {formatTimezoneForDisplay(session.chart.timezoneUsed)}
                </Text>
              <View style={styles.contextMeters}>
                <View style={styles.contextWrap}>
                <View style={styles.contextCircle}>
                  <View
                    style={[
                      styles.contextFill,
                      {
                        height: `${contextPercent}%`,
                        backgroundColor: contextRatio >= 0.9 ? 'rgba(255,107,107,0.62)' : 'rgba(212,165,116,0.62)',
                      },
                    ]}
                  />
                  <Text style={styles.contextPercent}>{contextPercent}%</Text>
                </View>
                <Text style={styles.contextLabel}>Giriş</Text>
                </View>
                <View style={styles.contextWrap}>
                  <View style={styles.contextCircle}>
                    <View
                      style={[
                        styles.contextFill,
                        {
                          height: `${outputPercent}%`,
                          backgroundColor: outputRatio >= 0.9 ? 'rgba(255,107,107,0.62)' : 'rgba(125,220,154,0.54)',
                        },
                      ]}
                    />
                    <Text style={styles.contextPercent}>{outputPercent}%</Text>
                  </View>
                  <Text style={styles.contextLabel}>Çıkış</Text>
                </View>
              </View>
            </View>
            {isContextLocked ? (
              <Text style={styles.contextLockedText}>
                Bağlam penceresi dolduğu için bu doğum haritasına yeni soru eklenemez.
              </Text>
            ) : null}
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
                if (isSendingQuestion) {
                  readingScrollRef.current?.scrollToEnd({ animated: true });
                }
              }}
            >
              {isLoading ? (
                <AssistantLoading
                  label="Doğum haritası yorumun hazırlanıyor"
                  detail="Lütfen bekleyiniz. Ekranı kapatmayınız."
                />
              ) : session?.interpretationText ? (
                <View style={[styles.chatBubble, styles.assistantBubble]}>
                  <Text style={styles.chatRole}>{assistantLabel}</Text>
                  <SelectableFormattedText text={session.interpretationText} style={styles.chatText} />
                </View>
              ) : (
                <Text style={styles.loading}>Yorum hazırlanamadı. Profil bilgilerini kontrol edip tekrar deneyebilirsin.</Text>
              )}
              {session?.followUps.length ? (
                <>
                  {session.followUps.map((message) => (
                    <View
                      key={message.id}
                      style={[styles.chatBubble, message.role === 'user' ? styles.userBubble : styles.assistantBubble]}
                    >
                      <Text style={styles.chatRole}>{message.role === 'user' ? 'Sen' : assistantLabel}</Text>
                      <SelectableFormattedText text={message.text} style={styles.chatText} />
                    </View>
                  ))}
                  {isSendingQuestion ? <AssistantLoading compact /> : null}
                </>
              ) : null}
              {session && !session.followUps.length && isSendingQuestion ? <AssistantLoading compact /> : null}
            </BrandedScrollView>
          </View>

          {session ? (
            <View style={styles.readActionsBar}>
              <TouchableOpacity style={styles.secondaryAction} onPress={handlePhoneRead}>
                <Text style={styles.secondaryActionText}>{speechMode === 'playing' ? 'Duraklat' : 'Telefon Okusun'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.secondaryAction, styles.disabledAction]} disabled>
                <Text style={styles.secondaryActionText}>{assistantLabel} Okusun</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {session ? (
            <View style={[styles.panel, styles.questionPanel]}>
              <TouchableOpacity style={styles.questionInput} activeOpacity={0.88} onPress={() => setEditorVisible(true)}>
                <Text style={[styles.composePreviewText, !questionText.trim() && styles.composePreviewPlaceholder]}>
                  {questionText.trim() || 'Bu doğum haritası yorumuyla ilgili ne sormak istersin?'}
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
                        style={[styles.editorSendBtn, (!questionText.trim() || isSendingQuestion || isContextLocked) && styles.disabledAction]}
                        onPress={() => void handleSendQuestion()}
                        disabled={!questionText.trim() || isSendingQuestion || isContextLocked}
                      >
                        <Text style={styles.editorSendText}>{isSendingQuestion ? 'Soruluyor...' : isContextLocked ? 'Bağlam Doldu' : 'Sor'}</Text>
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
                  style={[styles.primaryAction, (!questionText.trim() || isSendingQuestion || isContextLocked) && styles.disabledAction]}
                  onPress={() => void handleSendQuestion()}
                  disabled={!questionText.trim() || isSendingQuestion || isContextLocked}
                >
                  <Text style={styles.primaryActionText}>{isSendingQuestion ? 'Soruluyor...' : isContextLocked ? 'Bağlam Doldu' : 'Sor'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>

        <BrandedConfirmModal
          visible={infoModal.visible}
          title={infoModal.title}
          message={infoModal.message}
          confirmLabel="Tamam"
          cancelLabel="Kapat"
          onConfirm={() => setInfoModal({ visible: false, title: APP_NAME, message: '' })}
          onCancel={() => setInfoModal({ visible: false, title: APP_NAME, message: '' })}
          extraActionLabel={infoModal.title === 'Profil Bilgisi Gerekli' ? 'Profil Ayarlarına Git' : null}
          onExtraAction={infoModal.title === 'Profil Bilgisi Gerekli' ? openProfileSettings : undefined}
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
  panel: {
    marginBottom: 14,
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(30, 30, 40, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.18)',
  },
  metaPanel: { paddingVertical: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  metaText: { flex: 1 },
  contextMeters: { flexDirection: 'row', gap: 8 },
  contextWrap: { width: 42, alignItems: 'center' },
  contextCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.55)',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  contextFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  contextPercent: { color: '#FFF5E8', fontSize: 10, fontWeight: '800' },
  contextLabel: { marginTop: 4, color: 'rgba(255,255,255,0.58)', fontSize: 10, fontWeight: '700' },
  contextLockedText: { marginTop: 8, color: '#FFB3B3', fontSize: 12, lineHeight: 17 },
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
  title: { color: '#E8C49A', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  helper: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 10 },
  sectionTitle: { color: '#E8C49A', fontSize: 15, fontWeight: '700', marginBottom: 8 },
  loading: { color: '#FFF5E8', fontSize: 14, lineHeight: 21 },
  readingText: { color: '#FFF5E8', fontSize: 15, lineHeight: 22 },
  meta: { color: 'rgba(212,165,116,0.84)', fontSize: 12, lineHeight: 18 },
  precisionNote: { marginTop: 8, color: 'rgba(255,255,255,0.58)', fontSize: 12, lineHeight: 18 },
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
  disabledAction: { opacity: 0.55 },
});
