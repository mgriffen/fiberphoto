import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GapInfo } from '../types';
import { colors, spacing, radius } from './theme';

interface Props {
  gapInfo: GapInfo;
}

export function GapWarning({ gapInfo }: Props) {
  if (!gapInfo.hasGaps) return null;

  const gapList = gapInfo.gaps.slice(0, 8).join(', ');
  const overflow = gapInfo.gaps.length > 8 ? ` +${gapInfo.gaps.length - 8} more` : '';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>⚠ Missing Structure Numbers</Text>
      <Text style={styles.body}>
        The following structure numbers are missing from the global sequence:{' '}
        <Text style={styles.nums}>{gapList}{overflow}</Text>
      </Text>
      <Text style={styles.hint}>
        Open the affected DA to add the missing record or collapse the gap.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.warningLight,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
    borderRadius: radius.sm,
    padding: spacing.md,
    margin: spacing.md,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.warning,
    marginBottom: 4,
  },
  body: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  nums: {
    fontWeight: '700',
    fontFamily: 'Courier New',
  },
  hint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 6,
  },
});
