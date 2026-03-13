import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { getAllDAs } from '@/db/daRepository';
import { getRecordsByDA } from '@/db/recordRepository';
import { useSyncContext } from '@/context/SyncContext';
import { DA } from '@/types';
import { colors, spacing, radius } from '@/components/theme';

interface DAWithCount extends DA {
  recordCount: number;
}

export default function DAListScreen() {
  const router = useRouter();
  const { syncState, isOnline, triggerSync } = useSyncContext();
  const [das, setDas] = useState<DAWithCount[]>([]);
  const [filtered, setFiltered] = useState<DAWithCount[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  async function load() {
    setLoading(true);
    const allDAs = await getAllDAs();
    const withCounts: DAWithCount[] = await Promise.all(
      allDAs.map(async da => {
        const records = await getRecordsByDA(da.id);
        return { ...da, recordCount: records.length };
      })
    );
    setDas(withCounts);
    setFiltered(withCounts);
    setLoading(false);
  }

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleSync = async () => {
    await triggerSync();
    await load();
  };

  const handleSearch = (text: string) => {
    setSearch(text);
    setFiltered(das.filter(d => d.name.toUpperCase().includes(text.toUpperCase())));
  };

  const renderItem = useCallback(({ item }: { item: DAWithCount }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => router.push(`/da/${item.id}`)}
      activeOpacity={0.75}
    >
      <View style={styles.rowLeft}>
        <Text style={styles.daId}>{item.name}</Text>
        <Text style={styles.count}>
          {item.recordCount} structure{item.recordCount !== 1 ? 's' : ''}
        </Text>
      </View>
      {item.syncStatus !== 'synced' && (
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingBadgeText}>
            {item.syncStatus === 'pending' ? 'NEW' : 'EDITED'}
          </Text>
        </View>
      )}
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  ), []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Sync button bar */}
      <TouchableOpacity
        style={styles.statusBar}
        onPress={handleSync}
        disabled={!isOnline || syncState === 'syncing'}
        activeOpacity={0.7}
      >
        <View style={[styles.statusDot, { backgroundColor: isOnline ? colors.success : colors.warning }]} />
        <Text style={styles.statusText}>
          {!isOnline ? 'Offline' :
           syncState === 'syncing' ? 'Syncing...' :
           syncState === 'error' ? 'Sync error' :
           'Online'}
        </Text>
        {isOnline && syncState !== 'syncing' && (
          <View style={styles.syncBtn}>
            <Text style={styles.syncBtnText}>Sync Now</Text>
          </View>
        )}
        {syncState === 'syncing' && (
          <ActivityIndicator size="small" color={colors.accent} style={{ marginLeft: 'auto' }} />
        )}
      </TouchableOpacity>

      <TextInput
        style={styles.search}
        placeholder="Search DA..."
        placeholderTextColor={colors.textSecondary}
        value={search}
        onChangeText={handleSearch}
        autoCapitalize="characters"
        clearButtonMode="while-editing"
      />

      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No DAs found.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderItem}
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
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  syncBtn: {
    marginLeft: 'auto',
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 2,
  },
  syncBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  search: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    margin: spacing.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginHorizontal: spacing.md,
    marginVertical: 5,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 2,
  },
  rowLeft: { flex: 1 },
  daId: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    fontFamily: 'Courier New',
  },
  count: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  pendingBadge: {
    backgroundColor: colors.accentLight,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: spacing.sm,
  },
  pendingBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accent,
  },
  chevron: {
    fontSize: 24,
    color: colors.textSecondary,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
});
