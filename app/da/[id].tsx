import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, SafeAreaView
} from 'react-native';
import { Stack } from 'expo-router';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { getDAById } from '@/db/daRepository';
import { getRecordsByDA } from '@/db/recordRepository';
import { exportDA } from '@/services/exportService';
import { detectGapsInDA, detectGaps } from '@/utils/gapDetector';
import { RecordCard } from '@/components/RecordCard';
import { GapWarning } from '@/components/GapWarning';
import { DA, FiberRecord, GapInfo } from '@/types';
import { colors, spacing, radius } from '@/components/theme';

export default function DADetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [da, setDA] = useState<DA | null>(null);
  const [records, setRecords] = useState<FiberRecord[]>([]);
  const [gapInfo, setGapInfo] = useState<GapInfo>({ hasGaps: false, gaps: [], affectedDAs: [] });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [id])
  );

  async function load() {
    setLoading(true);
    const [daData, recs, gaps] = await Promise.all([
      getDAById(id),
      getRecordsByDA(id),
      detectGaps(),
    ]);
    setDA(daData);
    setRecords(recs);
    setGapInfo(gaps);
    setLoading(false);
  }

  const handleNewRecord = useCallback(() => {
    router.push(`/da/${id}/camera`);
  }, [id]);

  const renderItem = useCallback(({ item }: { item: FiberRecord }) => (
    <RecordCard
      record={item}
      onPress={() => router.push(`/da/${id}/record/${item.id}`)}
    />
  ), [id]);

  const handleExport = async () => {
    if (gapInfo.hasGaps) {
      Alert.alert(
        'Sequence Gaps Detected',
        `There are missing structure numbers (${gapInfo.gaps.slice(0, 5).join(', ')}${gapInfo.gaps.length > 5 ? '…' : ''}). ` +
        'Your export may be incomplete. Export anyway?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Export Anyway', onPress: doExport },
        ]
      );
    } else {
      doExport();
    }
  };

  const doExport = async () => {
    setExporting(true);
    try {
      await exportDA(id);
    } catch (e: any) {
      Alert.alert('Export Failed', e.message ?? 'Unknown error');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!da) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>DA not found.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: da.id }} />
      <FlatList
        data={records}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListHeaderComponent={
          <>
            {/* DA header */}
            <View style={styles.daHeader}>
              <Text style={styles.daId}>{da.id}</Text>
              <Text style={styles.count}>
                {records.length} structure{records.length !== 1 ? 's' : ''}
              </Text>
            </View>

            {/* Gap warning scoped to this DA */}
            {gapInfo.hasGaps && (
              <GapWarning gapInfo={gapInfo} />
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
            <Text style={styles.emptyText}>No records yet.</Text>
            <Text style={styles.emptyHint}>Tap "New Record" to start.</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: spacing.xl }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  daHeader: {
    backgroundColor: colors.primary,
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  daId: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    fontFamily: 'Courier New',
  },
  count: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
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
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md + 2,
    alignItems: 'center',
  },
  exportBtnText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  listLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginLeft: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  emptyHint: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  disabled: { opacity: 0.5 },
  errorText: { fontSize: 16, color: colors.danger },
});
