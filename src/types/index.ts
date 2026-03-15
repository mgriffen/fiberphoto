// ─────────────────────────────────────────────
//  Core domain types for FiberPhoto
// ─────────────────────────────────────────────

export type StructureTypeId = 'FP' | 'HH' | 'BP';

export interface StructureType {
  id: StructureTypeId;
  label: string;
  abbreviation: StructureTypeId;
}

export const STRUCTURE_TYPES: StructureType[] = [
  { id: 'FP', label: 'FP 12x12 (Flower Pot)', abbreviation: 'FP' },
  { id: 'HH', label: 'HH 17x30',              abbreviation: 'HH' },
  { id: 'HH', label: 'HH 24x36',              abbreviation: 'HH' },
  { id: 'HH', label: 'HH 30x60',              abbreviation: 'HH' },
  { id: 'BP', label: 'BP (Bore Pit)',          abbreviation: 'BP' },
];

// Unique structure options for picker (display purposes)
export const STRUCTURE_OPTIONS = [
  { value: 'FP 12x12',  label: 'FP 12x12 (Flower Pot)', abbreviation: 'FP' as StructureTypeId },
  { value: 'HH 17x30',  label: 'HH 17x30',              abbreviation: 'HH' as StructureTypeId },
  { value: 'HH 24x36',  label: 'HH 24x36',              abbreviation: 'HH' as StructureTypeId },
  { value: 'HH 30x60',  label: 'HH 30x60',              abbreviation: 'HH' as StructureTypeId },
  { value: 'BP',        label: 'BP (Bore Pit)',          abbreviation: 'BP' as StructureTypeId },
];

// ─── Sync status for offline-first ──────────
export type SyncStatus = 'pending' | 'synced' | 'modified' | 'deleted';

// ─── Distribution Area ────────────────────────
export interface DA {
  id: string;         // UUID
  name: string;       // User-facing label, e.g. 'DA001'
  createdBy?: string; // User ID (set after auth is implemented)
  createdAt: string;  // ISO timestamp
  updatedAt: string;
  syncStatus: SyncStatus;
}

// ─── Fiber Structure Record ───────────────────
export interface FiberRecord {
  id: string;                   // UUID
  displayId: string;            // e.g. 'HH27' — typeAbbrev + sequenceNum (for display)
  sequenceNum: number;          // Display-only, ordered by created_at within DA
  daId: string;                 // UUID of parent DA
  typeAbbrev: StructureTypeId;  // 'HH'
  structureType: string;        // 'HH 17x30'
  photoPath: string;            // absolute local path to compressed JPEG
  photoUrl?: string;            // cloud storage URL (set after sync)
  hasSC: boolean;               // Splice Enclosure present
  hasTerminal: boolean;         // Indexed Terminal present
  terminalDesignation?: string; // '2.13' — required if hasTerminal
  notes?: string;
  recordedBy: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
}

// ─── New record payload (before DB insert) ────
export interface NewRecordPayload {
  daId: string;
  daName?: string;
  structureType: string;
  typeAbbrev: StructureTypeId;
  photoPath: string;
  hasSC: boolean;
  hasTerminal: boolean;
  terminalDesignation?: string;
  notes?: string;
}

// ─── Edit record payload ──────────────────────
export interface EditRecordPayload {
  structureType: string;
  typeAbbrev: StructureTypeId;
  hasSC: boolean;
  hasTerminal: boolean;
  terminalDesignation?: string;
  notes?: string;
}

// ─── App settings (persisted in SQLite) ───────
export interface AppSettings {
  userName: string;
}

// ─── Export ───────────────────────────────────
export interface ExportRecord {
  record_id: string;
  display_id: string;
  da_name: string;
  photo_filename: string;
  structure_type: string;
  has_sc: string;
  has_terminal: string;
  terminal_designation: string;
  notes: string;
  recorded_by: string;
  created_at: string;
  updated_at: string;
}
