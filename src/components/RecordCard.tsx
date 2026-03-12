import React, { memo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { FiberRecord } from '../types';
import { colors, structureColors, fonts, spacing, radius } from './theme';

interface Props {
  record: FiberRecord;
  onPress: () => void;
}

export const RecordCard = memo(function RecordCard({ record, onPress }: Props) {
  const typeColor = structureColors[record.typeAbbrev] ?? structureColors.HH;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <Image source={{ uri: record.photoPath }} style={styles.thumb} />
      <View style={styles.info}>
        <View style={styles.topRow}>
          <Text style={styles.id}>{record.id}</Text>
          <View style={[styles.typePill, { backgroundColor: typeColor.bg, borderColor: typeColor.border }]}>
            <Text style={[styles.typePillText, { color: typeColor.text }]}>{record.typeAbbrev}</Text>
          </View>
        </View>
        <Text style={styles.type}>{record.structureType}</Text>
        <View style={styles.badges}>
          {record.hasSC && <Badge label="SC" color={colors.accent} />}
          {record.hasTerminal && (
            <Badge label={`T ${record.terminalDesignation ?? ''}`} color="#7c3aed" />
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

const Badge = memo(function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
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
    marginVertical: 4,
    padding: spacing.sm + 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: radius.sm + 2,
    backgroundColor: colors.border,
  },
  info: {
    flex: 1,
    marginLeft: spacing.sm + 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  id: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    fontFamily: fonts.mono,
    letterSpacing: 0.5,
  },
  typePill: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 1,
  },
  typePillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  type: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.sm - 2,
    marginTop: spacing.xs,
  },
  badge: {
    borderRadius: radius.sm - 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  notes: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 3,
  },
  chevron: {
    fontSize: 22,
    color: colors.border,
    marginLeft: spacing.sm,
  },
});
