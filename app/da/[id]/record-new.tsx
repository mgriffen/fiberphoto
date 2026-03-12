import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Image, Alert, Switch, ActivityIndicator,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { createRecord } from '@/db/recordRepository';
import { savePhoto } from '@/services/photoService';
import { getNextSequenceNum } from '@/utils/idGenerator';
import { isValidTerminalDesignation } from '@/utils/validators';
import { StructureTypePicker } from '@/components/StructureTypePicker';
import { useAppContext } from '@/context/AppContext';
import { colors, spacing, radius } from '@/components/theme';
import { StructureTypeId } from '@/types';

export default function RecordNewScreen() {
  const { id: daId, tempUri } = useLocalSearchParams<{ id: string; tempUri: string }>();
  const router = useRouter();
  const { userName } = useAppContext();

  const [structureType, setStructureType] = useState('');
  const [typeAbbrev, setTypeAbbrev] = useState<StructureTypeId>('HH');
  const [hasSC, setHasSC] = useState(false);
  const [hasTerminal, setHasTerminal] = useState(false);
  const [terminalDes, setTerminalDes] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
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
      const seqNum = await getNextSequenceNum();
      const photoPath = await savePhoto(tempUri, typeAbbrev, seqNum);

      await createRecord(
        {
          daId,
          structureType,
          typeAbbrev,
          photoPath,
          hasSC,
          hasTerminal,
          terminalDesignation: hasTerminal ? terminalDes.trim() : undefined,
          notes: notes.trim() || undefined,
        },
        userName || 'Unknown'
      );

      // Navigate back to DA detail (replaces stack so we don't land on home)
      router.replace(`/da/${daId}`);
    } catch (e: any) {
      Alert.alert('Save Failed', e.message ?? 'Unknown error');
      setSaving(false);
    }
  };

  const handleRetake = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Photo preview */}
        <Image source={{ uri: tempUri }} style={styles.photo} resizeMode="cover" />

        <TouchableOpacity style={styles.retakeBtn} onPress={handleRetake}>
          <Text style={styles.retakeText}>Retake Photo</Text>
        </TouchableOpacity>

        <View style={styles.form}>
          {/* Structure type */}
          <Text style={styles.label}>Structure Type *</Text>
          <StructureTypePicker
            selected={structureType}
            onSelect={(val, abbrev) => {
              setStructureType(val);
              setTypeAbbrev(abbrev);
            }}
          />

          <View style={styles.divider} />

          {/* SC toggle */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>SC — Splice Enclosure</Text>
              <Text style={styles.toggleSub}>Splice enclosure is present</Text>
            </View>
            <Switch
              value={hasSC}
              onValueChange={setHasSC}
              trackColor={{ true: colors.accent }}
              thumbColor="#fff"
            />
          </View>

          {/* T toggle */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>T — Indexed Terminal</Text>
              <Text style={styles.toggleSub}>Terminal is present</Text>
            </View>
            <Switch
              value={hasTerminal}
              onValueChange={v => {
                setHasTerminal(v);
                if (!v) setTerminalDes('');
              }}
              trackColor={{ true: colors.accent }}
              thumbColor="#fff"
            />
          </View>

          {/* Terminal designation — only if T is on */}
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
                returnKeyType="done"
              />
            </View>
          )}

          <View style={styles.divider} />

          {/* Notes */}
          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="Any additional notes..."
            placeholderTextColor={colors.textSecondary}
            value={notes}
            onChangeText={setNotes}
            multiline
            returnKeyType="default"
          />

          {/* Save */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.disabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveBtnText}>Save Record</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { paddingBottom: spacing.xl },
  photo: {
    width: '100%',
    height: 240,
    backgroundColor: '#000',
  },
  retakeBtn: {
    alignSelf: 'flex-end',
    margin: spacing.sm,
    padding: spacing.sm,
  },
  retakeText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  form: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
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
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
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
  toggleLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  toggleSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  indented: {
    marginLeft: spacing.md,
    gap: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  saveBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.md + 4,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  disabled: { opacity: 0.5 },
});
