import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useColors, ColorPalette } from '../../constants/colors';
import { Avatar } from '../ui/Avatar';

interface LeaderboardRowProps {
  rank: number;
  userId: string;
  username: string;
  avatarUrl: string | null;
  /** The number ranked on ("640"), and what it counts ("XP"). */
  value: string;
  unit: string;
  /** Under the name: the level on the all-time board. */
  subtitle?: string | null;
  /** Your own row. */
  isMe?: boolean;
}

const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

export const LeaderboardRow = React.memo(function LeaderboardRow({
  rank,
  userId,
  username,
  avatarUrl,
  value,
  unit,
  subtitle,
  isMe = false,
}: LeaderboardRowProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const podium = rank <= 3;

  return (
    <TouchableOpacity
      style={[styles.row, podium && styles.topRow, isMe && styles.meRow]}
      activeOpacity={0.7}
      onPress={() => router.push(`/trail/user/${userId}`)}
      accessibilityRole="button"
      accessibilityLabel={`${rank}. ${isMe ? 'You' : username}, ${value} ${unit}`}
      testID={isMe ? 'leaderboard-me' : `leaderboard-row-${rank}`}
    >
      <View style={[styles.rank, podium && { backgroundColor: (RANK_COLORS[rank - 1] || Colors.borderLight) + '30' }]}>
        <Text style={[styles.rankText, podium && { color: RANK_COLORS[rank - 1], fontWeight: '800' }]}>{rank}</Text>
      </View>
      <Avatar uri={avatarUrl} name={username} size={40} />
      <View style={styles.nameBlock}>
        <Text style={styles.username} numberOfLines={1}>
          {isMe ? `${username} (you)` : username}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.countContainer}>
        <Text style={styles.count}>{value}</Text>
        <Text style={styles.countLabel}>{unit}</Text>
      </View>
    </TouchableOpacity>
  );
});

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: Colors.surface,
      marginHorizontal: 16,
      marginBottom: 8,
      borderRadius: 12,
      gap: 12,
    },
    topRow: {
      borderWidth: 1,
      borderColor: Colors.border,
    },
    meRow: {
      borderWidth: 1.5,
      borderColor: Colors.primary,
    },
    rank: {
      minWidth: 32,
      height: 32,
      paddingHorizontal: 4,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: Colors.borderLight,
    },
    rankText: {
      fontSize: 14,
      fontWeight: '700',
      color: Colors.textSecondary,
    },
    nameBlock: {
      flex: 1,
      gap: 1,
    },
    username: {
      fontSize: 15,
      fontWeight: '600',
      color: Colors.text,
    },
    subtitle: {
      fontSize: 12,
      color: Colors.textSecondary,
    },
    countContainer: {
      alignItems: 'flex-end',
    },
    count: {
      fontSize: 18,
      fontWeight: '800',
      color: Colors.primary,
      fontVariant: ['tabular-nums'],
    },
    countLabel: {
      fontSize: 11,
      color: Colors.textLight,
    },
  });
