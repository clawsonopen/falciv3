import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type BrandedPickerOption<T extends string> = {
  label: string;
  value: T;
};

type Props<T extends string> = {
  label?: string;
  selectedValue: T;
  options: BrandedPickerOption<T>[];
  onValueChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  compact?: boolean;
};

export function BrandedPicker<T extends string>({
  label,
  selectedValue,
  options,
  onValueChange,
  placeholder = 'Seç',
  disabled = false,
  compact = false,
}: Props<T>) {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const selected = useMemo(() => options.find((option) => option.value === selectedValue) || null, [options, selectedValue]);

  return (
    <>
      <TouchableOpacity
        style={[styles.trigger, compact && styles.triggerCompact, disabled && styles.disabled]}
        activeOpacity={0.88}
        onPress={() => {
          if (!disabled) setVisible(true);
        }}
        disabled={disabled}
      >
        {label ? <Text style={styles.inlineLabel}>{label}</Text> : null}
        <Text style={[styles.triggerText, !selected && styles.placeholder]} numberOfLines={1}>
          {selected?.label || placeholder}
        </Text>
      </TouchableOpacity>
      {visible ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setVisible(false)}>
          <View style={[styles.overlay, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            <View style={styles.card}>
              <View style={styles.header}>
                <Text style={styles.title}>{label || placeholder}</Text>
                <TouchableOpacity onPress={() => setVisible(false)}>
                  <Text style={styles.closeText}>Kapat</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.optionScroll} contentContainerStyle={styles.optionContent}>
                {options.map((option) => {
                  const active = option.value === selectedValue;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.optionRow, active && styles.optionRowActive]}
                      onPress={() => {
                        onValueChange(option.value);
                        setVisible(false);
                      }}
                    >
                      <Text style={[styles.optionText, active && styles.optionTextActive]}>{option.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.25)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.18)',
    marginBottom: 10,
  },
  triggerCompact: {
    paddingHorizontal: 8,
    paddingVertical: 9,
    marginBottom: 0,
  },
  disabled: { opacity: 0.55 },
  inlineLabel: { color: '#D4A574', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  triggerText: { color: '#FFF5E8', fontSize: 14, fontWeight: '700' },
  placeholder: { color: 'rgba(255,255,255,0.42)' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10,10,18,0.72)',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  card: {
    maxHeight: '82%',
    borderRadius: 18,
    padding: 14,
    backgroundColor: 'rgba(30,30,40,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.35)',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { color: '#D4A574', fontSize: 16, fontWeight: '800', flex: 1, paddingRight: 10 },
  closeText: { color: '#E8C49A', fontSize: 13, fontWeight: '800' },
  optionScroll: { flexShrink: 1 },
  optionContent: { gap: 8, paddingBottom: 4 },
  optionRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.2)',
    backgroundColor: 'rgba(0,0,0,0.16)',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  optionRowActive: {
    borderColor: '#D4A574',
    backgroundColor: 'rgba(212,165,116,0.16)',
  },
  optionText: { color: '#FFF5E8', fontSize: 14, fontWeight: '700' },
  optionTextActive: { color: '#E8C49A' },
});
