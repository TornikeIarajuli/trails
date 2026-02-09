import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { formatDistance, formatElevation, formatDuration } from '../../utils/formatters';

interface TrailStatsProps {
  distanceKm: number | null;
  elevationGainM: number | null;
  estimatedHours: number | null;
}

export function TrailStats({ distanceKm, elevationGainM, estimatedHours }: TrailStatsProps) {
  return (
    <View style={styles.container}>
      <View style={styles.stat}>
        <Ionicons name="map-outline" size={18} color={Colors.textSecondary} />
        <Text style={styles.value}>{formatDistance(distanceKm)}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.stat}>
        <Ionicons name="trending-up-outline" size={18} color={Colors.textSecondary} />
        <Text style={styles.value}>{formatElevation(elevationGainM)}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.stat}>
        <Ionicons name="time-outline" size={18} color={Colors.textSecondary} />
        <Text style={styles.value}>{formatDuration(estimatedHours)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.border,
  },
});
