import { getDatabase } from '../db/database';
import { StructureTypeId } from '../types';

/**
 * Returns the next available global sequence number.
 * Fills the lowest gap in the global sequence.
 * If no gaps, returns max + 1.
 */
export async function getNextSequenceNum(): Promise<number> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ sequence_num: number }>(
    'SELECT sequence_num FROM records ORDER BY sequence_num ASC'
  );
  const existing = rows.map(r => r.sequence_num);

  if (existing.length === 0) return 1;

  // Find lowest gap
  for (let i = 0; i < existing.length; i++) {
    const expected = i + 1; // 1-based continuous sequence
    if (existing[i] !== expected) return expected;
  }

  // No gap — return next after max
  return existing[existing.length - 1] + 1;
}

/** Builds a record ID like 'HH27' */
export function buildRecordId(typeAbbrev: StructureTypeId, seqNum: number): string {
  return `${typeAbbrev}${seqNum}`;
}

/** Builds a photo filename like 'HH27.jpg' */
export function buildPhotoFilename(typeAbbrev: StructureTypeId, seqNum: number): string {
  return `${typeAbbrev}${seqNum}.jpg`;
}
