import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { buildPhotoFilename } from '../utils/idGenerator';

const PHOTOS_DIR = `${FileSystem.documentDirectory}fiberphoto-photos/`;

export async function ensurePhotosDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(PHOTOS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
  }
}

/**
 * Compresses a photo from the camera and saves it with the record UUID filename.
 * Returns the permanent local path.
 */
export async function savePhoto(
  tempUri: string,
  recordId: string
): Promise<string> {
  await ensurePhotosDir();

  const compressed = await ImageManipulator.manipulateAsync(
    tempUri,
    [{ resize: { width: 1920 } }],
    { compress: 0.78, format: ImageManipulator.SaveFormat.JPEG }
  );

  const filename = buildPhotoFilename(recordId);
  const dest = `${PHOTOS_DIR}${filename}`;
  await FileSystem.copyAsync({ from: compressed.uri, to: dest });

  return dest;
}

/** Deletes a photo file from disk. */
export async function deletePhoto(photoPath: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(photoPath);
  if (info.exists) {
    await FileSystem.deleteAsync(photoPath, { idempotent: true });
  }
}

/** Reads a photo as a base64 string (for ZIP export). */
export async function readPhotoAsBase64(photoPath: string): Promise<string> {
  return FileSystem.readAsStringAsync(photoPath, {
    encoding: FileSystem.EncodingType.Base64,
  });
}
