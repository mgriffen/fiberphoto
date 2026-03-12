import { getDatabase } from '../db/database';
import { StructureTypeId } from '../types';

/**
 * Returns the next available global sequence number.
 * Respects the minSequenceNum setting (for picking up after existing records).
 * Fills the lowest gap in the global sequence (at or above minSequenceNum).
 * If no gaps, returns max + 1.
 */
export async function getNextSequenceNum(): Promise<number> {
  const db = await getDatabase();

  // Check if there's a minimum sequence number set
  const minRow = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_settings WHERE key = 'minSequenceNum'"
  );
  const minSeq = minRow ? parseInt(minRow.value, 10) : 1;

  const rows = await db.getAllAsync<{ sequence_num: number }>(
    'SELECT sequence_num FROM records ORDER BY sequence_num ASC'
  );
  const existing = rows.map(r => r.sequence_num);

  if (existing.length === 0) return minSeq;

  // Find lowest gap (at or above minSeq)
  const max = existing[existing.length - 1];
  const existingSet = new Set(existing);
  for (let n = minSeq; n <= max; n++) {
    if (!existingSet.has(n)) return n;
  }

  // No gap — return next after max
  return Math.max(max + 1, minSeq);
}

/** Builds a record ID like 'HH27' */
export function buildRecordId(typeAbbrev: StructureTypeId, seqNum: number): string {
  return `${typeAbbrev}${seqNum}`;
}

/** Builds a photo filename like 'HH27.jpg' */
export function buildPhotoFilename(typeAbbrev: StructureTypeId, seqNum: number): string {
  return `${typeAbbrev}${seqNum}.jpg`;
}
