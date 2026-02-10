import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../../constants/colors';
import { Badge } from '../../types/badge';

interface BadgeCardProps {
  badge: Badge;
  earned: boolean;
  compact?: boolean;
  progress?: { current: number; target: number };
}

const ICON_MAP: Record<string, string> = {
  footsteps: 'footsteps',
  compass: 'compass',
  flame: 'flame',
  trophy: 'trophy',
  leaf: 'leaf',
  flag: 'flag',
  rocket: 'rocket',
  snow: 'snow',
  'trail-sign': 'trail-sign',
  wine: 'wine',
  camera: 'camera',
  megaphone: 'megaphone',
  bookmark: 'bookmark',
};

export function BadgeCard({ badge, earned, compact, progress }: BadgeCardProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const iconName = ICON_MAP[badge.icon] ?? 'ribbon';

  if (compact) {
    return (
      <View style={[styles.compact, !earned && styles.locked]}>
        <View style={[styles.compactIcon, earned && styles.compactIconEarned]}>
          <Ionicons
            name={iconName as any}
            size={20}
            color={earned ? '#fff' : Colors.textLight}
          />
        </View>
        <Text style={[styles.compactName, !earned && styles.lockedText]} numberOfLines={1}>
          {badge.name_en}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, !earned && styles.locked]}>
      <View style={[styles.iconContainer, earned && styles.iconEarned]}>
        <Ionicons
          name={iconName as any}
          size={28}
          color={earned ? '#fff' : Colors.textLight}
        />
        {!earned && (
          <View style={styles.lockOverlay}>
            <Ionicons name="lock-closed" size={12} color={Colors.textLight} />
          </View>
        )}
      </View>
      <Text style={[styles.name, !earned && styles.lockedText]}>{badge.name_en}</Text>
      <Text style={styles.description} numberOfLines={2}>
        {badge.description_en}
      </Text>
      {progress && !earned && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${(progress.current / progress.target) * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {progress.current}/{progress.target}
          </Text>
        </View>
      )}
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  card: {
    width: 120,
    alignItems: 'center',
    padding: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  locked: {
    opacity: 0.7,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconEarned: {
    backgroundColor: Colors.primary,
  },
  lockOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 2,
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  lockedText: {
    color: Colors.textLight,
  },
  description: {
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  progressContainer: {
    width: '100%',
    marginTop: 8,
    alignItems: 'center',
    gap: 3,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: Colors.borderLight,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  compact: {
    alignItems: 'center',
    width: 70,
  },
  compactIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  compactIconEarned: {
    backgroundColor: Colors.primary,
  },
  compactName: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
});
