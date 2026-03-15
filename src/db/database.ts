import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('fiberphoto.db');
  await initSchema(_db);
  return _db;
}

async function initSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS das (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      created_by  TEXT,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS records (
      id                   TEXT PRIMARY KEY,
      sequence_num         INTEGER NOT NULL,
      da_id                TEXT NOT NULL,
      type_abbrev          TEXT NOT NULL,
      structure_type       TEXT NOT NULL,
      photo_path           TEXT NOT NULL,
      photo_url            TEXT,
      has_sc               INTEGER NOT NULL DEFAULT 0,
      has_terminal         INTEGER NOT NULL DEFAULT 0,
      terminal_designation TEXT,
      latitude             REAL,
      longitude            REAL,
      notes                TEXT,
      recorded_by          TEXT NOT NULL,
      created_at           TEXT NOT NULL,
      updated_at           TEXT NOT NULL,
      sync_status          TEXT NOT NULL DEFAULT 'pending',
      FOREIGN KEY (da_id) REFERENCES das(id)
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Migration: add columns if upgrading from old schema
  await migrateSchema(db);
}

async function migrateSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  // Check if 'name' column exists on das table
  const dasInfo = await db.getAllAsync<{ name: string }>(
    "PRAGMA table_info(das)"
  );
  const dasColumns = dasInfo.map((c: any) => c.name);

  if (!dasColumns.includes('name')) {
    // Old schema: das only had id, created_at, updated_at
    // id was the user-facing label (e.g. 'DA001'), copy it to name
    await db.execAsync(`ALTER TABLE das ADD COLUMN name TEXT NOT NULL DEFAULT ''`);
    await db.execAsync(`UPDATE das SET name = id`);
  }

  if (!dasColumns.includes('created_by')) {
    await db.execAsync(`ALTER TABLE das ADD COLUMN created_by TEXT`);
  }

  if (!dasColumns.includes('sync_status')) {
    await db.execAsync(`ALTER TABLE das ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'pending'`);
  }

  // Check records table
  const recsInfo = await db.getAllAsync<{ name: string }>(
    "PRAGMA table_info(records)"
  );
  const recsColumns = recsInfo.map((c: any) => c.name);

  if (!recsColumns.includes('photo_url')) {
    await db.execAsync(`ALTER TABLE records ADD COLUMN photo_url TEXT`);
  }

  if (!recsColumns.includes('sync_status')) {
    await db.execAsync(`ALTER TABLE records ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'pending'`);
  }

  if (!recsColumns.includes('latitude')) {
    await db.execAsync(`ALTER TABLE records ADD COLUMN latitude REAL`);
  }
  if (!recsColumns.includes('longitude')) {
    await db.execAsync(`ALTER TABLE records ADD COLUMN longitude REAL`);
  }
}
