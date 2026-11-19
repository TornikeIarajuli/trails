import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '../ui/Icon';
import { useColors, ColorPalette } from '../../constants/colors';
import { formatXp, levelFor } from '../../utils/xp';
import type { UserXp } from '../../types/user';

/**
 * Your level on the profile: the name, a bar to the next level, and this week's XP and place,
 * which open the leaderboard.
 */
export function LevelCard({ xp }: { xp: UserXp }) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const { current, next, progress, toNext } = levelFor(xp.total_xp);
  const week = xp.week_xp > 0 ? `This week ${formatXp(xp.week_xp)}${xp.ranks.week ? ` · #${xp.ranks.week}` : ''}` : 'No XP this week yet';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.navigate('/(tabs)/feed?segment=leaderboard' as never)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Level ${current.level}, ${current.name}, ${formatXp(xp.total_xp)}. ${
        next ? `${toNext} XP to ${next.name}.` : 'Top level.'
      } ${week}. Opens the leaderboard`}
      testID="level-card"
    >
      <View style={styles.top}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{current.level}</Text>
        </View>
        <View style={styles.titleBlock}>
          <Text style={styles.name}>{current.name}</Text>
          <Text style={styles.level}>Level {current.level}</Text>
        </View>
        <Text style={styles.total}>{formatXp(xp.total_xp)}</Text>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }]} />
      </View>

      <View style={styles.bottom}>
        <Text style={styles.hint} numberOfLines={1}>
          {next ? `${toNext!.toLocaleString('en-US')} XP to ${next.name}` : 'Top level reached'}
        </Text>
        <Text style={styles.week} numberOfLines={1}>
          {week}
        </Text>
        <Icon name="chevron-forward" size={14} color={Colors.textLight} />
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    card: {
      gap: 10,
      paddingTop: 4,
    },
    top: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    badge: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.primary,
    },
    badgeText: {
      fontSize: 16,
      fontWeight: '800',
      color: Colors.textOnPrimary,
    },
    titleBlock: {
      flex: 1,
    },
    name: {
      fontSize: 16,
      fontWeight: '700',
      color: Colors.text,
    },
    level: {
      fontSize: 12,
      color: Colors.textSecondary,
    },
    total: {
      fontSize: 15,
      fontWeight: '800',
      color: Colors.primary,
      fontVariant: ['tabular-nums'],
    },
    track: {
      height: 8,
      borderRadius: 4,
      overflow: 'hidden',
      backgroundColor: Colors.borderLight,
    },
    fill: {
      height: 8,
      borderRadius: 4,
      backgroundColor: Colors.primary,
    },
    bottom: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    hint: {
      flex: 1,
      fontSize: 12,
      color: Colors.textSecondary,
    },
    week: {
      fontSize: 12,
      fontWeight: '600',
      color: Colors.text,
    },
  });
