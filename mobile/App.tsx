// ============================================================
// FALCI - App.tsx (Entry Point)
// ============================================================

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { HomeScreen } from './src/screens/HomeScreen';
import { SessionScreen } from './src/screens/SessionScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { MemoryDebugScreen } from './src/screens/MemoryDebugScreen';
import { ReadingDetailScreen } from './src/screens/ReadingDetailScreen';
import { GeneralReadingsScreen } from './src/screens/GeneralReadingsScreen';
import { PersonalReadingsScreen } from './src/screens/PersonalReadingsScreen';
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
import type { DevSettings, SessionConfig } from './src/types';
import type { ReadingSummary } from './src/types/memory';

export type RootStackParamList = {
  Home: { freshStartToken?: number } | undefined;
  ProfileSettings: undefined;
  GeneralReadings: undefined;
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
  };
  PersonalNumerologyReading: {
    profileId: string;
    assistantId: string;
  };
  MbtiTest: {
    profileId: string;
  };
  Session: { config: SessionConfig };
  History: { profileId: string; profileName: string };
  MemoryDebug: { profileId: string; profileName: string };
  ReadingDetail: { reading: ReadingSummary; profileName: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: '#1E1E28' },
            headerTintColor: '#D4A574',
            headerTitleStyle: { fontWeight: '600' },
            contentStyle: { backgroundColor: '#14141E' },
          }}
        >
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: APP_NAME }} />
          <Stack.Screen name="ProfileSettings" component={ProfileSettingsScreen} options={{ title: 'Profil Ayarları' }} />
          <Stack.Screen name="GeneralReadings" component={GeneralReadingsScreen} options={{ title: 'Genel Fallar' }} />
          <Stack.Screen name="SunCompatibility" component={SunCompatibilityScreen} options={{ title: 'Genel Burç Uyumu' }} />
          <Stack.Screen name="DaisyFortune" component={DaisyFortuneScreen} options={{ title: 'Papatya Falı' }} />
          <Stack.Screen name="PersonalReadings" component={PersonalReadingsScreen} options={{ title: 'Kişiye Özel' }} />
          <Stack.Screen
            name="PersonalProfileSelect"
            component={PersonalProfileSelectScreen}
            options={{ title: 'Profil Seçimi' }}
          />
          <Stack.Screen
            name="PersonalReadingTypeSelect"
            component={PersonalReadingTypeSelectScreen}
            options={{ title: 'Fal Tipi Seçimi' }}
          />
          <Stack.Screen
            name="PersonalAssistantSelect"
            component={PersonalAssistantSelectScreen}
            options={{ title: 'Falcı Seçimi' }}
          />
          <Stack.Screen
            name="PersonalReadingSetup"
            component={PersonalReadingSetupScreen}
            options={{ title: 'Profil Ayarları ve Fal Akışı' }}
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
            options={{ title: 'MBTI Kişilik Testi' }}
          />
          <Stack.Screen
            name="Session"
            component={SessionScreen}
            options={{ title: APP_NAME, headerBackVisible: false }}
          />
          <Stack.Screen name="History" component={HistoryScreen} options={{ title: 'Son Fallar' }} />
          <Stack.Screen name="MemoryDebug" component={MemoryDebugScreen} options={{ title: 'Hafıza' }} />
          <Stack.Screen name="ReadingDetail" component={ReadingDetailScreen} options={{ title: 'Fal Detayı' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
