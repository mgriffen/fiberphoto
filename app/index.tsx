import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Dimensions, Modal, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAppContext } from '@/context/AppContext';
import { useSyncContext } from '@/context/SyncContext';
import { getAllDAs } from '@/db/daRepository';
import { setSetting, getRecordsByDA, searchRecordsByDesignation } from '@/db/recordRepository';
import type { FiberRecord } from '@/types';
import { RecordCard } from '@/components/RecordCard';
import { colors, spacing, radius } from '@/components/theme';
import { useFocusEffect } from 'expo-router';

const DA_NAMES = Array.from({ length: 15 }, (_, i) =>
  `DA${String(i + 1).padStart(3, '0')}`
);

const GRID_COLS = 3;
const GRID_ROWS = 5;
const GRID_GAP = 8;

export default function WelcomeScreen() {
  const router = useRouter();
  const { userName, signOut, isReady } = useAppContext();
  const { syncState, syncProgress, isOnline, triggerSync, lastSyncedAt } = useSyncContext();
  const [selectedDA, setSelectedDA] = useState<string | null>(null);
  const [startSeq, setStartSeq] = useState('');
  const [showSeqModal, setShowSeqModal] = useState(false);
  const [recordCounts, setRecordCounts] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<(FiberRecord & { daName: string })[]>([]);

  const syncLabel = syncState === 'syncing' && syncProgress
    ? syncProgress.total > 0
      ? `Syncing ${syncProgress.current}/${syncProgress.total}`
      : 'Syncing...'
    : syncState === 'error'
      ? 'Sync Failed'
      : !isOnline
        ? 'Offline'
        : 'Sync';

  const loadCounts = useCallback(async () => {
    const das = await getAllDAs();
    const counts: Record<string, number> = {};
    for (const da of das) {
      const recs = await getRecordsByDA(da.id);
      counts[da.name] = (counts[da.name] ?? 0) + recs.length;
    }
    setRecordCounts(counts);
  }, []);

  useFocusEffect(
    useCallback(() => { loadCounts(); }, [loadCounts])
  );

  // Reload counts after sync completes
  useEffect(() => {
    if (lastSyncedAt > 0) {
      loadCounts();
    }
  }, [lastSyncedAt, loadCounts]);

  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      searchRecordsByDesignation(searchQuery.trim()).then(setSearchResults);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  if (!isReady) return null;

  const handleDAPress = (name: string) => {
    setSelectedDA(name);
    setShowSeqModal(true);
  };

  const handleOpenDA = async () => {
    if (!selectedDA) return;
    setShowSeqModal(false);
    if (startSeq.trim()) {
      const num = parseInt(startSeq.trim(), 10);
      if (num > 1) {
        await setSetting(`start_seq_${selectedDA}`, String(num));
      }
    }
    setStartSeq('');
    router.push(`/da/${selectedDA}`);
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Text style={styles.logo}>FiberPhoto</Text>
          <Text style={styles.userLabel}>{userName}</Text>
        </View>
        <View style={styles.topBarRight}>
          <TouchableOpacity
            style={[
              styles.syncBtn,
              syncState === 'syncing' && styles.syncBtnActive,
              syncState === 'error' && styles.syncBtnError,
              !isOnline && styles.syncBtnOffline,
            ]}
            onPress={triggerSync}
            disabled={syncState === 'syncing' || !isOnline}
          >
            {syncState === 'syncing' ? (
              <View style={styles.syncRow}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={[styles.syncBtnText, { color: '#fff' }]}>{syncLabel}</Text>
              </View>
            ) : (
              <Text style={[
                styles.syncBtnText,
                syncState === 'error' && { color: '#fff' },
              ]}>{syncLabel}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* DA Grid — fills remaining space */}
      <View style={styles.gridContainer}>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search records (e.g. HH23, FP12)"
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.searchClear}>
              <Text style={styles.searchClearText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {searchResults.length > 0 ? (
          <View style={styles.searchResults}>
            {searchResults.map(record => (
              <View key={record.id}>
                <Text style={styles.searchResultDA}>{record.daName}</Text>
                <RecordCard
                  record={record}
                  onPress={() => {
                    setSearchQuery('');
                    router.push(`/da/${record.daName}/record/${record.id}`);
                  }}
                />
              </View>
            ))}
          </View>
        ) : searchQuery.trim().length >= 2 ? (
          <View style={styles.searchEmpty}>
            <Text style={styles.searchEmptyText}>No records match "{searchQuery}"</Text>
          </View>
        ) : null}

        {searchQuery.trim().length < 2 && (
          <>
        <Text style={styles.gridTitle}>Select Distribution Area</Text>
        <View style={styles.grid}>
          {DA_NAMES.map(name => {
            const count = recordCounts[name];
            const hasRecords = count !== undefined && count > 0;
            return (
              <TouchableOpacity
                key={name}
                style={styles.daBtn}
                onPress={() => handleDAPress(name)}
                activeOpacity={0.7}
              >
                <Text style={styles.daBtnNumber}>
                  {name.replace('DA', '')}
                </Text>
                <Text style={styles.daBtnLabel}>
                  DA
                </Text>
                {hasRecords && (
                  <Text style={styles.countText}>{count} {count === 1 ? 'Record' : 'Records'}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
          </>
        )}
      </View>

      {/* Starting Sequence Modal */}
      <Modal
        visible={showSeqModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSeqModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowSeqModal(false)}
          >
            <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
              <Text style={styles.modalTitle}>Open {selectedDA}</Text>
              <Text style={styles.modalSubtitle}>
                {recordCounts[selectedDA ?? ''] > 0
                  ? `${recordCounts[selectedDA ?? '']} records`
                  : 'No records yet'}
              </Text>
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Starting Sequence # (optional)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="1"
                  placeholderTextColor={colors.textSecondary}
                  value={startSeq}
                  onChangeText={setStartSeq}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  onSubmitEditing={handleOpenDA}
                  autoFocus
                />
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => { setShowSeqModal(false); setStartSeq(''); }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalOpen} onPress={handleOpenDA}>
                  <Text style={styles.modalOpenText}>Open</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.primary,
  },

  // ─── Top Bar ──────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  topBarLeft: {
    flexShrink: 1,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logo: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  userLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
    marginTop: 1,
  },
  syncBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.sm + 2,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 2,
  },
  syncBtnActive: {
    backgroundColor: 'rgba(37,99,235,0.4)',
  },
  syncBtnError: {
    backgroundColor: colors.danger,
  },
  syncBtnOffline: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  syncBtnText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '700',
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  signOutBtn: {
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 2,
  },
  signOutText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '600',
  },

  // ─── Grid ─────────────────────────────────────────────
  gridContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg + 4,
    borderTopRightRadius: radius.lg + 4,
    paddingHorizontal: spacing.sm + 2,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.text,
  },
  searchClear: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  searchClearText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  searchResults: {
    flex: 1,
  },
  searchResultDA: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginLeft: spacing.md,
    marginTop: spacing.sm,
    marginBottom: 2,
  },
  searchEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchEmptyText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  gridTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: spacing.sm + 2,
  },
  grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  daBtn: {
    width: `${(100 - ((GRID_COLS - 1) * GRID_GAP * 100) / Dimensions.get('window').width) / GRID_COLS}%` as any,
    flexGrow: 1,
    flexBasis: '30%',
    maxWidth: '33%',
    height: `${(100 / GRID_ROWS) - 1.5}%` as any,
    backgroundColor: '#ffffff',
    borderRadius: radius.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    // Subtle elevation
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  daBtnNumber: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.primary,
    fontFamily: 'Courier New',
    letterSpacing: 1,
    lineHeight: 32,
  },
  daBtnLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.textSecondary,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginTop: -1,
    fontFamily: 'Courier New',
  },
  countText: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 2,
  },

  // ─── Modal ────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: '85%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
    fontFamily: 'Courier New',
    letterSpacing: 1,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
    marginTop: 2,
    marginBottom: spacing.md,
  },
  modalField: {
    gap: spacing.xs,
  },
  modalLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  modalInput: {
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md - 2,
    fontSize: 16,
    color: colors.text,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md + 4,
  },
  modalCancel: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm + 4,
    alignItems: 'center',
  },
  modalCancelText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  modalOpen: {
    flex: 2,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.sm + 4,
    alignItems: 'center',
  },
  modalOpenText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  disabled: {
    opacity: 0.4,
  },
});
