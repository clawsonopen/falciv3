// ============================================================
// FALCI - ImageUploader Component
// Branded source picker (no crop editor)
// ============================================================

import { Camera, CameraView } from 'expo-camera';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, View, Text, TouchableOpacity, Image, StyleSheet, Modal } from 'react-native';
import { BrandedConfirmModal } from './BrandedConfirmModal';
import { pickImage } from '../services/imageService';

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
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);
  const [isSelectingImage, setIsSelectingImage] = useState(false);
  const [errorModal, setErrorModal] = useState({ visible: false, message: '' });
  const cameraRef = useRef<CameraView>(null);

  const isBusy = isTakingPhoto || isSelectingImage;

  const startSourcePicker = () => {
    if (isBusy) return;
    setShowSourceModal(true);
  };

  const chooseFromCamera = async () => {
    setShowSourceModal(false);
    try {
      const permission = await Camera.requestCameraPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Kamera erişim izni gerekli.');
      }
      setCameraReady(false);
      setShowCameraModal(true);
    } catch (e: any) {
      setErrorModal({ visible: true, message: e?.message || 'Kamera açılamadı.' });
    }
  };

  const captureBackCameraPhoto = async () => {
    if (!cameraReady || isTakingPhoto) return;
    try {
      setIsTakingPhoto(true);
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 1,
        exif: false,
      });
      if (photo?.uri) {
        setShowCameraModal(false);
        setIsSelectingImage(true);
        onImageSelected(photo.uri);
      }
    } catch (e: any) {
      setErrorModal({ visible: true, message: e?.message || 'Fotoğraf çekilemedi.' });
    } finally {
      setIsTakingPhoto(false);
      setIsSelectingImage(false);
    }
  };

  const chooseFromGallery = async () => {
    setShowSourceModal(false);
    try {
      setIsSelectingImage(true);
      const uri = await pickImage();
      if (uri) onImageSelected(uri);
    } catch (e: any) {
      setErrorModal({ visible: true, message: e?.message || 'Galeri açılamadı.' });
    } finally {
      setIsSelectingImage(false);
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
            <Text style={styles.changeText}>Değiştir</Text>
          </View>
        )}
        {isSelectingImage ? (
          <View style={styles.processingOverlay}>
            <ActivityIndicator color="#E8C49A" />
            <Text style={styles.processingText}>Fotoğraf hazırlanıyor...</Text>
          </View>
        ) : null}
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
      <Modal visible={showCameraModal} animationType="slide" onRequestClose={() => setShowCameraModal(false)}>
        <View style={styles.cameraScreen}>
          <CameraView
            ref={cameraRef}
            style={styles.cameraPreview}
            facing="back"
            mode="picture"
            mirror={false}
            onCameraReady={() => setCameraReady(true)}
            onMountError={(event: any) => {
              setShowCameraModal(false);
              setErrorModal({ visible: true, message: event.message || 'Kamera açılamadı.' });
            }}
          />
          <View style={styles.cameraTopBar}>
            <TouchableOpacity style={styles.cameraGhostButton} onPress={() => setShowCameraModal(false)}>
              <Text style={styles.cameraGhostText}>Kapat</Text>
            </TouchableOpacity>
            <Text style={styles.cameraHint}>Arka kamera</Text>
          </View>
          <View style={styles.cameraBottomBar}>
            {isTakingPhoto ? (
              <View style={styles.cameraProcessing}>
                <ActivityIndicator color="#FFF" />
                <Text style={styles.cameraProcessingText}>Fotoğraf hazırlanıyor...</Text>
              </View>
            ) : null}
            <TouchableOpacity
              style={[styles.shutterButton, (!cameraReady || isTakingPhoto) && styles.shutterButtonDisabled]}
              onPress={captureBackCameraPhoto}
              disabled={!cameraReady || isTakingPhoto}
            >
              <View style={styles.shutterInner} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <BrandedConfirmModal
        visible={errorModal.visible}
        title="Hata"
        message={errorModal.message}
        confirmLabel="Tamam"
        cancelLabel={null}
        onConfirm={() => setErrorModal({ visible: false, message: '' })}
        onCancel={() => setErrorModal({ visible: false, message: '' })}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(168, 130, 82, 0.4)',
    borderStyle: 'dashed',
    overflow: 'hidden',
    backgroundColor: 'rgba(168, 130, 82, 0.08)',
  },
  containerCompact: {
    width: 94,
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
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.58)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  processingText: {
    color: '#E8C49A',
    fontSize: 12,
    fontWeight: '700',
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
  cameraScreen: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraPreview: {
    flex: 1,
  },
  cameraTopBar: {
    position: 'absolute',
    top: 42,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cameraGhostButton: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  cameraGhostText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  cameraHint: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cameraBottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 34,
    alignItems: 'center',
  },
  cameraProcessing: {
    marginBottom: 14,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cameraProcessingText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  shutterButton: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  shutterButtonDisabled: {
    opacity: 0.45,
  },
  shutterInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFF',
  },
});
