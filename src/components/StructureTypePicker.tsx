import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { STRUCTURE_OPTIONS } from '../types';
import { colors, spacing, radius } from './theme';

interface Props {
  selected: string;
  onSelect: (value: string, abbreviation: 'FP' | 'HH' | 'BP') => void;
}

export function StructureTypePicker({ selected, onSelect }: Props) {
  return (
    <View style={styles.grid}>
      {STRUCTURE_OPTIONS.map(opt => {
        const active = selected === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.btn, active && styles.btnActive]}
            onPress={() => onSelect(opt.value, opt.abbreviation)}
            activeOpacity={0.75}
          >
            <Text style={[styles.abbrev, active && styles.abbrevActive]}>
              {opt.abbreviation}
            </Text>
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={2}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  btn: {
    width: '47%',
    backgroundColor: colors.inputBg,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    alignItems: 'center',
  },
  btnActive: {
    backgroundColor: colors.accentLight,
    borderColor: colors.accent,
  },
  abbrev: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  abbrevActive: {
    color: colors.accent,
  },
  label: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  labelActive: {
    color: colors.accent,
    fontWeight: '600',
  },
});
