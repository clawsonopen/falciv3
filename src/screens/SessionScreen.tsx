import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import {
  getLatestNativeTranscript,
  resetNativeTranscript,
  startNativeRecording,
  stopNativeRecording,
} from '../services/nativeSttService';
import { APP_NAME } from '../config/constants';
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
import {
  failMemoryAnalysisEstimate,
  settleMemoryAnalysisUsage,
  startMemoryAnalysisEstimate,
} from '../services/tokenLedgerService';

type Props = NativeStackScreenProps<RootStackParamList, 'Session'>;

const PHOTO_RETRY_MESSAGE =
  'Bu fotoğraf bu fal türü için uygun görünmüyor canım. Kahve falı için telveyi gösteren fincan veya tabak, el falı için avuç içi fotoğrafı yükleyelim.';

function visibleStartupError(raw?: string | null) {
  const text = (raw || '').trim();
  if (!text) return PHOTO_RETRY_MESSAGE;
  return /Gemini|HTTP|JSON|RuntimeError|Traceback|candidate|classifier|generateContent|API|token|exception|returned/i.test(
    text,
  )
    ? PHOTO_RETRY_MESSAGE
    : text;
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
  const [draftText, setDraftText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [sttHint, setSttHint] = useState('');
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [sessionImageUris, setSessionImageUris] = useState({
    cup: config.cupImageUri,
    saucer: config.saucerImageUri,
    palm: config.palmImageUri || null,
  });
  const [isReading, setIsReading] = useState(false);
  const [isReadPaused, setIsReadPaused] = useState(false);
  const [readingMessageId, setReadingMessageId] = useState<string | null>(null);
  const [pendingTurnMessageId, setPendingTurnMessageId] = useState<string | null>(null);
  const [startupError, setStartupError] = useState<string | null>(null);
  const lastAssistantMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    sendUserTranscriptRef.current = sendUserTranscript;
  }, [sendUserTranscript]);

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
        setSttHint('Bas-Konuş ile dikte et, metni kontrol et, sonra gönder.');
      })
      .catch((err) => {
        if (isCancelled) return;
        setStartupError(visibleStartupError(err?.message));
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

  const isTurnLocked =
    state.isAiSpeaking || isAssistantSpeaking() || isReading || Boolean(pendingTurnMessageId);

  const handleStartRecording = async () => {
    if (isTurnLocked && !isRecording) {
      Alert.alert('Sıralı Akış', 'Bu tur tamamlanmadan konuşma başlatılamaz. Önce mesajı oku veya Okudum de.');
      return;
    }
    try {
      setSttHint('');
      draftBaseRef.current = draftText.trim();
      liveSegmentRef.current = '';
      setUserSpeakingActive(true);
      await startNativeRecording(
        (text) => {
          const segment = text.trim();
          liveSegmentRef.current = segment;
          const base = draftBaseRef.current;
          const merged = base && segment ? `${base} ${segment}` : base || segment;
          setDraftText(merged);
        },
        (code, message) => {
          if (code === 'no-speech') {
            setSttHint('Sessizlik algılandı, dinleme devam ediyor.');
          } else {
            setSttHint(`STT hata: ${code}${message ? ` - ${message}` : ''}`);
          }
        },
      );
      setIsRecording(true);
    } catch (err: any) {
      setUserSpeakingActive(false);
      Alert.alert('Mikrofon Hatası', err?.message || 'Kayıt başlatılamadı');
    }
  };

  const handleStopRecording = async () => {
    await stopNativeRecording().catch(() => {});
    setIsRecording(false);
    setUserSpeakingActive(false);
    const latest = getLatestNativeTranscript().trim();
    const segment = latest || liveSegmentRef.current;
    const base = draftBaseRef.current;
    const merged = base && segment ? `${base} ${segment}` : base || segment;
    if (merged) setDraftText(merged);
    draftBaseRef.current = '';
    liveSegmentRef.current = '';
  };

  const handleClearDraft = () => {
    setDraftText('');
    setSttHint('');
    resetNativeTranscript();
    draftBaseRef.current = '';
    liveSegmentRef.current = '';
  };

  const handleSendDraft = async () => {
    const rawText = draftText;
    if (!rawText.trim()) return;
    if (isTurnLocked) {
      Alert.alert('Sıralı Akış', 'Bu tur tamamlanmadan yeni mesaj gönderemezsin.');
      return;
    }
    setDraftText('');
    setSttHint('');
    await sendUserTranscriptRef.current(rawText).catch((err) => {
      Alert.alert('Falcıdan Not', err?.message || 'Mesaj gönderilemedi canım, bir daha deneyelim.');
    });
  };

  const handleSessionImageSelected = async (slot: 'cup' | 'saucer' | 'palm', uri: string) => {
    setSessionImageUris((prev) => ({ ...prev, [slot]: uri }));
    await updateSessionImage(slot, uri).catch((err: any) => {
      Alert.alert('Görsel Hata', err?.message || 'Görsel işlenemedi.');
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
      Alert.alert('Oku', `Henüz okunacak bir ${assistantLabel} mesajı yok.`);
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
      Alert.alert('TTS Hata', err?.message || 'Okuma başlatılamadı');
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
  };

  const readButtonLabel = (() => {
    if (isAssistantSpeaking() || isReading) return 'Duraklat';
    if (isReadPaused) return 'Devam Et';
    return `Anlat ${assistantLabel}`;
  })();

  const persistReadingAndEnd = async () => {
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
              config.cupImageUri ? 'cup' : null,
              config.saucerImageUri ? 'saucer' : null,
            ].filter(Boolean) as Array<'cup' | 'saucer'>);
    const summaryText =
      firstReading ||
      `${config.profileName} için ${assistantLabel} ile yapılan ${config.readingType === 'palm' ? 'el falı' : 'kahve falı'}.`;

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
          <Text style={styles.errorTitle}>Fotoğrafı bir daha seçelim</Text>
          <Text style={styles.errorText}>{startupError}</Text>
          <Text style={styles.errorWarning}>
            Her yanlış yüklenen görsel kredi hesabına dahil edilir. Bu denemeler bir sonraki falın açılışına da not
            düşülür.
          </Text>
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
          <Text style={styles.sessionHeaderText}>{assistantLabel}</Text>
        </View>

        {config.readingType === 'coffee' && config.coffeeMode === 'ai-brew' ? (
          <View style={styles.modeInfoCard}>
            <Text style={styles.modeInfoTitle}>Benim Yerime İç Modu</Text>
            <Text style={styles.modeInfoText}>
              Bu oturumda gerçek fincan görseli yok. {assistantLabel}, {config.profileName} için
              hafıza ve önceki temalardan destek alarak sezgisel bir kahve falı açıyor.
            </Text>
          </View>
        ) : config.readingType === 'palm' ? (
          <View style={styles.modeInfoCard}>
            <Text style={styles.modeInfoTitle}>El Falı Modu</Text>
            <Text style={styles.modeInfoText}>
              Bu oturumda avuç içi çizgileri ve el formu yorumlanacak. İlk sürümde yumuşak doğrulama kullanıyoruz; sert bir el kalıbı dayatmıyoruz.
            </Text>
          </View>
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
                <Text style={styles.sessionImageLabel}>Fincan İçi</Text>
                <ImageUploader
                  compact
                  hideLabel
                  label="Fincan İçi"
                  imageUri={sessionImageUris.cup}
                  onImageSelected={(uri) => {
                    void handleSessionImageSelected('cup', uri);
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
                <Text style={styles.sessionImageLabel}>Tabak</Text>
                <ImageUploader
                  compact
                  hideLabel
                  label="Fincan Tabağı"
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
                <Text style={styles.sessionImageLabel}>Avuç İçi</Text>
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

        <View style={styles.readControlRow}>
          <TouchableOpacity
            style={[
              styles.readControlButton,
              (!pendingTurnMessageId || state.isAiSpeaking) && styles.readControlDisabled,
            ]}
            onPress={handleToggleRead}
            disabled={!pendingTurnMessageId || state.isAiSpeaking}
          >
            <Text style={styles.readControlButtonText}>{readButtonLabel}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={chatScrollRef}
          style={styles.chatArea}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
        >
          {state.messages.map((msg) => (
            <View
              key={msg.id}
              style={[styles.chatBubble, msg.role === 'user' ? styles.bubbleUser : styles.bubbleAi]}
              onLayout={(e) => {
                messageYRef.current[msg.id] = e.nativeEvent.layout.y;
              }}
            >
              <Text style={[styles.chatText, msg.role === 'user' ? styles.textUser : styles.textAi]}>
                {msg.text}
              </Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.turnAckRow}>
          <TouchableOpacity
            style={[
              styles.squareButton,
              styles.turnAckButton,
              !pendingTurnMessageId && styles.squareButtonDisabled,
            ]}
            onPress={handleMarkTurnRead}
            disabled={!pendingTurnMessageId}
          >
            <Text style={styles.squareButtonText}>Okundu, Tamam</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <View style={styles.composeRow}>
            <TextInput
              style={styles.composeInput}
              value={draftText}
              onChangeText={setDraftText}
              placeholder="Konuşman burada metne dökülür; düzenleyip gönderebilirsin."
              placeholderTextColor="rgba(255,255,255,0.35)"
              multiline
              scrollEnabled
            />
            <TouchableOpacity
              style={[
                styles.sendIconButton,
                (isTurnLocked || isRecording || !draftText.trim()) && styles.squareButtonDisabled,
              ]}
              onPress={handleSendDraft}
              disabled={isTurnLocked || isRecording || !draftText.trim()}
            >
              <Text style={styles.sendIconText}>Gönder</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[
                styles.squareButton,
                styles.micButton,
                isRecording && styles.squareButtonStop,
                !isRecording && isTurnLocked && styles.squareButtonDisabled,
              ]}
              onPress={isRecording ? handleStopRecording : handleStartRecording}
              disabled={!isRecording && isTurnLocked}
            >
              <Text style={styles.squareButtonText}>{isRecording ? 'Kaydı Durdur' : 'Bas-Konuş'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.squareButton, (isRecording || !draftText.trim()) && styles.squareButtonDisabled]}
              onPress={handleClearDraft}
              disabled={isRecording || !draftText.trim()}
            >
              <Text style={styles.squareButtonText}>Temizle</Text>
            </TouchableOpacity>
          </View>
          {!!sttHint ? <Text style={styles.sttHint}>{sttHint}</Text> : null}
          <TouchableOpacity style={styles.endButton} onPress={() => void persistReadingAndEnd()}>
            <Text style={styles.endButtonText}>Falı Bitir</Text>
          </TouchableOpacity>
        </View>

        <Modal visible={!!viewerUri} transparent animationType="fade" onRequestClose={() => setViewerUri(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalBackdrop} onPress={() => setViewerUri(null)}>
            {viewerUri ? <Image source={{ uri: viewerUri }} style={styles.fullscreenImage} resizeMode="contain" /> : null}
          </TouchableOpacity>
        </Modal>
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
  sessionImageLabel: { color: '#D4A574', fontSize: 12, fontWeight: '700', marginBottom: 8 },
  readControlRow: {
    alignItems: 'center',
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
  chatArea: { flex: 0.92 },
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
  composeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  composeInput: {
    flex: 1,
    minHeight: 108,
    maxHeight: 158,
    borderRadius: 10,
    borderColor: 'rgba(212,165,116,0.35)',
    borderWidth: 1,
    backgroundColor: 'rgba(30,30,40,0.95)',
    color: '#FFF',
    paddingHorizontal: 10,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  sendIconButton: {
    width: 64,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#D4A574',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIconText: {
    color: '#14141E',
    fontSize: 12,
    fontWeight: '800',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
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
