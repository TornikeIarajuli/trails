import React from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { TrailDifficulty } from '../../types/trail';

const DIFFICULTIES: (TrailDifficulty | null)[] = [null, 'easy', 'medium', 'hard', 'ultra'];

interface TrailFiltersProps {
  search: string;
  onSearchChange: (text: string) => void;
  difficulty: TrailDifficulty | null;
  onDifficultyChange: (d: TrailDifficulty | null) => void;
  region: string | null;
  onRegionChange: (r: string | null) => void;
  regions: string[];
}

export function TrailFilters({
  search,
  onSearchChange,
  difficulty,
  onDifficultyChange,
  region,
  onRegionChange,
  regions,
}: TrailFiltersProps) {
  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={20} color={Colors.textLight} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search trails..."
          placeholderTextColor={Colors.textLight}
          value={search}
          onChangeText={onSearchChange}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => onSearchChange('')}>
            <Ionicons name="close-circle" size={20} color={Colors.textLight} />
          </TouchableOpacity>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
        {DIFFICULTIES.map((d) => (
          <TouchableOpacity
            key={d ?? 'all'}
            style={[styles.chip, difficulty === d && styles.chipActive]}
            onPress={() => onDifficultyChange(d)}
          >
            <Text style={[styles.chipText, difficulty === d && styles.chipTextActive]}>
              {d ? d.charAt(0).toUpperCase() + d.slice(1) : 'All'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {regions.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
          <TouchableOpacity
            style={[styles.chip, styles.regionChip, region === null && styles.regionChipActive]}
            onPress={() => onRegionChange(null)}
          >
            <Ionicons
              name="map-outline"
              size={14}
              color={region === null ? Colors.textOnPrimary : Colors.textSecondary}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.chipText, region === null && styles.regionChipTextActive]}>
              All Regions
            </Text>
          </TouchableOpacity>
          {regions.map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.chip, styles.regionChip, region === r && styles.regionChipActive]}
              onPress={() => onRegionChange(r)}
            >
              <Text style={[styles.chipText, region === r && styles.regionChipTextActive]}>
                {r}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: Colors.background,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginHorizontal: 16,
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
  chips: {
    paddingHorizontal: 12,
    marginTop: 10,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.textOnPrimary,
  },
  regionChip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  regionChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  regionChipTextActive: {
    color: Colors.textOnPrimary,
  },
});
