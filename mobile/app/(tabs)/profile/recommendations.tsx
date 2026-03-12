import React, { useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useRecommendations } from '../../../hooks/useRecommendations';
import { DifficultyBadge } from '../../../components/trail/DifficultyBadge';
import { TrailDifficulty } from '../../../types/trail';

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  ultra: 'Ultra',
};

export default function RecommendationsScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const { data, isLoading, refetch, isRefetching } = useRecommendations();

  const renderHeader = () => {
    if (!data) return null;
    const { target_difficulties, user_stats } = data;
    const totalCompleted = Object.values(user_stats).reduce((a, b) => a + b, 0);

    return (
      <View style={styles.header}>
        <View style={styles.statsRow}>
          {(['easy', 'medium', 'hard', 'ultra'] as const).map((d) => (
            <View key={d} style={styles.statItem}>
              <Text style={[styles.statCount, { color: Colors.difficulty[d] }]}>
                {user_stats[d]}
              </Text>
              <Text style={styles.statLabel}>{d}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.headerHint}>
          {totalCompleted === 0
            ? 'Start with these easy trails!'
            : `Based on your ${totalCompleted} completed trail${totalCompleted > 1 ? 's' : ''}, we recommend ${target_difficulties.map((d) => DIFFICULTY_LABELS[d]).join(' & ')} trails:`}
        </Text>
      </View>
    );
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={() => router.push(`/trail/${item.id}`)}
    >
      {item.cover_image_url ? (
        <Image
          source={{ uri: item.cover_image_url }}
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
        <Text style={styles.cardName} numberOfLines={1}>{item.name_en}</Text>
        <Text style={styles.cardRegion} numberOfLines={1}>{item.region}</Text>
        <View style={styles.cardMeta}>
          <DifficultyBadge difficulty={item.difficulty as TrailDifficulty} />
          {item.distance_km != null && (
            <Text style={styles.metaText}>{item.distance_km} km</Text>
          )}
          {item.avg_rating != null && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={12} color={Colors.warning} />
              <Text style={styles.metaText}>{item.avg_rating}</Text>
            </View>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
    </TouchableOpacity>
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'For You',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerTitleStyle: { color: Colors.text },
          headerShadowVisible: false,
        }}
      />
      <View style={styles.container}>
        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
        ) : (
          <FlatList
            data={data?.data ?? []}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ListHeaderComponent={renderHeader}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="compass-outline" size={48} color={Colors.textLight} />
                <Text style={styles.emptyText}>No recommendations yet</Text>
                <Text style={styles.emptyHint}>Complete a few trails to get personalized suggestions</Text>
              </View>
            }
          />
        )}
      </View>
    </>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    listContent: { padding: 16, gap: 10 },
    header: {
      backgroundColor: Colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 8,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: 12,
    },
    statItem: { alignItems: 'center' },
    statCount: { fontSize: 22, fontWeight: '800' },
    statLabel: { fontSize: 11, color: Colors.textSecondary, textTransform: 'capitalize', marginTop: 2 },
    headerHint: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.surface,
      borderRadius: 12,
      padding: 10,
      gap: 12,
    },
    cardImage: {
      width: 60,
      height: 60,
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
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
    emptyText: { fontSize: 16, color: Colors.textLight },
    emptyHint: { fontSize: 13, color: Colors.textLight, textAlign: 'center', maxWidth: 260 },
  });
