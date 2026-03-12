import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAppContext } from '@/context/AppContext';
import { createDA, daExists } from '@/db/daRepository';
import { getSetting, setSetting } from '@/db/recordRepository';
import { normaliseDAId, isValidDAId } from '@/utils/validators';
import { colors, spacing, radius } from '@/components/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const { userName, setUserName, isReady } = useAppContext();
  const [daInput, setDaInput] = useState('');
  const [nameInput, setNameInput] = useState(userName);
  const [savingName, setSavingName] = useState(false);
  const [seqInput, setSeqInput] = useState('');
  const [currentMinSeq, setCurrentMinSeq] = useState<number | null>(null);

  // Load current minSequenceNum on mount
  React.useEffect(() => {
    if (isReady) {
      getSetting('minSequenceNum').then(val => {
        if (val) setCurrentMinSeq(parseInt(val, 10));
      });
    }
  }, [isReady]);

  if (!isReady) return null;

  const handleCreateDA = async () => {
    const id = normaliseDAId(daInput);
    if (!isValidDAId(id)) {
      Alert.alert('Invalid DA ID', 'Enter a valid DA ID such as DA001 or DA012.');
      return;
    }
    if (!userName) {
      Alert.alert('Set Your Name', 'Please enter your name before creating a DA.');
      return;
    }
    const exists = await daExists(id);
    if (exists) {
      Alert.alert('DA Exists', `${id} already exists. Use "Load Existing DA" to open it.`);
      return;
    }
    await createDA(id);
    router.push(`/da/${id}`);
  };

  const handleSetStartingSeq = async () => {
    const num = parseInt(seqInput.trim(), 10);
    if (isNaN(num) || num < 1) {
      Alert.alert('Invalid Number', 'Enter a valid starting sequence number.');
      return;
    }
    await setSetting('minSequenceNum', String(num));
    setCurrentMinSeq(num);
    setSeqInput('');
    Alert.alert('Saved', `New records will start at #${num}.`);
  };

  const handleSaveName = async () => {
    const name = nameInput.trim();
    if (!name) return;
    setSavingName(true);
    await setUserName(name);
    setSavingName(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={styles.header}>
          <Text style={styles.logo}>FiberPhoto</Text>
          <Text style={styles.sub}>MCN Field Documentation Tool</Text>
        </View>

        <View style={styles.body}>
          {/* Name section */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Field Technician</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.flex]}
                placeholder="Enter your name"
                placeholderTextColor={colors.textSecondary}
                value={nameInput}
                onChangeText={setNameInput}
                returnKeyType="done"
                onSubmitEditing={handleSaveName}
              />
              <TouchableOpacity
                style={[styles.smallBtn, !nameInput.trim() && styles.disabled]}
                onPress={handleSaveName}
                disabled={!nameInput.trim() || savingName}
              >
                <Text style={styles.smallBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
            {userName ? (
              <Text style={styles.savedName}>Signed in as: {userName}</Text>
            ) : null}
          </View>

          <View style={styles.divider} />

          {/* Starting sequence number */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Starting Sequence Number</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.flex]}
                placeholder={currentMinSeq ? String(currentMinSeq) : 'e.g. 573'}
                placeholderTextColor={colors.textSecondary}
                value={seqInput}
                onChangeText={setSeqInput}
                keyboardType="number-pad"
                returnKeyType="done"
                onSubmitEditing={handleSetStartingSeq}
              />
              <TouchableOpacity
                style={[styles.smallBtn, !seqInput.trim() && styles.disabled]}
                onPress={handleSetStartingSeq}
                disabled={!seqInput.trim()}
              >
                <Text style={styles.smallBtnText}>Set</Text>
              </TouchableOpacity>
            </View>
            {currentMinSeq ? (
              <Text style={styles.savedName}>Next new record starts at #{currentMinSeq}</Text>
            ) : null}
          </View>

          <View style={styles.divider} />

          {/* Create DA */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Create New DA</Text>
            <TextInput
              style={styles.input}
              placeholder="DA001"
              placeholderTextColor={colors.textSecondary}
              value={daInput}
              onChangeText={setDaInput}
              autoCapitalize="characters"
              returnKeyType="go"
              onSubmitEditing={handleCreateDA}
            />
            <TouchableOpacity
              style={[styles.primaryBtn, (!daInput.trim() || !userName) && styles.disabled]}
              onPress={handleCreateDA}
              disabled={!daInput.trim() || !userName}
            >
              <Text style={styles.primaryBtnText}>Create DA</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* Load existing */}
          <TouchableOpacity
            style={[styles.secondaryBtn, !userName && styles.disabled]}
            onPress={() => {
              if (!userName) {
                Alert.alert('Set Your Name', 'Please enter your name before accessing DAs.');
                return;
              }
              router.push('/da-list');
            }}
          >
            <Text style={styles.secondaryBtnText}>Load Existing DA</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primary },
  flex: { flex: 1 },
  header: {
    backgroundColor: colors.primary,
    paddingTop: spacing.xl + spacing.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  logo: {
    fontSize: 36,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 1,
  },
  sub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  body: {
    flex: 1,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg + 4,
    borderTopRightRadius: radius.lg + 4,
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
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
  savedName: {
    fontSize: 13,
    color: colors.success,
    fontWeight: '600',
  },
  smallBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  smallBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.md + 2,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryBtn: {
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.md + 2,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: colors.accent,
    fontSize: 17,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  disabled: {
    opacity: 0.4,
  },
});
