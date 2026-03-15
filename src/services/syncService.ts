import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';
import { getDatabase } from '../db/database';

// ─── Sync State ────────────────────────────────────────────────────────────

export type SyncState = 'idle' | 'syncing' | 'error' | 'offline';

export interface SyncProgress {
  phase: 'push-das' | 'push-records' | 'pull-das' | 'pull-records' | 'done';
  current: number;
  total: number;
}

type SyncListener = (state: SyncState, progress?: SyncProgress) => void;
const listeners: SyncListener[] = [];
let currentState: SyncState = 'idle';

export function onSyncStateChange(fn: SyncListener) {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export function getSyncState(): SyncState {
  return currentState;
}

function setSyncState(state: SyncState, progress?: SyncProgress) {
  currentState = state;
  listeners.forEach(fn => fn(state, progress));
}

// ─── Full Sync ─────────────────────────────────────────────────────────────

let syncInProgress = false;

export async function performSync(userId: string): Promise<string | null> {
  if (syncInProgress) return null;
  syncInProgress = true;
  setSyncState('syncing', { phase: 'push-das', current: 0, total: 0 });

  const errors: string[] = [];

  try {
    await pushDeletedRecords(errors);
    await pushDeletedDAs(errors);
    await pushDAs(userId, errors);
    await pushRecords(userId, errors);
    const pulledDAs = await pullDAs();
    const pulledRecords = await pullRecords();
    setSyncState('idle', { phase: 'done', current: 0, total: 0 });

    const parts: string[] = [];
    if (errors.length > 0) parts.push(`Errors:\n${errors.join('\n')}`);
    parts.push(`Pulled ${pulledDAs} DAs, ${pulledRecords} records`);
    return parts.join('\n\n');
  } catch (err: any) {
    const message = err?.message ?? String(err);
    console.warn('Sync failed:', message);
    setSyncState('error');
    return message;
  } finally {
    syncInProgress = false;
  }
}

// ─── Push Deletes ─────────────────────────────────────────────────────────

async function pushDeletedRecords(errors: string[]): Promise<void> {
  const db = await getDatabase();
  const deleted = await db.getAllAsync<RawRecord>(
    "SELECT * FROM records WHERE sync_status = 'deleted'"
  );

  for (const record of deleted) {
    // Delete from Supabase
    const { error } = await supabase.from('records').delete().eq('id', record.id);
    if (error) {
      errors.push(`Delete record ${record.sequence_num}: ${error.message}`);
      continue;
    }

    // Delete photo from storage if it exists
    if (record.photo_url) {
      await supabase.storage.from('photos').remove([record.photo_url]);
    }

    // Hard delete locally now that Supabase is updated
    await db.runAsync('DELETE FROM records WHERE id = ?', record.id);
  }
}

async function pushDeletedDAs(errors: string[]): Promise<void> {
  const db = await getDatabase();
  const deleted = await db.getAllAsync<RawDA>(
    "SELECT * FROM das WHERE sync_status = 'deleted'"
  );

  for (const da of deleted) {
    const { error } = await supabase.from('das').delete().eq('id', da.id);
    if (error) {
      errors.push(`Delete DA ${da.name}: ${error.message}`);
      continue;
    }

    // Hard delete locally
    await db.runAsync('DELETE FROM das WHERE id = ?', da.id);
  }
}

// ─── Push DAs ──────────────────────────────────────────────────────────────

async function pushDAs(userId: string, errors: string[]): Promise<void> {
  const db = await getDatabase();

  const pending = await db.getAllAsync<RawDA>(
    "SELECT * FROM das WHERE sync_status IN ('pending', 'modified')"
  );

  for (let i = 0; i < pending.length; i++) {
    const da = pending[i];
    setSyncState('syncing', { phase: 'push-das', current: i + 1, total: pending.length });

    if (da.sync_status === 'pending') {
      const { error } = await supabase.from('das').upsert({
        id: da.id,
        name: da.name,
        created_by: userId,
        created_at: da.created_at,
        updated_at: da.updated_at,
      });

      if (error) {
        errors.push(`Push DA ${da.name}: ${error.message}`);
        continue;
      }
    } else if (da.sync_status === 'modified') {
      const { error } = await supabase.from('das').update({
        name: da.name,
        updated_at: da.updated_at,
      }).eq('id', da.id);

      if (error) {
        errors.push(`Update DA ${da.name}: ${error.message}`);
        continue;
      }
    }

    await db.runAsync(
      "UPDATE das SET sync_status = 'synced' WHERE id = ?",
      da.id
    );
  }
}

// ─── Push Records + Photos ─────────────────────────────────────────────────

async function pushRecords(userId: string, errors: string[]): Promise<void> {
  const db = await getDatabase();

  const pending = await db.getAllAsync<RawRecord>(
    "SELECT * FROM records WHERE sync_status IN ('pending', 'modified')"
  );

  for (let i = 0; i < pending.length; i++) {
    const record = pending[i];
    setSyncState('syncing', { phase: 'push-records', current: i + 1, total: pending.length });

    // Always ensure parent DA exists in Supabase before pushing record
    const parentDA = await db.getFirstAsync<RawDA>(
      'SELECT * FROM das WHERE id = ?', record.da_id
    );
    if (!parentDA) {
      errors.push(`Push record ${record.sequence_num}: parent DA not found locally`);
      continue;
    }
    const { error: daError } = await supabase.from('das').upsert({
      id: parentDA.id,
      name: parentDA.name,
      created_by: userId,
      created_at: parentDA.created_at,
      updated_at: parentDA.updated_at,
    });
    if (daError) {
      errors.push(`Push record ${record.sequence_num}: failed to push parent DA ${parentDA.name}: ${daError.message}`);
      continue;
    }
    await db.runAsync("UPDATE das SET sync_status = 'synced' WHERE id = ?", parentDA.id);

    // Upload photo first if we haven't stored a storage path yet
    let storagePath = record.photo_url;
    if (!storagePath && record.photo_path) {
      storagePath = await uploadPhoto(record.id, record.photo_path, userId);
    }

    if (record.sync_status === 'pending') {
      const { error } = await supabase.from('records').upsert({
        id: record.id,
        da_id: record.da_id,
        sequence_num: record.sequence_num,
        type_abbrev: record.type_abbrev,
        structure_type: record.structure_type,
        photo_url: storagePath,
        has_sc: record.has_sc === 1,
        has_terminal: record.has_terminal === 1,
        terminal_designation: record.terminal_designation,
        latitude: record.latitude,
        longitude: record.longitude,
        notes: record.notes,
        recorded_by: userId,
        created_at: record.created_at,
        updated_at: record.updated_at,
      });

      if (error) {
        errors.push(`Push record ${record.sequence_num}: ${error.message}`);
        continue;
      }
    } else if (record.sync_status === 'modified') {
      const { error } = await supabase.from('records').update({
        type_abbrev: record.type_abbrev,
        structure_type: record.structure_type,
        has_sc: record.has_sc === 1,
        has_terminal: record.has_terminal === 1,
        terminal_designation: record.terminal_designation,
        latitude: record.latitude,
        longitude: record.longitude,
        notes: record.notes,
        photo_url: storagePath,
        updated_at: record.updated_at,
      }).eq('id', record.id);

      if (error) {
        errors.push(`Update record ${record.sequence_num}: ${error.message}`);
        continue;
      }
    }

    await db.runAsync(
      "UPDATE records SET sync_status = 'synced', photo_url = ? WHERE id = ?",
      storagePath ?? null, record.id
    );
  }
}

// ─── Paginated Fetch Helper ───────────────────────────────────────────────

const PAGE_SIZE = 500;

async function fetchAllPaginated<T>(
  table: string,
  afterDate: string | null
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from(table)
      .select('*')
      .order('updated_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (afterDate) {
      query = query.gt('updated_at', afterDate);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Pull ${table} failed: ${error.message}`);
    if (!data || data.length === 0) break;

    all.push(...(data as T[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}

// ─── Pull DAs ──────────────────────────────────────────────────────────────

async function pullDAs(): Promise<number> {
  const db = await getDatabase();

  // Always pull all DAs (small dataset, avoids incremental sync bugs)
  const remoteDAs = await fetchAllPaginated<any>('das', null);
  console.log('[Sync] Pull DAs - found:', remoteDAs.length);
  if (remoteDAs.length === 0) return 0;

  setSyncState('syncing', { phase: 'pull-das', current: 0, total: remoteDAs.length });

  for (let i = 0; i < remoteDAs.length; i++) {
    const remote = remoteDAs[i];
    setSyncState('syncing', { phase: 'pull-das', current: i + 1, total: remoteDAs.length });

    const localById = await db.getFirstAsync<RawDA>(
      'SELECT * FROM das WHERE id = ?', remote.id
    );

    if (localById?.sync_status === 'deleted') {
      // User deleted this locally — don't re-insert
      continue;
    }

    if (!localById) {
      // Check if a local DA with the same name exists (created before sync)
      const localByName = await db.getFirstAsync<RawDA>(
        'SELECT * FROM das WHERE name = ? AND id != ?', remote.name, remote.id
      );

      if (localByName) {
        if (localByName.sync_status === 'deleted') continue;
        // Merge: reassign records from local DA to remote DA, then delete local
        await db.runAsync(
          'UPDATE records SET da_id = ? WHERE da_id = ?',
          remote.id, localByName.id
        );
        await db.runAsync('DELETE FROM das WHERE id = ?', localByName.id);
      }

      await db.runAsync(
        "INSERT INTO das (id, name, created_by, created_at, updated_at, sync_status) VALUES (?, ?, ?, ?, ?, 'synced')",
        remote.id, remote.name, remote.created_by, remote.created_at, remote.updated_at
      );
    } else if (localById.sync_status === 'synced' && remote.updated_at > localById.updated_at) {
      await db.runAsync(
        "UPDATE das SET name = ?, updated_at = ?, sync_status = 'synced' WHERE id = ?",
        remote.name, remote.updated_at, remote.id
      );
    }
  }
  return remoteDAs.length;
}

// ─── Pull Records + Photos ─────────────────────────────────────────────────

const DOWNLOAD_CONCURRENCY = 3;

async function pullRecords(): Promise<number> {
  const db = await getDatabase();

  // Always pull all records (avoids incremental sync cursor bugs)
  const remoteRecords = await fetchAllPaginated<any>('records', null);
  console.log('[Sync] Pull records - found:', remoteRecords.length);
  if (remoteRecords.length === 0) return 0;

  setSyncState('syncing', { phase: 'pull-records', current: 0, total: remoteRecords.length });

  // Process records sequentially to avoid SQLite concurrency issues
  for (let i = 0; i < remoteRecords.length; i++) {
    const remote = remoteRecords[i];
    setSyncState('syncing', { phase: 'pull-records', current: i + 1, total: remoteRecords.length });

    try {
      const local = await db.getFirstAsync<RawRecord>(
        'SELECT * FROM records WHERE id = ?', remote.id
      );

      // Skip if user deleted this locally
      if (local?.sync_status === 'deleted') continue;

      // Download photo if we don't have it locally
      let localPhotoPath = local?.photo_path ?? '';
      if (remote.photo_url && !local) {
        localPhotoPath = await downloadPhoto(remote.id, remote.photo_url);
      }

      if (!local) {
        // Verify the DA exists locally before inserting
        const daExists = await db.getFirstAsync<{ id: string }>(
          'SELECT id FROM das WHERE id = ?', remote.da_id
        );
        if (!daExists) {
          console.warn(`[Sync] Skipping record ${remote.id} — DA ${remote.da_id} not found locally`);
          continue;
        }

        await db.runAsync(
          `INSERT INTO records
            (id, sequence_num, da_id, type_abbrev, structure_type, photo_path, photo_url,
             has_sc, has_terminal, terminal_designation, latitude, longitude,
             notes, recorded_by, created_at, updated_at, sync_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
          remote.id,
          remote.sequence_num,
          remote.da_id,
          remote.type_abbrev,
          remote.structure_type,
          localPhotoPath,
          remote.photo_url,
          remote.has_sc ? 1 : 0,
          remote.has_terminal ? 1 : 0,
          remote.terminal_designation,
          remote.latitude ?? null,
          remote.longitude ?? null,
          remote.notes,
          remote.recorded_by,
          remote.created_at,
          remote.updated_at
        );
      } else if (local.sync_status === 'synced' && remote.updated_at > local.updated_at) {
        await db.runAsync(
          `UPDATE records SET
             type_abbrev = ?, structure_type = ?, has_sc = ?, has_terminal = ?,
             terminal_designation = ?, latitude = ?, longitude = ?,
             notes = ?, photo_url = ?,
             updated_at = ?, sync_status = 'synced'
           WHERE id = ?`,
          remote.type_abbrev,
          remote.structure_type,
          remote.has_sc ? 1 : 0,
          remote.has_terminal ? 1 : 0,
          remote.terminal_designation,
          remote.latitude ?? null,
          remote.longitude ?? null,
          remote.notes,
          remote.photo_url,
          remote.updated_at,
          remote.id
        );
      }
    } catch (err: any) {
      console.warn(`[Sync] Pull record ${remote.id} failed:`, err?.message);
    }
  }
  return remoteRecords.length;
}

// ─── Photo Upload ─────────────────────────────────────────────────────────

async function uploadPhoto(
  recordId: string,
  localPath: string,
  userId: string
): Promise<string | null> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    if (!fileInfo.exists) return null;

    const base64 = await FileSystem.readAsStringAsync(localPath, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const storagePath = `${userId}/${recordId}.jpg`;

    const { error } = await supabase.storage
      .from('photos')
      .upload(storagePath, bytes, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) {
      console.warn('Photo upload failed:', error.message);
      return null;
    }

    // Store the storage path, not a URL — we generate signed URLs on download
    return storagePath;
  } catch (err) {
    console.warn('Photo upload error:', err);
    return null;
  }
}

// ─── Photo Download ───────────────────────────────────────────────────────

const PHOTOS_DIR = `${FileSystem.documentDirectory}fiberphoto-photos/`;

async function downloadPhoto(
  recordId: string,
  storagePath: string
): Promise<string> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(PHOTOS_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
    }

    const localPath = `${PHOTOS_DIR}${recordId}.jpg`;

    // Already downloaded
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    if (fileInfo.exists) return localPath;

    // Generate a signed URL (valid 1 hour) and download via FileSystem
    // This avoids the FileReader/blob issue in React Native
    const { data: signedData, error: signError } = await supabase.storage
      .from('photos')
      .createSignedUrl(storagePath, 3600);

    if (signError || !signedData?.signedUrl) {
      console.warn('Signed URL failed:', signError?.message);
      return '';
    }

    await FileSystem.downloadAsync(signedData.signedUrl, localPath);
    return localPath;
  } catch (err) {
    console.warn('Photo download error:', err);
    return '';
  }
}

// ─── Raw Types ─────────────────────────────────────────────────────────────

interface RawDA {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  sync_status: string;
}

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
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  recorded_by: string;
  created_at: string;
  updated_at: string;
  sync_status: string;
}
