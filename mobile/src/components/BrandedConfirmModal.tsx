import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string | null;
  cancelLabel?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  speechMode?: 'hidden' | 'idle' | 'playing' | 'paused';
  onSpeechStart?: () => void;
  onSpeechPause?: () => void;
  onSpeechResume?: () => void;
  topContent?: React.ReactNode;
  hideMessageText?: boolean;
  extraActionLabel?: string | null;
  onExtraAction?: () => void;
};

export function BrandedConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Evet, Devam',
  cancelLabel = 'Hayır, Geri Dön',
  onConfirm,
  onCancel,
  speechMode = 'hidden',
  onSpeechStart,
  onSpeechPause,
  onSpeechResume,
  topContent,
  hideMessageText = false,
  extraActionLabel = null,
  onExtraAction,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={[styles.overlay, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {topContent ? <View style={styles.topContent}>{topContent}</View> : null}
          {!hideMessageText && (
            <ScrollView style={styles.messageScroll} contentContainerStyle={styles.messageScrollContent}>
              <Text style={styles.message}>{message}</Text>
            </ScrollView>
          )}

          {speechMode !== 'hidden' ? (
            <View style={styles.speechActions}>
              {speechMode === 'idle' ? (
                <TouchableOpacity style={styles.speechButton} onPress={onSpeechStart}>
                  <Text style={styles.speechButtonText}>Oku</Text>
                </TouchableOpacity>
              ) : null}
              {speechMode === 'playing' ? (
                <TouchableOpacity style={styles.speechButton} onPress={onSpeechPause}>
                  <Text style={styles.speechButtonText}>Duraklat</Text>
                </TouchableOpacity>
              ) : null}
              {speechMode === 'paused' ? (
                <TouchableOpacity style={styles.speechButton} onPress={onSpeechResume}>
                  <Text style={styles.speechButtonText}>Devam Et</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          <View style={styles.actions}>
            {cancelLabel ? (
              <TouchableOpacity style={styles.secondaryButton} onPress={onCancel}>
                <Text style={styles.secondaryButtonText}>{cancelLabel}</Text>
              </TouchableOpacity>
            ) : null}
            {extraActionLabel && onExtraAction ? (
              <TouchableOpacity style={styles.secondaryButton} onPress={onExtraAction}>
                <Text style={styles.secondaryButtonText}>{extraActionLabel}</Text>
              </TouchableOpacity>
            ) : null}
            {confirmLabel ? (
              <TouchableOpacity style={styles.primaryButton} onPress={onConfirm}>
                <Text style={styles.primaryButtonText}>{confirmLabel}</Text>
              </TouchableOpacity>
            ) : null}
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
    paddingTop: 14,
  },
  card: {
    maxHeight: '88%',
    borderRadius: 18,
    padding: 18,
    backgroundColor: 'rgba(30, 30, 40, 0.98)',
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.35)',
  },
  title: {
    color: '#D4A574',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  messageScroll: {
    flexShrink: 1,
    marginBottom: 12,
  },
  messageScrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  message: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
    lineHeight: 21,
  },
  topContent: {
    marginBottom: 12,
    alignItems: 'center',
  },
  speechActions: {
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  speechButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.55)',
    backgroundColor: 'rgba(212,165,116,0.14)',
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  speechButtonText: {
    color: '#E8C49A',
    fontSize: 12,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
