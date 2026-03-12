import { getAllRecords } from '../db/recordRepository';
import { GapInfo } from '../types';

/**
 * Scans ALL records globally and returns gap information.
 * Gaps are missing sequence numbers in the 1..max range.
 */
export async function detectGaps(): Promise<GapInfo> {
  const records = await getAllRecords(); // sorted by seq ascending

  if (records.length === 0) {
    return { hasGaps: false, gaps: [], affectedDAs: [] };
  }

  const seqSet = new Set(records.map(r => r.sequenceNum));
  const max = Math.max(...seqSet);
  const gaps: number[] = [];

  for (let i = 1; i <= max; i++) {
    if (!seqSet.has(i)) gaps.push(i);
  }

  if (gaps.length === 0) {
    return { hasGaps: false, gaps: [], affectedDAs: [] };
  }

  // Which DAs have records at or after the first gap?
  const firstGap = gaps[0];
  const affectedDASet = new Set<string>();
  for (const r of records) {
    if (r.sequenceNum >= firstGap) affectedDASet.add(r.daId);
  }

  return {
    hasGaps: true,
    gaps,
    affectedDAs: Array.from(affectedDASet),
  };
}

/** Returns gaps within a specific DA's sequence range */
export async function detectGapsInDA(daId: string): Promise<number[]> {
  const all = await detectGaps();
  if (!all.hasGaps) return [];

  // Find the min and max sequence for this DA
  const records = await getAllRecords();
  const daRecords = records.filter(r => r.daId === daId);
  if (daRecords.length === 0) return [];

  const daMin = Math.min(...daRecords.map(r => r.sequenceNum));
  const daMax = Math.max(...daRecords.map(r => r.sequenceNum));

  return all.gaps.filter(g => g >= daMin && g <= daMax);
}
