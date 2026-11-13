import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { useColors, ColorPalette } from '../../constants/colors';
import { Checkpoint } from '../../types/checkpoint';
import {
  checkpointProfile,
  elevationScale,
  elevationStats,
  normaliseProfile,
  smoothAreaPath,
  smoothLinePath,
  toChartPoints,
} from '../../utils/elevationProfile';

interface ElevationProfileProps {
  /** `[distance_m, elevation_m]` pairs measured along the route, when available. */
  profile?: [number, number][] | null;
  checkpoints: Checkpoint[];
  distanceKm: number | null;
  elevationGainM?: number | null;
  height?: number;
}

const Y_AXIS_WIDTH = 52;

function formatKm(metres: number): string {
  const km = metres / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

export function ElevationProfile({
  profile,
  checkpoints,
  distanceKm,
  elevationGainM,
  height = 120,
}: ElevationProfileProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const [chartWidth, setChartWidth] = useState(0);

  const data = useMemo(() => {
    const measured = normaliseProfile(profile);
    const points = measured.length >= 2 ? measured : checkpointProfile(checkpoints ?? [], distanceKm);
    if (points.length < 2) return null;
    return {
      points,
      fromRoute: measured.length >= 2,
      scale: elevationScale(points),
      stats: elevationStats(points),
    };
  }, [profile, checkpoints, distanceKm]);

  const paths = useMemo(() => {
    if (!data || chartWidth <= 0) return null;
    const chartPoints = toChartPoints(data.points, data.scale, chartWidth, height);
    return { line: smoothLinePath(chartPoints), area: smoothAreaPath(chartPoints, height) };
  }, [data, chartWidth, height]);

  if (!data) return null;

  const { scale, stats, fromRoute } = data;
  const middle = Math.round((scale.lo + scale.hi) / 2);
  // The measured route's own length; checkpoints are spread over the trail's length
  const totalDistance = fromRoute || !distanceKm ? stats.distance : distanceKm * 1000;
  const ascent = elevationGainM ?? stats.ascent;

  const onLayout = (e: LayoutChangeEvent) => {
    const width = Math.floor(e.nativeEvent.layout.width);
    if (width !== chartWidth) setChartWidth(width);
  };

  return (
    <View
      style={styles.container}
      accessible
      accessibilityLabel={`Elevation profile: lowest point ${stats.min} metres, highest ${stats.max} metres, ${ascent} metres of ascent`}
    >
      <Text style={styles.title}>Elevation Profile</Text>
      <View style={styles.chartRow}>
        <View style={[styles.yAxis, { height }]}>
          <Text style={styles.axisLabel}>{Math.round(scale.hi)} m</Text>
          <Text style={styles.axisLabel}>{middle} m</Text>
          <Text style={styles.axisLabel}>{Math.round(scale.lo)} m</Text>
        </View>

        <View style={[styles.chart, { height }]} onLayout={onLayout}>
          {paths && (
            <Svg width={chartWidth} height={height}>
              <Defs>
                <LinearGradient id="elevationFill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={Colors.accent} stopOpacity={0.45} />
                  <Stop offset="1" stopColor={Colors.accent} stopOpacity={0.05} />
                </LinearGradient>
              </Defs>
              <Line x1={0} y1={0.5} x2={chartWidth} y2={0.5} stroke={Colors.borderLight} strokeWidth={1} />
              <Line x1={0} y1={height / 2} x2={chartWidth} y2={height / 2} stroke={Colors.borderLight} strokeWidth={1} />
              <Line x1={0} y1={height - 0.5} x2={chartWidth} y2={height - 0.5} stroke={Colors.borderLight} strokeWidth={1} />
              <Path d={paths.area} fill="url(#elevationFill)" />
              <Path
                d={paths.line}
                fill="none"
                stroke={Colors.accent}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </Svg>
          )}
        </View>
      </View>

      <View style={styles.xAxis}>
        <Text style={styles.axisLabel}>0 km</Text>
        <Text style={styles.axisLabel}>{formatKm(totalDistance)}</Text>
      </View>

      {!fromRoute && (
        <Text style={styles.note}>Estimated from checkpoint elevations.</Text>
      )}

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Min</Text>
          <Text style={styles.statValue}>{stats.min} m</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Max</Text>
          <Text style={styles.statValue}>{stats.max} m</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Ascent</Text>
          <Text style={styles.statValue}>{ascent} m</Text>
        </View>
        {fromRoute && (
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Descent</Text>
            <Text style={styles.statValue}>{stats.descent} m</Text>
          </View>
        )}
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Distance</Text>
          <Text style={styles.statValue}>{formatKm(totalDistance)}</Text>
        </View>
      </View>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
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
  chartRow: {
    flexDirection: 'row',
  },
  yAxis: {
    width: Y_AXIS_WIDTH,
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
  },
  xAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginLeft: Y_AXIS_WIDTH,
    marginTop: 4,
  },
  note: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 4,
    marginLeft: Y_AXIS_WIDTH,
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
