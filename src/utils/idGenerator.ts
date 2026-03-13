import { StructureTypeId } from '../types';

/** Generates a UUID v4 for use as a primary key */
export function generateUUID(): string {
  // crypto.randomUUID is available in Hermes (Expo SDK 55+)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Builds a display ID like 'HH27' from type abbreviation and sequence number */
export function buildDisplayId(typeAbbrev: StructureTypeId, seqNum: number): string {
  return `${typeAbbrev}${seqNum}`;
}

/** Builds a photo filename using UUID */
export function buildPhotoFilename(recordId: string): string {
  return `${recordId}.jpg`;
}
