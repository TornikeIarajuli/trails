import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon, IconName } from '../ui/Icon';
import { useColors, ColorPalette } from '../../constants/colors';
import type { TrailTerrain } from '../../types/trail';
import { TerrainBarPart, terrainRows, terrainSource } from '../../utils/terrainSummary';

/** A thin bar split by km: grades from easy to hard, or surfaces longest first. */
function KmBar({ parts, styles }: { parts: TerrainBarPart[]; styles: ReturnType<typeof createStyles> }) {
  const total = parts.reduce((sum, p) => sum + p.km, 0);
  if (total <= 0) return null;
  return (
    <View style={styles.bar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {parts.map((p) => (
        <View key={p.key} style={{ flex: p.km / total, backgroundColor: p.color }} />
      ))}
    </View>
  );
}

/**
 * Trail screen: what the trail is like underfoot, from OpenStreetMap: the hardest grade, the
 * ground, river crossings without a bridge, springs and taps, huts and shelters.
 */
export function TerrainCard({ terrain }: { terrain: TrailTerrain }) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const rows = terrainRows(terrain);
  const { source, caution } = terrainSource(terrain);

  return (
    <View style={styles.card} testID="terrain-card">
      <View style={styles.header}>
        <Icon name="map" size={16} color={Colors.textSecondary} />
        <Text style={styles.headerText}>Terrain</Text>
      </View>

      {rows.map((row) => (
        <View
          key={row.key}
          style={styles.row}
          accessible
          accessibilityLabel={row.detail ? `${row.title}. ${row.detail}` : row.title}
          testID={`terrain-${row.key}`}
        >
          <View style={styles.iconWrap}>
            <Icon name={row.icon as IconName} size={18} color={Colors.primary} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.title}>{row.title}</Text>
            {row.bar ? <KmBar parts={row.bar} styles={styles} /> : null}
            {row.detail ? <Text style={styles.detail}>{row.detail}</Text> : null}
          </View>
        </View>
      ))}

      <Text style={styles.source}>
        {source}
        {caution ? `. ${caution}` : '.'}
      </Text>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    card: {
      backgroundColor: Colors.surface,
      borderRadius: 14,
      padding: 16,
      marginHorizontal: 16,
      gap: 14,
      elevation: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    headerText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: Colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    row: {
      flexDirection: 'row',
      gap: 12,
    },
    iconWrap: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.primary + '14',
    },
    rowText: {
      flex: 1,
      gap: 4,
      paddingTop: 2,
    },
    title: {
      fontSize: 15,
      fontWeight: '600',
      color: Colors.text,
    },
    detail: {
      fontSize: 13,
      lineHeight: 18,
      color: Colors.textSecondary,
    },
    bar: {
      flexDirection: 'row',
      height: 6,
      borderRadius: 3,
      overflow: 'hidden',
      marginTop: 2,
    },
    source: {
      fontSize: 12,
      lineHeight: 17,
      color: Colors.textLight,
    },
  });
