import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors, ColorPalette } from '../../constants/colors';
import { Trail } from '../../types/trail';
import { DifficultyBadge } from './DifficultyBadge';
import { formatDistance, formatDuration } from '../../utils/formatters';
import { useSettingsStore } from '../../store/settingsStore';

interface TrailCardProps {
  trail: Trail;
}

export function TrailCard({ trail }: TrailCardProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const language = useSettingsStore((s) => s.language);
  const name = language === 'ka' && trail.name_ka ? trail.name_ka : trail.name_en;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={() => router.push(`/trail/${trail.id}`)}
    >
      <Image
        source={{
          uri: trail.cover_image_url || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=60',
        }}
        style={styles.image}
      />
      <View style={styles.content}>
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
        </View>
      </View>
    </TouchableOpacity>
  );
}

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
});
