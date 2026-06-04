// ============================================================
// FALCI - App.tsx (Entry Point)
// ============================================================

import React, { useCallback, useEffect } from 'react';
import { BackHandler, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { HomeScreen } from './src/screens/HomeScreen';
import { SessionScreen } from './src/screens/SessionScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { MemoryDebugScreen } from './src/screens/MemoryDebugScreen';
import { ReadingDetailScreen } from './src/screens/ReadingDetailScreen';
import { GeneralReadingsScreen } from './src/screens/GeneralReadingsScreen';
import { GeneralReadingResultScreen } from './src/screens/GeneralReadingResultScreen';
import { PersonalReadingsScreen } from './src/screens/PersonalReadingsScreen';
import { SelfKnowledgeScreen } from './src/screens/SelfKnowledgeScreen';
import { SimyaLabScreen } from './src/screens/SimyaLabScreen';
import { ProfileSettingsScreen } from './src/screens/ProfileSettingsScreen';
import { PersonalProfileSelectScreen } from './src/screens/PersonalProfileSelectScreen';
import { PersonalReadingTypeSelectScreen } from './src/screens/PersonalReadingTypeSelectScreen';
import { PersonalAssistantSelectScreen } from './src/screens/PersonalAssistantSelectScreen';
import { PersonalReadingSetupScreen } from './src/screens/PersonalReadingSetupScreen';
import { PersonalAstroReadingScreen } from './src/screens/PersonalAstroReadingScreen';
import { PersonalBirthChartScreen } from './src/screens/PersonalBirthChartScreen';
import { BirthChartInterpretationScreen } from './src/screens/BirthChartInterpretationScreen';
import { DreamInterpretationScreen } from './src/screens/DreamInterpretationScreen';
import { PersonalNumerologyReadingScreen } from './src/screens/PersonalNumerologyReadingScreen';
import { TarotSpreadSelectScreen } from './src/screens/TarotSpreadSelectScreen';
import { TarotReadingScreen } from './src/screens/TarotReadingScreen';
import { MbtiTestScreen } from './src/screens/MbtiTestScreen';
import { AstroRelationshipReadingScreen } from './src/screens/AstroRelationshipReadingScreen';
import { SunCompatibilityScreen } from './src/screens/SunCompatibilityScreen';
import { DaisyFortuneScreen } from './src/screens/DaisyFortuneScreen';
import { APP_NAME } from './src/config/constants';
import type { TarotDeckId } from './src/data/tarotImageMap';
import type { DevSettings, SessionConfig } from './src/types';
import type { GeneralDivinationType } from './src/services/divinationEngine';
import type { ReadingSummary } from './src/types/memory';

export type RootStackParamList = {
  Home: { freshStartToken?: number } | undefined;
  ProfileSettings: { profileId?: string } | undefined;
  GeneralReadings: undefined;
  SelfKnowledge: { devSettings: DevSettings } | undefined;
  SimyaLab: { devSettings: DevSettings } | undefined;
  GeneralReadingResult: {
    profileId: string;
    readingId: GeneralDivinationType | 'astro-daily' | 'astro-weekly' | 'astro-monthly';
    title: string;
  };
  SunCompatibility: undefined;
  DaisyFortune: undefined;
  PersonalReadings: { devSettings: DevSettings } | undefined;
  PersonalProfileSelect: { devSettings: DevSettings };
  PersonalReadingTypeSelect: { devSettings: DevSettings; profileId: string };
  PersonalAssistantSelect: {
    devSettings: DevSettings;
    profileId: string;
    readingType:
      | 'coffee'
      | 'palm'
      | 'astro-personal'
      | 'tarot-personal'
      | 'numerology-personal'
      | 'numerology-core'
      | 'numerology-period'
      | 'angel-personal'
      | 'manifest-chat'
      | 'dream-interpretation';
  };
  PersonalReadingSetup:
    | {
        freshStartToken?: number;
        preselectedProfileId?: string;
        preselectedReadingType?: 'coffee' | 'palm';
        preselectedAssistantId?: string;
        preselectedDevSettings?: DevSettings;
      }
    | undefined;
  PersonalAstroReading: {
    profileId: string;
    assistantId: string;
    iqLevel?: 'free' | 'pro' | 'premium';
    localGemmaModelId?: 'gemma-4-e2b-it';
  };
  AstroRelationshipReading: {
    profileId: string;
    assistantId: string;
    mode: 'compatibility' | 'family';
  };
  PersonalBirthChart: {
    profileId: string;
  };
  BirthChartInterpretation: {
    profileId: string;
  };
  DreamInterpretation: {
    profileId: string;
    assistantId: string;
  };
  TarotSpreadSelect: {
    profileId: string;
    assistantId: string;
  };
  TarotReading: {
    profileId: string;
    assistantId: string;
    spreadId: string;
    deckId?: TarotDeckId;
  };
  PersonalNumerologyReading: {
    profileId: string;
    assistantId: string;
    initialMode?: 'core' | 'daily' | 'weekly' | 'monthly';
  };
  MbtiTest: {
    profileId: string;
    testId?: 'mbti' | 'compatibility' | 'big-five' | 'attachment' | 'values' | 'coping-style';
  };
  Session: { config: SessionConfig };
  History: { profileId: string; profileName: string };
  MemoryDebug: { profileId: string; profileName: string };
  ReadingDetail: { reading: ReadingSummary; profileName: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Deneme bayrağı: beğenilmezse false yapıp eski sistem bara dönebiliriz.
const ENABLE_ANDROID_IMMERSIVE_NAVIGATION = true;

function useAndroidImmersiveNavigation() {
  const applyNavigationMode = useCallback(async () => {
    if (Platform.OS !== 'android' || !ENABLE_ANDROID_IMMERSIVE_NAVIGATION) {
      return;
    }

    try {
      const NavigationBar = await import('expo-navigation-bar');

      // Edge-to-edge modda arka plan rengi ve davranış ayarları desteklenmiyor.
      await NavigationBar.setButtonStyleAsync('light');
      await NavigationBar.setVisibilityAsync('hidden');
    } catch {
      // Native modül dev build'e eklenmemişse uygulama açılmaya devam etsin.
    }
  }, []);

  useEffect(() => {
    void applyNavigationMode();
  }, [applyNavigationMode]);
}

export default function App() {
  useAndroidImmersiveNavigation();

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={({ navigation, route }) => ({
            headerStyle: { backgroundColor: '#1E1E28' },
            headerTintColor: '#D4A574',
            headerTitleStyle: { fontWeight: '600' },
            contentStyle: { backgroundColor: '#14141E' },
            headerRight: () => (
              <View style={styles.headerActions}>
                {route.name === 'Home' ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Ayarlar"
                    activeOpacity={0.82}
                    style={styles.gearButton}
                    onPress={() => navigation.navigate('ProfileSettings')}
                  >
                    <Text style={styles.gearButtonText}>⚙</Text>
                    <Text style={styles.gearButtonLabel}>Profil Ayarları</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Çıkış"
                  activeOpacity={0.82}
                  style={styles.exitButton}
                  onPress={() => {
                    if (route.name === 'Home' && Platform.OS === 'android') {
                      BackHandler.exitApp();
                      return;
                    }

                    if (route.name !== 'Home') {
                      navigation.reset({
                        index: 0,
                        routes: [{ name: 'Home' }],
                      });
                    }
                  }}
                >
                  <Text style={styles.exitButtonText}>Çıkış</Text>
                </TouchableOpacity>
              </View>
            ),
          })}
        >
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: APP_NAME }} />
          <Stack.Screen name="ProfileSettings" component={ProfileSettingsScreen} options={{ title: 'Profil Ayarları' }} />
          <Stack.Screen name="GeneralReadings" component={GeneralReadingsScreen} options={{ title: 'İkram Masası' }} />
          <Stack.Screen name="GeneralReadingResult" component={GeneralReadingResultScreen} options={{ title: 'Genel Okuma' }} />
          <Stack.Screen name="SunCompatibility" component={SunCompatibilityScreen} options={{ title: 'Genel Burç Uyumu' }} />
          <Stack.Screen name="DaisyFortune" component={DaisyFortuneScreen} options={{ title: 'Papatya Ritüeli' }} />
          <Stack.Screen name="PersonalReadings" component={PersonalReadingsScreen} options={{ title: 'Senin Evin' }} />
          <Stack.Screen name="SelfKnowledge" component={SelfKnowledgeScreen} options={{ title: 'Kendini Tanı' }} />
          <Stack.Screen name="SimyaLab" component={SimyaLabScreen} options={{ title: 'Simya Laboratuvarı' }} />
          <Stack.Screen
            name="PersonalProfileSelect"
            component={PersonalProfileSelectScreen}
            options={{ title: 'Profil Seçimi' }}
          />
          <Stack.Screen
            name="PersonalReadingTypeSelect"
            component={PersonalReadingTypeSelectScreen}
            options={{ title: 'Okuma Tipi Seçimi' }}
          />
          <Stack.Screen
            name="PersonalAssistantSelect"
            component={PersonalAssistantSelectScreen}
            options={{ title: 'Yorumcu Seçimi' }}
          />
          <Stack.Screen
            name="PersonalReadingSetup"
            component={PersonalReadingSetupScreen}
            options={{ title: 'Profil Ayarları ve Okuma Akışı' }}
          />
          <Stack.Screen
            name="PersonalAstroReading"
            component={PersonalAstroReadingScreen}
            options={{ title: 'Kişiye Özel Astroloji' }}
          />
          <Stack.Screen
            name="AstroRelationshipReading"
            component={AstroRelationshipReadingScreen}
            options={{ title: 'Çoklu Astroloji' }}
          />
          <Stack.Screen
            name="PersonalBirthChart"
            component={PersonalBirthChartScreen}
            options={{ title: 'Doğum Haritası' }}
          />
          <Stack.Screen
            name="BirthChartInterpretation"
            component={BirthChartInterpretationScreen}
            options={{ title: 'Doğum Haritası Yorumu' }}
          />
          <Stack.Screen
            name="DreamInterpretation"
            component={DreamInterpretationScreen}
            options={{ title: 'Rüya Yorumu' }}
          />
          <Stack.Screen
            name="TarotSpreadSelect"
            component={TarotSpreadSelectScreen}
            options={{ title: 'Tarot Açılımı' }}
          />
          <Stack.Screen
            name="TarotReading"
            component={TarotReadingScreen}
            options={{ title: 'Tarot Yorumu' }}
          />
          <Stack.Screen
            name="PersonalNumerologyReading"
            component={PersonalNumerologyReadingScreen}
            options={{ title: 'Kişiye Özel Numeroloji' }}
          />
          <Stack.Screen
            name="MbtiTest"
            component={MbtiTestScreen}
            options={({ route }) => {
              const titles = {
                mbti: 'MBTI Kişilik Testi',
                compatibility: 'Uyumluluk Testi',
                'big-five': 'Beş Faktör Testi',
                attachment: 'Bağlanma Stili Testi',
                values: 'Değerler Pusulası',
                'coping-style': 'Stresle Başa Çıkma Testi',
              };
              return { title: titles[route.params.testId || 'mbti'] };
            }}
          />
          <Stack.Screen
            name="Session"
            component={SessionScreen}
            options={{ title: APP_NAME, headerBackVisible: false }}
          />
          <Stack.Screen name="History" component={HistoryScreen} options={{ title: 'Son Okumalar' }} />
          <Stack.Screen name="MemoryDebug" component={MemoryDebugScreen} options={{ title: 'Hafıza' }} />
          <Stack.Screen name="ReadingDetail" component={ReadingDetailScreen} options={{ title: 'Okuma Detayı' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gearButton: {
    minWidth: 126,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: 'rgba(212, 165, 116, 0.42)',
    borderRadius: 8,
    backgroundColor: 'rgba(212, 165, 116, 0.12)',
  },
  gearButtonText: {
    color: '#E7C190',
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 20,
  },
  gearButtonLabel: {
    color: '#E7C190',
    fontSize: 11,
    fontWeight: '800',
  },
  exitButton: {
    minWidth: 54,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(212, 165, 116, 0.42)',
    borderRadius: 8,
    backgroundColor: 'rgba(212, 165, 116, 0.12)',
  },
  exitButtonText: {
    color: '#E7C190',
    fontSize: 12,
    fontWeight: '800',
  },
});
