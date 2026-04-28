import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { createBirthChartSnapshot, hasRequiredAstroBirthInputs } from '../services/astroEngine';
import { loadAccountState } from '../services/profileMemoryService';
import { BrandedConfirmModal } from '../components/BrandedConfirmModal';

type Props = NativeStackScreenProps<RootStackParamList, 'PersonalBirthChart'>;

export function PersonalBirthChartScreen({ route }: Props) {
  const { profileId } = route.params;
  const insets = useSafeAreaInsets();
  const [state, setState] = React.useState<{
    loading: boolean;
    title: string;
    lines: string[];
    modal: { visible: boolean; title: string; message: string };
  }>({
    loading: true,
    title: '',
    lines: [],
    modal: { visible: false, title: '', message: '' },
  });

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const account = await loadAccountState();
        const profile = account.profiles.find((p) => p.profileId === profileId) || null;
        if (!profile) {
          if (!cancelled) {
            setState((prev) => ({
              ...prev,
              loading: false,
              modal: { visible: true, title: 'Hata', message: 'Profil bulunamadı.' },
            }));
          }
          return;
        }

        if (!hasRequiredAstroBirthInputs(profile)) {
          if (!cancelled) {
            setState((prev) => ({
              ...prev,
              loading: false,
              modal: {
                visible: true,
                title: 'Profil Bilgisi Gerekli',
                message: 'Doğum haritası için doğum tarihi + doğum ülkesi + doğum şehri bilgilerini tamamlamalısın.',
              },
            }));
          }
          return;
        }

        const chart = createBirthChartSnapshot(profile);
        const lines = [
          `Güneş Burcu: ${chart.sign}`,
          `Yükselen: ${chart.ascendant}`,
          `Baskın Ev: ${chart.dominantHouse}. ev`,
          '',
          'Gezegen Konumları:',
          ...chart.planets.map((p) => `${p.name}: ${p.sign} ${p.degree}°${p.retrograde ? ' (R)' : ''}`),
          '',
          'Transit ve Gökyüzü Notları:',
          ...chart.transitNotes.map((note) => `- ${note}`),
        ];

        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            loading: false,
            title: `${profile.displayName} - Doğum Haritası`,
            lines,
          }));
        }
      } catch (err: any) {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            loading: false,
            modal: { visible: true, title: 'Hata', message: err?.message || 'Doğum haritası üretilemedi.' },
          }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  const wheelLabels = useMemo(
    () => ['Koç', 'Boğa', 'İkizler', 'Yengeç', 'Aslan', 'Başak', 'Terazi', 'Akrep', 'Yay', 'Oğlak', 'Kova', 'Balık'],
    [],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}>
        <View style={styles.panel}>
          <Text style={styles.title}>{state.title || 'Doğum Haritası'}</Text>
          <View style={styles.wheel}>
            {wheelLabels.map((label, index) => (
              <Text
                key={label}
                style={[
                  styles.wheelLabel,
                  {
                    transform: [
                      { rotate: `${index * 30}deg` },
                      { translateY: -98 },
                      { rotate: `${-index * 30}deg` },
                    ],
                  },
                ]}
              >
                {label}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.panel}>
          {state.loading ? (
            <Text style={styles.text}>Hazırlanıyor...</Text>
          ) : (
            state.lines.map((line, idx) => (
              <Text key={`${idx}-${line}`} style={line.startsWith('- ') ? styles.bullet : styles.text}>
                {line}
              </Text>
            ))
          )}
        </View>
      </ScrollView>

      <BrandedConfirmModal
        visible={state.modal.visible}
        title={state.modal.title}
        message={state.modal.message}
        confirmLabel="Tamam"
        cancelLabel="Kapat"
        onConfirm={() => setState((prev) => ({ ...prev, modal: { visible: false, title: '', message: '' } }))}
        onCancel={() => setState((prev) => ({ ...prev, modal: { visible: false, title: '', message: '' } }))}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#14141E' },
  content: { padding: 16 },
  panel: {
    marginBottom: 12,
    borderRadius: 16,
    padding: 14,
    backgroundColor: 'rgba(30,30,40,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.18)',
  },
  title: { color: '#E8C49A', fontSize: 16, fontWeight: '700', marginBottom: 10, textAlign: 'center' },
  text: { color: '#FFF5E8', fontSize: 13, lineHeight: 20, marginBottom: 2 },
  bullet: { color: '#F6C38B', fontSize: 13, lineHeight: 20, marginBottom: 2 },
  wheel: {
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 120,
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.4)',
    backgroundColor: 'rgba(0,0,0,0.18)',
    overflow: 'hidden',
  },
  wheelLabel: {
    position: 'absolute',
    color: '#E8C49A',
    fontSize: 11,
    fontWeight: '700',
  },
});
