import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { ImageUploader } from '../components/ImageUploader';
import { BrandedConfirmModal } from '../components/BrandedConfirmModal';
import { BrandedScrollView } from '../components/BrandedScrollView';
import {
  APP_NAME,
  DEFAULT_DEV_SETTINGS,
  FORTUNE_MODELS,
  applyAssistantPreset,
  getAssistantLabel,
  getAssistantPreset,
} from '../config/constants';
import { getPrimaryProfile, loadAccountState, loadProfileMemorySnippet } from '../services/profileMemoryService';
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
  const [imageState, setImageState] = useState<{ cup: string | null; saucer: string | null; palm: string | null }>({
    cup: null,
    saucer: null,
    palm: null,
  });
  const [pendingInputTokens, setPendingInputTokens] = useState(0);
  const [pendingRejectedUploads, setPendingRejectedUploads] = useState(0);
  const [pendingMemoryAnalysisTokens, setPendingMemoryAnalysisTokens] = useState(0);
  const [memoryAnalysisInFlight, setMemoryAnalysisInFlight] = useState(0);
  const [totalMemoryAnalysisCost, setTotalMemoryAnalysisCost] = useState({ input: 0, output: 0 });
  const [selectedModelName, setSelectedModelName] = useState(baseDevSettings.modelName || 'gemini-2.5-flash-lite');
  const [infoModal, setInfoModal] = useState({ visible: false, title: APP_NAME, message: '' });

  const devSettings: DevSettings = useMemo(
    () => {
      const model = FORTUNE_MODELS.find((item) => item.name === selectedModelName) || FORTUNE_MODELS[0];
      return {
        ...applyAssistantPreset(baseDevSettings, assistantId),
        modelProvider: model.provider,
        modelName: model.name,
        inputPrice: getModelTokenPrices(model.name).inputPriceUsdPerM,
        outputPrice: getModelTokenPrices(model.name).outputPriceUsdPerM,
      };
    },
    [assistantId, baseDevSettings, selectedModelName],
  );

  const assistantLabel = getAssistantLabel(devSettings.assistantId);
  const assistantPreset = getAssistantPreset(devSettings.assistantId);

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

    if (readingType === 'coffee' && coffeeMode === 'upload' && !imageState.cup && !imageState.saucer) {
      setInfoModal({ visible: true, title: 'Eksik', message: 'Kahve falında en azından fincan ya da tabak fotoğrafı gerekli.' });
      return;
    }

    if (readingType === 'palm' && !imageState.palm) {
      setInfoModal({ visible: true, title: 'Eksik', message: 'El falı için uygun el ya da pati fotoğrafı gerekli.' });
      return;
    }

    const memorySnippet = await loadProfileMemorySnippet(state, selectedProfile.profileId);

    navigation.navigate('Session', {
      config: {
        readingType,
        coffeeMode: readingType === 'coffee' ? coffeeMode : undefined,
        cupImageUri: readingType === 'coffee' && coffeeMode === 'upload' ? imageState.cup : null,
        saucerImageUri: readingType === 'coffee' && coffeeMode === 'upload' ? imageState.saucer : null,
        palmImageUri: readingType === 'palm' ? imageState.palm : null,
        profileId: selectedProfile.profileId,
        profileName: selectedProfile.displayName,
        profileIsSelf: selectedProfile.relationshipPrimary === 'kendi',
        memorySnippet,
        devSettings,
      },
    });
  }, [coffeeMode, devSettings, imageState, navigation, readingType, selectedProfile, state]);

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
        <BrandedScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showScrollToTop>
          <Text style={styles.title}>{APP_NAME}</Text>
          <Text style={styles.subtitle}>Seçimlerin tamamlandı. Şimdi falı başlatabilirsin.</Text>

          <View style={styles.summaryPanel}>
            <Text style={styles.summaryText}>Profil: {selectedProfile?.displayName || '-'}</Text>
            <Text style={styles.summaryText}>Fal Tipi: {readingType === 'coffee' ? 'Kahve Falı' : 'El / Pati Falı'}</Text>
            <Text style={styles.summaryText}>Falcı: {assistantLabel}</Text>
            <Text style={styles.summaryText}>Model: {FORTUNE_MODELS.find((item) => item.name === devSettings.modelName)?.label || devSettings.modelName}</Text>
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
                  Bekleyen kredi etkisi: {pendingRejectedUploads} yanlış görsel denemesi bir sonraki fala taşınacak.
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
                  Toplam hafıza analizi tokenları: giriş {totalMemoryAnalysisCost.input}, çıkış {totalMemoryAnalysisCost.output}
                </Text>
              ) : null}
            </View>
          )}

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>{readingType === 'coffee' ? 'Kahve Falına Başla' : 'El Falına Başla'}</Text>
            <Text style={styles.assistantBlurb}>{assistantPreset.tagline}</Text>

            <Text style={styles.inlineLabel}>Model</Text>
            <View style={styles.modelRow}>
              {FORTUNE_MODELS.map((model) => (
                <TouchableOpacity
                  key={model.name}
                  style={[styles.modelCard, selectedModelName === model.name && styles.modeCardSelected]}
                  onPress={() => setSelectedModelName(model.name)}
                >
                  <Text style={styles.modeTitle}>{model.label}</Text>
                  <Text style={styles.modeText}>
                    {model.name === 'gpt-5-nano' ? 'Ayrı OpenAI prompt builder ile deneysel akış.' : 'Mevcut Gemini akışı aynen korunur.'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {readingType === 'coffee' ? (
              <>
                <Text style={styles.inlineLabel}>Kahve modu</Text>
                <View style={styles.modeRow}>
                  <TouchableOpacity
                    style={[styles.modeCard, coffeeMode === 'upload' && styles.modeCardSelected]}
                    onPress={() => setCoffeeMode('upload')}
                  >
                    <Text style={styles.modeTitle}>Fotoğraf yükle</Text>
                    <Text style={styles.modeText}>Fincan ve tabak görselleriyle klasik fal.</Text>
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
                        <Text style={styles.imageSlotLabel}>Fincan içi</Text>
                        <ImageUploader
                          hideLabel
                          label="Fincan içi"
                          imageUri={imageState.cup}
                          onImageSelected={(uri) => setImageState((prev) => ({ ...prev, cup: uri }))}
                        />
                      </View>
                      <View style={styles.imageSlot}>
                        <Text style={styles.imageSlotLabel}>Tabak</Text>
                        <ImageUploader
                          hideLabel
                          label="Fincan tabağı"
                          imageUri={imageState.saucer}
                          onImageSelected={(uri) => setImageState((prev) => ({ ...prev, saucer: uri }))}
                        />
                      </View>
                    </View>
                    <Text style={styles.creditWarning}>
                      Her yanlış yüklenen görsel kredi hesabına dahil edilir. Yanlış denemeler bir sonraki falın açılışına da not düşülür.
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
                  Yanlış türde yüklenen her görsel kredi hesabına dahil edilir. Doğru fal açıldığında bu deneme sayısı yeni fala taşınır.
                </Text>
              </>
            )}

            <TouchableOpacity style={styles.primaryButton} onPress={() => void startSession()}>
              <Text style={styles.primaryButtonText}>Falımı Başlat</Text>
            </TouchableOpacity>
          </View>
        </BrandedScrollView>
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
  scrollContent: { padding: 20, paddingBottom: 40 },
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
  modelRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  modelCard: {
    flex: 1,
    minHeight: 86,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.18)',
  },
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
  photosRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  imageSlot: { width: '47%', alignItems: 'center' },
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
