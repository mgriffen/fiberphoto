import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { getDAById, deleteDA } from '@/db/daRepository';
import { getRecordsByDA, deleteRecordsByDA } from '@/db/recordRepository';
import { exportDA } from '@/services/exportService';
import { deletePhoto } from '@/services/photoService';
import { RecordCard } from '@/components/RecordCard';
import { useSyncContext } from '@/context/SyncContext';
import { DA, FiberRecord } from '@/types';
import { colors, spacing, radius } from '@/components/theme';

export default function DADetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
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
    }, [id])
  );

  async function load() {
    setLoading(true);
    const [daData, recs] = await Promise.all([
      getDAById(id),
      getRecordsByDA(id),
    ]);
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
    doExport();
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
    try {
      for (const record of records) {
        await deletePhoto(record.photoPath);
      }
      await deleteRecordsByDA(id);
      await deleteDA(id);
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

  if (!da) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>DA not found.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: da.name }} />
      <FlatList
        data={records}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListHeaderComponent={
          <>
            {/* DA header */}
            <View style={styles.daHeader}>
              <Text style={styles.daId}>{da.name}</Text>
              <View style={styles.statsRow}>
                <View style={styles.statBubble}>
                  <Text style={styles.statNum}>{records.length}</Text>
                  <Text style={styles.statLabel}>
                    structure{records.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                {records.length > 0 && (
                  <>
                    <View style={styles.statBubble}>
                      <Text style={styles.statNum}>
                        {records.filter(r => r.typeAbbrev === 'HH').length}
                      </Text>
                      <Text style={styles.statLabel}>HH</Text>
                    </View>
                    <View style={styles.statBubble}>
                      <Text style={styles.statNum}>
                        {records.filter(r => r.typeAbbrev === 'FP').length}
                      </Text>
                      <Text style={styles.statLabel}>FP</Text>
                    </View>
                    <View style={styles.statBubble}>
                      <Text style={styles.statNum}>
                        {records.filter(r => r.typeAbbrev === 'BP').length}
                      </Text>
                      <Text style={styles.statLabel}>BP</Text>
                    </View>
                  </>
                )}
              </View>
            </View>

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
        ListFooterComponent={
          <TouchableOpacity style={styles.deleteDABtn} onPress={handleDeleteDA}>
            <Text style={styles.deleteDAText}>Delete {da.name}</Text>
          </TouchableOpacity>
        }
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
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
    fontSize: 34,
    fontWeight: '900',
    color: '#fff',
    fontFamily: 'Courier New',
    letterSpacing: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  statBubble: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.sm + 2,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 2,
    alignItems: 'center',
    minWidth: 48,
  },
  statNum: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
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
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  emptyHint: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
    lineHeight: 20,
  },
  disabled: { opacity: 0.5 },
  errorText: { fontSize: 16, color: colors.danger },
  deleteDABtn: {
    marginHorizontal: spacing.md,
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.danger,
    backgroundColor: colors.dangerLight,
    alignItems: 'center',
  },
  deleteDAText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
});
