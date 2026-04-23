import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { DEFAULT_DEV_SETTINGS } from '../config/constants';

type Props = NativeStackScreenProps<RootStackParamList, 'PersonalReadings'>;

export function PersonalReadingsScreen({ navigation, route }: Props) {
  const devSettings = route.params?.devSettings || DEFAULT_DEV_SETTINGS;

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.panel}>
          <Text style={styles.title}>1. Kim İçin Baktıracaksın?</Text>
          <Text style={styles.text}>
            Kişiye özel akış adım adım ilerler. İlk adımda profil seçimine geçeceğiz.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('PersonalProfileSelect', { devSettings })}
          >
            <Text style={styles.primaryButtonText}>Profil Seçim Ekranına Git</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#14141E' },
  content: { flex: 1, padding: 18, justifyContent: 'center' },
  panel: {
    borderRadius: 18,
    padding: 18,
    backgroundColor: 'rgba(30, 30, 40, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.18)',
  },
  title: { color: '#E8C49A', fontSize: 19, fontWeight: '700', marginBottom: 10 },
  text: { color: 'rgba(255,255,255,0.78)', fontSize: 14, lineHeight: 22, marginBottom: 16 },
  primaryButton: {
    borderRadius: 14,
    backgroundColor: '#D4A574',
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#14141E', fontSize: 14, fontWeight: '800' },
});

