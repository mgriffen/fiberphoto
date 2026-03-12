import React, { memo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { FiberRecord } from '../types';
import { colors, fonts, spacing, radius } from './theme';

interface Props {
  record: FiberRecord;
  onPress: () => void;
}

export const RecordCard = memo(function RecordCard({ record, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <Image source={{ uri: record.photoPath }} style={styles.thumb} />
      <View style={styles.info}>
        <Text style={styles.id}>{record.id}</Text>
        <Text style={styles.type}>{record.structureType}</Text>
        <View style={styles.badges}>
          {record.hasSC && <Badge label="SC" />}
          {record.hasTerminal && (
            <Badge label={`T ${record.terminalDesignation ?? ''}`} />
          )}
        </View>
        {record.notes ? (
          <Text style={styles.notes} numberOfLines={1}>{record.notes}</Text>
        ) : null}
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
});

const Badge = memo(function Badge({ label }: { label: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginHorizontal: spacing.md,
    marginVertical: 5,
    padding: spacing.sm + 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  thumb: {
    width: 68,
    height: 68,
    borderRadius: radius.sm,
    backgroundColor: colors.border,
  },
  info: {
    flex: 1,
    marginLeft: spacing.md - 4,
  },
  id: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    fontFamily: fonts.mono,
  },
  type: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.sm - 2,
    marginTop: spacing.xs + 1,
  },
  badge: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm - 2,
    paddingHorizontal: spacing.sm - 1,
    paddingVertical: 2,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  notes: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 3,
  },
  chevron: {
    fontSize: 24,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
});
