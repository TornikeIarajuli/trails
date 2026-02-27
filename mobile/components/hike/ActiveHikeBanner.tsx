import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../../constants/colors';
import { useHikeStore } from '../../store/hikeStore';
import { useTrail } from '../../hooks/useTrails';

export function ActiveHikeBanner() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const isActive = useHikeStore((s) => s.isActive);
  const trailId = useHikeStore((s) => s.trailId);
  const endHike = useHikeStore((s) => s.endHike);

  const { data: trail } = useTrail(trailId ?? '');

  if (!isActive || !trailId) return null;

  const trailName = trail?.name_en ?? 'Unknown Trail';

  return (
    <View style={styles.banner}>
      <Ionicons name="footsteps-outline" size={18} color={Colors.textOnPrimary} />
      <Text style={styles.text} numberOfLines={1}>
        Active hike: <Text style={styles.trailName}>{trailName}</Text>
      </Text>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.resumeButton}
          onPress={() => router.push(`/trail/${trailId}/hike` as any)}
        >
          <Text style={styles.resumeText}>Resume</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.discardButton} onPress={endHike}>
          <Ionicons name="close" size={18} color={Colors.textOnPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 8,
    },
    text: {
      flex: 1,
      fontSize: 13,
      color: Colors.textOnPrimary,
    },
    trailName: {
      fontWeight: '700',
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    resumeButton: {
      backgroundColor: Colors.textOnPrimary + '25',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 10,
    },
    resumeText: {
      fontSize: 13,
      fontWeight: '700',
      color: Colors.textOnPrimary,
    },
    discardButton: {
      padding: 2,
    },
  });
