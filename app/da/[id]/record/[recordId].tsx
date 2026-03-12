import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Image, Alert, Switch, ActivityIndicator,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { getRecordById, updateRecord, deleteRecord } from '@/db/recordRepository';
import { deletePhoto } from '@/services/photoService';
import { previewCascadeDecrement, performCascadeDecrement } from '@/services/renumberService';
import { detectGaps } from '@/utils/gapDetector';
import { isValidTerminalDesignation } from '@/utils/validators';
import { StructureTypePicker } from '@/components/StructureTypePicker';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FiberRecord, StructureTypeId } from '@/types';
import { colors, spacing, radius } from '@/components/theme';

export default function RecordDetailScreen() {
  const { id: daId, recordId } = useLocalSearchParams<{ id: string; recordId: string }>();
  const router = useRouter();

  const [record, setRecord] = useState<FiberRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [structureType, setStructureType] = useState('');
  const [typeAbbrev, setTypeAbbrev] = useState<StructureTypeId>('HH');
  const [hasSC, setHasSC] = useState(false);
  const [hasTerminal, setHasTerminal] = useState(false);
  const [terminalDes, setTerminalDes] = useState('');
  const [notes, setNotes] = useState('');

  // Dialog state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCollapseConfirm, setShowCollapseConfirm] = useState(false);
  const [collapsePreview, setCollapsePreview] = useState({ affectedCount: 0, affectedDAs: [] as string[] });

  useEffect(() => { loadRecord(); }, [recordId]);

  async function loadRecord() {
    setLoading(true);
    const r = await getRecordById(recordId);
    if (r) {
      setRecord(r);
      populateEdit(r);
    }
    setLoading(false);
  }

  function populateEdit(r: FiberRecord) {
    setStructureType(r.structureType);
    setTypeAbbrev(r.typeAbbrev);
    setHasSC(r.hasSC);
    setHasTerminal(r.hasTerminal);
    setTerminalDes(r.terminalDesignation ?? '');
    setNotes(r.notes ?? '');
  }

  const handleSaveEdit = async () => {
    if (!structureType) {
      Alert.alert('Required', 'Please select a structure type.');
      return;
    }
    if (hasTerminal && !isValidTerminalDesignation(terminalDes)) {
      Alert.alert('Invalid Format', 'Terminal designation must be in x.x or x.xx format (e.g. 1.1, 2.13, 10.10).');
      return;
    }
    setSaving(true);
    try {
      await updateRecord(recordId, {
        structureType,
        typeAbbrev,
        hasSC,
        hasTerminal,
        terminalDesignation: hasTerminal ? terminalDes.trim() : undefined,
        notes: notes.trim() || undefined,
      });
      await loadRecord();
      setEditing(false);
    } catch (e: any) {
      Alert.alert('Save Failed', e.message ?? 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePress = async () => {
    if (!record) return;

    // Check if deleting this creates a gap
    const gaps = await detectGaps();
    const wouldCreateGap = !gaps.hasGaps; // currently clean — delete would create one

    if (wouldCreateGap) {
      const preview = await previewCascadeDecrement(record.sequenceNum);
      setCollapsePreview(preview);
      setShowDeleteConfirm(true);
    } else {
      setShowDeleteConfirm(true);
    }
  };

  const handleConfirmDelete = async () => {
    if (!record) return;
    setShowDeleteConfirm(false);
    try {
      await deletePhoto(record.photoPath);
      await deleteRecord(record.id);
      router.back();
    } catch (e: any) {
      Alert.alert('Delete Failed', e.message ?? 'Unknown error');
    }
  };

  const handleCollapsePress = async () => {
    if (!record) return;
    const preview = await previewCascadeDecrement(record.sequenceNum);
    setCollapsePreview(preview);
    setShowCollapseConfirm(true);
  };

  const handleConfirmCollapse = async () => {
    if (!record) return;
    setShowCollapseConfirm(false);
    try {
      await deletePhoto(record.photoPath);
      await deleteRecord(record.id);
      await performCascadeDecrement(record.sequenceNum - 1);
      router.back();
    } catch (e: any) {
      Alert.alert('Renumber Failed', e.message ?? 'Unknown error');
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /></View>;
  }

  if (!record) {
    return <View style={styles.center}><Text style={styles.errorText}>Record not found.</Text></View>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: record.id }} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Photo */}
        <Image source={{ uri: record.photoPath }} style={styles.photo} resizeMode="cover" />

        {/* Record ID banner */}
        <View style={styles.idBanner}>
          <Text style={styles.recordId}>{record.id}</Text>
          <Text style={styles.daId}>{record.daId}</Text>
        </View>

        <View style={styles.body}>
          {editing ? (
            /* ── Edit mode ─────────────────────────────────── */
            <>
              <Text style={styles.label}>Structure Type *</Text>
              <StructureTypePicker
                selected={structureType}
                onSelect={(val, abbrev) => {
                  setStructureType(val);
                  setTypeAbbrev(abbrev);
                }}
              />

              <View style={styles.divider} />

              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleLabel}>SC — Splice Enclosure</Text>
                </View>
                <Switch
                  value={hasSC}
                  onValueChange={setHasSC}
                  trackColor={{ true: colors.accent }}
                  thumbColor="#fff"
                />
              </View>

              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleLabel}>T — Indexed Terminal</Text>
                </View>
                <Switch
                  value={hasTerminal}
                  onValueChange={v => { setHasTerminal(v); if (!v) setTerminalDes(''); }}
                  trackColor={{ true: colors.accent }}
                  thumbColor="#fff"
                />
              </View>

              {hasTerminal && (
                <View style={styles.indented}>
                  <Text style={styles.label}>Terminal Designation *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 2.13"
                    placeholderTextColor={colors.textSecondary}
                    value={terminalDes}
                    onChangeText={setTerminalDes}
                    keyboardType="decimal-pad"
                  />
                </View>
              )}

              <View style={styles.divider} />

              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                placeholder="Optional notes..."
                placeholderTextColor={colors.textSecondary}
                value={notes}
                onChangeText={setNotes}
                multiline
              />

              <View style={styles.editActions}>
                <TouchableOpacity
                  style={styles.cancelEditBtn}
                  onPress={() => { setEditing(false); populateEdit(record); }}
                >
                  <Text style={styles.cancelEditText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, saving && styles.disabled]}
                  onPress={handleSaveEdit}
                  disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.saveBtnText}>Save Changes</Text>
                  }
                </TouchableOpacity>
              </View>
            </>
          ) : (
            /* ── View mode ─────────────────────────────────── */
            <>
              <Field label="Structure Type" value={record.structureType} />
              <Field label="Splice Enclosure (SC)" value={record.hasSC ? 'Yes' : 'No'} />
              <Field
                label="Indexed Terminal (T)"
                value={record.hasTerminal
                  ? `Yes — ${record.terminalDesignation ?? ''}`
                  : 'No'}
              />
              {record.notes ? <Field label="Notes" value={record.notes} /> : null}
              <Field label="Recorded By" value={record.recordedBy} />
              <Field
                label="Created"
                value={new Date(record.createdAt).toLocaleString()}
              />
              {record.createdAt !== record.updatedAt && (
                <Field
                  label="Last Updated"
                  value={new Date(record.updatedAt).toLocaleString()}
                />
              )}

              <View style={styles.divider} />

              <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
                <Text style={styles.editBtnText}>Edit Record</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.deleteBtn} onPress={handleDeletePress}>
                <Text style={styles.deleteBtnText}>Delete Record</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.collapseBtn} onPress={handleCollapsePress}>
                <Text style={styles.collapseBtnText}>Delete & Collapse Gap</Text>
                <Text style={styles.collapseHint}>
                  Deletes this record and renumbers all subsequent structures down by 1 across all DAs.
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>

      {/* Delete confirmation */}
      <ConfirmDialog
        visible={showDeleteConfirm}
        title="Delete Record"
        message={`Delete ${record.id}? This will create a gap in the sequence. Use "Delete & Collapse Gap" to avoid a gap.`}
        confirmLabel="Delete"
        confirmDanger
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* Collapse confirmation */}
      <ConfirmDialog
        visible={showCollapseConfirm}
        title="Delete & Renumber"
        message={
          `This will delete ${record.id} and renumber ${collapsePreview.affectedCount} records ` +
          `across ${collapsePreview.affectedDAs.length} DA(s): ${collapsePreview.affectedDAs.join(', ')}.\n\n` +
          `All photo files will be renamed. This cannot be undone.`
        }
        confirmLabel="Renumber"
        confirmDanger
        onConfirm={handleConfirmCollapse}
        onCancel={() => setShowCollapseConfirm(false)}
      />
    </SafeAreaView>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={fieldStyles.row}>
      <Text style={fieldStyles.label}>{label}</Text>
      <Text style={fieldStyles.value}>{value}</Text>
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  row: {
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  value: {
    fontSize: 15,
    color: colors.text,
  },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { paddingBottom: spacing.xl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  photo: {
    width: '100%',
    height: 240,
    backgroundColor: '#000',
  },
  idBanner: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recordId: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    fontFamily: 'Courier New',
  },
  daId: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'Courier New',
  },
  body: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: colors.border,
  },
  toggleInfo: { flex: 1 },
  toggleLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  indented: { marginLeft: spacing.md, gap: spacing.xs },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  editActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  cancelEditBtn: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelEditText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  editBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.md + 2,
    alignItems: 'center',
  },
  editBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  saveBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  deleteBtn: {
    backgroundColor: colors.dangerLight,
    borderRadius: radius.md,
    padding: spacing.md + 2,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.danger,
    marginTop: spacing.xs,
  },
  deleteBtnText: { color: colors.danger, fontSize: 16, fontWeight: '700' },
  collapseBtn: {
    backgroundColor: colors.warningLight,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.warning,
    marginTop: spacing.xs,
  },
  collapseBtnText: { color: colors.warning, fontSize: 15, fontWeight: '700', marginBottom: 3 },
  collapseHint: { fontSize: 12, color: colors.textSecondary, lineHeight: 16 },
  errorText: { fontSize: 16, color: colors.danger },
  disabled: { opacity: 0.5 },
});
