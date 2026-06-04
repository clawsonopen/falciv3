import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { ImageUploader } from '../components/ImageUploader';
import { BrandedConfirmModal } from '../components/BrandedConfirmModal';
import { BrandedScrollView } from '../components/BrandedScrollView';
import {
  APP_NAME,
  DEFAULT_DEV_SETTINGS,
  applyAssistantPreset,
  getAssistantLabel,
  getAssistantPreset,
} from '../config/constants';
import { normalizeLimitedInput, OPTIONAL_READING_TOPIC_MAX_CHARS } from '../config/llmTokenPolicy';
import { appendUserReadingIntentMemory, getPrimaryProfile, loadAccountState, loadProfileMemorySnippet } from '../services/profileMemoryService';
import { getModelTokenPrices, getTokenLedgerSnapshot } from '../services/tokenLedgerService';
import type { AccountState } from '../types/memory';
import type { DevSettings } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'PersonalReadingSetup'>;

export function PersonalReadingSetupScreen({ navigation, route }: Props) {
  const readingType = route.params?.preselectedReadingType || 'coffee';
  const assistantId = route.params?.preselectedAssistantId || DEFAULT_DEV_SETTINGS.assistantId;
  const baseDevSettings = route.params?.preselectedDevSettings || DEFAULT_DEV_SETTINGS;
  const [state, setState] = useState<AccountState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [coffeeMode, setCoffeeMode] = useState<'upload' | 'ai-brew'>('upload');
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(route.params?.preselectedProfileId || null);
  const [topicText, setTopicText] = useState('');
  const [topicEditorVisible, setTopicEditorVisible] = useState(false);
  const [imageState, setImageState] = useState<{ cup: string | null; cup2: string | null; saucer: string | null; palm: string | null }>({
    cup: null,
    cup2: null,
    saucer: null,
    palm: null,
  });
  const [pendingInputTokens, setPendingInputTokens] = useState(0);
  const [pendingRejectedUploads, setPendingRejectedUploads] = useState(0);
  const [pendingMemoryAnalysisTokens, setPendingMemoryAnalysisTokens] = useState(0);
  const [memoryAnalysisInFlight, setMemoryAnalysisInFlight] = useState(0);
  const [totalMemoryAnalysisCost, setTotalMemoryAnalysisCost] = useState({ input: 0, output: 0, runs: 0 });
  const [infoModal, setInfoModal] = useState({ visible: false, title: APP_NAME, message: '' });
  const scrollRef = useRef<ScrollView>(null);

  const devSettings: DevSettings = useMemo(
    () => {
      return {
        ...applyAssistantPreset(baseDevSettings, assistantId),
        inputPrice: getModelTokenPrices('gemini-2.5-flash-lite').inputPriceUsdPerM,
        outputPrice: getModelTokenPrices('gemini-2.5-flash-lite').outputPriceUsdPerM,
      };
    },
    [assistantId, baseDevSettings],
  );

  const assistantLabel = getAssistantLabel(devSettings.assistantId);
  const assistantPreset = getAssistantPreset(devSettings.assistantId);
  const normalizedTopicText = normalizeLimitedInput(topicText, OPTIONAL_READING_TOPIC_MAX_CHARS);

  const selectedProfile = useMemo(
    () => state?.profiles.find((profile) => profile.profileId === selectedProfileId) || null,
    [selectedProfileId, state],
  );

  const loadState = useCallback(async () => {
    setIsLoading(true);
    try {
      const next = await loadAccountState();
      const ledger = await getTokenLedgerSnapshot();
      setState(next);
      setPendingInputTokens(ledger.pendingInputTokens || 0);
      setPendingRejectedUploads(ledger.pendingRejectedUploads || 0);
      setPendingMemoryAnalysisTokens(ledger.pendingMemoryAnalysisInputTokens || 0);
      setMemoryAnalysisInFlight(ledger.memoryAnalysisInFlight || 0);
      setTotalMemoryAnalysisCost({
        input: ledger.totalMemoryAnalysisInputTokens || 0,
        output: ledger.totalMemoryAnalysisOutputTokens || 0,
        runs: ledger.totalMemoryAnalysisRuns || 0,
      });

      const requestedProfileId = route.params?.preselectedProfileId || null;
      const fallbackProfile =
        (requestedProfileId && next.profiles.find((p) => p.profileId === requestedProfileId)) ||
        getPrimaryProfile(next) ||
        next.profiles[0] ||
        null;
      setSelectedProfileId(fallbackProfile?.profileId || null);
    } finally {
      setIsLoading(false);
    }
  }, [route.params?.preselectedProfileId]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      void loadState();
    });
    return unsubscribe;
  }, [loadState, navigation]);

  const startSession = useCallback(async () => {
    if (!state || !selectedProfile) {
      setInfoModal({ visible: true, title: 'Eksik', message: 'Profil bulunamadı. Lütfen akış adımlarını tekrar tamamla.' });
      return;
    }

    if (readingType === 'coffee' && coffeeMode === 'upload' && !imageState.cup && !imageState.cup2 && !imageState.saucer) {
      setInfoModal({ visible: true, title: 'Eksik', message: 'Kahve yorumunda en az bir telveli kahve görseli gerekli.' });
      return;
    }

    if (readingType === 'palm' && !imageState.palm) {
      setInfoModal({ visible: true, title: 'Eksik', message: 'El okuması için uygun el ya da pati fotoğrafı gerekli.' });
      return;
    }

    if (normalizedTopicText) {
      await appendUserReadingIntentMemory({
        profileId: selectedProfile.profileId,
        text: normalizedTopicText,
        readingType,
      }).catch(() => {});
    }
    const memoryState = normalizedTopicText ? await loadAccountState().catch(() => state) : state;
    const memorySnippet = await loadProfileMemorySnippet(
      memoryState,
      selectedProfile.profileId,
      normalizedTopicText ? { semanticQuery: normalizedTopicText } : undefined,
    );

    navigation.navigate('Session', {
      config: {
        readingType,
        coffeeMode: readingType === 'coffee' ? coffeeMode : undefined,
        cupImageUri: readingType === 'coffee' && coffeeMode === 'upload' ? imageState.cup : null,
        secondCupImageUri: readingType === 'coffee' && coffeeMode === 'upload' ? imageState.cup2 : null,
        saucerImageUri: readingType === 'coffee' && coffeeMode === 'upload' ? imageState.saucer : null,
        palmImageUri: readingType === 'palm' ? imageState.palm : null,
        profileId: selectedProfile.profileId,
        profileName: selectedProfile.displayName,
        profileIsSelf: selectedProfile.relationshipPrimary === 'kendi',
        focusQuestion: normalizedTopicText || undefined,
        memorySnippet,
        devSettings,
      },
    });
  }, [coffeeMode, devSettings, imageState, navigation, normalizedTopicText, readingType, selectedProfile, state]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingWrap}>
        <Text style={styles.loadingText}>Hazırlanıyor...</Text>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <BrandedScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showScrollToTop
        >
          <Text style={styles.title}>{APP_NAME}</Text>
          <Text style={styles.subtitle}>Seçimlerin tamamlandı. Şimdi okumayı başlatabilirsin.</Text>

          <View style={styles.summaryPanel}>
            <Text style={styles.summaryText}>Profil: {selectedProfile?.displayName || '-'}</Text>
            <Text style={styles.summaryText}>Okuma Tipi: {readingType === 'coffee' ? 'Kahve Yorumu' : 'El / Pati Okuması'}</Text>
            <Text style={styles.summaryText}>Yorumcu: {assistantLabel}</Text>
            <Text style={styles.summaryText}>Model: Gemini 2.5 Flash Lite</Text>
          </View>

          {(pendingRejectedUploads > 0 ||
            pendingInputTokens > 0 ||
            pendingMemoryAnalysisTokens > 0 ||
            memoryAnalysisInFlight > 0 ||
            totalMemoryAnalysisCost.input > 0 ||
            totalMemoryAnalysisCost.output > 0) && (
            <View style={styles.pendingImpactBar}>
              {pendingInputTokens > 0 ? (
                <Text style={styles.pendingImpactText}>Bekleyen giriş tokenı: {pendingInputTokens}</Text>
              ) : null}
              {pendingRejectedUploads > 0 ? (
                <Text style={styles.pendingImpactText}>
                  Bekleyen kredi etkisi: {pendingRejectedUploads} yanlış görsel denemesi bir sonraki okumaya taşınacak.
                </Text>
              ) : null}
              {pendingMemoryAnalysisTokens > 0 ? (
                <Text style={styles.pendingImpactSubtext}>
                  Hafıza analizi için ayrılan tahmini input token: {pendingMemoryAnalysisTokens}
                </Text>
              ) : null}
              {memoryAnalysisInFlight > 0 ? (
                <Text style={styles.pendingImpactSubtext}>Hafıza işleniyor: {memoryAnalysisInFlight} arka plan görevi aktif.</Text>
              ) : null}
              {totalMemoryAnalysisCost.input > 0 || totalMemoryAnalysisCost.output > 0 ? (
                <Text style={styles.pendingImpactSubtext}>
                  Toplam hafıza analizi: {totalMemoryAnalysisCost.runs} işlem, giriş {totalMemoryAnalysisCost.input}, çıkış {totalMemoryAnalysisCost.output} token
                </Text>
              ) : null}
            </View>
          )}

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>{readingType === 'coffee' ? 'Kahve Yorumuna Başla' : 'El Okumasına Başla'}</Text>
            <Text style={styles.assistantBlurb}>{assistantPreset.tagline}</Text>
            <Text style={styles.inlineLabel}>Konu / soru</Text>
            <TouchableOpacity style={styles.topicPromptBox} activeOpacity={0.88} onPress={() => setTopicEditorVisible(true)}>
              <Text style={[styles.topicPromptText, !normalizedTopicText && styles.topicPromptPlaceholder]}>
                {normalizedTopicText ||
                  'Aklında bir soru, yorumlanmasını istediğin bir konu, durum vb. varsa buraya yazabilirsin. Aklında bir şey yoksa boş da bırakabilirsin.'}
              </Text>
            </TouchableOpacity>

            {readingType === 'coffee' ? (
              <>
                <Text style={styles.inlineLabel}>Kahve modu</Text>
                <View style={styles.modeRow}>
                  <TouchableOpacity
                    style={[styles.modeCard, coffeeMode === 'upload' && styles.modeCardSelected]}
                    onPress={() => setCoffeeMode('upload')}
                  >
                    <Text style={styles.modeTitle}>Fotoğraf yükle</Text>
                    <Text style={styles.modeText}>Fincan ve tabak görselleriyle klasik yorum.</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modeCard, coffeeMode === 'ai-brew' && styles.modeCardSelected]}
                    onPress={() => setCoffeeMode('ai-brew')}
                  >
                    <Text style={styles.modeTitle}>Benim yerime iç</Text>
                    <Text style={styles.modeText}>senin niyetine içip bakıyoruz</Text>
                  </TouchableOpacity>
                </View>

                {coffeeMode === 'upload' ? (
                  <>
                    <View style={styles.photosRow}>
                      <View style={styles.imageSlot}>
                        <Text style={styles.imageSlotLabel}>Kahve görseli 1</Text>
                        <ImageUploader
                          hideLabel
                          label="Kahve görseli 1"
                          imageUri={imageState.cup}
                          onImageSelected={(uri) => setImageState((prev) => ({ ...prev, cup: uri }))}
                        />
                      </View>
                      <View style={styles.imageSlot}>
                        <Text style={styles.imageSlotLabel}>Kahve görseli 2</Text>
                        <ImageUploader
                          hideLabel
                          label="Kahve görseli 2"
                          imageUri={imageState.cup2}
                          onImageSelected={(uri) => setImageState((prev) => ({ ...prev, cup2: uri }))}
                        />
                      </View>
                      <View style={styles.imageSlot}>
                        <Text style={styles.imageSlotLabel}>Kahve görseli 3</Text>
                        <ImageUploader
                          hideLabel
                          label="Kahve görseli 3"
                          imageUri={imageState.saucer}
                          onImageSelected={(uri) => setImageState((prev) => ({ ...prev, saucer: uri }))}
                        />
                      </View>
                    </View>
                    <Text style={styles.helperText}>
                      Her slot fincan, tabak veya fincan+tabak olabilir. Aynı kahvenin farklı açılardan çekilmiş karelerini yükleyebilirsin.
                    </Text>
                    <Text style={styles.creditWarning}>
                      Her yanlış yüklenen görsel kredi hesabına dahil edilir. Yanlış denemeler bir sonraki okumanın açılışına da not düşülür.
                    </Text>
                  </>
                ) : (
                  <Text style={styles.helperText}>
                    Bu modda görsel yüklemiyorsun. Seçili profilin hafızası ve önceki okumalardan sezgisel destek alınır.
                  </Text>
                )}
              </>
            ) : (
              <>
                <View style={styles.singleImageWrap}>
                  <Text style={styles.imageSlotLabel}>
                    {selectedProfile?.relationshipPrimary === 'evcil_hayvan' ? 'Pati ya da ayak' : 'El ya da pati'}
                  </Text>
                  <ImageUploader
                    hideLabel
                    label="El ya da pati"
                    imageUri={imageState.palm}
                    onImageSelected={(uri) => setImageState((prev) => ({ ...prev, palm: uri }))}
                  />
                </View>
                <Text style={styles.creditWarning}>
                  Yanlış türde yüklenen her görsel kredi hesabına dahil edilir. Doğru okuma açıldığında bu deneme sayısı yeni okumaya taşınır.
                </Text>
              </>
            )}

            <TouchableOpacity style={styles.primaryButton} onPress={() => void startSession()}>
              <Text style={styles.primaryButtonText}>Okumamı Başlat</Text>
            </TouchableOpacity>
          </View>
        </BrandedScrollView>
        <Modal visible={topicEditorVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setTopicEditorVisible(false)}>
          <KeyboardAvoidingView
            style={styles.editorOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'android' ? 24 : 0}
          >
            <View style={styles.editorCard}>
              <Text style={styles.editorTitle}>Konu / Soru</Text>
              <TextInput
                style={styles.editorInput}
                value={topicText}
                onChangeText={setTopicText}
                maxLength={OPTIONAL_READING_TOPIC_MAX_CHARS}
                placeholder="Aklında bir soru, yorumlanmasını istediğin bir konu, durum vb. varsa buraya yazabilirsin. Aklında bir şey yoksa boş da bırakabilirsin."
                placeholderTextColor="rgba(255,255,255,0.35)"
                multiline
                autoFocus
                scrollEnabled
              />
              <View style={styles.editorActions}>
                <TouchableOpacity style={styles.editorGhostBtn} onPress={() => setTopicEditorVisible(false)}>
                  <Text style={styles.editorGhostText}>Kapat</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.editorSendBtn} onPress={() => setTopicEditorVisible(false)}>
                  <Text style={styles.editorSendText}>Kaydet</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
        <BrandedConfirmModal
          visible={infoModal.visible}
          title={infoModal.title}
          message={infoModal.message}
          confirmLabel="Tamam"
          cancelLabel={null}
          onConfirm={() => setInfoModal({ visible: false, title: APP_NAME, message: '' })}
          onCancel={() => setInfoModal({ visible: false, title: APP_NAME, message: '' })}
        />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#14141E' },
  safeArea: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 20, paddingBottom: 180 },
  loadingWrap: { flex: 1, backgroundColor: '#14141E', alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#E8C49A', fontSize: 16, fontWeight: '700' },
  title: { fontSize: 26, fontWeight: '700', color: '#D4A574', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: 'rgba(212,165,116,0.72)', textAlign: 'center', marginBottom: 18, lineHeight: 20 },
  summaryPanel: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(212,165,116,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.28)',
  },
  summaryText: { color: '#F6C38B', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  panel: {
    marginBottom: 18,
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(30, 30, 40, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(168, 130, 82, 0.18)',
  },
  panelTitle: { color: '#E8C49A', fontSize: 16, fontWeight: '700', marginBottom: 10 },
  pendingImpactBar: {
    marginBottom: 18,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(212,165,116,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.28)',
  },
  pendingImpactText: { color: '#F6C38B', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  pendingImpactSubtext: { color: 'rgba(255,255,255,0.68)', fontSize: 11, lineHeight: 16, marginTop: 4 },
  helperText: { color: 'rgba(255,255,255,0.65)', fontSize: 12, lineHeight: 18, marginBottom: 10 },
  assistantBlurb: { color: 'rgba(255,255,255,0.72)', fontSize: 12, lineHeight: 18, marginBottom: 12 },
  creditWarning: {
    color: '#F6C38B',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
    backgroundColor: 'rgba(212,165,116,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.22)',
    borderRadius: 12,
    padding: 10,
  },
  inlineLabel: { color: '#D4A574', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  topicPromptBox: {
    minHeight: 88,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.24)',
    backgroundColor: 'rgba(0,0,0,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    justifyContent: 'center',
  },
  topicPromptText: { color: '#FFF5E8', fontSize: 13, lineHeight: 19 },
  topicPromptPlaceholder: { color: 'rgba(255,255,255,0.42)' },
  editorOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.58)',
    justifyContent: 'center',
    padding: 18,
  },
  editorCard: {
    maxHeight: '82%',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.35)',
    backgroundColor: '#1E1E28',
    padding: 16,
  },
  editorTitle: { color: '#E8C49A', fontSize: 16, fontWeight: '800', marginBottom: 10 },
  editorInput: {
    minHeight: 180,
    maxHeight: 300,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.24)',
    backgroundColor: 'rgba(0,0,0,0.2)',
    color: '#FFF5E8',
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 12,
    paddingVertical: 12,
    textAlignVertical: 'top',
  },
  editorActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
  editorGhostBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)' },
  editorGhostText: { color: 'rgba(255,255,255,0.78)', fontSize: 13, fontWeight: '700' },
  editorSendBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: '#D4A574' },
  editorSendText: { color: '#14141E', fontSize: 13, fontWeight: '800' },
  modeRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  modeCard: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.18)',
  },
  modeCardSelected: { borderColor: '#D4A574', backgroundColor: 'rgba(212,165,116,0.14)' },
  modeTitle: { color: '#FFF5E8', fontSize: 13, fontWeight: '700', marginBottom: 4 },
  modeText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 17 },
  photosRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 8 },
  imageSlot: { flex: 1, minWidth: 0, alignItems: 'center' },
  imageSlotLabel: { color: '#D4A574', fontSize: 12, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  singleImageWrap: { alignItems: 'center', marginBottom: 12 },
  primaryButton: {
    borderRadius: 14,
    backgroundColor: '#D4A574',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#14141E', fontSize: 15, fontWeight: '800' },
});
