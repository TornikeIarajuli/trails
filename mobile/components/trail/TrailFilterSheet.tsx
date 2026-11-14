import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useColors, ColorPalette } from '../../constants/colors';
import { TrailDifficulty } from '../../types/trail';
import { haptics } from '../../utils/haptics';
import { DIFFICULTY_OPTIONS, difficultyLabel, showResultsLabel } from '../../utils/trailFilters';
import { Sheet, SheetButton } from '../ui/Sheet';

interface TrailFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  difficulty: TrailDifficulty | null;
  onDifficultyChange: (d: TrailDifficulty | null) => void;
  region: string | null;
  onRegionChange: (r: string | null) => void;
  regions: string[];
  /** Shown in place of the region choices when they do not apply (Near Me). */
  regionNote?: string | null;
  /** How many filters are set; "Clear all" shows only when there are some. */
  activeCount: number;
  onClearAll: () => void;
  /** Trails matching the current filters, or null while that is not known. */
  resultCount: number | null;
  resultsLoading: boolean;
}

/**
 * Bottom sheet with the Explore filters. Every choice applies at once, so the list behind
 * the sheet follows along; the button at the bottom only closes the sheet.
 */
export function TrailFilterSheet({
  visible,
  onClose,
  difficulty,
  onDifficultyChange,
  region,
  onRegionChange,
  regions,
  regionNote,
  activeCount,
  onClearAll,
  resultCount,
  resultsLoading,
}: TrailFilterSheetProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const resultsLabel = showResultsLabel(resultsLoading ? null : resultCount);

  const chip = (key: string, label: string, selected: boolean, onPress: () => void) => (
    <TouchableOpacity
      key={key}
      style={[styles.chip, selected && styles.chipActive]}
      onPress={() => {
        if (!selected) haptics.select();
        onPress();
      }}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Filters"
      closeLabel="Close filters"
      headerRight={
        activeCount > 0 ? (
          <TouchableOpacity
            onPress={() => {
              haptics.select();
              onClearAll();
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Clear all filters"
          >
            <Text style={styles.clearAll}>Clear all</Text>
          </TouchableOpacity>
        ) : null
      }
      footer={
        <SheetButton
          title={resultsLabel}
          onPress={onClose}
          busy={resultsLoading}
          testID="filters-show-results"
          accessibilityLabel={resultsLabel}
        />
      }
    >
      <Text style={[styles.sectionTitle, styles.firstSection]}>Difficulty</Text>
      <View style={styles.chips}>
        {chip('any', 'Any', difficulty === null, () => onDifficultyChange(null))}
        {DIFFICULTY_OPTIONS.map((d) =>
          chip(d, difficultyLabel(d), difficulty === d, () => onDifficultyChange(d)),
        )}
      </View>

      <Text style={styles.sectionTitle}>Region</Text>
      {regionNote ? (
        <Text style={styles.note}>{regionNote}</Text>
      ) : regions.length === 0 ? (
        <Text style={styles.note}>Regions are not available right now.</Text>
      ) : (
        <View style={styles.chips}>
          {chip('all', 'All regions', region === null, () => onRegionChange(null))}
          {regions.map((r) => chip(r, r, region === r, () => onRegionChange(r)))}
        </View>
      )}
    </Sheet>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    clearAll: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.primary,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: Colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 16,
      marginBottom: 10,
    },
    firstSection: {
      marginTop: 4,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      paddingHorizontal: 16,
      minHeight: 38,
      justifyContent: 'center',
      borderRadius: 20,
      backgroundColor: Colors.background,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    chipActive: {
      backgroundColor: Colors.primary,
      borderColor: Colors.primary,
    },
    chipText: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.textSecondary,
    },
    chipTextActive: {
      color: Colors.textOnPrimary,
    },
    note: {
      fontSize: 14,
      lineHeight: 20,
      color: Colors.textSecondary,
    },
  });
