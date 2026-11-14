import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '../ui/Icon';
import { useColors, ColorPalette } from '../../constants/colors';
import { ProfileStats } from '../../types/user';
import { useRegionProgress } from '../../hooks/useRegionProgress';

interface StatsGridProps {
  stats: ProfileStats;
  /**
   * Whose region progress the "Regions" tile shows: 'me' (default) for the
   * signed-in user, a user id for someone else, or null to hide the tile.
   */
  regionsFor?: 'me' | string | null;
}

function RegionsTile({ userId, styles, Colors }: {
  userId?: string;
  styles: ReturnType<typeof createStyles>;
  Colors: ColorPalette;
}) {
  const { data } = useRegionProgress(userId);
  // Hidden while loading and on servers that do not have region progress yet
  if (!data?.totals) return null;
  const { regions_started, regions_total } = data.totals;

  const open = () =>
    userId
      ? router.push({ pathname: '/trail/user/regions', params: { userId } } as any)
      : router.push('/(tabs)/profile/regions' as any);

  return (
    <TouchableOpacity
      style={styles.regionsTile}
      onPress={open}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Regions explored: ${regions_started} of ${regions_total}`}
    >
      <View style={styles.regionsIcon}>
        <Icon name="map" size={18} color={Colors.primary} />
      </View>
      <Text style={styles.regionsLabel}>Regions</Text>
      <Text style={styles.regionsValue}>
        {regions_started}/{regions_total} regions
      </Text>
      <Icon name="chevron-forward" size={16} color={Colors.textLight} />
    </TouchableOpacity>
  );
}

export function StatsGrid({ stats, regionsFor = 'me' }: StatsGridProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const items = [
    { label: 'Easy', value: stats.easy, color: Colors.difficulty.easy },
    { label: 'Medium', value: stats.medium, color: Colors.difficulty.medium },
    { label: 'Hard', value: stats.hard, color: Colors.difficulty.hard },
    { label: 'Ultra', value: stats.ultra, color: Colors.difficulty.ultra },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total Completed</Text>
        <Text style={styles.totalValue}>{stats.total}</Text>
      </View>
      <View style={styles.grid}>
        {items.map((item) => (
          <View key={item.label} style={styles.card}>
            <View style={[styles.indicator, { backgroundColor: item.color }]} />
            <Text style={styles.value}>{item.value}</Text>
            <Text style={styles.label}>{item.label}</Text>
          </View>
        ))}
      </View>
      {regionsFor !== null && (
        <RegionsTile
          userId={regionsFor === 'me' ? undefined : regionsFor}
          styles={styles}
          Colors={Colors}
        />
      )}
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  container: {
    padding: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  totalValue: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.primary,
  },
  grid: {
    flexDirection: 'row',
    gap: 10,
  },
  card: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  indicator: {
    width: 24,
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  value: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  label: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  regionsTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  regionsIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
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
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
});
