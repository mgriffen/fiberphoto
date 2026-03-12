import { cascadeDecrement, getAllRecords } from '../db/recordRepository';
import { renamePhoto } from './photoService';

export interface RenumberPreview {
  affectedCount: number;
  affectedDAs: string[];
}

/**
 * Returns a preview of how many records will be affected by a cascade
 * decrement starting after the given sequence number.
 */
export async function previewCascadeDecrement(afterSequence: number): Promise<RenumberPreview> {
  const all = await getAllRecords();
  const affected = all.filter(r => r.sequenceNum > afterSequence);
  const daSet = new Set(affected.map(r => r.daId));
  return {
    affectedCount: affected.length,
    affectedDAs: Array.from(daSet),
  };
}

/**
 * Performs the cascade decrement:
 * 1. Gets all affected records (seq > afterSequence).
 * 2. Renames photo files on disk.
 * 3. Updates DB records.
 */
export async function performCascadeDecrement(afterSequence: number): Promise<void> {
  // Get current state before DB update (for photo rename)
  const allBefore = await getAllRecords();
  const affected = allBefore
    .filter(r => r.sequenceNum > afterSequence)
    .sort((a, b) => a.sequenceNum - b.sequenceNum); // ascending — rename lowest first

  // Rename photo files first
  for (const record of affected) {
    const newSeq = record.sequenceNum - 1;
    try {
      await renamePhoto(record.photoPath, record.typeAbbrev, newSeq);
    } catch {
      // Photo may not exist on disk — continue
    }
  }

  // Update DB
  await cascadeDecrement(afterSequence);
}
