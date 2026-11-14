import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '../ui/Icon';
import { router } from 'expo-router';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  useReducedMotion,
  withSpring,
} from 'react-native-reanimated';
import { Pressable } from 'react-native';
import { useColors, ColorPalette } from '../../constants/colors';
import { TrailSummary } from '../../types/trail';
import { DifficultyBadge } from './DifficultyBadge';
import { TrailCover } from './TrailCover';
import { formatDistance, formatDuration, formatElevation } from '../../utils/formatters';
import { localName } from '../../utils/i18n';
import { haptics } from '../../utils/haptics';
import { useSettingsStore } from '../../store/settingsStore';
import { usePrefetchTrail } from '../../hooks/useTrails';

interface TrailCardProps {
  trail: TrailSummary;
  index?: number;
}

export const TrailCard = React.memo(function TrailCard({ trail, index = 0 }: TrailCardProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const language = useSettingsStore((s) => s.language);
  const name = localName(trail.name_en, trail.name_ka, language);

  const prefetchTrail = usePrefetchTrail();
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const delay = Math.min(index, 8) * 50;
  const entering = reducedMotion ? undefined : FadeInDown.delay(delay).duration(280);

  return (
    <Animated.View entering={entering} style={animatedStyle}>
      <Pressable
        style={styles.card}
        onPressIn={() => {
          // A touch, not a scroll past: start loading the detail while the finger is down
          prefetchTrail(trail.id);
          if (!reducedMotion) scale.value = withSpring(0.97, { damping: 15 });
        }}
        onPressOut={() => { if (!reducedMotion) scale.value = withSpring(1, { damping: 15 }); }}
        onPress={() => {
          haptics.tap();
          router.push(`/trail/${trail.id}`);
        }}
        accessibilityRole="button"
        accessibilityLabel={name}
        testID="trail-card"
      >
        <TrailCover
          uri={trail.cover_image_url}
          style={styles.image}
          iconSize={36}
          showLabel
        />
        <View style={styles.content}>
          {trail.status && trail.status !== 'open' && (
            <View style={[styles.statusPill, { backgroundColor: STATUS_BG[trail.status] }]} accessibilityLabel={`Trail status: ${STATUS_LABEL[trail.status]}`}>
              <Text style={[styles.statusText, { color: STATUS_COLOR[trail.status] }]}>
                {STATUS_LABEL[trail.status]}
              </Text>
            </View>
          )}
          <View style={styles.header}>
            <DifficultyBadge difficulty={trail.difficulty} />
            <Text style={styles.region}>{trail.region}</Text>
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Icon name="map-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.statText}>{formatDistance(trail.distance_km)}</Text>
            </View>
            <View style={styles.stat}>
              <Icon name="time-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.statText}>{formatDuration(trail.estimated_hours)}</Text>
            </View>
            <View style={styles.stat}>
              <Icon name="trending-up-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.statText}>{formatElevation(trail.elevation_gain_m)}</Text>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
});

const STATUS_LABEL: Record<string, string> = {
  closed: 'Closed',
  seasonal: 'Seasonal',
  maintenance: 'Maintenance',
};
const STATUS_BG: Record<string, string> = {
  closed: '#FEE2E2',
  seasonal: '#FEF3C7',
  maintenance: '#DBEAFE',
};
const STATUS_COLOR: Record<string, string> = {
  closed: '#DC2626',
  seasonal: '#D97706',
  maintenance: '#2563EB',
};

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  image: {
    width: '100%',
    height: 160,
  },
  content: {
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  region: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  stats: {
    flexDirection: 'row',
    gap: 16,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
