import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';
import { getDatabase } from '../db/database';
import { buildDisplayId, buildPhotoFilename } from '../utils/idGenerator';
import { FiberRecord, DA, SyncStatus } from '../types';

// ─── Sync State ────────────────────────────────────────────────────────────

export type SyncState = 'idle' | 'syncing' | 'error' | 'offline';

type SyncListener = (state: SyncState) => void;
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

function setSyncState(state: SyncState) {
  currentState = state;
  listeners.forEach(fn => fn(state));
}

// ─── Full Sync ─────────────────────────────────────────────────────────────

let syncInProgress = false;

export async function performSync(userId: string): Promise<void> {
  if (syncInProgress) return;
  syncInProgress = true;
  setSyncState('syncing');

  try {
    await pushDAs(userId);
    await pushRecords(userId);
    await pullDAs();
    await pullRecords();
    setSyncState('idle');
  } catch (err) {
    console.warn('Sync failed:', err);
    setSyncState('error');
  } finally {
    syncInProgress = false;
  }
}

// ─── Push DAs ──────────────────────────────────────────────────────────────

async function pushDAs(userId: string): Promise<void> {
  const db = await getDatabase();

  // Get DAs that need syncing
  const pending = await db.getAllAsync<RawDA>(
    "SELECT * FROM das WHERE sync_status IN ('pending', 'modified')"
  );

  for (const da of pending) {
    if (da.sync_status === 'pending') {
      // Insert to Supabase
      const { error } = await supabase.from('das').upsert({
        id: da.id,
        name: da.name,
        created_by: userId,
        created_at: da.created_at,
        updated_at: da.updated_at,
      });

      if (error) {
        console.warn('Push DA failed:', da.id, error.message);
        continue;
      }
    } else if (da.sync_status === 'modified') {
      const { error } = await supabase.from('das').update({
        name: da.name,
        updated_at: da.updated_at,
      }).eq('id', da.id);

      if (error) {
        console.warn('Update DA failed:', da.id, error.message);
        continue;
      }
    }

    // Mark as synced locally
    await db.runAsync(
      "UPDATE das SET sync_status = 'synced' WHERE id = ?",
      da.id
    );
  }
}

// ─── Push Records + Photos ─────────────────────────────────────────────────

async function pushRecords(userId: string): Promise<void> {
  const db = await getDatabase();

  const pending = await db.getAllAsync<RawRecord>(
    "SELECT * FROM records WHERE sync_status IN ('pending', 'modified')"
  );

  for (const record of pending) {
    // Upload photo first if no photo_url yet
    let photoUrl = record.photo_url;
    if (!photoUrl && record.photo_path) {
      photoUrl = await uploadPhoto(record.id, record.photo_path, userId);
    }

    if (record.sync_status === 'pending') {
      const { error } = await supabase.from('records').upsert({
        id: record.id,
        da_id: record.da_id,
        sequence_num: record.sequence_num,
        type_abbrev: record.type_abbrev,
        structure_type: record.structure_type,
        photo_url: photoUrl,
        has_sc: record.has_sc === 1,
        has_terminal: record.has_terminal === 1,
        terminal_designation: record.terminal_designation,
        notes: record.notes,
        recorded_by: userId,
        created_at: record.created_at,
        updated_at: record.updated_at,
      });

      if (error) {
        console.warn('Push record failed:', record.id, error.message);
        continue;
      }
    } else if (record.sync_status === 'modified') {
      const { error } = await supabase.from('records').update({
        type_abbrev: record.type_abbrev,
        structure_type: record.structure_type,
        has_sc: record.has_sc === 1,
        has_terminal: record.has_terminal === 1,
        terminal_designation: record.terminal_designation,
        notes: record.notes,
        photo_url: photoUrl,
        updated_at: record.updated_at,
      }).eq('id', record.id);

      if (error) {
        console.warn('Update record failed:', record.id, error.message);
        continue;
      }
    }

    // Mark as synced locally
    await db.runAsync(
      "UPDATE records SET sync_status = 'synced', photo_url = ? WHERE id = ?",
      photoUrl ?? null, record.id
    );
  }
}

// ─── Pull DAs ──────────────────────────────────────────────────────────────

async function pullDAs(): Promise<void> {
  const db = await getDatabase();

  // Get the latest updated_at we have locally for synced records
  const lastSync = await db.getFirstAsync<{ max_updated: string | null }>(
    "SELECT MAX(updated_at) as max_updated FROM das WHERE sync_status = 'synced'"
  );

  let query = supabase.from('das').select('*');
  if (lastSync?.max_updated) {
    query = query.gt('updated_at', lastSync.max_updated);
  }

  const { data, error } = await query;
  if (error) {
    console.warn('Pull DAs failed:', error.message);
    return;
  }
  if (!data || data.length === 0) return;

  for (const remote of data) {
    // Check if we have this DA locally
    const local = await db.getFirstAsync<RawDA>(
      'SELECT * FROM das WHERE id = ?', remote.id
    );

    if (!local) {
      // New DA from another user — insert locally
      await db.runAsync(
        "INSERT INTO das (id, name, created_by, created_at, updated_at, sync_status) VALUES (?, ?, ?, ?, ?, 'synced')",
        remote.id, remote.name, remote.created_by, remote.created_at, remote.updated_at
      );
    } else if (local.sync_status === 'synced' && remote.updated_at > local.updated_at) {
      // Remote is newer and we haven't modified locally — update
      await db.runAsync(
        "UPDATE das SET name = ?, updated_at = ?, sync_status = 'synced' WHERE id = ?",
        remote.name, remote.updated_at, remote.id
      );
    }
    // If local is 'modified', keep local version (will push on next sync)
  }
}

// ─── Pull Records + Photos ─────────────────────────────────────────────────

async function pullRecords(): Promise<void> {
  const db = await getDatabase();

  const lastSync = await db.getFirstAsync<{ max_updated: string | null }>(
    "SELECT MAX(updated_at) as max_updated FROM records WHERE sync_status = 'synced'"
  );

  let query = supabase.from('records').select('*');
  if (lastSync?.max_updated) {
    query = query.gt('updated_at', lastSync.max_updated);
  }

  const { data, error } = await query;
  if (error) {
    console.warn('Pull records failed:', error.message);
    return;
  }
  if (!data || data.length === 0) return;

  for (const remote of data) {
    const local = await db.getFirstAsync<RawRecord>(
      'SELECT * FROM records WHERE id = ?', remote.id
    );

    // Download photo if we don't have it locally
    let localPhotoPath = local?.photo_path ?? '';
    if (remote.photo_url && !local) {
      localPhotoPath = await downloadPhoto(remote.id, remote.photo_url);
    }

    if (!local) {
      // New record from another user
      await db.runAsync(
        `INSERT INTO records
          (id, sequence_num, da_id, type_abbrev, structure_type, photo_path, photo_url,
           has_sc, has_terminal, terminal_designation, notes, recorded_by,
           created_at, updated_at, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
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
        remote.notes,
        remote.recorded_by,
        remote.created_at,
        remote.updated_at
      );
    } else if (local.sync_status === 'synced' && remote.updated_at > local.updated_at) {
      // Remote is newer — update locally
      await db.runAsync(
        `UPDATE records SET
           type_abbrev = ?, structure_type = ?, has_sc = ?, has_terminal = ?,
           terminal_designation = ?, notes = ?, photo_url = ?,
           updated_at = ?, sync_status = 'synced'
         WHERE id = ?`,
        remote.type_abbrev,
        remote.structure_type,
        remote.has_sc ? 1 : 0,
        remote.has_terminal ? 1 : 0,
        remote.terminal_designation,
        remote.notes,
        remote.photo_url,
        remote.updated_at,
        remote.id
      );
    }
  }
}

// ─── Photo Upload/Download ─────────────────────────────────────────────────

const PHOTOS_DIR = `${FileSystem.documentDirectory}fiberphoto-photos/`;

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

    // Convert base64 to Uint8Array for upload
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

    // Get the public/signed URL
    const { data: urlData } = supabase.storage
      .from('photos')
      .getPublicUrl(storagePath);

    return urlData?.publicUrl ?? storagePath;
  } catch (err) {
    console.warn('Photo upload error:', err);
    return null;
  }
}

async function downloadPhoto(
  recordId: string,
  photoUrl: string
): Promise<string> {
  try {
    // Ensure photos directory exists
    const dirInfo = await FileSystem.getInfoAsync(PHOTOS_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
    }

    const localPath = `${PHOTOS_DIR}${recordId}.jpg`;

    // Check if already downloaded
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    if (fileInfo.exists) return localPath;

    // Download from Supabase storage
    // photoUrl might be a full URL or a storage path
    if (photoUrl.startsWith('http')) {
      await FileSystem.downloadAsync(photoUrl, localPath);
    } else {
      // It's a storage path — download via Supabase
      const { data, error } = await supabase.storage
        .from('photos')
        .download(photoUrl);

      if (error || !data) {
        console.warn('Photo download failed:', error?.message);
        return '';
      }

      // Convert blob to base64 and save
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1] ?? '');
        };
        reader.readAsDataURL(data);
      });

      await FileSystem.writeAsStringAsync(localPath, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }

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
  notes: string | null;
  recorded_by: string;
  created_at: string;
  updated_at: string;
  sync_status: string;
}
