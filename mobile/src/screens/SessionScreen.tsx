import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useSession } from '../hooks/useSession';
import { TokenUsage } from '../components/TokenUsage';
import { ImageUploader } from '../components/ImageUploader';
import { BrandedConfirmModal } from '../components/BrandedConfirmModal';
import { BrandedScrollView } from '../components/BrandedScrollView';
import { AssistantLoading } from '../components/AssistantLoading';
import { SelectableFormattedText } from '../components/SelectableFormattedText';
import {
  getLatestNativeTranscript,
  resetNativeTranscript,
  startNativeRecording,
  stopNativeRecording,
} from '../services/nativeSttService';
import { APP_NAME } from '../config/constants';
import { FOLLOW_UP_QUESTION_MAX_CHARS, FOLLOW_UP_QUESTION_MIN_CHARS, normalizeLimitedInput } from '../config/llmTokenPolicy';
import {
  getAssistantSpeechProgress,
  isAssistantSpeaking,
  prepareAssistantSpeech,
  startOrResumeAssistantSpeech,
  stopAssistantSpeech,
} from '../services/ttsService';
import { getAssistantLabel } from '../config/constants';
import { analyzeMemoryTranscript } from '../services/memoryAnalysisService';
import { applyMemoryAnalysisResult, appendReadingSummary } from '../services/profileMemoryService';
import { getRetryLaterMessage, isRetryableLlmError } from '../services/llmRetryMessages';
import {
  failMemoryAnalysisEstimate,
  settleMemoryAnalysisUsage,
  startMemoryAnalysisEstimate,
} from '../services/tokenLedgerService';

type Props = NativeStackScreenProps<RootStackParamList, 'Session'>;
const MAX_HOLD_TO_TALK_SECONDS = 30;

const PHOTO_RETRY_MESSAGE =
  'Bu fotoğraf bu okuma türü için uygun görünmüyor canım. Kahve yorumu için telveyi gösteren fincan veya tabak, el okuması için avuç içi fotoğrafı yükleyelim.';

function visibleStartupError(raw?: string | null) {
  const text = (raw || '').trim();
  if (!text) return PHOTO_RETRY_MESSAGE;
  return /Gemini|HTTP|JSON|RuntimeError|Traceback|candidate|classifier|generateContent|API|token|exception|returned/i.test(
    text,
  )
    ? PHOTO_RETRY_MESSAGE
    : text;
}

function retryKindForSession(config: Props['route']['params']['config']) {
  return config.readingType === 'palm' ? 'palm' : 'coffee';
}

function mergeDraftWithTranscript(baseText: string, transcriptText: string) {
  const base = baseText.replace(/\s+/g, ' ').trim();
  const transcript = transcriptText.replace(/\s+/g, ' ').trim();
  if (!base) return transcript;
  if (!transcript) return base;
  const baseLower = base.toLocaleLowerCase('tr-TR');
  const transcriptLower = transcript.toLocaleLowerCase('tr-TR');
  if (transcriptLower === baseLower || transcriptLower.startsWith(`${baseLower} `)) {
    return transcript;
  }
  if (baseLower.endsWith(` ${transcriptLower}`)) {
    return base;
  }
  return `${base} ${transcript}`;
}

export function SessionScreen({ route, navigation }: Props) {
  const { config } = route.params;
  const assistantLabel = getAssistantLabel(config.devSettings.assistantId);
  const { state, startSession, endSession, sendUserTranscript, updateSessionImage, setUserSpeakingActive } =
    useSession();

  const sendUserTranscriptRef = useRef(sendUserTranscript);
  const chatScrollRef = useRef<ScrollView>(null);
  const messageYRef = useRef<Record<string, number>>({});
  const draftBaseRef = useRef('');
  const liveSegmentRef = useRef('');
  const holdBudgetAtPressStartRef = useRef(MAX_HOLD_TO_TALK_SECONDS * 1000);
  const recordStartAtRef = useRef(0);
  const isRecordingRef = useRef(false);
  const autoStopLockRef = useRef(false);
  const [draftText, setDraftText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [sttHint, setSttHint] = useState('');
  const [editorVisible, setEditorVisible] = useState(false);
  const [recordElapsedMs, setRecordElapsedMs] = useState(0);
  const [holdRemainingMs, setHoldRemainingMs] = useState(MAX_HOLD_TO_TALK_SECONDS * 1000);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [sessionImageUris, setSessionImageUris] = useState({
    cup: config.cupImageUri,
    cup2: config.secondCupImageUri || null,
    saucer: config.saucerImageUri,
    palm: config.palmImageUri || null,
  });
  const [isReading, setIsReading] = useState(false);
  const [isReadPaused, setIsReadPaused] = useState(false);
  const [readingMessageId, setReadingMessageId] = useState<string | null>(null);
  const [pendingTurnMessageId, setPendingTurnMessageId] = useState<string | null>(null);
  const [holdToTalkUnlocked, setHoldToTalkUnlocked] = useState(false);
  const [pauseWarningVisible, setPauseWarningVisible] = useState(false);
  const [sendErrorModal, setSendErrorModal] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });
  const [infoModal, setInfoModal] = useState<{ visible: boolean; title: string; message: string }>({
    visible: false,
    title: APP_NAME,
    message: '',
  });
  const [messageActionModal, setMessageActionModal] = useState<{ visible: boolean; text: string }>({
    visible: false,
    text: '',
  });
  const [startupError, setStartupError] = useState<{ title: string; message: string; isRetry?: boolean } | null>(null);
  const lastAssistantMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    sendUserTranscriptRef.current = sendUserTranscript;
  }, [sendUserTranscript]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    navigation.setOptions({
      title: APP_NAME,
    });
  }, [navigation]);

  useEffect(() => {
    let isCancelled = false;
    startSession(config)
      .then(() => {
        if (isCancelled) return;
        setSttHint('');
      })
      .catch((err) => {
        if (isCancelled) return;
        const retryMessage = isRetryableLlmError(err) ? getRetryLaterMessage(retryKindForSession(config), config.profileId) : null;
        setStartupError({
          title: retryMessage?.title || 'Fotoğrafı bir daha seçelim',
          message: retryMessage?.message || visibleStartupError(err?.message),
          isRetry: Boolean(retryMessage),
        });
      });

    return () => {
      isCancelled = true;
      stopNativeRecording().catch(() => {});
      resetNativeTranscript();
      stopAssistantSpeech();
      setUserSpeakingActive(false);
      endSession();
    };
  }, [config, endSession, navigation, setUserSpeakingActive, startSession]);

  useEffect(() => {
    if (state.status !== 'ended') return;
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home', params: { freshStartToken: Date.now() } }],
    });
  }, [state.status, navigation]);

  useEffect(() => {
    const assistantMessages = state.messages.filter((m) => m.role === 'assistant');
    const latestAssistant = assistantMessages.length ? assistantMessages[assistantMessages.length - 1] : null;
    if (!latestAssistant) return;
    if (latestAssistant.id === lastAssistantMessageIdRef.current) return;

    lastAssistantMessageIdRef.current = latestAssistant.id;
    stopAssistantSpeech();
    setIsReading(false);
    setIsReadPaused(false);
    setReadingMessageId(latestAssistant.id);
    setPendingTurnMessageId(latestAssistant.id);
    setHoldToTalkUnlocked(false);
    setHoldRemainingMs(MAX_HOLD_TO_TALK_SECONDS * 1000);
    prepareAssistantSpeech(latestAssistant.text);
  }, [state.messages]);

  useEffect(() => {
    if (!state.messages.length) return;
    const lastMessage = state.messages[state.messages.length - 1];
    const scrollToLastMessageTop = () => {
      const y = messageYRef.current[lastMessage.id];
      if (typeof y === 'number') {
        chatScrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
      }
    };
    const t1 = setTimeout(scrollToLastMessageTop, 0);
    const t2 = setTimeout(scrollToLastMessageTop, 80);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [state.messages]);

  useEffect(() => {
    if (!state.isAiSpeaking) return;
    const t1 = setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 0);
    const t2 = setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [state.isAiSpeaking]);

  const isTurnLocked =
    state.isAiSpeaking || isAssistantSpeaking() || isReading;
  const isHoldToTalkDisabled = state.isAiSpeaking;

  const handleStartRecording = async () => {
    if (state.isAiSpeaking && !isRecording) {
      setInfoModal({ visible: true, title: 'Sıralı Akış', message: 'Yanıt hazırlanırken konuşma başlatılamaz. Birazdan tekrar dene.' });
      return;
    }
    if ((isAssistantSpeaking() || isReading) && !isRecording) {
      stopAssistantSpeech();
      setIsReading(false);
      setIsReadPaused(true);
      setHoldToTalkUnlocked(true);
    }
    try {
      setSttHint('');
      if (holdRemainingMs <= 0) {
        setSttHint(`Bu tur için ses limiti doldu (${MAX_HOLD_TO_TALK_SECONDS} sn).`);
        return;
      }
      draftBaseRef.current = draftText.trim();
      liveSegmentRef.current = '';
      recordStartAtRef.current = Date.now();
      holdBudgetAtPressStartRef.current = holdRemainingMs;
      autoStopLockRef.current = false;
      setRecordElapsedMs(0);
      isRecordingRef.current = true;
      setIsRecording(true);
      setUserSpeakingActive(true);
      await startNativeRecording(
        (text) => {
          const segment = text.trim();
          liveSegmentRef.current = segment;
          const base = draftBaseRef.current;
          setDraftText(mergeDraftWithTranscript(base, segment));
        },
        (code, message) => {
          if (code === 'no-speech') {
            setSttHint('Sessizlik algılandı, dinleme devam ediyor.');
          } else {
            setSttHint(`STT hata: ${code}${message ? ` - ${message}` : ''}`);
          }
        },
      );
    } catch (err: any) {
      isRecordingRef.current = false;
      setIsRecording(false);
      setUserSpeakingActive(false);
      setInfoModal({ visible: true, title: 'Mikrofon Hatası', message: err?.message || 'Kayıt başlatılamadı' });
    }
  };

  const handleStopRecording = async () => {
    if (!isRecordingRef.current) return;
    const elapsed = Math.max(0, Date.now() - recordStartAtRef.current);
    const nextRemaining = Math.max(0, holdBudgetAtPressStartRef.current - elapsed);
    setHoldRemainingMs(nextRemaining);
    isRecordingRef.current = false;
    setIsRecording(false);
    await stopNativeRecording().catch(() => {});
    setUserSpeakingActive(false);
    const latest = getLatestNativeTranscript().trim();
    const segment = latest || liveSegmentRef.current;
    const base = draftBaseRef.current;
    const merged = mergeDraftWithTranscript(base, segment);
    if (merged) setDraftText(merged);
    draftBaseRef.current = '';
    liveSegmentRef.current = '';
    setRecordElapsedMs(0);
  };

  useEffect(() => {
    if (!isRecording) return;
    const timer = setInterval(() => {
      const elapsed = Date.now() - recordStartAtRef.current;
      setRecordElapsedMs(elapsed);
      if (elapsed >= MAX_HOLD_TO_TALK_SECONDS * 1000 && !autoStopLockRef.current) {
        autoStopLockRef.current = true;
        setSttHint(`Limit: En fazla ${MAX_HOLD_TO_TALK_SECONDS} saniye.`);
        void handleStopRecording();
      }
    }, 250);
    return () => clearInterval(timer);
  }, [isRecording]);

  const handleSendDraft = async () => {
    const rawText = normalizeLimitedInput(draftText, FOLLOW_UP_QUESTION_MAX_CHARS);
    if (rawText.length < FOLLOW_UP_QUESTION_MIN_CHARS) return;
    if (isTurnLocked) {
      setInfoModal({ visible: true, title: 'Sıralı Akış', message: 'Bu tur tamamlanmadan yeni mesaj gönderemezsin.' });
      return;
    }
    const sendResult = await sendUserTranscriptRef.current(rawText).then(
      () => ({ ok: true as const }),
      (err) => ({ ok: false as const, err }),
    );
    if (!sendResult.ok) {
      const retryMessage = isRetryableLlmError(sendResult.err)
        ? getRetryLaterMessage(retryKindForSession(config), `${config.profileId}-${Date.now()}`)
        : null;
      setSendErrorModal({
        visible: true,
        message: retryMessage?.message || sendResult.err?.message || 'Mesaj gönderilemedi canım, bir daha deneyelim.',
      });
      return;
    }
    setDraftText('');
    setEditorVisible(false);
    setSttHint('');
    setHoldRemainingMs(MAX_HOLD_TO_TALK_SECONDS * 1000);
  };

  const handleMessageActions = (message: { role: 'user' | 'assistant'; text: string }) => {
    const value = message.text.trim();
    if (!value) return;
    if (message.role !== 'user') return;
    setMessageActionModal({ visible: true, text: value });
  };

  const handleSessionImageSelected = async (slot: 'cup' | 'cup2' | 'saucer' | 'palm', uri: string) => {
    setSessionImageUris((prev) => ({ ...prev, [slot]: uri }));
    await updateSessionImage(slot, uri).catch((err: any) => {
      setInfoModal({ visible: true, title: 'Görsel Hata', message: err?.message || 'Görsel işlenemedi.' });
    });
  };

  const handleToggleRead = async () => {
    if (isAssistantSpeaking()) {
      stopAssistantSpeech();
      setIsReading(false);
      setIsReadPaused(true);
      return;
    }

    if (!pendingTurnMessageId) {
      setInfoModal({ visible: true, title: 'Oku', message: `Henüz okunacak bir ${assistantLabel} mesajı yok.` });
      return;
    }

    const targetMessage = state.messages.find(
      (m) => m.id === pendingTurnMessageId && m.role === 'assistant',
    );
    if (!targetMessage) return;

    if (!isReadPaused || readingMessageId !== targetMessage.id) {
      prepareAssistantSpeech(targetMessage.text);
      setReadingMessageId(targetMessage.id);
    }

    setIsReading(true);
    setIsReadPaused(false);
    try {
      await startOrResumeAssistantSpeech();
      const progress = getAssistantSpeechProgress();
      if (progress.finished && pendingTurnMessageId === targetMessage.id) {
        setPendingTurnMessageId(null);
        setIsReadPaused(false);
      }
    } catch (err: any) {
      setInfoModal({ visible: true, title: 'TTS Hata', message: err?.message || 'Okuma başlatılamadı' });
    } finally {
      setIsReading(false);
    }
  };

  const handleMarkTurnRead = () => {
    if (!pendingTurnMessageId) return;
    stopAssistantSpeech();
    setIsReading(false);
    setIsReadPaused(false);
    setPendingTurnMessageId(null);
    setHoldToTalkUnlocked(false);
    setHoldRemainingMs(MAX_HOLD_TO_TALK_SECONDS * 1000);
  };

  const readButtonLabel = (() => {
    if (isAssistantSpeaking() || isReading) return 'Duraklat';
    if (isReadPaused) return 'Devam Et';
    return 'Telefon Okusun';
  })();
  const modeHeaderLabel =
    config.readingType === 'coffee'
      ? config.coffeeMode === 'ai-brew'
        ? 'Benim Yerime İç Modu'
        : 'Kahve Yorumu'
      : 'El Okuması Modu';
  const persistReadingAndEnd = async () => {
    if (state.isAiSpeaking) return;
    const transcript = state.messages.map((message) => ({
      role: message.role,
      text: message.text,
      timestamp: message.timestamp,
    }));
    const assistantMessages = state.messages.filter((message) => message.role === 'assistant');
    const firstReading = assistantMessages[0]?.text?.trim() || '';
    const surfacesRead =
      config.readingType === 'palm'
        ? (['palm'] as Array<'palm'>)
        : config.coffeeMode === 'ai-brew'
          ? []
          : ([
              config.cupImageUri || config.secondCupImageUri ? 'cup' : null,
              config.saucerImageUri ? 'saucer' : null,
            ].filter(Boolean) as Array<'cup' | 'saucer'>);
    const summaryText =
      firstReading ||
      `${config.profileName} için ${assistantLabel} ile yapılan ${config.readingType === 'palm' ? 'el okuması' : 'kahve yorumu'}.`;

    await appendReadingSummary({
      profileId: config.profileId,
      assistantId: config.devSettings.assistantId,
      readingType: config.readingType,
      coffeeMode: config.coffeeMode,
      surfacesRead,
      summary: summaryText,
      transcript,
    }).catch(() => {});

    const estimatedMemoryTokens = Math.ceil(
      transcript.reduce((sum, item) => sum + item.text.length, 0) / 3,
    );
    void (async () => {
      await startMemoryAnalysisEstimate(estimatedMemoryTokens).catch(() => {});
      try {
        const result = await analyzeMemoryTranscript({
          profileId: config.profileId,
          profileName: config.profileName,
          readingType: config.readingType,
          memorySnippet: config.memorySnippet,
          transcript,
        });
        await applyMemoryAnalysisResult(config.profileId, result).catch(() => {});
        await settleMemoryAnalysisUsage(
          result.usage.inputTokens,
          result.usage.outputTokens,
          estimatedMemoryTokens,
        ).catch(() => {});
      } catch {
        await failMemoryAnalysisEstimate(estimatedMemoryTokens).catch(() => {});
      }
    })();

    await endSession();
  };

  if (startupError) {
    return (
      <SafeAreaView style={styles.errorSafeArea} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.errorCard}>
          <Text style={styles.errorBrand}>{APP_NAME}</Text>
          <Text style={styles.errorTitle}>{startupError.title}</Text>
          <Text style={styles.errorText}>{startupError.message}</Text>
          {!startupError.isRetry ? (
            <Text style={styles.errorWarning}>
              Her yanlış yüklenen görsel kredi hesabına dahil edilir. Bu denemeler bir sonraki okumanın açılışına da not
              düşülür.
            </Text>
          ) : null}
          <TouchableOpacity style={styles.errorButton} onPress={() => navigation.goBack()}>
            <Text style={styles.errorButtonText}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <View style={styles.tokenAckRow}>
          <View style={styles.tokenWrap}>
            <TokenUsage
              usage={state.tokenUsage}
              inputPrice={config.devSettings.inputPrice}
              outputPrice={config.devSettings.outputPrice}
            />
          </View>
        </View>
        <View style={styles.sessionHeaderRow}>
          <Text style={styles.sessionHeaderText}>{config.profileName}</Text>
          <Text style={[styles.sessionHeaderText, styles.modeHeaderText]}>{modeHeaderLabel}</Text>
          <Text style={styles.sessionHeaderText}>{assistantLabel}</Text>
        </View>

        {config.readingType === 'coffee' && config.coffeeMode === 'ai-brew' ? (
          null
        ) : config.readingType === 'palm' ? (
          null
        ) : (
          <View style={styles.imagesRow}>
            {sessionImageUris.cup ? (
              <TouchableOpacity onPress={() => setViewerUri(sessionImageUris.cup)}>
                <View style={styles.previewWrap}>
                  <Image source={{ uri: sessionImageUris.cup }} style={styles.previewImage} />
                  <Text style={styles.previewHintText}>Büyütmek için dokun</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.sessionImageSlot}>
                <ImageUploader
                  compact
                  hideLabel
                  label="Kahve görseli 1"
                  imageUri={sessionImageUris.cup}
                  onImageSelected={(uri) => {
                    void handleSessionImageSelected('cup', uri);
                  }}
                />
              </View>
            )}
            {sessionImageUris.cup2 ? (
              <TouchableOpacity onPress={() => setViewerUri(sessionImageUris.cup2)}>
                <View style={styles.previewWrap}>
                  <Image source={{ uri: sessionImageUris.cup2 }} style={styles.previewImage} />
                  <Text style={styles.previewHintText}>Büyütmek için dokun</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.sessionImageSlot}>
                <ImageUploader
                  compact
                  hideLabel
                  label="Kahve görseli 2"
                  imageUri={sessionImageUris.cup2}
                  onImageSelected={(uri) => {
                    void handleSessionImageSelected('cup2', uri);
                  }}
                />
              </View>
            )}
            {sessionImageUris.saucer ? (
              <TouchableOpacity onPress={() => setViewerUri(sessionImageUris.saucer)}>
                <View style={styles.previewWrap}>
                  <Image source={{ uri: sessionImageUris.saucer }} style={styles.previewImage} />
                  <Text style={styles.previewHintText}>Büyütmek için dokun</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.sessionImageSlot}>
                <ImageUploader
                  compact
                  hideLabel
                  label="Kahve görseli 3"
                  imageUri={sessionImageUris.saucer}
                  onImageSelected={(uri) => {
                    void handleSessionImageSelected('saucer', uri);
                  }}
                />
              </View>
            )}
          </View>
        )}
        {config.readingType === 'palm' ? (
          <View style={styles.imagesRow}>
            {sessionImageUris.palm ? (
              <TouchableOpacity onPress={() => setViewerUri(sessionImageUris.palm)}>
                <View style={styles.previewWrap}>
                  <Image source={{ uri: sessionImageUris.palm }} style={styles.previewImage} />
                  <Text style={styles.previewHintText}>Büyütmek için dokun</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.sessionImageSlot}>
                <ImageUploader
                  compact
                  hideLabel
                  label="Avuç İçi"
                  imageUri={sessionImageUris.palm}
                  onImageSelected={(uri) => {
                    void handleSessionImageSelected('palm', uri);
                  }}
                />
              </View>
            )}
          </View>
        ) : null}

        <BrandedScrollView
          ref={chatScrollRef}
          containerStyle={styles.chatAreaFrame}
          style={styles.chatArea}
          contentContainerStyle={styles.chatContent}
          indicatorMode="box"
          onContentSizeChange={() => {
            if (state.isAiSpeaking) {
              chatScrollRef.current?.scrollToEnd({ animated: true });
            }
          }}
        >
          {state.messages.map((msg) => (
            <View
              key={msg.id}
              style={[styles.chatBubble, msg.role === 'user' ? styles.bubbleUser : styles.bubbleAi]}
              onLayout={(e) => {
                messageYRef.current[msg.id] = e.nativeEvent.layout.y;
              }}
            >
              <SelectableFormattedText
                text={msg.text}
                selectionColor={msg.role === 'user' ? '#E8C49A' : '#E6D7C6'}
                style={[styles.chatText, msg.role === 'user' ? styles.textUser : styles.textAi]}
              />
              {msg.role === 'user' ? (
                <TouchableOpacity
                  style={styles.messageActionsButton}
                  activeOpacity={0.78}
                  onPress={() => handleMessageActions(msg)}
                >
                  <Text style={styles.messageActionsText}>Yeniden gönder / düzenle</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
          {state.isAiSpeaking ? (
            <AssistantLoading
              label={state.messages.length ? 'Yanıt hazırlanıyor' : 'Okuman hazırlanıyor'}
              detail={state.messages.length ? undefined : 'Lütfen bekleyiniz. Ekranı kapatmayınız.'}
              compact={Boolean(state.messages.length)}
            />
          ) : null}
        </BrandedScrollView>

        <View style={styles.readActionsBar}>
          <TouchableOpacity
            style={[
              styles.secondaryAction,
              (!pendingTurnMessageId || state.isAiSpeaking) && styles.readControlDisabled,
            ]}
            onPress={handleToggleRead}
            disabled={!pendingTurnMessageId || state.isAiSpeaking}
          >
            <Text style={styles.secondaryActionText}>{readButtonLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.secondaryAction, styles.readControlDisabled]} disabled>
            <Text style={styles.secondaryActionText}>{assistantLabel} Okusun</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.questionInput}
            activeOpacity={0.88}
            onPress={() => setEditorVisible(true)}
          >
            <Text style={[styles.composePreviewText, !draftText.trim() && styles.composePreviewPlaceholder]}>
              {draftText.trim() || 'Bu yorumla ilgili ne sormak istersin?'}
            </Text>
          </TouchableOpacity>
          <View style={styles.quickActions}>
            <Pressable
              style={[
                styles.holdTalkAction,
                isRecording && styles.holdTalkActionRecording,
                !isRecording && isHoldToTalkDisabled && styles.squareButtonDisabled,
              ]}
              onPressIn={() => {
                void handleStartRecording();
              }}
              onPressOut={() => {
                void handleStopRecording();
              }}
              onResponderTerminate={() => {
                void handleStopRecording();
              }}
              disabled={!isRecording && isHoldToTalkDisabled}
            >
              <Text style={styles.holdTalkActionText}>{isRecording ? 'Bırakınca Yaz' : 'Basılı Tut Konuş'}</Text>
            </Pressable>
            <TouchableOpacity
              style={[
                styles.primaryAction,
                (isTurnLocked || isRecording || !draftText.trim()) && styles.squareButtonDisabled,
              ]}
              onPress={handleSendDraft}
              disabled={isTurnLocked || isRecording || !draftText.trim()}
            >
              <Text style={styles.primaryActionText}>Sor</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.limitInfoText}>Bu tur için ses limitin: {MAX_HOLD_TO_TALK_SECONDS} sn</Text>
          {!!sttHint ? <Text style={styles.sttHint}>{sttHint}</Text> : null}
          <TouchableOpacity
            style={[styles.endButton, state.isAiSpeaking && styles.squareButtonDisabled]}
            onPress={() => void persistReadingAndEnd()}
            disabled={state.isAiSpeaking}
          >
            <Text style={styles.endButtonText}>Okumayı Bitir</Text>
          </TouchableOpacity>
        </View>

        <Modal visible={!!viewerUri} transparent animationType="fade" onRequestClose={() => setViewerUri(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalBackdrop} onPress={() => setViewerUri(null)}>
            {viewerUri ? <Image source={{ uri: viewerUri }} style={styles.fullscreenImage} resizeMode="contain" /> : null}
          </TouchableOpacity>
        </Modal>

        <BrandedConfirmModal
          visible={pauseWarningVisible}
          title={APP_NAME}
          message="Yorumcu okumasını bitirip soru sorarak mı devam etmek istiyorsunuz?"
          confirmLabel="Evet"
          cancelLabel="Hayır"
          onConfirm={() => {
            setPauseWarningVisible(false);
            setHoldToTalkUnlocked(true);
            setPendingTurnMessageId(null);
            setIsReadPaused(false);
          }}
          onCancel={() => setPauseWarningVisible(false)}
        />

        <Modal
          visible={editorVisible}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setEditorVisible(false)}
        >
          <KeyboardAvoidingView
            style={styles.editorOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'android' ? 24 : 0}
          >
            <View style={styles.editorCard}>
              <Text style={styles.editorTitle}>Sorunu Düzenle</Text>
              <TextInput
                style={styles.editorInput}
                value={draftText}
                onChangeText={setDraftText}
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
                  style={[styles.editorSendBtn, (isTurnLocked || isRecording || !draftText.trim()) && styles.squareButtonDisabled]}
                  onPress={handleSendDraft}
                  disabled={isTurnLocked || isRecording || !draftText.trim()}
                >
                  <Text style={styles.editorSendText}>Gönder</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <BrandedConfirmModal
          visible={sendErrorModal.visible}
          title={APP_NAME}
          message={sendErrorModal.message}
          confirmLabel="Tamam"
          cancelLabel="Kapat"
          onConfirm={() => setSendErrorModal({ visible: false, message: '' })}
          onCancel={() => setSendErrorModal({ visible: false, message: '' })}
        />
        <BrandedConfirmModal
          visible={infoModal.visible}
          title={infoModal.title}
          message={infoModal.message}
          confirmLabel="Tamam"
          cancelLabel={null}
          onConfirm={() => setInfoModal({ visible: false, title: APP_NAME, message: '' })}
          onCancel={() => setInfoModal({ visible: false, title: APP_NAME, message: '' })}
        />
        <BrandedConfirmModal
          visible={messageActionModal.visible}
          title="Mesaj"
          message="Bu soruyla ne yapmak istersin?"
          confirmLabel="Yeniden Gönder"
          cancelLabel="Kapat"
          extraActionLabel="Düzenle"
          onExtraAction={() => {
            setDraftText(messageActionModal.text);
            setEditorVisible(true);
            setMessageActionModal({ visible: false, text: '' });
          }}
          onConfirm={() => {
            const value = messageActionModal.text;
            setMessageActionModal({ visible: false, text: '' });
            if (isTurnLocked || isRecording) {
              setInfoModal({ visible: true, title: 'Sıralı Akış', message: 'Bu tur tamamlanmadan yeniden gönderemezsin.' });
              return;
            }
            void sendUserTranscriptRef.current(value);
          }}
          onCancel={() => setMessageActionModal({ visible: false, text: '' })}
        />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#14141E' },
  safeArea: { flex: 1 },
  errorSafeArea: { flex: 1, backgroundColor: '#14141E', justifyContent: 'center', padding: 22 },
  errorCard: {
    borderRadius: 22,
    padding: 20,
    backgroundColor: 'rgba(30,30,40,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.35)',
  },
  errorBrand: { color: '#D4A574', fontSize: 13, fontWeight: '800', marginBottom: 10, letterSpacing: 0.4 },
  errorTitle: { color: '#FFF5E8', fontSize: 20, fontWeight: '800', marginBottom: 8 },
  errorText: { color: 'rgba(255,255,255,0.76)', fontSize: 14, lineHeight: 22, marginBottom: 18 },
  errorWarning: { color: '#F6C38B', fontSize: 12, lineHeight: 18, marginBottom: 18 },
  errorButton: { borderRadius: 14, backgroundColor: '#D4A574', paddingVertical: 14, alignItems: 'center' },
  errorButtonText: { color: '#14141E', fontSize: 15, fontWeight: '800' },
  modeInfoCard: {
    marginHorizontal: 12,
    marginBottom: 6,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.28)',
    backgroundColor: 'rgba(212,165,116,0.1)',
  },
  modeInfoTitle: {
    color: '#E8C49A',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  modeInfoText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    lineHeight: 18,
  },
  imagesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  sessionImageSlot: { alignItems: 'center' },
  imageAudioRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  tokenAckRow: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 4,
  },
  tokenWrap: { width: '100%' },
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
  previewWrap: {
    position: 'relative',
  },
  previewImage: {
    width: 100,
    height: 100,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.45)',
  },
  previewHintText: {
    position: 'absolute',
    left: 6,
    right: 6,
    bottom: 6,
    fontSize: 10,
    color: '#FFF',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 2,
    textAlign: 'center',
  },
  readControlButton: {
    minWidth: 78,
    height: 38,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#D4A574',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212,165,116,0.12)',
    paddingHorizontal: 8,
  },
  readControlDisabled: {
    opacity: 0.45,
  },
  readControlButtonText: {
    color: '#E8C49A',
    fontWeight: '700',
    fontSize: 12,
  },
  chatAreaFrame: { flex: 0.92 },
  chatArea: { flex: 1 },
  chatContent: { paddingHorizontal: 10, paddingBottom: 10 },
  turnAckRow: {
    paddingHorizontal: 12,
    paddingBottom: 4,
    alignItems: 'center',
  },
  turnAckButton: {
    flex: 0,
    minHeight: 34,
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  chatBubble: {
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    maxWidth: '84%',
    backgroundColor: 'rgba(168,130,82,0.2)',
    borderBottomRightRadius: 4,
  },
  bubbleAi: {
    alignSelf: 'flex-start',
    maxWidth: '94%',
    backgroundColor: 'rgba(30,30,40,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.3)',
    borderBottomLeftRadius: 4,
  },
  chatText: {
    fontSize: 15,
    lineHeight: 22,
  },
  messageActionsButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 4,
  },
  messageActionsText: {
    color: '#CFA46E',
    fontSize: 12,
    fontWeight: '700',
  },
  textUser: { color: '#E8C49A' },
  textAi: { color: '#FFF' },
  footer: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(168,130,82,0.12)',
    backgroundColor: 'rgba(20,20,30,0.95)',
  },
  readActionsBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 8,
    backgroundColor: 'rgba(20,20,30,0.95)',
  },
  footerTitle: {
    color: '#E8C49A',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  questionInput: {
    minHeight: 82,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.28)',
    backgroundColor: 'rgba(0,0,0,0.18)',
    padding: 12,
    justifyContent: 'flex-start',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  primaryAction: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#D4A574',
    paddingVertical: 11,
    alignItems: 'center',
  },
  primaryActionText: {
    color: '#14141E',
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryAction: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.45)',
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  secondaryActionText: {
    color: '#E8C49A',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  holdTalkAction: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    paddingVertical: 11,
    alignItems: 'center',
  },
  holdTalkActionRecording: {
    backgroundColor: '#FF6B6B',
  },
  holdTalkActionText: {
    color: '#14141E',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  composeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  composeInputWrap: {
    flex: 1,
    position: 'relative',
  },
  micSquareButton: {
    width: 92,
    minHeight: 92,
    borderRadius: 10,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  micSquareText: {
    color: '#14141E',
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 12,
    lineHeight: 16,
  },
  composeInputTouch: {
    minHeight: 92,
    maxHeight: 92,
    borderRadius: 10,
    borderColor: 'rgba(212,165,116,0.35)',
    borderWidth: 1,
    backgroundColor: 'rgba(30,30,40,0.95)',
    justifyContent: 'flex-start',
    paddingLeft: 74,
    paddingRight: 10,
    paddingTop: 10,
    paddingBottom: 10,
  },
  composePreviewText: {
    color: '#FFF',
    fontSize: 13,
    lineHeight: 19,
  },
  composePreviewPlaceholder: {
    color: 'rgba(255,255,255,0.45)',
  },
  composeInput: {
    minHeight: 92,
    maxHeight: 92,
    borderRadius: 10,
    borderColor: 'rgba(212,165,116,0.35)',
    borderWidth: 1,
    backgroundColor: 'rgba(30,30,40,0.95)',
    color: '#FFF',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 10,
    textAlignVertical: 'top',
  },
  sendInInputButton: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    zIndex: 3,
    elevation: 3,
    width: 54,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#D4A574',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendInInputText: {
    color: '#14141E',
    fontSize: 11,
    fontWeight: '800',
  },
  limitInfoText: {
    color: 'rgba(212,165,116,0.9)',
    fontSize: 11,
    marginTop: 8,
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
    color: '#FFF',
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
  squareButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 7,
    backgroundColor: '#D4A574',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButton: {
    backgroundColor: '#4CAF50',
  },
  squareButtonStop: {
    backgroundColor: '#FF6B6B',
  },
  squareButtonDisabled: {
    opacity: 0.45,
  },
  squareButtonText: {
    color: '#14141E',
    fontWeight: '800',
    fontSize: 13,
  },
  sttHint: {
    color: '#E8C49A',
    fontSize: 12,
    marginTop: 8,
  },
  endButton: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.5)',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255,107,107,0.12)',
  },
  endButtonText: {
    color: '#FF6B6B',
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  fullscreenImage: {
    width: '100%',
    height: '90%',
  },
});
