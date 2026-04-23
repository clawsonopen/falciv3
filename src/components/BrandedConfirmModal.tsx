import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function BrandedConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Evet, Devam',
  cancelLabel = 'Hayır, Geri Don',
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.secondaryButton} onPress={onCancel}>
              <Text style={styles.secondaryButtonText}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton} onPress={onConfirm}>
              <Text style={styles.primaryButtonText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 18, 0.72)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    borderRadius: 18,
    padding: 18,
    backgroundColor: 'rgba(30, 30, 40, 0.98)',
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.35)',
  },
  title: {
    color: '#FFF5E8',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  message: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.5)',
    backgroundColor: 'rgba(212,165,116,0.12)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#E8C49A',
    fontSize: 13,
    fontWeight: '700',
  },
  primaryButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#D4A574',
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#14141E',
    fontSize: 13,
    fontWeight: '800',
  },
});

