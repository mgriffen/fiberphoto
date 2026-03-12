import { getDatabase } from './database';
import { DA } from '../types';

export async function getAllDAs(): Promise<DA[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ id: string; created_at: string; updated_at: string }>(
    'SELECT * FROM das ORDER BY id ASC'
  );
  return rows.map(rowToDA);
}

export async function getDAById(id: string): Promise<DA | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ id: string; created_at: string; updated_at: string }>(
    'SELECT * FROM das WHERE id = ?',
    id
  );
  return row ? rowToDA(row) : null;
}

export async function createDA(id: string): Promise<DA> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO das (id, created_at, updated_at) VALUES (?, ?, ?)',
    id, now, now
  );
  return { id, createdAt: now, updatedAt: now };
}

export async function deleteDA(id: string): Promise<void> {
  const db = await getDatabase();
  // Records are deleted first by callers (to handle photo cleanup)
  await db.runAsync('DELETE FROM das WHERE id = ?', id);
}

export async function touchDA(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE das SET updated_at = ? WHERE id = ?',
    new Date().toISOString(), id
  );
}

export async function daExists(id: string): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM das WHERE id = ?',
    id
  );
  return (row?.count ?? 0) > 0;
}

function rowToDA(row: { id: string; created_at: string; updated_at: string }): DA {
  return { id: row.id, createdAt: row.created_at, updatedAt: row.updated_at };
}
