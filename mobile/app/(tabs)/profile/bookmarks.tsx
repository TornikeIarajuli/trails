import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useMyBookmarks } from '../../../hooks/useBookmarks';
import { DifficultyBadge } from '../../../components/trail/DifficultyBadge';
import { TrailDifficulty } from '../../../types/trail';
import {
  BookmarkCategory,
  BookmarkEntry,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
} from '../../../services/bookmarks';

const CATEGORIES: (BookmarkCategory | undefined)[] = [
  undefined,
  'favorites',
  'want_to_hike',
  'in_progress',
  'saved',
];

export default function BookmarksScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const [activeCategory, setActiveCategory] = useState<BookmarkCategory | undefined>(undefined);

  const { data, isLoading, refetch, isRefetching } = useMyBookmarks(1, activeCategory);

  const renderItem = ({ item }: { item: BookmarkEntry }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={() => router.push(`/trail/${item.trails.id}`)}
    >
      {item.trails.cover_image_url ? (
        <Image
          source={{ uri: item.trails.cover_image_url }}
          style={styles.cardImage}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
          <Ionicons name="trail-sign-outline" size={24} color={Colors.textLight} />
        </View>
      )}
      <View style={styles.cardContent}>
        <Text style={styles.cardName} numberOfLines={1}>{item.trails.name_en}</Text>
        <Text style={styles.cardRegion} numberOfLines={1}>{item.trails.region}</Text>
        <View style={styles.cardMeta}>
          {item.trails.difficulty && (
            <DifficultyBadge difficulty={item.trails.difficulty as TrailDifficulty} />
          )}
          {item.trails.distance_km != null && (
            <Text style={styles.metaText}>{item.trails.distance_km} km</Text>
          )}
          {item.category && item.category !== 'saved' && (
            <View style={styles.categoryTag}>
              <Ionicons
                name={CATEGORY_ICONS[item.category] as any}
                size={10}
                color={Colors.primary}
              />
              <Text style={styles.categoryTagText}>
                {CATEGORY_LABELS[item.category]}
              </Text>
            </View>
          )}
        </View>
        {item.note ? (
          <Text style={styles.noteText} numberOfLines={1}>{item.note}</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
    </TouchableOpacity>
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'My Bookmarks',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerTitleStyle: { color: Colors.text },
          headerShadowVisible: false,
        }}
      />
      <View style={styles.container}>
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
                style={[
                  styles.filterChip,
                  isActive && { backgroundColor: Colors.primary + '20', borderColor: Colors.primary },
                ]}
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

        <FlatList
          data={data?.data ?? []}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="bookmark-outline" size={48} color={Colors.textLight} />
              <Text style={styles.emptyText}>
                {activeCategory
                  ? `No trails in "${CATEGORY_LABELS[activeCategory]}"`
                  : 'No bookmarked trails yet'}
              </Text>
              <Text style={styles.emptyHint}>
                Tap the heart icon on any trail to save it here
              </Text>
            </View>
          }
        />
      </View>
    </>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    filterScroll: {
      flexGrow: 0,
      borderBottomWidth: 1,
      borderBottomColor: Colors.borderLight,
    },
    filterRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.borderLight,
    },
    filterLabel: {
      fontSize: 13,
      color: Colors.textSecondary,
      fontWeight: '600',
    },
    listContent: { padding: 16, gap: 10 },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.surface,
      borderRadius: 12,
      padding: 10,
      gap: 12,
    },
    cardImage: {
      width: 56,
      height: 56,
      borderRadius: 10,
    },
    cardImagePlaceholder: {
      backgroundColor: Colors.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardContent: { flex: 1, gap: 3 },
    cardName: { fontSize: 15, fontWeight: '700', color: Colors.text },
    cardRegion: { fontSize: 12, color: Colors.textSecondary },
    cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
    metaText: { fontSize: 12, color: Colors.textSecondary },
    categoryTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: Colors.primary + '15',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    categoryTagText: { fontSize: 10, color: Colors.primary, fontWeight: '600' },
    noteText: {
      fontSize: 12,
      color: Colors.textLight,
      fontStyle: 'italic',
      marginTop: 2,
    },
    empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
    emptyText: { fontSize: 16, fontWeight: '600', color: Colors.textLight },
    emptyHint: { fontSize: 13, color: Colors.textLight, textAlign: 'center', maxWidth: 260 },
  });
