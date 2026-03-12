import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, SafeAreaView, ActivityIndicator
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { getAllDAs } from '@/db/daRepository';
import { getRecordsByDA } from '@/db/recordRepository';
import { detectGaps } from '@/utils/gapDetector';
import { GapWarning } from '@/components/GapWarning';
import { DA, GapInfo } from '@/types';
import { colors, spacing, radius } from '@/components/theme';

interface DAWithCount extends DA {
  recordCount: number;
}

export default function DAListScreen() {
  const router = useRouter();
  const [das, setDas] = useState<DAWithCount[]>([]);
  const [filtered, setFiltered] = useState<DAWithCount[]>([]);
  const [search, setSearch] = useState('');
  const [gapInfo, setGapInfo] = useState<GapInfo>({ hasGaps: false, gaps: [], affectedDAs: [] });
  const [loading, setLoading] = useState(true);

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
    const gaps = await detectGaps();
    setDas(withCounts);
    setFiltered(withCounts);
    setGapInfo(gaps);
    setLoading(false);
  }

  const handleSearch = (text: string) => {
    setSearch(text);
    setFiltered(das.filter(d => d.id.toUpperCase().includes(text.toUpperCase())));
  };

  const renderItem = useCallback(({ item }: { item: DAWithCount }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => router.push(`/da/${item.id}`)}
      activeOpacity={0.75}
    >
      <View style={styles.rowLeft}>
        <Text style={styles.daId}>{item.id}</Text>
        <Text style={styles.count}>
          {item.recordCount} structure{item.recordCount !== 1 ? 's' : ''}
        </Text>
      </View>
      {gapInfo.affectedDAs.includes(item.id) && (
        <View style={styles.gapBadge}>
          <Text style={styles.gapBadgeText}>GAP</Text>
        </View>
      )}
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  ), [gapInfo.affectedDAs]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <GapWarning gapInfo={gapInfo} />

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
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  gapBadge: {
    backgroundColor: colors.warningLight,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: spacing.sm,
  },
  gapBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.warning,
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
