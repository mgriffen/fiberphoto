import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAppContext } from '@/context/AppContext';
import { createDA, daExistsByName } from '@/db/daRepository';
import { setSetting } from '@/db/recordRepository';
import { normaliseDAId, isValidDAId } from '@/utils/validators';
import { colors, spacing, radius } from '@/components/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const { userName, signOut, isReady } = useAppContext();
  const [daInput, setDaInput] = useState('');
  const [startSeq, setStartSeq] = useState('');

  if (!isReady) return null;

  const handleCreateDA = async () => {
    const name = normaliseDAId(daInput);
    if (!isValidDAId(name)) {
      Alert.alert('Invalid DA ID', 'Enter a valid DA ID such as DA001 or DA012.');
      return;
    }
    const exists = await daExistsByName(name);
    if (exists) {
      Alert.alert('DA Exists', `${name} already exists. Use "Load Existing DA" to open it.`);
      return;
    }
    const da = await createDA(name);
    if (startSeq.trim()) {
      const num = parseInt(startSeq.trim(), 10);
      if (num > 1) {
        await setSetting(`start_seq_${da.id}`, String(num));
      }
    }
    router.push(`/da/${da.id}`);
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
          {/* Signed-in user */}
          <View style={styles.section}>
            <View style={styles.userRow}>
              <View style={styles.flex}>
                <Text style={styles.sectionLabel}>Signed in as</Text>
                <Text style={styles.userName}>{userName}</Text>
              </View>
              <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
                <Text style={styles.signOutText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
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
            <Text style={styles.sectionLabel}>Starting Sequence # (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="1"
              placeholderTextColor={colors.textSecondary}
              value={startSeq}
              onChangeText={setStartSeq}
              keyboardType="number-pad"
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[styles.primaryBtn, !daInput.trim() && styles.disabled]}
              onPress={handleCreateDA}
              disabled={!daInput.trim()}
            >
              <Text style={styles.primaryBtnText}>Create DA</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* Load existing */}
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push('/da-list')}
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
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
  },
  signOutBtn: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  signOutText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
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
