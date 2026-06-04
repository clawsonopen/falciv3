// ============================================================
// FALCI - TokenUsage Component
// Single-row cumulative token + cost display
// ============================================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { TokenUsageData } from '../types';

interface TokenUsageProps {
  usage: TokenUsageData;
  inputPrice: number;
  outputPrice: number;
}

export function TokenUsage({ usage, inputPrice, outputPrice }: TokenUsageProps) {
  const imageInputTokens = usage.imageInputTokens || 0;
  const textInputTokens = usage.textInputTokens ?? Math.max(0, usage.inputTokens - imageInputTokens);
  const total = imageInputTokens + textInputTokens + usage.outputTokens;
  const cost =
    ((imageInputTokens + textInputTokens) / 1_000_000) * inputPrice +
    (usage.outputTokens / 1_000_000) * outputPrice;

  return (
    <View style={styles.container}>
      <Text style={styles.rowText}>
        Görsel: {imageInputTokens.toLocaleString()}   Metin: {textInputTokens.toLocaleString()}   Çıkış:{' '}
        {usage.outputTokens.toLocaleString()}   Toplam: {total.toLocaleString()}
      </Text>
      <Text style={styles.costText}>Maliyet: ${cost.toFixed(6)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(168, 130, 82, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(168, 130, 82, 0.2)',
  },
  rowText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#D4A574',
    fontVariant: ['tabular-nums'],
    flex: 1,
    marginRight: 8,
  },
  costText: {
    fontSize: 10,
    color: 'rgba(212, 165, 116, 0.85)',
    fontWeight: '600',
  },
});
