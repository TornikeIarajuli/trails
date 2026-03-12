import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../../constants/colors';
import { useMyBookmarks } from '../../hooks/useBookmarks';
import { DifficultyBadge } from '../trail/DifficultyBadge';
import { TrailDifficulty } from '../../types/trail';
import {
  BookmarkCategory,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
} from '../../services/bookmarks';

const CATEGORIES: (BookmarkCategory | undefined)[] = [
  undefined,
  'favorites',
  'want_to_hike',
  'in_progress',
  'saved',
];

export function BookmarksSection() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const [activeCategory, setActiveCategory] = useState<BookmarkCategory | undefined>(undefined);

  const { data: bookmarksData } = useMyBookmarks(1, activeCategory);

  if (!bookmarksData || (bookmarksData.data.length === 0 && !activeCategory)) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Bookmarked Trails</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat;
          const label = cat ? CATEGORY_LABELS[cat] : 'All';
          const icon = cat ? CATEGORY_ICONS[cat] : 'list';
          return (
            <TouchableOpacity
              key={cat ?? 'all'}
              style={[styles.filterChip, isActive && { backgroundColor: Colors.primary + '20' }]}
              onPress={() => setActiveCategory(cat)}
            >
              <Ionicons
                name={icon as any}
                size={14}
                color={isActive ? Colors.primary : Colors.textSecondary}
              />
              <Text style={[styles.filterLabel, isActive && { color: Colors.primary }]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {bookmarksData.data.length === 0 ? (
        <Text style={styles.emptyText}>No trails in this category</Text>
      ) : (
        bookmarksData.data.map((b) => (
          <TouchableOpacity
            key={b.id}
            style={styles.row}
            onPress={() => router.push(`/trail/${b.trails.id}`)}
          >
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>
                {b.trails.name_en}
              </Text>
              <View style={styles.metaRow}>
                <Text style={styles.sub}>{b.trails.region}</Text>
                {b.note ? (
                  <Text style={styles.note} numberOfLines={1}>{b.note}</Text>
                ) : null}
              </View>
            </View>
            {b.trails.difficulty && (
              <DifficultyBadge difficulty={b.trails.difficulty as TrailDifficulty} />
            )}
          </TouchableOpacity>
        ))
      )}
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
  filterScroll: {
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.surface,
  },
  filterLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.textLight,
    fontSize: 14,
    paddingVertical: 20,
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  sub: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  note: {
    fontSize: 12,
    color: Colors.textLight,
    fontStyle: 'italic',
    flex: 1,
  },
});
