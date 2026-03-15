import { getDatabase } from './database';
import { FiberRecord, NewRecordPayload, EditRecordPayload } from '../types';
import { generateUUID, buildDisplayId, buildPhotoFilename } from '../utils/idGenerator';
import { touchDA } from './daRepository';

// ─── Read ──────────────────────────────────────────────────────────────────

export async function getRecordsByDA(daId: string): Promise<FiberRecord[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<RawRecord>(
    "SELECT * FROM records WHERE da_id = ? AND sync_status != 'deleted' ORDER BY sequence_num ASC",
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

export async function searchRecordsByDesignation(query: string): Promise<(FiberRecord & { daName: string })[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<RawRecord & { da_name: string }>(
    `SELECT r.*, d.name as da_name FROM records r
     JOIN das d ON r.da_id = d.id
     WHERE r.sync_status != 'deleted'
       AND ((r.type_abbrev || r.sequence_num) LIKE ?
        OR r.terminal_designation LIKE ?)
     ORDER BY r.sequence_num ASC
     LIMIT 20`,
    `%${query}%`, `%${query}%`
  );
  return rows.map(row => ({ ...rowToRecord(row), daName: row.da_name }));
}

export async function getAllRecords(): Promise<FiberRecord[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<RawRecord>(
    "SELECT * FROM records WHERE sync_status != 'deleted' ORDER BY sequence_num ASC"
  );
  return rows.map(rowToRecord);
}

export async function getMaxSequenceNumForDA(daId: string): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ max_seq: number | null }>(
    'SELECT MAX(sequence_num) as max_seq FROM records WHERE da_id = ?',
    daId
  );
  return row?.max_seq ?? 0;
}

export async function getNextSequenceNumForDA(daId: string, daName?: string): Promise<number> {
  const maxSeq = await getMaxSequenceNumForDA(daId);
  if (maxSeq > 0) return maxSeq + 1;
  // No records yet — check if a starting number was set (by name or id)
  if (daName) {
    const startNum = await getSetting(`start_seq_${daName}`);
    if (startNum) return parseInt(startNum, 10);
  }
  const startNum = await getSetting(`start_seq_${daId}`);
  return startNum ? parseInt(startNum, 10) : 1;
}

// ─── Create ────────────────────────────────────────────────────────────────

export async function createRecord(
  payload: NewRecordPayload,
  recordedBy: string,
  preGeneratedId?: string
): Promise<FiberRecord> {
  const db = await getDatabase();
  const id = preGeneratedId ?? generateUUID();
  const now = new Date().toISOString();
  const seqNum = await getNextSequenceNumForDA(payload.daId, payload.daName);

  await db.runAsync(
    `INSERT INTO records
      (id, sequence_num, da_id, type_abbrev, structure_type, photo_path,
       has_sc, has_terminal, terminal_designation, notes, recorded_by,
       created_at, updated_at, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    now,
    'pending'
  );

  await touchDA(payload.daId);

  return {
    id,
    displayId: buildDisplayId(payload.typeAbbrev, seqNum),
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
    syncStatus: 'pending',
  };
}

// ─── Update ────────────────────────────────────────────────────────────────

export async function updateRecord(
  id: string,
  payload: EditRecordPayload
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  const existing = await getRecordById(id);
  if (!existing) throw new Error(`Record ${id} not found`);

  await db.runAsync(
    `UPDATE records SET
       type_abbrev = ?, structure_type = ?,
       has_sc = ?, has_terminal = ?,
       terminal_designation = ?, notes = ?,
       updated_at = ?, sync_status = ?
     WHERE id = ?`,
    payload.typeAbbrev,
    payload.structureType,
    payload.hasSC ? 1 : 0,
    payload.hasTerminal ? 1 : 0,
    payload.terminalDesignation ?? null,
    payload.notes ?? null,
    now,
    'modified',
    id
  );

  await touchDA(existing.daId);
}

// ─── Delete ────────────────────────────────────────────────────────────────

export async function deleteRecord(id: string): Promise<void> {
  const db = await getDatabase();
  const record = await getRecordById(id);
  if (!record) return;
  if (record.syncStatus === 'pending') {
    // Never synced — safe to hard delete
    await db.runAsync('DELETE FROM records WHERE id = ?', id);
  } else {
    // Mark for deletion so sync can push the delete to Supabase
    await db.runAsync("UPDATE records SET sync_status = 'deleted' WHERE id = ?", id);
  }
  await touchDA(record.daId);
}

export async function deleteRecordsByDA(daId: string): Promise<FiberRecord[]> {
  const db = await getDatabase();
  const records = await getRecordsByDA(daId);
  for (const record of records) {
    if (record.syncStatus === 'pending') {
      await db.runAsync('DELETE FROM records WHERE id = ?', record.id);
    } else {
      await db.runAsync("UPDATE records SET sync_status = 'deleted' WHERE id = ?", record.id);
    }
  }
  return records; // return so callers can clean up photo files
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
  photo_url: string | null;
  has_sc: number;
  has_terminal: number;
  terminal_designation: string | null;
  notes: string | null;
  recorded_by: string;
  created_at: string;
  updated_at: string;
  sync_status: string;
}

function rowToRecord(row: RawRecord): FiberRecord {
  return {
    id: row.id,
    displayId: buildDisplayId(row.type_abbrev as FiberRecord['typeAbbrev'], row.sequence_num),
    sequenceNum: row.sequence_num,
    daId: row.da_id,
    typeAbbrev: row.type_abbrev as FiberRecord['typeAbbrev'],
    structureType: row.structure_type,
    photoPath: row.photo_path,
    photoUrl: row.photo_url ?? undefined,
    hasSC: row.has_sc === 1,
    hasTerminal: row.has_terminal === 1,
    terminalDesignation: row.terminal_designation ?? undefined,
    notes: row.notes ?? undefined,
    recordedBy: row.recorded_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status as FiberRecord['syncStatus'],
  };
}
