// ============================================================
// FALCI - ImageUploader Component
// Branded source picker (no crop editor)
// ============================================================

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Alert, Modal } from 'react-native';
import { pickImage, takePhoto } from '../services/imageService';

interface ImageUploaderProps {
  label: string;
  emoji?: string;
  imageUri: string | null;
  onImageSelected: (uri: string) => void;
  compact?: boolean;
  hideLabel?: boolean;
}

export function ImageUploader({
  label,
  emoji,
  imageUri,
  onImageSelected,
  compact = false,
  hideLabel = false,
}: ImageUploaderProps) {
  const [showSourceModal, setShowSourceModal] = useState(false);

  const startSourcePicker = () => setShowSourceModal(true);

  const chooseFromCamera = async () => {
    setShowSourceModal(false);
    try {
      const uri = await takePhoto();
      if (uri) onImageSelected(uri);
    } catch (e: any) {
      Alert.alert('Hata', e?.message || 'Kamera acilamadi.');
    }
  };

  const chooseFromGallery = async () => {
    setShowSourceModal(false);
    try {
      const uri = await pickImage();
      if (uri) onImageSelected(uri);
    } catch (e: any) {
      Alert.alert('Hata', e?.message || 'Galeri acilamadi.');
    }
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.container, compact && styles.containerCompact, imageUri ? styles.containerFilled : null]}
        onPress={startSourcePicker}
        activeOpacity={0.8}
      >
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.preview} />
        ) : (
          <View style={styles.placeholder}>
            {emoji ? <Text style={styles.emoji}>{emoji}</Text> : null}
            {!hideLabel ? <Text style={styles.label}>{label}</Text> : null}
            <Text style={styles.hint}>Dokunarak fotoğraf ekle</Text>
          </View>
        )}
        {imageUri && (
          <View style={styles.changeOverlay}>
            <Text style={styles.changeText}>Degistir</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal visible={showSourceModal} transparent animationType="fade" onRequestClose={() => setShowSourceModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{label}</Text>
            <Text style={styles.cardSubtitle}>Nereden eklemek istersin?</Text>

            <View style={styles.sourceRow}>
              <TouchableOpacity style={[styles.actionBtn, styles.primary, styles.sourceBtn]} onPress={chooseFromCamera}>
                <Text style={styles.actionBtnText}>Kamera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.primary, styles.sourceBtn]} onPress={chooseFromGallery}>
                <Text style={styles.actionBtnText}>Galeri</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.actionBtn, styles.ghost]} onPress={() => setShowSourceModal(false)}>
              <Text style={styles.ghostText}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '47%',
    aspectRatio: 1,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(168, 130, 82, 0.4)',
    borderStyle: 'dashed',
    overflow: 'hidden',
    backgroundColor: 'rgba(168, 130, 82, 0.08)',
  },
  containerCompact: {
    width: 100,
    aspectRatio: 1,
  },
  containerFilled: {
    borderStyle: 'solid',
    borderColor: 'rgba(168, 130, 82, 0.7)',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  emoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D4A574',
    textAlign: 'center',
  },
  hint: {
    fontSize: 11,
    color: 'rgba(212, 165, 116, 0.6)',
    marginTop: 4,
    textAlign: 'center',
  },
  preview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  changeOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 6,
    alignItems: 'center',
  },
  changeText: {
    color: '#D4A574',
    fontSize: 12,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#1F1E2B',
    borderWidth: 1,
    borderColor: 'rgba(212, 165, 116, 0.35)',
  },
  cardTitle: {
    color: '#E8C49A',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  cardSubtitle: {
    color: 'rgba(212, 165, 116, 0.75)',
    fontSize: 12,
    marginTop: 6,
    marginBottom: 10,
    textAlign: 'center',
  },
  sourceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  sourceBtn: {
    flex: 1,
    minHeight: 44,
  },
  actionBtn: {
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: '#D4A574',
  },
  actionBtnText: {
    color: '#2B1D0E',
    fontSize: 14,
    fontWeight: '700',
  },
  ghost: {
    borderWidth: 1,
    borderColor: 'rgba(212, 165, 116, 0.5)',
    backgroundColor: 'transparent',
  },
  ghostText: {
    color: '#E8C49A',
    fontSize: 14,
    fontWeight: '600',
  },
});
