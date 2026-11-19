import React, { useMemo, useState } from 'react';
import { View, FlatList, Text, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useColors, ColorPalette } from '../../constants/colors';
import { useMyXp, useXpLeaderboard } from '../../hooks/useXp';
import { useWithoutBlocked } from '../../hooks/useModeration';
import { useAuthStore } from '../../store/authStore';
import { LeaderboardRow } from './LeaderboardRow';
import { XpRulesSheet } from './XpRulesSheet';
import { ErrorState } from '../ui/ErrorState';
import { LeaderboardRowSkeleton } from '../ui/Skeleton';
import { levelFor } from '../../utils/xp';
import { haptics } from '../../utils/haptics';
import { queryKeys } from '../../utils/queryKeys';
import type { UserProfile } from '../../types/user';
import type { XpPeriod } from '../../types/user';

const PERIODS: { key: XpPeriod; label: string; empty: string; none: string }[] = [
  { key: 'week', label: 'This week', empty: 'No XP yet this week', none: 'You have no XP this week yet. A hike puts you on the board.' },
  { key: 'month', label: 'This month', empty: 'No XP yet this month', none: 'You have no XP this month yet. A hike puts you on the board.' },
  { key: 'all', label: 'All time', empty: 'No XP yet', none: 'Hike a trail with the app to get on the board.' },
];

interface LeaderboardViewProps {
  /** Shows a "Leaderboard" heading above the caption (not needed under the Feed's segments). */
  showTitle?: boolean;
}

/**
 * Hikers ranked by XP this week (from Monday), this month or all time, with your own place at
 * the bottom when you are not in the list, and how XP is earned.
 */
export function LeaderboardView({ showTitle = false }: LeaderboardViewProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const [period, setPeriod] = useState<XpPeriod>('week');
  const [rulesOpen, setRulesOpen] = useState(false);
  const me = useAuthStore((s) => s.user);
  // Your photo, from the profile already loaded (Profile tab); the name comes with the sign-in
  const myProfile = useQueryClient().getQueryData<UserProfile>(queryKeys.profile.me());

  const { data, isLoading, isError, error, refetch, isRefetching } = useXpLeaderboard(period);
  const entries = useWithoutBlocked(data, (entry) => entry.id);
  const { data: myXp, refetch: refetchMine } = useMyXp();

  const myPoints = myXp ? (period === 'week' ? myXp.week_xp : period === 'month' ? myXp.month_xp : myXp.total_xp) : 0;
  const myRank = myXp ? myXp.ranks[period] : null;
  const meListed = !!me && entries.some((e) => e.id === me.id);
  const current = PERIODS.find((p) => p.key === period)!;

  const select = (next: XpPeriod) => {
    if (next === period) return;
    haptics.select();
    setPeriod(next);
  };

  let footer: React.ReactElement | null = null;
  if (me && !meListed && myXp) {
    footer =
      myRank && myPoints > 0 ? (
        <LeaderboardRow
          rank={myRank}
          userId={me.id}
          username={myProfile?.username || me.user_metadata?.username || 'You'}
          avatarUrl={myProfile?.avatar_url ?? null}
          value={myPoints.toLocaleString('en-US')}
          unit="XP"
          subtitle={period === 'all' ? levelFor(myPoints).current.name : null}
          isMe
        />
      ) : entries.length > 0 ? (
        <Text style={styles.meHint} testID="leaderboard-me-none">
          {current.none}
        </Text>
      ) : null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {showTitle && <Text style={styles.title}>Leaderboard</Text>}
        <View style={styles.periods} accessibilityRole="tablist">
          {PERIODS.map((p) => {
            const active = p.key === period;
            return (
              <TouchableOpacity
                key={p.key}
                style={[styles.period, active && styles.periodActive]}
                onPress={() => select(p.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                testID={`leaderboard-period-${p.key}`}
              >
                <Text style={[styles.periodText, active && styles.periodTextActive]}>{p.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.subtitle}>
          XP from hikes recorded in the app, photos, reviews, reports and posts.{' '}
          <Text style={styles.link} onPress={() => setRulesOpen(true)} accessibilityRole="link" testID="xp-rules-link">
            How XP works
          </Text>
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.list}>
          {Array.from({ length: 8 }).map((_, i) => (
            <LeaderboardRowSkeleton key={i} />
          ))}
        </View>
      ) : isError && entries.length === 0 ? (
        <ErrorState error={error} title="Couldn't load the leaderboard" onRetry={() => refetch()} retrying={isRefetching} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <LeaderboardRow
              rank={item.rank}
              userId={item.id}
              username={item.username}
              avatarUrl={item.avatar_url}
              value={item.xp.toLocaleString('en-US')}
              unit="XP"
              subtitle={period === 'all' ? levelFor(item.xp).current.name : null}
              isMe={item.id === me?.id}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={5}
          initialNumToRender={15}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => {
                refetch();
                refetchMine();
              }}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          ListFooterComponent={footer}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{current.empty}</Text>
              <Text style={styles.emptyHint}>
                Record a hike, add photos or report the trail conditions, and you'll be the first name here.
              </Text>
              <TouchableOpacity
                style={styles.emptyAction}
                onPress={() => router.navigate('/(tabs)/home' as any)}
                accessibilityRole="button"
              >
                <Text style={styles.emptyActionText}>Browse trails</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      <XpRulesSheet visible={rulesOpen} onClose={() => setRulesOpen(false)} />
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    header: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 12,
      gap: 10,
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: Colors.text,
    },
    periods: {
      flexDirection: 'row',
      gap: 8,
    },
    period: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
    },
    periodActive: {
      backgroundColor: Colors.primary,
      borderColor: Colors.primary,
    },
    periodText: {
      fontSize: 13,
      fontWeight: '600',
      color: Colors.textSecondary,
    },
    periodTextActive: {
      color: Colors.textOnPrimary,
    },
    subtitle: {
      fontSize: 13,
      lineHeight: 18,
      color: Colors.textSecondary,
    },
    link: {
      fontWeight: '700',
      color: Colors.primary,
    },
    list: {
      paddingBottom: 20,
    },
    meHint: {
      marginHorizontal: 16,
      marginTop: 4,
      fontSize: 13,
      lineHeight: 18,
      color: Colors.textSecondary,
      textAlign: 'center',
    },
    empty: {
      alignItems: 'center',
      paddingTop: 80,
      paddingHorizontal: 32,
    },
    emptyText: {
      fontSize: 16,
      fontWeight: '600',
      color: Colors.textSecondary,
      marginTop: 8,
    },
    emptyHint: {
      fontSize: 14,
      lineHeight: 20,
      color: Colors.textLight,
      textAlign: 'center',
      marginTop: 6,
    },
    emptyAction: {
      marginTop: 16,
      paddingHorizontal: 24,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: Colors.primary + '15',
      borderWidth: 1,
      borderColor: Colors.primary + '40',
    },
    emptyActionText: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.primary,
    },
  });
