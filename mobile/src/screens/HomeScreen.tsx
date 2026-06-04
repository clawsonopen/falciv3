import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { APP_NAME, DEFAULT_DEV_SETTINGS } from '../config/constants';
import { DevControls } from '../components/DevControls';
import { BrandedScrollView } from '../components/BrandedScrollView';
import { loadAccountState } from '../services/profileMemoryService';
import {
  DEFAULT_USD_TRY_RATE,
  MODEL_TOKEN_PRICES_USD_PER_M,
  getModelTokenPrices,
  getTokenLedgerSnapshot,
  resetPendingLedgerOncePerLaunch,
  resetPersonalTokenUsage,
  type PersonalTokenUsageRow,
} from '../services/tokenLedgerService';
import type { DevSettings } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const [profileCount, setProfileCount] = useState(0);
  const [devSettings, setDevSettings] = useState<DevSettings>(DEFAULT_DEV_SETTINGS);
  const [pendingInputTokens, setPendingInputTokens] = useState(0);
  const [pendingRejectedUploads, setPendingRejectedUploads] = useState(0);
  const [pendingMemoryAnalysisTokens, setPendingMemoryAnalysisTokens] = useState(0);
  const [personalUsageRows, setPersonalUsageRows] = useState<PersonalTokenUsageRow[]>([]);
  const [usdTryRate, setUsdTryRate] = useState(DEFAULT_USD_TRY_RATE.toFixed(2));
  const [appliedUsdTryRate, setAppliedUsdTryRate] = useState(DEFAULT_USD_TRY_RATE);
  const [safetyK, setSafetyK] = useState('2.0');
  const [appliedSafetyK, setAppliedSafetyK] = useState(2);
  const [isTokenPanelExpanded, setIsTokenPanelExpanded] = useState(false);

  const refresh = useCallback(async () => {
    await resetPendingLedgerOncePerLaunch();
    const [state, ledger] = await Promise.all([loadAccountState(), getTokenLedgerSnapshot()]);
    setProfileCount(state.profiles.length);
    setPendingInputTokens(ledger.pendingInputTokens || 0);
    setPendingRejectedUploads(ledger.pendingRejectedUploads || 0);
    setPendingMemoryAnalysisTokens(ledger.pendingMemoryAnalysisInputTokens || 0);
    setPersonalUsageRows(ledger.personalUsageRows || []);
  }, []);

  const parsedUsdTryRate = Number(usdTryRate.replace(',', '.')) || DEFAULT_USD_TRY_RATE;
  const costUsd = useCallback((tokens: number, pricePerMillion: number) => (Math.max(0, tokens || 0) / 1_000_000) * pricePerMillion, []);
  const fmtTokens = useCallback((value: number) => Math.round(value || 0).toLocaleString('tr-TR'), []);
  const fmtUsd = useCallback((value: number) => `$${value.toFixed(6)}`, []);
  const fmtTry = useCallback((value: number) => `₺${value.toFixed(4)}`, []);
  const fmtDateTime = useCallback((value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);
  const sanitizeUsdTryRate = useCallback((value: string) => {
    const normalized = value.replace(',', '.').replace(/[^0-9.]/g, '');
    if (!normalized) return '';
    const [wholePart, ...decimalParts] = normalized.split('.');
    if (!decimalParts.length) return wholePart;
    return `${wholePart || '0'}.${decimalParts.join('').slice(0, 2)}`;
  }, []);
  const sanitizeSafetyK = useCallback((value: string) => {
    const normalized = value.replace(',', '.').replace(/[^0-9.]/g, '');
    if (!normalized) return '';
    const [wholePart, ...decimalParts] = normalized.split('.');
    if (!decimalParts.length) return wholePart;
    return `${wholePart || '0'}.${decimalParts.join('').slice(0, 1)}`;
  }, []);
  const usageTotals = React.useMemo(
    () =>
      personalUsageRows.reduce(
        (totals, row) => ({
          imageInputTokens: totals.imageInputTokens + row.imageInputTokens,
          textInputTokens: totals.textInputTokens + row.textInputTokens,
          outputTokens: totals.outputTokens + row.outputTokens,
          rawPromptTokens: totals.rawPromptTokens + row.rawPromptTokens,
          rawOutputTokens: totals.rawOutputTokens + row.rawOutputTokens,
          rawTotalTokens: totals.rawTotalTokens + row.rawTotalTokens,
        }),
        { imageInputTokens: 0, textInputTokens: 0, outputTokens: 0, rawPromptTokens: 0, rawOutputTokens: 0, rawTotalTokens: 0 },
      ),
    [personalUsageRows],
  );
  const resetTokenTable = useCallback(async () => {
    await resetPersonalTokenUsage();
    await refresh();
  }, [refresh]);
  const updateUsdTryRate = useCallback(() => {
    setAppliedUsdTryRate(parsedUsdTryRate);
  }, [parsedUsdTryRate]);
  const updateSafetyK = useCallback(() => {
    const parsed = Number(safetyK.replace(',', '.'));
    setAppliedSafetyK(Number.isFinite(parsed) && parsed >= 0 ? parsed : 2);
  }, [safetyK]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      void refresh();
    });
    return unsubscribe;
  }, [navigation, refresh]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <BrandedScrollView contentContainerStyle={styles.content} showScrollToTop>
        <Text style={styles.title}>{APP_NAME}</Text>
        <Text style={styles.subtitle}>Burası giriş lobin. Okuma, içgörü ve yaratım akışlarına buradan geçebilirsin.</Text>

        {(pendingInputTokens > 0 || pendingRejectedUploads > 0 || pendingMemoryAnalysisTokens > 0) && (
          <View style={styles.tokenCard}>
            <Text style={styles.tokenTitle}>Token / İşlem Özeti</Text>
            {pendingInputTokens > 0 ? (
              <Text style={styles.tokenText}>Bekleyen giriş tokenı: {pendingInputTokens}</Text>
            ) : null}
            {pendingRejectedUploads > 0 ? (
              <Text style={styles.tokenText}>Bekleyen yanlış görsel denemesi: {pendingRejectedUploads}</Text>
            ) : null}
            {pendingMemoryAnalysisTokens > 0 ? (
              <Text style={styles.tokenSubText}>Hafıza analizi için ayrılan tahmini token: {pendingMemoryAnalysisTokens}</Text>
            ) : null}
          </View>
        )}

        <View style={styles.lobbyGrid}>
          <TouchableOpacity style={styles.lobbyCard} activeOpacity={0.86} onPress={() => navigation.navigate('GeneralReadings')}>
            <Text style={styles.lobbyIcon}>☕</Text>
            <Text style={styles.lobbyTitle}>İkram Masası</Text>
            <Text style={styles.lobbyText}>Genel astro, kartlar, rune, I-Ching ve günlük küçük ritüeller.</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.lobbyCard}
            activeOpacity={0.86}
            onPress={() => navigation.navigate('PersonalReadings', { devSettings })}
          >
            <Text style={styles.lobbyIcon}>⌂</Text>
            <Text style={styles.lobbyTitle}>Senin Evin</Text>
            <Text style={styles.lobbyText}>Kahve, el / pati, tarot, astroloji, numeroloji ve rüya yorumları.</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.lobbyCard}
            activeOpacity={0.86}
            onPress={() => navigation.navigate('SimyaLab', { devSettings })}
          >
            <Text style={styles.lobbyIcon}>⚗</Text>
            <Text style={styles.lobbyTitle}>Simya Laboratuvarı</Text>
            <Text style={styles.lobbyText}>Manifest, kendi okumanı oluştur, baştan yarat ve combo yarat alanları.</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.lobbyCard}
            activeOpacity={0.86}
            onPress={() => navigation.navigate('SelfKnowledge', { devSettings })}
          >
            <Text style={styles.lobbyIcon}>◎</Text>
            <Text style={styles.lobbyTitle}>Kendini Tanı</Text>
            <Text style={styles.lobbyText}>Doğum haritası, temel numeroloji ve testler.</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.panel}>
          <TouchableOpacity
            style={styles.tokenHeaderRow}
            activeOpacity={0.78}
            onPress={() => setIsTokenPanelExpanded((current) => !current)}
          >
            <Text style={[styles.panelTitle, styles.collapsibleTitle]}>Genel Token Sayaçları</Text>
            <Text style={styles.expandButtonText}>{isTokenPanelExpanded ? 'Kapat' : 'Aç'}</Text>
          </TouchableOpacity>
          {isTokenPanelExpanded ? (
            <>
              <View style={styles.tokenActionRow}>
                <TouchableOpacity style={styles.resetButton} onPress={() => void resetTokenTable()}>
                  <Text style={styles.resetButtonText}>Sıfırla</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.panelText}>
                Model fiyatı Gemini 2.5 Flash Lite olarak uygulanır: giriş $
                {MODEL_TOKEN_PRICES_USD_PER_M['gemini-2.5-flash-lite'].inputPriceUsdPerM.toFixed(2)} / çıkış $
                {MODEL_TOKEN_PRICES_USD_PER_M['gemini-2.5-flash-lite'].outputPriceUsdPerM.toFixed(2)} / 1M token.
              </Text>
              <View style={styles.rateControls}>
                <View style={styles.rateRow}>
                  <Text style={styles.rateLabel}>USD/TRY</Text>
                  <TextInput
                    style={styles.rateInput}
                    value={usdTryRate}
                    onChangeText={(value) => setUsdTryRate(sanitizeUsdTryRate(value))}
                    keyboardType="decimal-pad"
                    placeholder="45.45"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                  />
                  <TouchableOpacity style={styles.rateUpdateButton} onPress={updateUsdTryRate}>
                    <Text style={styles.rateUpdateButtonText}>Güncelle</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.rateRow}>
                  <Text style={styles.rateLabel}>Safety K.</Text>
                  <TextInput
                    style={styles.safetyInput}
                    value={safetyK}
                    onChangeText={(value) => setSafetyK(sanitizeSafetyK(value))}
                    keyboardType="decimal-pad"
                    placeholder="2.0"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                  />
                  <TouchableOpacity style={styles.rateUpdateButton} onPress={updateSafetyK}>
                    <Text style={styles.rateUpdateButtonText}>K ile Güncelle</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator>
                <View style={styles.usageTable}>
                  <View style={[styles.usageRow, styles.usageHeader]}>
                    {[
                      'Tarih/Saat',
                      'Model',
                      'Okuma',
                      'Image Input',
                      'USD',
                      'TRY',
                      'Text Input',
                      'USD',
                      'TRY',
                      'Text Output',
                      'USD',
                      'TRY',
                      'Total Tokens',
                      'USD',
                      'TRY',
                      'Raw Prompt',
                      'Raw Output',
                      'Raw Total',
                    ].map((label, index) => (
                      <Text key={`${label}-${index}`} style={[styles.usageCell, styles.usageHeaderText]}>
                        {label}
                      </Text>
                    ))}
                  </View>
                  {personalUsageRows.length ? (
                    personalUsageRows.map((row) => {
                      const prices = getModelTokenPrices(row.modelName);
                      const imageUsd = costUsd(row.imageInputTokens, prices.inputPriceUsdPerM);
                      const textUsd = costUsd(row.textInputTokens, prices.inputPriceUsdPerM);
                      const outputUsd = costUsd(row.outputTokens, prices.outputPriceUsdPerM);
                      const totalTokens = row.imageInputTokens + row.textInputTokens + row.outputTokens;
                      const totalUsd = imageUsd + textUsd + outputUsd;
                      const values = [
                        fmtDateTime(row.createdAt),
                        row.modelName,
                        row.readingName,
                        fmtTokens(row.imageInputTokens),
                        fmtUsd(imageUsd),
                        fmtTry(imageUsd * appliedUsdTryRate),
                        fmtTokens(row.textInputTokens),
                        fmtUsd(textUsd),
                        fmtTry(textUsd * appliedUsdTryRate),
                        fmtTokens(row.outputTokens),
                        fmtUsd(outputUsd),
                        fmtTry(outputUsd * appliedUsdTryRate),
                        fmtTokens(totalTokens),
                        fmtUsd(totalUsd),
                        fmtTry(totalUsd * appliedUsdTryRate),
                        fmtTokens(row.rawPromptTokens),
                        fmtTokens(row.rawOutputTokens),
                        fmtTokens(row.rawTotalTokens),
                      ];
                      return (
                        <View key={row.key} style={styles.usageRow}>
                          {values.map((value, index) => (
                            <Text key={`${row.key}-${index}`} style={styles.usageCell}>
                              {value}
                            </Text>
                          ))}
                        </View>
                      );
                    })
                  ) : (
                    <View style={styles.usageRow}>
                      <Text style={[styles.usageCell, styles.emptyUsageCell]}>Henüz kişisel okuma token kaydı yok.</Text>
                    </View>
                  )}
                  {(() => {
                    const pricedTotals = personalUsageRows.reduce(
                      (totals, row) => {
                        const prices = getModelTokenPrices(row.modelName);
                        return {
                          imageUsd: totals.imageUsd + costUsd(row.imageInputTokens, prices.inputPriceUsdPerM),
                          textUsd: totals.textUsd + costUsd(row.textInputTokens, prices.inputPriceUsdPerM),
                          outputUsd: totals.outputUsd + costUsd(row.outputTokens, prices.outputPriceUsdPerM),
                        };
                      },
                      { imageUsd: 0, textUsd: 0, outputUsd: 0 },
                    );
                    const imageUsd = pricedTotals.imageUsd;
                    const textUsd = pricedTotals.textUsd;
                    const outputUsd = pricedTotals.outputUsd;
                    const totalTokens = usageTotals.imageInputTokens + usageTotals.textInputTokens + usageTotals.outputTokens;
                    const totalUsd = imageUsd + textUsd + outputUsd;
                    const values = [
                      'Toplam',
                      '',
                      '',
                      fmtTokens(usageTotals.imageInputTokens),
                      fmtUsd(imageUsd),
                      fmtTry(imageUsd * appliedUsdTryRate),
                      fmtTokens(usageTotals.textInputTokens),
                      fmtUsd(textUsd),
                      fmtTry(textUsd * appliedUsdTryRate),
                      fmtTokens(usageTotals.outputTokens),
                      fmtUsd(outputUsd),
                      fmtTry(outputUsd * appliedUsdTryRate),
                      fmtTokens(totalTokens),
                      fmtUsd(totalUsd),
                      fmtTry(totalUsd * appliedUsdTryRate),
                      fmtTokens(usageTotals.rawPromptTokens),
                      fmtTokens(usageTotals.rawOutputTokens),
                      fmtTokens(usageTotals.rawTotalTokens),
                    ];
                    return (
                      <View style={[styles.usageRow, styles.usageTotalRow]}>
                        {values.map((value, index) => (
                          <Text key={`usage-total-${index}`} style={[styles.usageCell, styles.usageTotalCell]}>
                            {value}
                          </Text>
                        ))}
                      </View>
                    );
                  })()}
                  {(() => {
                    const pricedTotals = personalUsageRows.reduce(
                      (totals, row) => {
                        const prices = getModelTokenPrices(row.modelName);
                        return {
                          imageUsd: totals.imageUsd + costUsd(row.imageInputTokens, prices.inputPriceUsdPerM),
                          textUsd: totals.textUsd + costUsd(row.textInputTokens, prices.inputPriceUsdPerM),
                          outputUsd: totals.outputUsd + costUsd(row.outputTokens, prices.outputPriceUsdPerM),
                        };
                      },
                      { imageUsd: 0, textUsd: 0, outputUsd: 0 },
                    );
                    const imageUsd = pricedTotals.imageUsd * appliedSafetyK;
                    const textUsd = pricedTotals.textUsd * appliedSafetyK;
                    const outputUsd = pricedTotals.outputUsd * appliedSafetyK;
                    const totalTokens = usageTotals.imageInputTokens + usageTotals.textInputTokens + usageTotals.outputTokens;
                    const totalUsd = imageUsd + textUsd + outputUsd;
                    const values = [
                      'Simüle Toplam',
                      `K x ${appliedSafetyK.toFixed(1)}`,
                      '',
                      fmtTokens(usageTotals.imageInputTokens),
                      fmtUsd(imageUsd),
                      fmtTry(imageUsd * appliedUsdTryRate),
                      fmtTokens(usageTotals.textInputTokens),
                      fmtUsd(textUsd),
                      fmtTry(textUsd * appliedUsdTryRate),
                      fmtTokens(usageTotals.outputTokens),
                      fmtUsd(outputUsd),
                      fmtTry(outputUsd * appliedUsdTryRate),
                      fmtTokens(totalTokens),
                      fmtUsd(totalUsd),
                      fmtTry(totalUsd * appliedUsdTryRate),
                      fmtTokens(usageTotals.rawPromptTokens),
                      fmtTokens(usageTotals.rawOutputTokens),
                      fmtTokens(usageTotals.rawTotalTokens),
                    ];
                    return (
                      <View style={[styles.usageRow, styles.usageSafetyRow]}>
                        {values.map((value, index) => (
                          <Text key={`usage-safety-${index}`} style={[styles.usageCell, styles.usageSafetyCell]}>
                            {value}
                          </Text>
                        ))}
                      </View>
                    );
                  })()}
                </View>
              </ScrollView>
            </>
          ) : null}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Geliştirici Ayarları</Text>
          <DevControls settings={devSettings} onSettingsChange={setDevSettings} />
        </View>
      </BrandedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#14141E' },
  content: { padding: 20, paddingBottom: 36 },
  title: { fontSize: 26, fontWeight: '700', color: '#D4A574', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: 'rgba(212,165,116,0.72)', textAlign: 'center', marginBottom: 20 },
  tokenCard: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(212,165,116,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.28)',
  },
  tokenTitle: { color: '#F6C38B', fontSize: 13, fontWeight: '700', marginBottom: 6 },
  tokenText: { color: '#F6C38B', fontSize: 12, lineHeight: 18 },
  tokenSubText: { color: 'rgba(255,255,255,0.68)', fontSize: 11, lineHeight: 16, marginTop: 4 },
  panel: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(30, 30, 40, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(168, 130, 82, 0.18)',
  },
  panelTitle: { color: '#E8C49A', fontSize: 16, fontWeight: '700', marginBottom: 10 },
  collapsibleTitle: { marginBottom: 0 },
  panelText: { color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 20, marginBottom: 12 },
  panelHint: { color: 'rgba(255,255,255,0.58)', fontSize: 12, marginTop: 10 },
  lobbyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  lobbyCard: {
    width: '48.5%',
    minHeight: 164,
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(30, 30, 40, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(168, 130, 82, 0.2)',
    justifyContent: 'space-between',
  },
  lobbyIcon: { color: '#D4A574', fontSize: 25, fontWeight: '900', lineHeight: 30 },
  lobbyTitle: { color: '#FFF5E8', fontSize: 16, fontWeight: '900', lineHeight: 20, marginTop: 10 },
  lobbyText: { color: 'rgba(212,165,116,0.76)', fontSize: 12, lineHeight: 18, marginTop: 8 },
  tokenHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  tokenActionRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, marginBottom: 10 },
  expandButtonText: { color: '#F6C38B', fontSize: 12, fontWeight: '900' },
  resetButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,107,107,0.1)',
  },
  resetButtonText: { color: '#FFB3B3', fontSize: 12, fontWeight: '800' },
  rateControls: { gap: 8, marginBottom: 12 },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rateLabel: { color: '#E8C49A', fontSize: 12, fontWeight: '800', width: 72 },
  rateInput: {
    minWidth: 96,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.34)',
    backgroundColor: 'rgba(0,0,0,0.18)',
    color: '#FFF5E8',
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  safetyInput: {
    width: 72,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.34)',
    backgroundColor: 'rgba(0,0,0,0.18)',
    color: '#FFF5E8',
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  rateUpdateButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.48)',
    backgroundColor: 'rgba(212,165,116,0.14)',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  rateUpdateButtonText: { color: '#F6C38B', fontSize: 12, fontWeight: '800' },
  usageTable: { borderWidth: 1, borderColor: 'rgba(168,130,82,0.22)', borderRadius: 10, overflow: 'hidden' },
  usageRow: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.12)' },
  usageHeader: { backgroundColor: 'rgba(212,165,116,0.14)' },
  usageTotalRow: { backgroundColor: 'rgba(212,165,116,0.18)' },
  usageSafetyRow: { backgroundColor: 'rgba(125,220,154,0.14)' },
  usageCell: {
    width: 106,
    minHeight: 38,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(168,130,82,0.18)',
    color: '#FFF5E8',
    fontSize: 11,
    paddingHorizontal: 7,
    paddingVertical: 8,
    fontVariant: ['tabular-nums'],
  },
  usageHeaderText: { color: '#E8C49A', fontWeight: '800' },
  usageTotalCell: { color: '#F6C38B', fontWeight: '900' },
  usageSafetyCell: { color: '#BFF2D0', fontWeight: '900' },
  emptyUsageCell: { width: 320, color: 'rgba(255,255,255,0.62)' },
  primaryButton: {
    borderRadius: 14,
    backgroundColor: '#D4A574',
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#14141E', fontSize: 14, fontWeight: '800' },
});
