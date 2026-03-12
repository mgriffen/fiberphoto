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
      id         TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS records (
      id                   TEXT PRIMARY KEY,
      sequence_num         INTEGER NOT NULL UNIQUE,
      da_id                TEXT NOT NULL,
      type_abbrev          TEXT NOT NULL,
      structure_type       TEXT NOT NULL,
      photo_path           TEXT NOT NULL,
      has_sc               INTEGER NOT NULL DEFAULT 0,
      has_terminal         INTEGER NOT NULL DEFAULT 0,
      terminal_designation TEXT,
      notes                TEXT,
      recorded_by          TEXT NOT NULL,
      created_at           TEXT NOT NULL,
      updated_at           TEXT NOT NULL,
      FOREIGN KEY (da_id) REFERENCES das(id)
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}
