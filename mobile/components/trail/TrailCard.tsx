import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Pressable } from 'react-native';
import { useColors, ColorPalette } from '../../constants/colors';
import { Trail } from '../../types/trail';
import { DifficultyBadge } from './DifficultyBadge';
import { formatDistance, formatDuration } from '../../utils/formatters';
import { localName } from '../../utils/i18n';
import { useSettingsStore } from '../../store/settingsStore';
import { useActiveHikerCount } from '../../hooks/useCompletions';

interface TrailCardProps {
  trail: Trail;
  index?: number;
}

export function TrailCard({ trail, index = 0 }: TrailCardProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const language = useSettingsStore((s) => s.language);
  const name = localName(trail.name_en, trail.name_ka, language);

  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const { data: activeCount } = useActiveHikerCount(trail.id);

  const delay = Math.min(index, 8) * 50;

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(280)} style={animatedStyle}>
      <Pressable
        style={styles.card}
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 15 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
        onPress={() => router.push(`/trail/${trail.id}`)}
      >
        <Image
          source={{
            uri: trail.cover_image_url || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=60',
          }}
          placeholder={{ blurhash: 'L76F~B?bWD%M~qxuxEtS%MNFWqxt' }}
          contentFit="cover"
          transition={300}
          cachePolicy="memory-disk"
          style={styles.image}
        />
        <View style={styles.content}>
          {trail.status && trail.status !== 'open' && (
            <View style={[styles.statusPill, { backgroundColor: STATUS_BG[trail.status] }]}>
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
              <Ionicons name="map-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.statText}>{formatDistance(trail.distance_km)}</Text>
            </View>
            <View style={styles.stat}>
              <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.statText}>{formatDuration(trail.estimated_hours)}</Text>
            </View>
            <View style={styles.stat}>
              <Ionicons name="trending-up-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.statText}>{trail.elevation_gain_m ?? '--'}m</Text>
            </View>
            {activeCount != null && activeCount > 0 && (
              <View style={styles.stat}>
                <Text style={styles.activeHikers}>🥾 {activeCount} active</Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

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
    backgroundColor: Colors.borderLight,
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
  activeHikers: {
    fontSize: 12,
    color: '#16A34A',
    fontWeight: '600',
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
