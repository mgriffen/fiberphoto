#!/usr/bin/env node
/**
 * Import Google Takeout photos into Supabase for FiberPhoto.
 *
 * Usage:
 *   node scripts/import-takeout.mjs <takeout-dir> <da-name> <email> <password> [--dry-run]
 *
 * Example:
 *   node scripts/import-takeout.mjs "/mnt/c/Users/mgrif/Downloads/DA001_Photos/Takeout/Google Photos/DA001" DA001 user@example.com mypassword
 *   node scripts/import-takeout.mjs "/mnt/c/Users/mgrif/Downloads/DA001_Photos/Takeout/Google Photos/DA001" DA001 user@example.com mypassword --dry-run
 *
 * Overrides for missing descriptions:
 *   Create a file called overrides.json in the takeout dir:
 *   { "PXL_20260303_224014911.jpg": "FP49" }
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://dvmrvfamnmezqnfjkdsi.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2bXJ2ZmFtbm1lenFuZmprZHNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNTI4ODIsImV4cCI6MjA4ODkyODg4Mn0.fx_yzM1lvPpJ--krjXNwXkObYiEV_7BuORAT0dvZc3U';

const DEFAULT_STRUCTURE_TYPES = {
  HH: 'HH 17x30',
  FP: 'FP 12x12',
  BP: 'BP',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateUUID() {
  return crypto.randomUUID();
}

function parseDescription(desc, overrides, filename) {
  // Check overrides first
  if (overrides[filename]) {
    desc = overrides[filename];
  }

  if (!desc || !desc.trim()) return null;

  const match = desc.trim().match(/^(HH|FP|BP)\s*(\d+)(\s+SC)?$/i);
  if (!match) {
    console.warn(`  ⚠ Could not parse description: "${desc}" (${filename})`);
    return null;
  }

  const typeAbbrev = match[1].toUpperCase();
  const seqNum = parseInt(match[2], 10);
  const hasSC = !!match[3];

  return {
    typeAbbrev,
    sequenceNum: seqNum,
    structureType: DEFAULT_STRUCTURE_TYPES[typeAbbrev] || typeAbbrev,
    hasSC,
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const filtered = args.filter(a => a !== '--dry-run');

  if (filtered.length < 4) {
    console.error('Usage: node import-takeout.mjs <takeout-dir> <da-name> <email> <password> [--dry-run]');
    process.exit(1);
  }

  const [takeoutDir, daName, email, password] = filtered;

  console.log(`\n📂 Import: ${takeoutDir}`);
  console.log(`📋 DA: ${daName}`);
  console.log(`${dryRun ? '🔍 DRY RUN — no changes will be made' : '🚀 LIVE RUN'}\n`);

  // Load overrides if present
  const overridesPath = path.join(takeoutDir, 'overrides.json');
  let overrides = {};
  if (fs.existsSync(overridesPath)) {
    overrides = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));
    console.log(`📝 Loaded ${Object.keys(overrides).length} description overrides\n`);
  }

  // Sign in (skip for dry run)
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  let userId = 'dry-run';
  if (!dryRun) {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      console.error('❌ Auth failed:', authError.message);
      process.exit(1);
    }
    userId = authData.user.id;
    console.log(`✅ Authenticated as ${email} (${userId})\n`);
  }

  // Find all JPG files
  const files = fs.readdirSync(takeoutDir).filter(f => f.toLowerCase().endsWith('.jpg'));
  console.log(`📷 Found ${files.length} photos\n`);

  // Parse each photo's sidecar JSON
  const records = [];
  const skipped = [];

  for (const file of files) {
    const jsonFile = path.join(takeoutDir, `${file}.supplemental-metada.json`);
    if (!fs.existsSync(jsonFile)) {
      console.warn(`  ⚠ No sidecar JSON for ${file}, skipping`);
      skipped.push(file);
      continue;
    }

    const meta = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
    const parsed = parseDescription(meta.description || '', overrides, file);

    if (!parsed) {
      console.warn(`  ⚠ Skipping ${file} — no valid description`);
      skipped.push(file);
      continue;
    }

    const timestamp = meta.photoTakenTime?.timestamp
      ? new Date(parseInt(meta.photoTakenTime.timestamp) * 1000).toISOString()
      : new Date().toISOString();

    records.push({
      file,
      filePath: path.join(takeoutDir, file),
      ...parsed,
      latitude: meta.geoData?.latitude || null,
      longitude: meta.geoData?.longitude || null,
      createdAt: timestamp,
    });
  }

  // Sort by sequence number
  records.sort((a, b) => a.sequenceNum - b.sequenceNum);

  console.log(`\n📊 Parsed ${records.length} records, skipped ${skipped.length}\n`);
  console.log('Records to import:');
  for (const r of records) {
    const sc = r.hasSC ? ' SC' : '';
    const gps = r.latitude ? ` (${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)})` : '';
    console.log(`  ${r.typeAbbrev}${r.sequenceNum}${sc} — ${r.structureType}${gps} — ${r.file}`);
  }

  if (skipped.length > 0) {
    console.log('\nSkipped files:');
    for (const f of skipped) console.log(`  ❌ ${f}`);
  }

  if (dryRun) {
    console.log('\n🔍 Dry run complete. No changes made.');
    return;
  }

  // Create or find DA
  console.log(`\n📁 Upserting DA: ${daName}`);
  const daId = generateUUID();
  const now = new Date().toISOString();

  // Check if DA already exists
  const { data: existingDA } = await supabase
    .from('das')
    .select('id')
    .eq('name', daName)
    .maybeSingle();

  const finalDAId = existingDA?.id || daId;

  if (!existingDA) {
    const { error: daError } = await supabase.from('das').insert({
      id: daId,
      name: daName,
      created_by: userId,
      created_at: now,
      updated_at: now,
    });
    if (daError) {
      console.error('❌ DA insert failed:', daError.message);
      process.exit(1);
    }
    console.log(`  ✅ Created DA ${daName} (${daId})`);
  } else {
    console.log(`  ✅ DA ${daName} already exists (${finalDAId})`);
  }

  // Import each record
  let success = 0;
  let errors = 0;

  for (const record of records) {
    const recordId = generateUUID();
    const storagePath = `${userId}/${recordId}.jpg`;

    process.stdout.write(`  ${record.typeAbbrev}${record.sequenceNum}... `);

    // Compress photo: 1920px wide, 70% JPEG quality (~400-500KB)
    const photoBytes = await sharp(record.filePath)
      .resize(1920, null, { withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer();
    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(storagePath, photoBytes, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      console.log(`❌ photo upload failed: ${uploadError.message}`);
      errors++;
      continue;
    }

    // Insert record
    const { error: recError } = await supabase.from('records').insert({
      id: recordId,
      da_id: finalDAId,
      sequence_num: record.sequenceNum,
      type_abbrev: record.typeAbbrev,
      structure_type: record.structureType,
      photo_url: storagePath,
      has_sc: record.hasSC,
      has_terminal: false,
      terminal_designation: null,
      latitude: record.latitude,
      longitude: record.longitude,
      notes: null,
      recorded_by: userId,
      created_at: record.createdAt,
      updated_at: record.createdAt,
    });

    if (recError) {
      console.log(`❌ record insert failed: ${recError.message}`);
      errors++;
      continue;
    }

    console.log('✅');
    success++;
  }

  console.log(`\n🏁 Done! ${success} imported, ${errors} errors, ${skipped.length} skipped`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
