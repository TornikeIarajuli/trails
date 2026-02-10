import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useColors, ColorPalette } from '../../constants/colors';
import { LeaderboardEntry } from '../../types/user';
import { Avatar } from '../ui/Avatar';

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  isTopThree?: boolean;
}

const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

export function LeaderboardRow({ entry, isTopThree }: LeaderboardRowProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  return (
    <TouchableOpacity
      style={[styles.row, isTopThree && styles.topRow]}
      activeOpacity={0.7}
      onPress={() => router.push(`/trail/user/${entry.id}`)}
    >
      <View
        style={[
          styles.rank,
          isTopThree && {
            backgroundColor: (RANK_COLORS[entry.rank - 1] || Colors.borderLight) + '30',
          },
        ]}
      >
        <Text
          style={[
            styles.rankText,
            isTopThree && { color: RANK_COLORS[entry.rank - 1], fontWeight: '800' },
          ]}
        >
          {entry.rank}
        </Text>
      </View>
      <Avatar uri={entry.avatar_url} name={entry.username} size={40} />
      <Text style={styles.username} numberOfLines={1}>
        {entry.username}
      </Text>
      <View style={styles.countContainer}>
        <Text style={styles.count}>{entry.total_trails_completed}</Text>
        <Text style={styles.countLabel}>trails</Text>
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
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
  rank: {
    width: 32,
    height: 32,
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
  username: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  countContainer: {
    alignItems: 'center',
  },
  count: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
  },
  countLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
});
