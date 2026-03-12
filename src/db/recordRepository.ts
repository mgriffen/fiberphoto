import { getDatabase } from './database';
import { FiberRecord, NewRecordPayload, EditRecordPayload } from '../types';
import { getNextSequenceNum, buildRecordId } from '../utils/idGenerator';
import { touchDA } from './daRepository';

// ─── Read ──────────────────────────────────────────────────────────────────

export async function getRecordsByDA(daId: string): Promise<FiberRecord[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<RawRecord>(
    'SELECT * FROM records WHERE da_id = ? ORDER BY sequence_num ASC',
    daId
  );
  return rows.map(rowToRecord);
}

export async function getRecordById(id: string): Promise<FiberRecord | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<RawRecord>(
    'SELECT * FROM records WHERE id = ?',
    id
  );
  return row ? rowToRecord(row) : null;
}

export async function getAllRecords(): Promise<FiberRecord[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<RawRecord>(
    'SELECT * FROM records ORDER BY sequence_num ASC'
  );
  return rows.map(rowToRecord);
}

export async function getAllSequenceNums(): Promise<number[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ sequence_num: number }>(
    'SELECT sequence_num FROM records ORDER BY sequence_num ASC'
  );
  return rows.map(r => r.sequence_num);
}

export async function getMaxSequenceNum(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ max_seq: number | null }>(
    'SELECT MAX(sequence_num) as max_seq FROM records'
  );
  return row?.max_seq ?? 0;
}

// ─── Create ────────────────────────────────────────────────────────────────

export async function createRecord(
  payload: NewRecordPayload,
  recordedBy: string
): Promise<FiberRecord> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const seqNum = await getNextSequenceNum();
  const id = buildRecordId(payload.typeAbbrev, seqNum);

  await db.runAsync(
    `INSERT INTO records
      (id, sequence_num, da_id, type_abbrev, structure_type, photo_path,
       has_sc, has_terminal, terminal_designation, notes, recorded_by,
       created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    seqNum,
    payload.daId,
    payload.typeAbbrev,
    payload.structureType,
    payload.photoPath,
    payload.hasSC ? 1 : 0,
    payload.hasTerminal ? 1 : 0,
    payload.terminalDesignation ?? null,
    payload.notes ?? null,
    recordedBy,
    now,
    now
  );

  await touchDA(payload.daId);

  return {
    id,
    sequenceNum: seqNum,
    daId: payload.daId,
    typeAbbrev: payload.typeAbbrev,
    structureType: payload.structureType,
    photoPath: payload.photoPath,
    hasSC: payload.hasSC,
    hasTerminal: payload.hasTerminal,
    terminalDesignation: payload.terminalDesignation,
    notes: payload.notes,
    recordedBy,
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Update ────────────────────────────────────────────────────────────────

export async function updateRecord(
  id: string,
  payload: EditRecordPayload
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  // If type abbreviation changed the record ID changes too
  const existing = await getRecordById(id);
  if (!existing) throw new Error(`Record ${id} not found`);

  const newId = buildRecordId(payload.typeAbbrev, existing.sequenceNum);

  await db.runAsync(
    `UPDATE records SET
       id = ?, type_abbrev = ?, structure_type = ?,
       has_sc = ?, has_terminal = ?,
       terminal_designation = ?, notes = ?, updated_at = ?
     WHERE id = ?`,
    newId,
    payload.typeAbbrev,
    payload.structureType,
    payload.hasSC ? 1 : 0,
    payload.hasTerminal ? 1 : 0,
    payload.terminalDesignation ?? null,
    payload.notes ?? null,
    now,
    id
  );

  await touchDA(existing.daId);
}

// ─── Delete ────────────────────────────────────────────────────────────────

export async function deleteRecord(id: string): Promise<void> {
  const db = await getDatabase();
  const record = await getRecordById(id);
  if (!record) return;
  await db.runAsync('DELETE FROM records WHERE id = ?', id);
  await touchDA(record.daId);
}

export async function deleteRecordsByDA(daId: string): Promise<FiberRecord[]> {
  const db = await getDatabase();
  const records = await getRecordsByDA(daId);
  await db.runAsync('DELETE FROM records WHERE da_id = ?', daId);
  return records; // return so callers can clean up photo files
}

// ─── Cascade renumber ─────────────────────────────────────────────────────
// Decrements sequence_num (and rebuilds id) for all records where
// sequence_num > afterSequence. Caller handles photo file renames.

export async function cascadeDecrement(afterSequence: number): Promise<FiberRecord[]> {
  const db = await getDatabase();

  // Get all affected records ordered ascending so we process lowest first
  // (avoids UNIQUE constraint collision on sequence_num during update)
  const affected = await db.getAllAsync<RawRecord>(
    'SELECT * FROM records WHERE sequence_num > ? ORDER BY sequence_num ASC',
    afterSequence
  );

  const updated: FiberRecord[] = [];

  for (const raw of affected) {
    const newSeq = raw.sequence_num - 1;
    const newId = `${raw.type_abbrev}${newSeq}`;
    const now = new Date().toISOString();

    await db.runAsync(
      'UPDATE records SET id = ?, sequence_num = ?, updated_at = ? WHERE id = ?',
      newId, newSeq, now, raw.id
    );

    updated.push(rowToRecord({ ...raw, id: newId, sequence_num: newSeq, updated_at: now }));
  }

  return updated;
}

// ─── Settings ─────────────────────────────────────────────────────────────

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    key
  );
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
    key, value
  );
}

// ─── Internal helpers ──────────────────────────────────────────────────────

interface RawRecord {
  id: string;
  sequence_num: number;
  da_id: string;
  type_abbrev: string;
  structure_type: string;
  photo_path: string;
  has_sc: number;
  has_terminal: number;
  terminal_designation: string | null;
  notes: string | null;
  recorded_by: string;
  created_at: string;
  updated_at: string;
}

function rowToRecord(row: RawRecord): FiberRecord {
  return {
    id: row.id,
    sequenceNum: row.sequence_num,
    daId: row.da_id,
    typeAbbrev: row.type_abbrev as FiberRecord['typeAbbrev'],
    structureType: row.structure_type,
    photoPath: row.photo_path,
    hasSC: row.has_sc === 1,
    hasTerminal: row.has_terminal === 1,
    terminalDesignation: row.terminal_designation ?? undefined,
    notes: row.notes ?? undefined,
    recordedBy: row.recorded_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
