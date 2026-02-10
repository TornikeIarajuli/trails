import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../../constants/colors';
import { Checkpoint, CheckpointType } from '../../types/checkpoint';
import { useSettingsStore } from '../../store/settingsStore';

const CHECKPOINT_ICONS: Record<CheckpointType, string> = {
  viewpoint: 'eye-outline',
  water_source: 'water-outline',
  campsite: 'bonfire-outline',
  landmark: 'flag-outline',
  summit: 'triangle-outline',
  shelter: 'home-outline',
  bridge: 'git-network-outline',
  pass: 'swap-horizontal-outline',
  lake: 'water-outline',
  waterfall: 'water-outline',
  ruins: 'business-outline',
  church: 'heart-outline',
  tower: 'cellular-outline',
};

interface CheckpointListProps {
  checkpoints: Checkpoint[];
  visitedIds?: string[];
}

export function CheckpointList({ checkpoints, visitedIds = [] }: CheckpointListProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const language = useSettingsStore((s) => s.language);

  if (checkpoints.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Checkpoints</Text>
      {checkpoints.map((cp, index) => {
        const name = language === 'ka' && cp.name_ka ? cp.name_ka : cp.name_en;
        const visited = visitedIds.includes(cp.id);
        const iconName = CHECKPOINT_ICONS[cp.type] || 'location-outline';

        return (
          <View key={cp.id} style={styles.item}>
            <View style={styles.timeline}>
              <View
                style={[
                  styles.dot,
                  visited && styles.dotVisited,
                  cp.is_checkable && styles.dotCheckable,
                ]}
              >
                <Ionicons
                  name={iconName as any}
                  size={14}
                  color={visited ? Colors.textOnPrimary : cp.is_checkable ? Colors.primary : Colors.textSecondary}
                />
              </View>
              {index < checkpoints.length - 1 && <View style={styles.line} />}
            </View>
            <View style={styles.content}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{name}</Text>
                {cp.is_checkable && (
                  <View style={styles.checkBadge}>
                    <Text style={styles.checkBadgeText}>Check-in</Text>
                  </View>
                )}
              </View>
              {cp.elevation_m && (
                <Text style={styles.elevation}>{cp.elevation_m}m elevation</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 16,
  },
  item: {
    flexDirection: 'row',
    minHeight: 50,
  },
  timeline: {
    width: 32,
    alignItems: 'center',
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  dotCheckable: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '15',
  },
  dotVisited: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.border,
    marginVertical: 2,
  },
  content: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 16,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  checkBadge: {
    backgroundColor: Colors.accent + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  checkBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.accent,
  },
  elevation: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
