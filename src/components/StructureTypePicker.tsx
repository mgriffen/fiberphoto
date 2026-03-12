import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { STRUCTURE_OPTIONS } from '../types';
import { colors, structureColors, spacing, radius } from './theme';

interface Props {
  selected: string;
  onSelect: (value: string, abbreviation: 'FP' | 'HH' | 'BP') => void;
}

export function StructureTypePicker({ selected, onSelect }: Props) {
  return (
    <View style={styles.grid}>
      {STRUCTURE_OPTIONS.map(opt => {
        const active = selected === opt.value;
        const typeColor = structureColors[opt.abbreviation] ?? structureColors.HH;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.btn,
              active && { backgroundColor: typeColor.bg, borderColor: typeColor.border },
            ]}
            onPress={() => onSelect(opt.value, opt.abbreviation)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.abbrev,
              active && { color: typeColor.text },
            ]}>
              {opt.abbreviation}
            </Text>
            <Text style={[
              styles.label,
              active && { color: typeColor.text, fontWeight: '600' },
            ]} numberOfLines={2}>
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
  abbrev: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.textSecondary,
    marginBottom: 2,
    letterSpacing: 1,
  },
  label: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
