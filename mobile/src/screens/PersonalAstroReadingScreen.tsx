import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { getAssistantLabel } from '../config/constants';
import { BrandedConfirmModal } from '../components/BrandedConfirmModal';
import { appendReadingDerivedTheme, appendReadingSummary, appendUserConversationMemory, loadAccountState, loadProfileMemorySnippet } from '../services/profileMemoryService';
import { getRetryLaterMessage, isRetryableLlmError } from '../services/llmRetryMessages';
import {
  createPersonalAstroReading,
  createPersonalAstroFollowUp,
  formatTimezoneForDisplay,
  hasRequiredAstroBirthInputs,
  type AstroPeriod,
} from '../services/astroEngine';
import { APP_NAME } from '../config/constants';
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

type Props = NativeStackScreenProps<RootStackParamList, 'PersonalAstroReading'>;

const PERIOD_LABELS: Record<AstroPeriod, string> = {
  daily: 'Günlük',
  weekly: 'Haftalık',
  monthly: 'Aylık',
  yearly: 'Yıllık',
};

type FollowUpMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

function compactSummary(text: string) {
  return text.replace(/\s+/g, ' ').trim().slice(0, 420);
}

function themeFromReading(period: AstroPeriod, sign: string, risingSign?: string | null) {
  const periodLabel = PERIOD_LABELS[period].toLocaleLowerCase('tr-TR');
  return `${periodLabel} kişisel astro: ${sign}${risingSign ? `, yükselen ${risingSign}` : ''}`;
}

export function PersonalAstroReadingScreen({ route }: Props) {
  const { profileId, assistantId } = route.params;
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<AstroPeriod | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [text, setText] = useState('');
  const [meta, setMeta] = useState<{ sign: string; risingSign?: string | null; timezone: string; precisionNote?: string } | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [followUps, setFollowUps] = useState<FollowUpMessage[]>([]);
  const [isSendingQuestion, setIsSendingQuestion] = useState(false);
  const [isRecordingQuestion, setIsRecordingQuestion] = useState(false);
  const [speechMode, setSpeechMode] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [infoModal, setInfoModal] = useState<{ visible: boolean; title: string; message: string }>({
    visible: false,
    title: APP_NAME,
    message: '',
  });
  const speechRunRef = useRef(0);
  const questionBaseRef = useRef('');

  const assistantLabel = useMemo(() => getAssistantLabel(assistantId), [assistantId]);

  const loadReading = useCallback(async () => {
    if (!period) {
      setText('');
      setMeta(null);
      return;
    }
    setIsLoading(true);
    try {
      const state = await loadAccountState();
      const profile = state.profiles.find((item) => item.profileId === profileId) || null;
      if (!profile) {
        setInfoModal({
          visible: true,
          title: APP_NAME,
          message: 'Profil bulunamadı.',
        });
        setText('');
        return;
      }
      setProfileName(profile.displayName);

      if (!hasRequiredAstroBirthInputs(profile)) {
        setInfoModal({
          visible: true,
          title: 'Profil Bilgisi Gerekli',
          message:
            'Kişiye özel astro için doğum tarihi + doğum ülkesi + doğum şehri gerekli. Lütfen profil bilgilerini tamamla.',
        });
        setText('');
        return;
      }

      const reading = await createPersonalAstroReading({
        period,
        profile,
        assistantId,
        assistantLabel,
      });
      setText(reading.text);
      setFollowUps([]);
      setMeta({
        sign: reading.sign,
        risingSign: reading.risingSign,
        timezone: reading.timezoneUsed,
        precisionNote: reading.precisionNote,
      });
      if (!reading.cached) {
        const theme = themeFromReading(period, reading.sign, reading.risingSign);
        await appendReadingSummary({
          profileId,
          assistantId,
          readingType: 'personal-astro',
          period,
          surfacesRead: [],
          summary: compactSummary(reading.text),
          transcript: [{ role: 'assistant', text: reading.text, timestamp: Date.now() }],
        });
        await appendReadingDerivedTheme(profileId, theme, `personal-astro-${period}-${reading.periodKey}`);
      }
    } catch (err: any) {
      const retryLater = isRetryableLlmError(err);
      const retryMessage = retryLater ? getRetryLaterMessage('personal-astro', `${profileId}-${period}`) : null;
      setInfoModal({
        visible: true,
        title: retryMessage?.title || APP_NAME,
        message: retryMessage?.message || err?.message || 'Kişiye özel astro yorumu üretilemedi.',
      });
      setText('');
    } finally {
      setIsLoading(false);
    }
  }, [assistantId, assistantLabel, period, profileId]);

  useEffect(() => {
    setText('');
    setMeta(null);
    setFollowUps([]);
    setQuestionText('');
  }, [period]);

  useEffect(() => {
    return () => {
      stopAssistantSpeech();
      void stopNativeRecording();
    };
  }, []);

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
    const question = questionText.replace(/\s+/g, ' ').trim();
    if (!question || !text || !period || isSendingQuestion) return;
    const userMessage: FollowUpMessage = { id: `u-${Date.now()}`, role: 'user', text: question };
    setFollowUps((current) => [...current, userMessage]);
    setQuestionText('');
    setIsSendingQuestion(true);
    try {
      await appendUserConversationMemory(profileId, question).catch(() => {});
      const semanticMemorySnippet = await loadAccountState()
        .then((state) => loadProfileMemorySnippet(state, profileId, { semanticQuery: question }))
        .catch(() => null);
      const answer = await createPersonalAstroFollowUp({
        profileName: profileName || 'Profil',
        assistantId,
        assistantLabel,
        period,
        readingText: text,
        question,
        memorySnippet: semanticMemorySnippet,
      });
      setFollowUps((current) => [...current, { id: `a-${Date.now()}`, role: 'assistant', text: answer }]);
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
  }, [assistantId, assistantLabel, isSendingQuestion, period, profileName, questionText, text]);

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
    if (!isRecordingQuestion) return;
    await stopNativeRecording();
    mergeQuestionTranscript(getLatestNativeTranscript());
    resetNativeTranscript();
    setIsRecordingQuestion(false);
  }, [isRecordingQuestion, mergeQuestionTranscript]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'android' ? 24 : 0}
    >
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}>
        <View style={styles.panel}>
          <Text style={styles.title}>Kişiye Özel Astroloji</Text>
          <Text style={styles.helper}>Falcı: {assistantLabel}</Text>
          <View style={styles.periodRow}>
            {(['daily', 'weekly', 'monthly', 'yearly'] as AstroPeriod[]).map((item) => {
              const selected = period === item;
              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.periodButton, selected && styles.periodButtonSelected]}
                  onPress={() => setPeriod(item)}
                >
                  <Text style={[styles.periodButtonText, selected && styles.periodButtonTextSelected]}>
                    {PERIOD_LABELS[item]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity style={styles.refreshButton} onPress={() => void loadReading()}>
            <Text style={styles.refreshButtonText}>{period ? 'Yorumu Hazırla' : 'Önce Dönem Seç'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Yorum</Text>
          {isLoading ? (
            <Text style={styles.loading}>Hazırlanıyor...</Text>
          ) : text ? (
            <Text style={styles.readingText}>{text}</Text>
          ) : (
            <Text style={styles.loading}>Günlük, haftalık, aylık veya yıllık dönem seçip yorumu hazırlayabilirsin.</Text>
          )}
          {meta ? (
            <Text style={styles.meta}>
              Güneş: {meta.sign} | Yükselen: {meta.risingSign || 'Doğum saati gerekli'} | Zaman dilimi: {formatTimezoneForDisplay(meta.timezone)}
            </Text>
          ) : null}
          {meta?.precisionNote ? <Text style={styles.precisionNote}>{meta.precisionNote}</Text> : null}
        </View>

        {text ? (
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Sorunu Sor</Text>
            {followUps.map((message) => (
              <View
                key={message.id}
                style={[styles.chatBubble, message.role === 'user' ? styles.userBubble : styles.assistantBubble]}
              >
                <Text style={styles.chatRole}>{message.role === 'user' ? 'Sen' : assistantLabel}</Text>
                <Text style={styles.chatText}>{message.text}</Text>
              </View>
            ))}
            <View style={styles.quickActions}>
              <TouchableOpacity style={styles.secondaryAction} onPress={handlePhoneRead}>
                <Text style={styles.secondaryActionText}>{speechMode === 'playing' ? 'Duraklat' : 'Telefon Okusun'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.secondaryAction, styles.disabledAction]} disabled>
                <Text style={styles.secondaryActionText}>{assistantLabel} Okusun</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.questionInput}
              value={questionText}
              onChangeText={setQuestionText}
              placeholder="Bu yorumla ilgili ne sormak istersin?"
              placeholderTextColor="rgba(255,255,255,0.42)"
              multiline
            />
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
          </View>
        ) : null}
      </ScrollView>

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
  loading: { color: '#FFF5E8', fontSize: 14 },
  readingText: { color: '#FFF5E8', fontSize: 14, lineHeight: 22 },
  meta: { marginTop: 12, color: 'rgba(212,165,116,0.8)', fontSize: 12 },
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
  chatText: { color: '#FFF5E8', fontSize: 13, lineHeight: 20 },
  questionInput: {
    minHeight: 88,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.28)',
    backgroundColor: 'rgba(0,0,0,0.18)',
    color: '#FFF5E8',
    fontSize: 14,
    lineHeight: 20,
    padding: 12,
    marginTop: 10,
    textAlignVertical: 'top',
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
  periodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  periodButton: {
    flexGrow: 1,
    flexBasis: '22%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.3)',
    backgroundColor: 'rgba(0,0,0,0.15)',
    paddingVertical: 10,
    alignItems: 'center',
  },
  periodButtonSelected: {
    borderColor: '#D4A574',
    backgroundColor: 'rgba(212,165,116,0.16)',
  },
  periodButtonText: { color: '#E8C49A', fontSize: 12, fontWeight: '700' },
  periodButtonTextSelected: { color: '#FFF5E8' },
  refreshButton: {
    borderRadius: 12,
    backgroundColor: '#D4A574',
    paddingVertical: 11,
    alignItems: 'center',
  },
  refreshButtonText: { color: '#14141E', fontSize: 13, fontWeight: '800' },
});
