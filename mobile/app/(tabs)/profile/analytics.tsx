import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useMyCompletions } from '../../../hooks/useCompletions';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { TrailCompletion } from '../../../types/completion';

// ── helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function getMonthLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short' });
}

function computeAnalytics(completions: TrailCompletion[]) {
  const approved = completions.filter((c) => c.status === 'approved');

  const totalHikes = approved.length;
  const totalKm = approved.reduce((sum, c) => sum + (c.trails?.distance_km ?? 0), 0);
  const totalElevation = approved.reduce((sum, c) => sum + (c.trails?.elevation_gain_m ?? 0), 0);
  const totalSeconds = approved.reduce((sum, c) => sum + (c.elapsed_seconds ?? 0), 0);

  // Monthly hikes — last 6 months
  const now = new Date();
  const months: { label: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = getMonthLabel(d);
    const count = approved.filter((c) => {
      const cd = new Date(c.completed_at);
      return cd.getFullYear() === d.getFullYear() && cd.getMonth() === d.getMonth();
    }).length;
    months.push({ label, count });
  }
  const maxMonthCount = Math.max(...months.map((m) => m.count), 1);

  // Difficulty breakdown
  const diffCounts: Record<string, number> = { easy: 0, medium: 0, hard: 0, ultra: 0 };
  approved.forEach((c) => {
    const diff = c.trails?.difficulty;
    if (diff && diff in diffCounts) diffCounts[diff]++;
  });

  // Best streak (consecutive weeks with at least 1 hike)
  const weekNumbers = new Set(
    approved.map((c) => {
      const d = new Date(c.completed_at);
      const startOfYear = new Date(d.getFullYear(), 0, 1);
      return Math.floor((d.getTime() - startOfYear.getTime()) / (7 * 86400000));
    }),
  );
  let bestStreak = 0;
  let currentStreak = 0;
  const weekArr = Array.from(weekNumbers).sort((a, b) => a - b);
  for (let i = 0; i < weekArr.length; i++) {
    if (i === 0 || weekArr[i] === weekArr[i - 1] + 1) {
      currentStreak++;
      bestStreak = Math.max(bestStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  return { totalHikes, totalKm, totalElevation, totalSeconds, months, maxMonthCount, diffCounts, bestStreak };
}

// ── component ─────────────────────────────────────────────────────────────────

export default function AnalyticsScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const { data: completions, isLoading } = useMyCompletions();

  const stats = useMemo(() => {
    if (!completions) return null;
    return computeAnalytics(completions);
  }, [completions]);

  const DIFF_COLORS: Record<string, string> = {
    easy: Colors.difficulty.easy,
    medium: Colors.difficulty.medium,
    hard: Colors.difficulty.hard,
    ultra: Colors.difficulty.ultra,
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'My Stats',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerTitleStyle: { color: Colors.text },
          headerShadowVisible: false,
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {isLoading || !stats ? (
          <LoadingSpinner />
        ) : (
          <>
            {/* Summary cards */}
            <View style={styles.summaryGrid}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{stats.totalHikes}</Text>
                <Text style={styles.summaryLabel}>Hikes</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{stats.totalKm.toFixed(1)}</Text>
                <Text style={styles.summaryLabel}>Total km</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{stats.totalElevation.toFixed(0)}</Text>
                <Text style={styles.summaryLabel}>Elevation (m)</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>
                  {stats.totalSeconds > 0 ? formatTime(stats.totalSeconds) : '—'}
                </Text>
                <Text style={styles.summaryLabel}>Time</Text>
              </View>
            </View>

            {/* Monthly activity chart */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Monthly Activity</Text>
              <View style={styles.barChart}>
                {stats.months.map((m, i) => (
                  <View key={i} style={styles.barColumn}>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: `${(m.count / stats.maxMonthCount) * 100}%`,
                            backgroundColor: Colors.primary,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.barCount}>{m.count > 0 ? m.count : ''}</Text>
                    <Text style={styles.barLabel}>{m.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Difficulty breakdown */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>By Difficulty</Text>
              {(['easy', 'medium', 'hard', 'ultra'] as const).map((diff) => {
                const count = stats.diffCounts[diff] ?? 0;
                const pct = stats.totalHikes > 0 ? count / stats.totalHikes : 0;
                return (
                  <View key={diff} style={styles.diffRow}>
                    <Text style={[styles.diffLabel, { color: DIFF_COLORS[diff] }]}>
                      {diff.charAt(0).toUpperCase() + diff.slice(1)}
                    </Text>
                    <View style={styles.diffTrack}>
                      <View
                        style={[
                          styles.diffBar,
                          { width: `${pct * 100}%`, backgroundColor: DIFF_COLORS[diff] },
                        ]}
                      />
                    </View>
                    <Text style={styles.diffCount}>{count}</Text>
                  </View>
                );
              })}
            </View>

            {/* Best streak */}
            {stats.bestStreak > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Best Streak</Text>
                <View style={styles.streakRow}>
                  <Text style={styles.streakValue}>{stats.bestStreak}</Text>
                  <Text style={styles.streakUnit}>consecutive weeks with a hike</Text>
                </View>
              </View>
            )}

            {stats.totalHikes === 0 && (
              <Text style={styles.emptyText}>Complete some trails to see your stats!</Text>
            )}
          </>
        )}
      </ScrollView>
    </>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    content: {
      padding: 16,
      paddingBottom: 40,
    },
    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 16,
    },
    summaryCard: {
      flex: 1,
      minWidth: '44%',
      backgroundColor: Colors.surface,
      borderRadius: 12,
      padding: 14,
      alignItems: 'center',
    },
    summaryValue: {
      fontSize: 24,
      fontWeight: '800',
      color: Colors.primary,
    },
    summaryLabel: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginTop: 2,
    },
    section: {
      backgroundColor: Colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: Colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 12,
    },
    barChart: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      height: 120,
      gap: 6,
    },
    barColumn: {
      flex: 1,
      alignItems: 'center',
      height: '100%',
      justifyContent: 'flex-end',
    },
    barTrack: {
      flex: 1,
      width: '70%',
      justifyContent: 'flex-end',
      backgroundColor: Colors.borderLight,
      borderRadius: 4,
      overflow: 'hidden',
    },
    bar: {
      width: '100%',
      borderRadius: 4,
      minHeight: 2,
    },
    barCount: {
      fontSize: 10,
      color: Colors.textSecondary,
      marginTop: 2,
    },
    barLabel: {
      fontSize: 10,
      color: Colors.textLight,
      marginTop: 1,
    },
    diffRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    diffLabel: {
      width: 52,
      fontSize: 13,
      fontWeight: '600',
    },
    diffTrack: {
      flex: 1,
      height: 8,
      backgroundColor: Colors.borderLight,
      borderRadius: 4,
      overflow: 'hidden',
    },
    diffBar: {
      height: '100%',
      borderRadius: 4,
      minWidth: 4,
    },
    diffCount: {
      width: 20,
      fontSize: 12,
      color: Colors.textSecondary,
      textAlign: 'right',
    },
    streakRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
    },
    streakValue: {
      fontSize: 36,
      fontWeight: '800',
      color: Colors.primary,
    },
    streakUnit: {
      fontSize: 14,
      color: Colors.textSecondary,
    },
    emptyText: {
      textAlign: 'center',
      color: Colors.textLight,
      fontSize: 14,
      marginTop: 32,
    },
  });
