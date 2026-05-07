// ============================================================
// FALCI — DevControls Component
// ============================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Slider from '@react-native-community/slider';
import type { DevSettings } from '../types';
import { AVAILABLE_VOICES } from '../config/constants';
import { BrandedPicker } from './BrandedPicker';

interface DevControlsProps {
  settings: DevSettings;
  onSettingsChange: (settings: DevSettings) => void;
}

export function DevControls({ settings, onSettingsChange }: DevControlsProps) {
  const [expanded, setExpanded] = useState(false);

  const update = (partial: Partial<DevSettings>) => {
    onSettingsChange({ ...settings, ...partial });
  };

  const updatePrice = (key: 'inputPrice' | 'outputPrice', value: string) => {
    const normalized = value.replace(',', '.');
    const parsed = Number.parseFloat(normalized);
    update({ [key]: Number.isFinite(parsed) ? Math.max(0, parsed) : 0 } as Partial<DevSettings>);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <Text style={styles.headerText}>
          Geliştirici Ayarları {expanded ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>

      {expanded && (
        <ScrollView
          style={styles.content}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
        >
          <View style={styles.control}>
            <Text style={styles.label}>
              Temperature: {settings.temperature.toFixed(2)}
            </Text>
            <View style={styles.sliderRow}>
              <Text style={styles.sliderLabel}>0</Text>
              <View style={styles.sliderWrapper}>
                <Slider
                  minimumValue={0}
                  maximumValue={2}
                  step={0.05}
                  value={settings.temperature}
                  onValueChange={(v: number) => update({ temperature: v })}
                  minimumTrackTintColor="#D4A574"
                  maximumTrackTintColor="rgba(168, 130, 82, 0.3)"
                  thumbTintColor="#E8C49A"
                />
              </View>
              <Text style={styles.sliderLabel}>2</Text>
            </View>
          </View>

          <View style={styles.control}>
            <Text style={styles.label}>
              Thinking Budget: {settings.thinkingBudget === 0 ? 'OFF' : settings.thinkingBudget}
            </Text>
            <View style={styles.sliderRow}>
              <Text style={styles.sliderLabel}>0</Text>
              <View style={styles.sliderWrapper}>
                <Slider
                  minimumValue={0}
                  maximumValue={8192}
                  step={256}
                  value={settings.thinkingBudget}
                  onValueChange={(v: number) => update({ thinkingBudget: v })}
                  minimumTrackTintColor="#7B68EE"
                  maximumTrackTintColor="rgba(123, 104, 238, 0.3)"
                  thumbTintColor="#9B89FF"
                />
              </View>
              <Text style={styles.sliderLabel}>8K</Text>
            </View>
          </View>

          <View style={styles.control}>
            <Text style={styles.label}>TTS Ses:</Text>
            <BrandedPicker
              selectedValue={settings.ttsVoiceName}
              onValueChange={(itemValue) => update({ ttsVoiceName: itemValue })}
              options={AVAILABLE_VOICES.map((voice) => ({ label: voice.label, value: voice.id }))}
            />
          </View>

          <View style={styles.control}>
            <Text style={styles.label}>TTS Talimatları:</Text>
            <TextInput
              style={styles.textInput}
              value={settings.ttsInstructions}
              onChangeText={(v) => update({ ttsInstructions: v })}
              placeholder="Ses tarzı talimatları..."
              placeholderTextColor="rgba(168, 130, 82, 0.3)"
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.control}>
            <Text style={styles.label}>Sistem İstemi (Persona):</Text>
            <TextInput
              style={[styles.textInput, styles.promptInput]}
              value={settings.systemPrompt}
              onChangeText={(v) => update({ systemPrompt: v })}
              placeholder="AI için persona ve talimatlar..."
              placeholderTextColor="rgba(168, 130, 82, 0.3)"
              multiline
            />
          </View>

          <View style={styles.control}>
            <Text style={styles.label}>Input Price (USD / 1M):</Text>
            <TextInput
              style={styles.priceInput}
              value={String(settings.inputPrice)}
              onChangeText={(v) => updatePrice('inputPrice', v)}
              keyboardType="decimal-pad"
              placeholder="0.3"
              placeholderTextColor="rgba(168, 130, 82, 0.3)"
            />
          </View>

          <View style={styles.control}>
            <Text style={styles.label}>Output Price (USD / 1M):</Text>
            <TextInput
              style={styles.priceInput}
              value={String(settings.outputPrice)}
              onChangeText={(v) => updatePrice('outputPrice', v)}
              keyboardType="decimal-pad"
              placeholder="0.4"
              placeholderTextColor="rgba(168, 130, 82, 0.3)"
            />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    backgroundColor: 'rgba(30, 30, 40, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(168, 130, 82, 0.2)',
    overflow: 'hidden',
  },
  header: {
    padding: 12,
    alignItems: 'center',
  },
  headerText: {
    fontSize: 13,
    color: 'rgba(212, 165, 116, 0.6)',
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    maxHeight: 450,
  },
  control: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: '#D4A574',
    fontWeight: '600',
    marginBottom: 6,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sliderWrapper: {
    flex: 1,
    marginHorizontal: 8,
  },
  sliderLabel: {
    fontSize: 11,
    color: 'rgba(212, 165, 116, 0.4)',
    width: 20,
    textAlign: 'center',
  },
  textInput: {
    borderWidth: 1,
    borderColor: 'rgba(168, 130, 82, 0.2)',
    borderRadius: 12,
    padding: 10,
    color: '#D4A574',
    fontSize: 13,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    textAlignVertical: 'top',
    minHeight: 70,
  },
  promptInput: {
    minHeight: 120,
  },
  priceInput: {
    borderWidth: 1,
    borderColor: 'rgba(168, 130, 82, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: '#D4A574',
    fontSize: 13,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
});
