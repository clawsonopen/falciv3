// ============================================================
// FALCI - Image Service
// Handles picking, app-side editing helpers, compression, and encoding
// ============================================================

import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Image } from 'react-native';
import { IMAGE_MAX_DIMENSION, IMAGE_QUALITY } from '../config/constants';

/**
 * Pick an image from the device gallery.
 * Returns local URI or null if cancelled.
 */
export async function pickImage(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Galeri erişim izni gerekli.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    exif: false,
    quality: 1,
  });

  if (result.canceled || !result.assets?.[0]) {
    return null;
  }

  return result.assets[0].uri;
}

/**
 * Take a photo with the camera.
 * Returns local URI or null if cancelled.
 */
export async function takePhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Kamera erişim izni gerekli.');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    cameraType: ImagePicker.CameraType.back,
    allowsEditing: false,
    exif: false,
    quality: 1,
  });

  if (result.canceled || !result.assets?.[0]) {
    return null;
  }

  return result.assets[0].uri;
}

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error),
    );
  });
}

/**
 * Crop image from center to a square, app-side.
 */
export async function cropCenterSquare(uri: string): Promise<string> {
  const { width, height } = await getImageSize(uri);
  const size = Math.min(width, height);
  const originX = Math.max(0, Math.floor((width - size) / 2));
  const originY = Math.max(0, Math.floor((height - size) / 2));

  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ crop: { originX, originY, width: size, height: size } }],
    { compress: 1, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result.uri;
}

/**
 * Crop square with zoom and offset controls.
 * zoom: 1.0..3.0
 * offsetX/offsetY: -1..1 (normalized shift inside available bounds)
 */
export async function cropSquareWithAdjust(
  uri: string,
  zoom: number,
  offsetX: number,
  offsetY: number,
): Promise<string> {
  const { width, height } = await getImageSize(uri);
  const minSide = Math.min(width, height);
  const safeZoom = Math.min(3, Math.max(1, zoom));
  const size = Math.max(64, Math.floor(minSide / safeZoom));

  const maxXShift = Math.max(0, Math.floor((width - size) / 2));
  const maxYShift = Math.max(0, Math.floor((height - size) / 2));

  const clampedOffsetX = Math.max(-1, Math.min(1, offsetX));
  const clampedOffsetY = Math.max(-1, Math.min(1, offsetY));

  const centerX = Math.floor(width / 2) + Math.floor(maxXShift * clampedOffsetX);
  const centerY = Math.floor(height / 2) + Math.floor(maxYShift * clampedOffsetY);

  const originX = Math.max(0, Math.min(width - size, centerX - Math.floor(size / 2)));
  const originY = Math.max(0, Math.min(height - size, centerY - Math.floor(size / 2)));

  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ crop: { originX, originY, width: size, height: size } }],
    { compress: 1, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result.uri;
}

/**
 * Crop by explicit rectangle in original image pixel coordinates.
 */
export async function cropImageWithRect(
  uri: string,
  rect: { originX: number; originY: number; width: number; height: number },
): Promise<string> {
  const originX = Math.max(0, Math.floor(rect.originX));
  const originY = Math.max(0, Math.floor(rect.originY));
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));

  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ crop: { originX, originY, width, height } }],
    { compress: 1, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result.uri;
}

/**
 * Compress and resize an image for efficient transfer.
 * Returns { uri, base64 } of the processed image.
 */
export async function compressImage(uri: string): Promise<{ uri: string; base64: string }> {
  const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error)
    );
  });

  const isPortrait = size.height > size.width;
  const maxDim = Math.max(size.width, size.height);
  
  const actions: ImageManipulator.Action[] = [];
  if (maxDim > IMAGE_MAX_DIMENSION) {
    actions.push({
      resize: isPortrait ? { height: IMAGE_MAX_DIMENSION } : { width: IMAGE_MAX_DIMENSION }
    });
  }

  const result = await ImageManipulator.manipulateAsync(
    uri,
    actions,
    {
      compress: IMAGE_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    },
  );

  return {
    uri: result.uri,
    base64: result.base64 ?? '',
  };
}

/**
 * Read a local image file as binary (Uint8Array).
 */
export async function readImageAsBytes(uri: string): Promise<Uint8Array> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: 'base64' as any,
  });

  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Get file size in bytes for a local URI.
 */
export async function getFileSize(uri: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(uri);
  return (info as { size?: number }).size ?? 0;
}
