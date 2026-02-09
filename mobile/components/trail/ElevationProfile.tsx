import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Colors } from '../../constants/colors';
import { Checkpoint } from '../../types/checkpoint';

interface ElevationProfileProps {
  checkpoints: Checkpoint[];
  distanceKm: number | null;
  height?: number;
}

export function ElevationProfile({
  checkpoints,
  distanceKm,
  height = 120,
}: ElevationProfileProps) {
  const elevationData = useMemo(() => {
    const withElevation = checkpoints
      .filter((cp) => cp.elevation_m !== null && cp.elevation_m !== undefined)
      .sort((a, b) => a.sort_order - b.sort_order);

    if (withElevation.length < 2) return null;

    const elevations = withElevation.map((cp) => cp.elevation_m!);
    const minElev = Math.min(...elevations);
    const maxElev = Math.max(...elevations);
    const range = maxElev - minElev || 1;

    return {
      points: withElevation,
      elevations,
      minElev,
      maxElev,
      range,
    };
  }, [checkpoints]);

  if (!elevationData) return null;

  const { elevations, minElev, maxElev, range } = elevationData;
  const chartWidth = Dimensions.get('window').width - 80;
  const chartHeight = height - 40;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Elevation Profile</Text>
      <View style={styles.chartContainer}>
        {/* Y-axis labels */}
        <View style={styles.yAxis}>
          <Text style={styles.axisLabel}>{maxElev}m</Text>
          <Text style={styles.axisLabel}>{Math.round((maxElev + minElev) / 2)}m</Text>
          <Text style={styles.axisLabel}>{minElev}m</Text>
        </View>

        {/* Chart area */}
        <View style={[styles.chart, { height: chartHeight }]}>
          {/* Background grid lines */}
          <View style={[styles.gridLine, { top: 0 }]} />
          <View style={[styles.gridLine, { top: chartHeight / 2 }]} />
          <View style={[styles.gridLine, { top: chartHeight - 1 }]} />

          {/* Elevation bars */}
          <View style={styles.barsContainer}>
            {elevations.map((elev, i) => {
              const barHeight = ((elev - minElev) / range) * (chartHeight - 8) + 4;
              const barWidth = Math.max(
                chartWidth / elevations.length - 2,
                3,
              );

              return (
                <View
                  key={i}
                  style={[
                    styles.bar,
                    {
                      height: barHeight,
                      width: barWidth,
                      backgroundColor: getElevationColor(elev, minElev, maxElev),
                    },
                  ]}
                />
              );
            })}
          </View>
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Min</Text>
          <Text style={styles.statValue}>{minElev}m</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Max</Text>
          <Text style={styles.statValue}>{maxElev}m</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Gain</Text>
          <Text style={styles.statValue}>{maxElev - minElev}m</Text>
        </View>
        {distanceKm && (
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Distance</Text>
            <Text style={styles.statValue}>{distanceKm}km</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function getElevationColor(elev: number, min: number, max: number): string {
  const ratio = max === min ? 0.5 : (elev - min) / (max - min);
  if (ratio < 0.33) return Colors.primaryLight;
  if (ratio < 0.66) return Colors.primary;
  return Colors.primaryDark;
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  chartContainer: {
    flexDirection: 'row',
  },
  yAxis: {
    width: 48,
    justifyContent: 'space-between',
    paddingRight: 8,
  },
  axisLabel: {
    fontSize: 10,
    color: Colors.textLight,
    textAlign: 'right',
  },
  chart: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: Colors.borderLight,
  },
  barsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-evenly',
    paddingHorizontal: 4,
    paddingBottom: 2,
  },
  bar: {
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderRadius: 8,
  },
  stat: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textLight,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 2,
  },
});
