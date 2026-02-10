import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors, ColorPalette } from '../../constants/colors';
import { ProfileStats } from '../../types/user';

interface StatsGridProps {
  stats: ProfileStats;
}

export function StatsGrid({ stats }: StatsGridProps) {
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
});
