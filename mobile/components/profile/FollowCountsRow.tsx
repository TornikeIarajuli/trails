import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useColors, ColorPalette } from '../../constants/colors';
import { useFollowCounts } from '../../hooks/useFollows';

interface FollowCountsRowProps {
  userId: string;
}

export function FollowCountsRow({ userId }: FollowCountsRowProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const { data: followCounts } = useFollowCounts(userId);

  if (!followCounts) return null;

  return (
    <View style={styles.followRow}>
      <TouchableOpacity
        style={styles.followItem}
        onPress={() => router.push(`/trail/user/followers?userId=${userId}&tab=followers`)}
      >
        <Text style={styles.followNumber}>{followCounts.followers_count}</Text>
        <Text style={styles.followLabel}>Followers</Text>
      </TouchableOpacity>
      <View style={styles.followDivider} />
      <TouchableOpacity
        style={styles.followItem}
        onPress={() => router.push(`/trail/user/followers?userId=${userId}&tab=following`)}
      >
        <Text style={styles.followNumber}>{followCounts.following_count}</Text>
        <Text style={styles.followLabel}>Following</Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  followRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  followItem: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  followNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  followLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  followDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.border,
  },
});
