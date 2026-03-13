import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import JSZip from 'jszip';
import { getRecordsByDA } from '../db/recordRepository';
import { getDAById } from '../db/daRepository';
import { readPhotoAsBase64 } from './photoService';
import { ExportRecord, FiberRecord } from '../types';

const EXPORT_DIR = `${FileSystem.cacheDirectory}fiberphoto-exports/`;

export async function exportDA(daId: string): Promise<void> {
  const [records, da] = await Promise.all([
    getRecordsByDA(daId),
    getDAById(daId),
  ]);
  const daName = da?.name ?? daId;

  if (records.length === 0) {
    throw new Error('No records to export.');
  }

  const zip = new JSZip();
  const folder = zip.folder(daName)!;

  // Add each photo
  for (const record of records) {
    const filename = `${record.displayId}.jpg`;
    const base64 = await readPhotoAsBase64(record.photoPath);
    folder.file(filename, base64, { base64: true });
  }

  // Build CSV
  const csv = buildCSV(records, daName);
  folder.file('records.csv', csv);

  // Build JSON
  const json = buildJSON(records, daName);
  folder.file('records.json', json);

  // Generate ZIP
  const zipBase64 = await zip.generateAsync({ type: 'base64' });

  // Write ZIP to cache
  const info = await FileSystem.getInfoAsync(EXPORT_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(EXPORT_DIR, { intermediates: true });
  }

  const zipPath = `${EXPORT_DIR}${daName}-export.zip`;
  await FileSystem.writeAsStringAsync(zipPath, zipBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Share
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device.');

  await Sharing.shareAsync(zipPath, {
    mimeType: 'application/zip',
    dialogTitle: `Export ${daName}`,
    UTI: 'public.zip-archive',
  });
}

// ─── CSV ─────────────────────────────────────────────────────────────────

function buildCSV(records: FiberRecord[], daName: string): string {
  const headers = [
    'record_id',
    'display_id',
    'da_name',
    'photo_filename',
    'structure_type',
    'has_sc',
    'has_terminal',
    'terminal_designation',
    'notes',
    'recorded_by',
    'created_at',
    'updated_at',
  ];

  const rows = records.map(r => [
    r.id,
    r.displayId,
    daName,
    `${r.displayId}.jpg`,
    r.structureType,
    r.hasSC ? 'yes' : 'no',
    r.hasTerminal ? 'yes' : 'no',
    r.terminalDesignation ?? '',
    csvEscape(r.notes ?? ''),
    r.recordedBy,
    r.createdAt,
    r.updatedAt,
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ─── JSON ────────────────────────────────────────────────────────────────

function buildJSON(records: FiberRecord[], daName: string): string {
  const exportRecords: ExportRecord[] = records.map(r => ({
    record_id: r.id,
    display_id: r.displayId,
    da_name: daName,
    photo_filename: `${r.displayId}.jpg`,
    structure_type: r.structureType,
    has_sc: r.hasSC ? 'yes' : 'no',
    has_terminal: r.hasTerminal ? 'yes' : 'no',
    terminal_designation: r.terminalDesignation ?? '',
    notes: r.notes ?? '',
    recorded_by: r.recordedBy,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  }));

  return JSON.stringify({ da_name: daName, records: exportRecords }, null, 2);
}
