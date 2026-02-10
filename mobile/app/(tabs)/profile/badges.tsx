import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useAllBadges, useMyBadges, useBadgeProgress } from '../../../hooks/useBadges';
import { BadgeCard } from '../../../components/badges/BadgeCard';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { Badge, BadgeCategory } from '../../../types/badge';

const CATEGORY_LABELS: Record<BadgeCategory, string> = {
  completions: 'Trail Completions',
  difficulty: 'Difficulty Challenges',
  region: 'Regional Explorer',
  streak: 'Streaks',
  special: 'Special Achievements',
};

function getProgressForBadge(
  badge: Badge,
  progress: {
    total_completions: number;
    completions_by_difficulty: Record<string, number>;
    completions_by_region: Record<string, number>;
    unique_regions: number;
  } | undefined,
): { current: number; target: number } | null {
  if (!progress || !badge.threshold) return null;

  const target = badge.threshold;

  if (badge.category === 'completions') {
    return { current: Math.min(progress.total_completions, target), target };
  }

  if (badge.category === 'difficulty' && badge.difficulty) {
    const count = progress.completions_by_difficulty[badge.difficulty] ?? 0;
    return { current: Math.min(count, target), target };
  }

  if (badge.category === 'region' && badge.region) {
    const count = progress.completions_by_region[badge.region] ?? 0;
    return { current: Math.min(count, target), target };
  }

  return null;
}

export default function BadgesScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const insets = useSafeAreaInsets();
  const { data: allBadges, isLoading: loadingAll } = useAllBadges();
  const { data: myBadges, isLoading: loadingMy } = useMyBadges();
  const { data: progress } = useBadgeProgress();

  const earnedIds = useMemo(
    () => new Set(myBadges?.map((ub) => ub.badges.id) ?? []),
    [myBadges],
  );

  const grouped = useMemo(() => {
    if (!allBadges) return {};
    const groups: Record<string, Badge[]> = {};
    for (const badge of allBadges) {
      if (!groups[badge.category]) groups[badge.category] = [];
      groups[badge.category].push(badge);
    }
    return groups;
  }, [allBadges]);

  if (loadingAll || loadingMy) return <LoadingSpinner />;

  const earnedCount = earnedIds.size;
  const totalCount = allBadges?.length ?? 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Badges</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Overall Progress */}
      <View style={styles.progressCard}>
        <Text style={styles.progressTitle}>
          {earnedCount} / {totalCount} Unlocked
        </Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${totalCount > 0 ? (earnedCount / totalCount) * 100 : 0}%` },
            ]}
          />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {Object.entries(grouped).map(([category, badges]) => (
          <View key={category} style={styles.section}>
            <Text style={styles.sectionTitle}>
              {CATEGORY_LABELS[category as BadgeCategory] ?? category}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.badgesRow}
            >
              {badges.map((badge) => {
                const earned = earnedIds.has(badge.id);
                const prog = !earned ? getProgressForBadge(badge, progress) : null;
                return (
                  <BadgeCard
                    key={badge.id}
                    badge={badge}
                    earned={earned}
                    progress={prog ?? undefined}
                  />
                );
              })}
            </ScrollView>
          </View>
        ))}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  progressCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 10,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.borderLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  badgesRow: {
    paddingHorizontal: 12,
    gap: 10,
  },
});
