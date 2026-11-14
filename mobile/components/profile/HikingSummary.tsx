import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '../ui/Icon';
import { useColors, ColorPalette } from '../../constants/colors';
import { ProfileStats } from '../../types/user';
import { useRegionProgress } from '../../hooks/useRegionProgress';

/**
 * The own profile's "My hiking" card: one bar showing how completed trails split by difficulty,
 * and the way into My Georgia. (The total is already in the header.)
 */
export function HikingSummary({ stats }: { stats: ProfileStats }) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const { data: regions } = useRegionProgress();

  const parts = [
    { key: 'easy', label: 'Easy', value: stats.easy, color: Colors.difficulty.easy },
    { key: 'medium', label: 'Medium', value: stats.medium, color: Colors.difficulty.medium },
    { key: 'hard', label: 'Hard', value: stats.hard, color: Colors.difficulty.hard },
    { key: 'ultra', label: 'Ultra', value: stats.ultra, color: Colors.difficulty.ultra },
  ];
  const total = parts.reduce((sum, p) => sum + (p.value ?? 0), 0);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>My hiking</Text>

      <View
        style={styles.bar}
        accessibilityLabel={parts.map((p) => `${p.value ?? 0} ${p.label.toLowerCase()}`).join(', ')}
      >
        {total === 0 ? (
          <View style={[styles.segment, { flex: 1, backgroundColor: Colors.borderLight }]} />
        ) : (
          parts
            .filter((p) => (p.value ?? 0) > 0)
            .map((p) => <View key={p.key} style={[styles.segment, { flex: p.value, backgroundColor: p.color }]} />)
        )}
      </View>

      <View style={styles.legend}>
        {parts.map((p) => (
          <View key={p.key} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: p.color }]} />
            <Text style={styles.legendText}>
              <Text style={styles.legendValue}>{p.value ?? 0}</Text> {p.label}
            </Text>
          </View>
        ))}
      </View>

      {regions?.totals ? (
        <TouchableOpacity
          style={styles.regionsRow}
          onPress={() => router.push('/(tabs)/profile/regions' as never)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`My Georgia: ${regions.totals.regions_started} of ${regions.totals.regions_total} regions explored`}
        >
          <View style={styles.regionsIcon}>
            <Icon name="map" size={18} color={Colors.primary} />
          </View>
          <Text style={styles.regionsLabel}>My Georgia</Text>
          <Text style={styles.regionsValue}>
            {regions.totals.regions_started} of {regions.totals.regions_total} regions
          </Text>
          <Icon name="chevron-forward" size={16} color={Colors.textLight} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    card: {
      marginHorizontal: 16,
      padding: 16,
      gap: 12,
      borderRadius: 16,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.borderLight,
    },
    title: {
      fontSize: 13,
      fontWeight: '700',
      color: Colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    bar: {
      flexDirection: 'row',
      height: 10,
      borderRadius: 5,
      overflow: 'hidden',
      gap: 2,
    },
    segment: {
      height: '100%',
    },
    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: 6,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendText: {
      fontSize: 13,
      color: Colors.textSecondary,
    },
    legendValue: {
      fontWeight: '800',
      color: Colors.text,
    },
    regionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.border,
    },
    regionsIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.primary + '15',
    },
    regionsLabel: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: Colors.text,
    },
    regionsValue: {
      fontSize: 13,
      fontWeight: '600',
      color: Colors.textSecondary,
    },
  });
