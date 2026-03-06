import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useAllBadges, useMyBadges, useBadgeProgress } from '../../../hooks/useBadges';
import { BadgeCard } from '../../../components/badges/BadgeCard';
import { BadgeDetailSheet } from '../../../components/badges/BadgeDetailSheet';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { Badge, BadgeCategory, UserBadge } from '../../../types/badge';
import { BADGE_CATEGORY_LABEL, getBadgeProgress } from '../../../components/badges/badgeConstants';

const CATEGORY_ORDER: BadgeCategory[] = ['completions', 'difficulty', 'region', 'streak', 'special'];

export default function BadgesScreen() {
  const Colors = useColors();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(Colors, width), [Colors, width]);
  const insets = useSafeAreaInsets();

  const { data: allBadges, isLoading: loadingAll } = useAllBadges();
  const { data: myBadges, isLoading: loadingMy } = useMyBadges();
  const { data: progress } = useBadgeProgress();

  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);

  const earnedMap = useMemo(() => {
    const map = new Map<string, UserBadge>();
    myBadges?.forEach((ub) => map.set(ub.badges.id, ub));
    return map;
  }, [myBadges]);

  const grouped = useMemo(() => {
    if (!allBadges) return {} as Record<string, Badge[]>;
    const groups: Record<string, Badge[]> = {};
    for (const badge of allBadges) {
      if (!groups[badge.category]) groups[badge.category] = [];
      groups[badge.category].push(badge);
    }
    return groups;
  }, [allBadges]);

  // Top 3 unearned badges closest to completion
  const nextUp = useMemo(() => {
    if (!allBadges || !progress) return [];
    return allBadges
      .filter((b) => !earnedMap.has(b.id))
      .map((b) => ({ badge: b, prog: getBadgeProgress(b, progress) }))
      .filter((x) => x.prog && x.prog.current > 0)
      .sort((a, b) => {
        const pctA = a.prog!.current / a.prog!.target;
        const pctB = b.prog!.current / b.prog!.target;
        return pctB - pctA;
      })
      .slice(0, 3);
  }, [allBadges, earnedMap, progress]);

  if (loadingAll || loadingMy) return <LoadingSpinner />;

  const earnedCount = earnedMap.size;
  const totalCount = allBadges?.length ?? 0;
  const overallPct = totalCount > 0 ? (earnedCount / totalCount) * 100 : 0;

  const selectedEarned = selectedBadge ? earnedMap.has(selectedBadge.id) : false;
  const selectedEarnedAt = selectedBadge ? (earnedMap.get(selectedBadge.id)?.earned_at ?? null) : null;
  const selectedProgress = selectedBadge && !selectedEarned
    ? getBadgeProgress(selectedBadge, progress)
    : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Badges</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Overall progress card */}
        <View style={styles.progressCard}>
          <View style={styles.progressTopRow}>
            <Text style={styles.progressTitle}>{earnedCount} / {totalCount} Unlocked</Text>
            <Text style={styles.progressPct}>{Math.round(overallPct)}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${overallPct}%` }]} />
          </View>
        </View>

        {/* Next Up — badges closest to earning */}
        {nextUp.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Next Up</Text>
            {nextUp.map(({ badge, prog }) => {
              const pct = prog ? Math.round((prog.current / prog.target) * 100) : 0;
              return (
                <TouchableOpacity
                  key={badge.id}
                  style={styles.nextUpRow}
                  onPress={() => setSelectedBadge(badge)}
                  activeOpacity={0.7}
                >
                  <BadgeCard badge={badge} earned={false} compact />
                  <View style={styles.nextUpInfo}>
                    <Text style={styles.nextUpName}>{badge.name_en}</Text>
                    <Text style={styles.nextUpDesc} numberOfLines={1}>
                      {badge.description_en}
                    </Text>
                    <View style={styles.nextUpBarTrack}>
                      <View style={[styles.nextUpBarFill, { width: `${pct}%` }]} />
                    </View>
                    <Text style={styles.nextUpCount}>
                      {prog!.current} / {prog!.target} — {pct}%
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Badges by category — 3-column grid */}
        {CATEGORY_ORDER.filter((cat) => grouped[cat]?.length > 0).map((category) => (
          <View key={category} style={styles.section}>
            <Text style={styles.sectionTitle}>{BADGE_CATEGORY_LABEL[category]}</Text>
            <View style={styles.grid}>
              {grouped[category].map((badge) => {
                const earned = earnedMap.has(badge.id);
                const prog = !earned ? getBadgeProgress(badge, progress) : null;
                return (
                  <TouchableOpacity
                    key={badge.id}
                    onPress={() => setSelectedBadge(badge)}
                    activeOpacity={0.75}
                    style={styles.gridItem}
                  >
                    <BadgeCard badge={badge} earned={earned} progress={prog ?? undefined} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>

      <BadgeDetailSheet
        badge={selectedBadge}
        earned={selectedEarned}
        earnedAt={selectedEarnedAt}
        progress={selectedProgress}
        onClose={() => setSelectedBadge(null)}
      />
    </View>
  );
}

const createStyles = (Colors: ColorPalette, width: number) => {
  const COLS = 3;
  const GRID_PAD = 16;
  const GAP = 10;
  const itemWidth = (width - GRID_PAD * 2 - GAP * (COLS - 1)) / COLS;

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    title: { fontSize: 18, fontWeight: '700', color: Colors.text },
    progressCard: {
      marginHorizontal: 16,
      marginBottom: 16,
      backgroundColor: Colors.surface,
      borderRadius: 14,
      padding: 16,
    },
    progressTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    progressTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
    progressPct: { fontSize: 16, fontWeight: '700', color: Colors.primary },
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
    section: { marginBottom: 24 },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: Colors.text,
      paddingHorizontal: 16,
      marginBottom: 12,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: GRID_PAD,
      gap: GAP,
    },
    gridItem: { width: itemWidth },
    nextUpRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.surface,
      marginHorizontal: 16,
      marginBottom: 10,
      borderRadius: 14,
      padding: 14,
      gap: 12,
    },
    nextUpInfo: { flex: 1 },
    nextUpName: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 2 },
    nextUpDesc: { fontSize: 12, color: Colors.textSecondary, marginBottom: 8 },
    nextUpBarTrack: {
      height: 5,
      backgroundColor: Colors.borderLight,
      borderRadius: 3,
      overflow: 'hidden',
      marginBottom: 3,
    },
    nextUpBarFill: {
      height: '100%',
      backgroundColor: Colors.primary,
      borderRadius: 3,
    },
    nextUpCount: { fontSize: 11, color: Colors.textLight, fontWeight: '600' },
  });
};
