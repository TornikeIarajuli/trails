import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { Icon } from '../ui/Icon';
import { useColors, ColorPalette } from '../../constants/colors';
import { TrailDifficulty } from '../../types/trail';
import { haptics } from '../../utils/haptics';
import { activeFilterCount } from '../../utils/trailFilters';
import { TrailFilterSheet } from './TrailFilterSheet';

interface TrailFiltersProps {
  search: string;
  onSearchChange: (text: string) => void;
  difficulty: TrailDifficulty | null;
  onDifficultyChange: (d: TrailDifficulty | null) => void;
  region: string | null;
  onRegionChange: (r: string | null) => void;
  regions: string[];
  /** Shown in place of the region choices when they do not apply; the region then does not count as set. */
  regionNote?: string | null;
  /** Clears every filter in the sheet (not the search). */
  onClearAll: () => void;
  /** Trails matching the current search and filters, or null while that is not known. */
  resultCount: number | null;
  resultsLoading: boolean;
}

/** The Explore search bar, and a Filters button that opens the difficulty and region filters. */
export function TrailFilters({
  search,
  onSearchChange,
  difficulty,
  onDifficultyChange,
  region,
  onRegionChange,
  regions,
  regionNote,
  onClearAll,
  resultCount,
  resultsLoading,
}: TrailFiltersProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const [sheetOpen, setSheetOpen] = useState(false);

  const activeCount = activeFilterCount({ difficulty, region: regionNote ? null : region });
  const filtersLabel = activeCount > 0 ? `Filters, ${activeCount} active` : 'Filters';

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.searchRow}>
          <Icon name="search" size={20} color={Colors.textLight} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search trails..."
            placeholderTextColor={Colors.textLight}
            value={search}
            onChangeText={onSearchChange}
            accessibilityLabel="Search trails"
            testID="search-input"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => onSearchChange('')} accessibilityLabel="Clear search" accessibilityRole="button">
              <Icon name="close-circle" size={20} color={Colors.textLight} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.filterButton, activeCount > 0 && styles.filterButtonActive]}
          onPress={() => {
            haptics.tap();
            Keyboard.dismiss();
            setSheetOpen(true);
          }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={filtersLabel}
          accessibilityHint="Opens difficulty and region filters"
          testID="filters-button"
        >
          <Icon
            name="options-outline"
            size={18}
            color={activeCount > 0 ? Colors.primary : Colors.textSecondary}
          />
          <Text style={[styles.filterText, activeCount > 0 && styles.filterTextActive]}>Filters</Text>
          {activeCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText} maxFontSizeMultiplier={1.3}>{activeCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <TrailFilterSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        difficulty={difficulty}
        onDifficultyChange={onDifficultyChange}
        region={region}
        onRegionChange={onRegionChange}
        regions={regions}
        regionNote={regionNote}
        activeCount={activeCount}
        onClearAll={onClearAll}
        resultCount={resultCount}
        resultsLoading={resultsLoading}
      />
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  container: {
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: Colors.background,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
  },
  searchRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surface,
  },
  filterButtonActive: {
    backgroundColor: Colors.primary + '15',
    borderColor: Colors.primary + '40',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterTextActive: {
    color: Colors.primary,
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
});
