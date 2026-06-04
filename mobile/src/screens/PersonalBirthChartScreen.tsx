import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, G, Line, Text as SvgText } from 'react-native-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { createBirthChartSnapshot, formatTimezoneForDisplay, hasRequiredAstroBirthInputs, type BirthChartSnapshot } from '../services/astroEngine';
import { appendReadingSummary, appendSelfKnowledgeProfileInsight, loadAccountState } from '../services/profileMemoryService';
import { BrandedConfirmModal } from '../components/BrandedConfirmModal';
import { BrandedScrollView } from '../components/BrandedScrollView';
import { birthChartProfileFingerprint, loadBirthChartInterpretationSession } from '../services/birthChartInterpretationStore';

type Props = NativeStackScreenProps<RootStackParamList, 'PersonalBirthChart'>;

export function PersonalBirthChartScreen({ route, navigation }: Props) {
  const { profileId } = route.params;
  const insets = useSafeAreaInsets();
  const [state, setState] = React.useState<{
    loading: boolean;
    title: string;
    lines: string[];
    chart: BirthChartSnapshot | null;
    interpretationExists: boolean;
    modal: { visible: boolean; title: string; message: string };
  }>({
    loading: true,
    title: '',
    lines: [],
    chart: null,
    interpretationExists: false,
    modal: { visible: false, title: '', message: '' },
  });

  const openProfileSettings = React.useCallback(() => {
    navigation.navigate('ProfileSettings', { profileId });
  }, [navigation, profileId]);

  const openInterpretation = React.useCallback(async () => {
    const account = await loadAccountState();
    const profile = account.profiles.find((p) => p.profileId === profileId) || null;
    if (!profile || !hasRequiredAstroBirthInputs(profile)) {
      setState((prev) => ({
        ...prev,
        modal: {
          visible: true,
          title: 'Profil Bilgisi Gerekli',
          message:
            'Doğum haritanı yorumlamadan önce doğum tarihi, ülke ve şehir bilgilerini tamamlamalısın. Doğum saati yoksa yükselen ve evler net okunamaz.',
        },
      }));
      return;
    }
    navigation.navigate('BirthChartInterpretation', { profileId });
  }, [navigation, profileId]);

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
                message: 'Doğum haritası için doğum tarihi, doğum ülkesi ve doğum şehri bilgilerini tamamlamalısın. Doğum saati varsa yükselen ve evler de netleşir.',
              },
            }));
          }
          return;
        }

        const chart = await createBirthChartSnapshot(profile);
        const interpretation = await loadBirthChartInterpretationSession(profileId, birthChartProfileFingerprint(profile));
        const lines = [
          `Güneş Burcu: ${chart.sign}`,
          `Yükselen: ${chart.ascendant || 'Doğum saati gerekli'}`,
          chart.dominantHouse ? `Baskın Ev: ${chart.dominantHouse}. ev` : 'Baskın Ev: Doğum saati gerekli',
          `Zaman dilimi: ${formatTimezoneForDisplay(chart.timezoneUsed)}`,
          '',
          'Gezegen Konumları:',
          ...chart.planets.map((p) => {
            const houseText = p.house ? `, ${p.house}. ev` : ', ev için doğum saati gerekli';
            return `${p.name}: ${p.sign} ${p.degree.toFixed(1)}°${houseText}${p.retrograde ? ' (R)' : ''}`;
          }),
          ...(chart.points?.length
            ? [
                '',
                'Ek Noktalar:',
                ...chart.points.map((p) => {
                  const houseText = p.house ? `, ${p.house}. ev` : ', ev için doğum saati gerekli';
                  return `${p.name}: ${p.sign} ${p.degree.toFixed(1)}°${houseText}`;
                }),
              ]
            : []),
          '',
          'Ana Açılar:',
          ...(chart.aspects.length
            ? chart.aspects.map((a) => `${a.planetA} - ${a.planetB}: ${a.type} (${a.orb.toFixed(1)}° orb)`)
            : ['Belirgin ana açı bulunamadı.']),
          '',
          'Transit ve Gökyüzü Notları:',
          ...chart.transitNotes.map((note) => `- ${note}`),
        ];
        if (!chart.cached) {
          const nextState = await appendReadingSummary({
            profileId,
            assistantId: 'selin',
            readingType: 'birth-chart',
            surfacesRead: [],
            summary: lines.filter(Boolean).slice(0, 14).join('\n'),
            transcript: [{ role: 'assistant', text: lines.filter(Boolean).join('\n'), timestamp: Date.now() }],
          });
          await appendSelfKnowledgeProfileInsight({
            profileId,
            readingId: nextState.readings[0]?.readingId || `birth-chart-${profileId}`,
            source: 'birth-chart',
            title: `Doğum haritası: ${chart.sign}${chart.ascendant ? `, yükselen ${chart.ascendant}` : ''}`,
            summary: lines.filter(Boolean).slice(0, 14).join('\n'),
            detailGroup: 'doğum haritası',
            confidence: 0.56,
          });
        }

        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            loading: false,
            title: `${profile.displayName} - Doğum Haritası`,
            lines,
            chart,
            interpretationExists: Boolean(interpretation),
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <BrandedScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]} showScrollToTop>
        <View style={styles.panel}>
          <Text style={styles.title}>{state.title || 'Doğum Haritası'}</Text>
          <BirthChartWheel chart={state.chart} />
          <TouchableOpacity
            style={[styles.interpretButton, state.loading && styles.interpretButtonDisabled]}
            onPress={() => void openInterpretation()}
            disabled={state.loading}
          >
            <Text style={styles.interpretButtonText}>{state.interpretationExists ? 'Yorum Hakkında Soru Sor' : 'Yorumla'}</Text>
          </TouchableOpacity>
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
      </BrandedScrollView>

      <BrandedConfirmModal
        visible={state.modal.visible}
        title={state.modal.title}
        message={state.modal.message}
        confirmLabel="Tamam"
        cancelLabel="Kapat"
        onConfirm={() => setState((prev) => ({ ...prev, modal: { visible: false, title: '', message: '' } }))}
        onCancel={() => setState((prev) => ({ ...prev, modal: { visible: false, title: '', message: '' } }))}
        extraActionLabel={state.modal.title === 'Profil Bilgisi Gerekli' ? 'Profil Ayarlarına Git' : null}
        onExtraAction={state.modal.title === 'Profil Bilgisi Gerekli' ? openProfileSettings : undefined}
      />
    </SafeAreaView>
  );
}

const SIGN_LABELS = ['Koç', 'Boğa', 'İkizler', 'Yengeç', 'Aslan', 'Başak', 'Terazi', 'Akrep', 'Yay', 'Oğlak', 'Kova', 'Balık'];
const PLANET_SYMBOLS: Record<string, string> = {
  Güneş: '☉',
  Ay: '☽',
  Merkür: '☿',
  Venüs: '♀',
  Mars: '♂',
  Jüpiter: '♃',
  Satürn: '♄',
  Uranüs: '♅',
  Neptün: '♆',
  Plüton: '♇',
  'Kuzey Ay Düğümü': '☊',
  'Güney Ay Düğümü': '☋',
  Lilith: '⚸',
};

function point(cx: number, cy: number, radius: number, longitude: number) {
  const angle = ((longitude - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
}

function BirthChartWheel({ chart }: { chart: BirthChartSnapshot | null }) {
  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const outer = 126;
  const signRadius = 111;
  const planetRadius = 82;

  return (
    <View style={styles.wheel}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={cx} cy={cy} r={outer} stroke="rgba(212,165,116,0.58)" strokeWidth={1.4} fill="rgba(0,0,0,0.16)" />
        <Circle cx={cx} cy={cy} r={96} stroke="rgba(255,255,255,0.16)" strokeWidth={1} fill="none" />
        <Circle cx={cx} cy={cy} r={58} stroke="rgba(212,165,116,0.24)" strokeWidth={1} fill="none" />
        {SIGN_LABELS.map((label, index) => {
          const line = point(cx, cy, outer, index * 30);
          const text = point(cx, cy, signRadius, index * 30 + 15);
          return (
            <G key={label}>
              <Line x1={cx} y1={cy} x2={line.x} y2={line.y} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
              <SvgText x={text.x} y={text.y} fill="#E8C49A" fontSize="9" fontWeight="700" textAnchor="middle">
                {label}
              </SvgText>
            </G>
          );
        })}
        {[...(chart?.planets || []), ...(chart?.points || [])].map((planet, index) => {
          const offset = (index % 3) * 8;
          const pos = point(cx, cy, planetRadius - offset, planet.longitude);
          const lineStart = point(cx, cy, 60, planet.longitude);
          const symbol = PLANET_SYMBOLS[planet.name] || planet.name.slice(0, 2);
          return (
            <G key={`${planet.name}-${index}`}>
              <Line x1={lineStart.x} y1={lineStart.y} x2={pos.x} y2={pos.y} stroke="rgba(246,195,139,0.34)" strokeWidth={1} />
              <Circle cx={pos.x} cy={pos.y} r={11} fill="rgba(20,20,30,0.94)" stroke="#D4A574" strokeWidth={1} />
              <SvgText x={pos.x} y={pos.y + 4} fill="#FFF5E8" fontSize="12" fontWeight="700" textAnchor="middle">
                {symbol}
              </SvgText>
            </G>
          );
        })}
        {!chart?.ascendant ? (
          <SvgText x={cx} y={cy + 4} fill="rgba(255,255,255,0.62)" fontSize="10" textAnchor="middle">
            Evler için doğum saati gerekli
          </SvgText>
        ) : (
          <SvgText x={cx} y={cy + 4} fill="#F6C38B" fontSize="11" fontWeight="700" textAnchor="middle">
            ASC {chart.ascendant}
          </SvgText>
        )}
      </Svg>
    </View>
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
  interpretButton: {
    borderRadius: 12,
    backgroundColor: '#D4A574',
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  interpretButtonDisabled: { opacity: 0.55 },
  interpretButtonText: { color: '#14141E', fontSize: 13, fontWeight: '800' },
  text: { color: '#FFF5E8', fontSize: 13, lineHeight: 20, marginBottom: 2 },
  bullet: { color: '#F6C38B', fontSize: 13, lineHeight: 20, marginBottom: 2 },
  wheel: {
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
