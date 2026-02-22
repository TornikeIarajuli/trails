import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useColors, ColorPalette } from '../../constants/colors';
import { useMyBookmarks } from '../../hooks/useBookmarks';
import { DifficultyBadge } from '../trail/DifficultyBadge';
import { TrailDifficulty } from '../../types/trail';

export function BookmarksSection() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const { data: bookmarksData } = useMyBookmarks();

  if (!bookmarksData || bookmarksData.data.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Bookmarked Trails</Text>
      {bookmarksData.data.map((b) => (
        <TouchableOpacity
          key={b.id}
          style={styles.row}
          onPress={() => router.push(`/trail/${b.trails.id}`)}
        >
          <View style={styles.info}>
            <Text style={styles.name} numberOfLines={1}>
              {b.trails.name_en}
            </Text>
            <Text style={styles.sub}>{b.trails.region}</Text>
          </View>
          {b.trails.difficulty && (
            <DifficultyBadge difficulty={b.trails.difficulty as TrailDifficulty} />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  section: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginBottom: 8,
    padding: 14,
  },
  info: {
    flex: 1,
    marginRight: 12,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  sub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
