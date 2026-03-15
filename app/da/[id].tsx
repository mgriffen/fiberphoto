import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { getDAByName, getOrCreateDA, deleteDA } from '@/db/daRepository';
import { getRecordsByDA, deleteRecordsByDA } from '@/db/recordRepository';
import { exportDA } from '@/services/exportService';
import { deletePhoto } from '@/services/photoService';
import { RecordCard } from '@/components/RecordCard';
import { useSyncContext } from '@/context/SyncContext';
import { DA, FiberRecord } from '@/types';
import { colors, spacing, radius } from '@/components/theme';
import { ScreenBackground, BG_COLOR } from '@/components/ScreenBackground';

export default function DADetailScreen() {
  const { id: daName } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { triggerSync } = useSyncContext();

  const [da, setDA] = useState<DA | null>(null);
  const [records, setRecords] = useState<FiberRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [daName])
  );

  async function load() {
    setLoading(true);
    const daData = await getDAByName(daName);
    const recs = daData ? await getRecordsByDA(daData.id) : [];
    setDA(daData);
    setRecords(recs);
    setLoading(false);
  }

  const handleRefresh = async () => {
    setRefreshing(true);
    await triggerSync();
    await load();
    setRefreshing(false);
  };

  const handleNewRecord = useCallback(async () => {
    // Create DA on-demand only when user wants to add a record
    const daData = await getOrCreateDA(daName);
    router.push(`/da/${daName}/camera`);
  }, [daName]);

  const renderItem = useCallback(({ item }: { item: FiberRecord }) => (
    <RecordCard
      record={item}
      onPress={() => router.push(`/da/${daName}/record/${item.id}`)}
    />
  ), []);

  const handleExport = async () => {
    doExport();
  };

  const doExport = async () => {
    if (!da) return;
    setExporting(true);
    try {
      await exportDA(da.id);
    } catch (e: any) {
      Alert.alert('Export Failed', e.message ?? 'Unknown error');
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteDA = () => {
    if (!da) return;
    Alert.alert(
      'Delete DA',
      `Are you sure you want to delete ${da.name}?\n\nThis will permanently delete all ${records.length} record${records.length !== 1 ? 's' : ''} and their photos. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (records.length > 0) {
              Alert.alert(
                'Final Warning',
                `You are about to permanently delete ${da.name} with ${records.length} structure${records.length !== 1 ? 's' : ''}. This cannot be undone.`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: `Delete ${da.name}`,
                    style: 'destructive',
                    onPress: doDeleteDA,
                  },
                ]
              );
            } else {
              doDeleteDA();
            }
          },
        },
      ]
    );
  };

  const doDeleteDA = async () => {
    if (!da) return;
    try {
      for (const record of records) {
        await deletePhoto(record.photoPath);
      }
      await deleteRecordsByDA(da.id);
      await deleteDA(da.id);
      router.back();
    } catch (e: any) {
      Alert.alert('Delete Failed', e.message ?? 'Unknown error');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // DA may not exist yet (no records created) — show empty state with the name
  const displayName = da?.name ?? daName;

  // Detect gaps in sequence numbers within this DA
  const gaps: number[] = [];
  if (records.length >= 2) {
    const seqNums = records.map(r => r.sequenceNum).sort((a, b) => a - b);
    for (let i = 1; i < seqNums.length; i++) {
      for (let n = seqNums[i - 1] + 1; n < seqNums[i]; n++) {
        gaps.push(n);
      }
    }
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: displayName }} />

      <ScreenBackground />

      {/* Scrollable content on top */}
      <SafeAreaView style={styles.safe}>
        <FlatList
          data={records}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          ListHeaderComponent={
            <>
              {/* DA title — transparent, text over background */}
              <View style={styles.daHeader}>
                <Text style={styles.daId}>{displayName}</Text>
                <Text style={styles.structureCount}>
                  {records.length} structure{records.length !== 1 ? 's' : ''}
                </Text>
              </View>

              {/* Gap warning */}
              {gaps.length > 0 && (
                <View style={styles.gapWarning}>
                  <Text style={styles.gapWarningText}>
                    <Text style={styles.gapWarningBold}>
                      {gaps.length} missing{' '}
                    </Text>
                    #{gaps.length <= 10 ? gaps.join(', #') : gaps.slice(0, 10).join(', #') + ` +${gaps.length - 10} more`}
                  </Text>
                </View>
              )}

              {/* Action buttons */}
              <View style={styles.actions}>
                <TouchableOpacity style={styles.newBtn} onPress={handleNewRecord}>
                  <Text style={styles.newBtnText}>+ New Record</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.exportBtn, (exporting || records.length === 0) && styles.disabled]}
                  onPress={handleExport}
                  disabled={exporting || records.length === 0}
                >
                  <Text style={styles.exportBtnText}>
                    {exporting ? 'Exporting…' : 'Export ZIP'}
                  </Text>
                </TouchableOpacity>
              </View>

              {records.length > 0 && (
                <Text style={styles.listLabel}>Records</Text>
              )}
            </>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📷</Text>
              <Text style={styles.emptyText}>No structures recorded</Text>
              <Text style={styles.emptyHint}>Tap "+ New Record" to photograph your first structure</Text>
            </View>
          }
          ListFooterComponent={da ? (
            <TouchableOpacity style={styles.deleteDABtn} onPress={handleDeleteDA}>
              <Text style={styles.deleteDAText}>Delete {da.name}</Text>
            </TouchableOpacity>
          ) : null}
          contentContainerStyle={{ paddingBottom: spacing.xl }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#fff"
              colors={['#fff']}
            />
          }
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_COLOR },
  safe: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // ─── Header (transparent, over background) ──────────────
  daHeader: {
    alignItems: 'center',
    paddingVertical: spacing.lg + spacing.md,
    paddingHorizontal: spacing.md,
  },
  daId: {
    fontSize: 38,
    fontWeight: '900',
    color: '#fff',
    fontFamily: 'Courier New',
    letterSpacing: 3,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  structureCount: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    marginTop: 4,
    letterSpacing: 0.5,
  },

  // ─── Actions (opaque cards) ─────────────────────────────
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  newBtn: {
    flex: 2,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.md + 2,
    alignItems: 'center',
  },
  newBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  exportBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.md,
    padding: spacing.md + 2,
    alignItems: 'center',
  },
  exportBtnText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },

  // ─── List ───────────────────────────────────────────────
  listLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginLeft: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
  },
  emptyHint: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginTop: spacing.xs,
    textAlign: 'center',
    lineHeight: 20,
  },
  disabled: { opacity: 0.5 },

  // ─── Gap Warning ────────────────────────────────────────
  gapWarning: {
    backgroundColor: 'rgba(255, 237, 213, 0.95)',
    borderWidth: 1.5,
    borderColor: colors.warning,
    borderRadius: radius.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 3,
  },
  gapWarningText: {
    fontSize: 12,
    color: colors.warning,
  },
  gapWarningBold: {
    fontWeight: '700',
  },

  // ─── Footer ─────────────────────────────────────────────
  errorText: { fontSize: 16, color: colors.danger },
  deleteDABtn: {
    marginHorizontal: spacing.md,
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'rgba(239,68,68,0.7)',
    backgroundColor: 'rgba(254,226,226,0.92)',
    alignItems: 'center',
  },
  deleteDAText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
});
