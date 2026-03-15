import { getDatabase } from './database';
import { DA } from '../types';
import { generateUUID } from '../utils/idGenerator';

export async function getAllDAs(): Promise<DA[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<RawDA>(
    "SELECT * FROM das WHERE sync_status != 'deleted' ORDER BY name ASC"
  );
  return rows.map(rowToDA);
}

export async function getDAById(id: string): Promise<DA | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<RawDA>(
    'SELECT * FROM das WHERE id = ?',
    id
  );
  return row ? rowToDA(row) : null;
}

export async function getDAByName(name: string): Promise<DA | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<RawDA>(
    "SELECT * FROM das WHERE name = ? AND sync_status != 'deleted'",
    name
  );
  return row ? rowToDA(row) : null;
}

export async function createDA(name: string): Promise<DA> {
  const db = await getDatabase();
  const id = generateUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO das (id, name, created_at, updated_at, sync_status) VALUES (?, ?, ?, ?, ?)',
    id, name, now, now, 'pending'
  );
  return { id, name, createdAt: now, updatedAt: now, syncStatus: 'pending' };
}

export async function deleteDA(id: string): Promise<void> {
  const db = await getDatabase();
  const da = await getDAById(id);
  if (!da) return;
  if (da.syncStatus === 'pending') {
    await db.runAsync('DELETE FROM das WHERE id = ?', id);
  } else {
    await db.runAsync("UPDATE das SET sync_status = 'deleted' WHERE id = ?", id);
  }
}

export async function touchDA(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE das SET updated_at = ?, sync_status = ? WHERE id = ?',
    new Date().toISOString(), 'modified', id
  );
}

export async function getOrCreateDA(name: string): Promise<DA> {
  const existing = await getDAByName(name);
  if (existing) return existing;
  return createDA(name);
}

interface RawDA {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  sync_status: string;
}

function rowToDA(row: RawDA): DA {
  return {
    id: row.id,
    name: row.name,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status as DA['syncStatus'],
  };
}
