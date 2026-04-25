import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { APP_NAME, DEFAULT_DEV_SETTINGS } from '../config/constants';
import { DevControls } from '../components/DevControls';
import { loadAccountState } from '../services/profileMemoryService';
import { getTokenLedgerSnapshot, resetPendingLedgerOncePerLaunch } from '../services/tokenLedgerService';
import type { DevSettings } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const [profileCount, setProfileCount] = useState(0);
  const [devSettings, setDevSettings] = useState<DevSettings>(DEFAULT_DEV_SETTINGS);
  const [pendingInputTokens, setPendingInputTokens] = useState(0);
  const [pendingRejectedUploads, setPendingRejectedUploads] = useState(0);
  const [pendingMemoryAnalysisTokens, setPendingMemoryAnalysisTokens] = useState(0);

  const refresh = useCallback(async () => {
    await resetPendingLedgerOncePerLaunch();
    const [state, ledger] = await Promise.all([loadAccountState(), getTokenLedgerSnapshot()]);
    setProfileCount(state.profiles.length);
    setPendingInputTokens(ledger.pendingInputTokens || 0);
    setPendingRejectedUploads(ledger.pendingRejectedUploads || 0);
    setPendingMemoryAnalysisTokens(ledger.pendingMemoryAnalysisInputTokens || 0);
  }, []);

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
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{APP_NAME}</Text>
        <Text style={styles.subtitle}>Hoş geldin. Aşağıdaki bölümlerden devam edebilirsin.</Text>

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

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Ayarlar</Text>
          <Text style={styles.panelText}>
            Profilleri buradan oluşturabilirsiniz. Eski fallarınıza ve hafıza kayıtlarınıza buradan ulaşabilirsiniz.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('ProfileSettings')}>
            <Text style={styles.primaryButtonText}>Profil Ayarları ve Kayıtlar</Text>
          </TouchableOpacity>
          <Text style={styles.panelHint}>Mevcut profil sayısı: {profileCount}</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Genel Fallar</Text>
          <Text style={styles.panelText}>
            Genel astro günlük/haftalık/aylık okumalar, kısmet kurabiyesi, sihirli küre, günlük tarot, günlük melek kartı ve günün numerolojisi burada.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('GeneralReadings')}>
            <Text style={styles.primaryButtonText}>Genel Fallara Git</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Kişiye Özel</Text>
          <Text style={styles.panelText}>
            Profili üstten seçip aynı sayfada fal tipine geçersin. Sonrasında falcıyı seçip doğrudan fal okumayı başlatırsın.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('PersonalReadings', { devSettings })}
          >
            <Text style={styles.primaryButtonText}>Kişiye Özel Fallara Git</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Geliştirici Ayarları</Text>
          <DevControls settings={devSettings} onSettingsChange={setDevSettings} />
        </View>
      </ScrollView>
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
  panelText: { color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 20, marginBottom: 12 },
  panelHint: { color: 'rgba(255,255,255,0.58)', fontSize: 12, marginTop: 10 },
  primaryButton: {
    borderRadius: 14,
    backgroundColor: '#D4A574',
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#14141E', fontSize: 14, fontWeight: '800' },
});

