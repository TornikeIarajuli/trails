import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Avatar } from '../ui/Avatar';
import { Icon } from '../ui/Icon';
import { Skeleton } from '../ui/Skeleton';
import { useColors, ColorPalette } from '../../constants/colors';
import { useSuggestedHikers } from '../../hooks/useFeed';
import { useToggleFollow } from '../../hooks/useFollows';
import { useWithoutBlocked } from '../../hooks/useModeration';
import { haptics } from '../../utils/haptics';
import type { SuggestedHiker } from '../../types/user';

type Styles = ReturnType<typeof createStyles>;

/** Why this person is suggested: someone you follow follows them, their hikes, or that they are new. */
export function suggestionReason(hiker: Pick<SuggestedHiker, 'followed_by' | 'mutual_count' | 'total_trails_completed'>): string {
  if (hiker.followed_by) {
    const others = Math.max(0, (hiker.mutual_count ?? 0) - 1);
    return others > 0 ? `Followed by ${hiker.followed_by} + ${others} more` : `Followed by ${hiker.followed_by}`;
  }
  const hikes = hiker.total_trails_completed ?? 0;
  if (hikes > 0) return `${hikes} ${hikes === 1 ? 'hike' : 'hikes'}`;
  return 'New on Kvali';
}

function HikerCard({ hiker, styles, Colors }: { hiker: SuggestedHiker; styles: Styles; Colors: ColorPalette }) {
  const toggleFollow = useToggleFollow();
  // The card stays after following (like Instagram), showing "Following" until the next refresh
  const [following, setFollowing] = useState(false);

  const follow = () => {
    if (toggleFollow.isPending) return;
    haptics.tap();
    const next = !following;
    setFollowing(next);
    toggleFollow.mutate(hiker.id, { onError: () => setFollowing(!next) });
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => router.push(`/trail/user/${hiker.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${hiker.username}, ${suggestionReason(hiker)}`}
      testID={`suggested-${hiker.id}`}
    >
      <Avatar uri={hiker.avatar_url} name={hiker.full_name || hiker.username} size={64} />
      <Text style={styles.username} numberOfLines={1}>
        {hiker.username}
      </Text>
      <Text style={styles.reason} numberOfLines={2}>
        {suggestionReason(hiker)}
      </Text>
      <Pressable
        style={({ pressed }) => [styles.followButton, following && styles.followingButton, pressed && styles.pressed]}
        onPress={follow}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={following ? `Following ${hiker.username}. Tap to unfollow` : `Follow ${hiker.username}`}
        accessibilityState={{ selected: following }}
        testID={`follow-${hiker.id}`}
      >
        <Text style={[styles.followText, following && styles.followingText]}>{following ? 'Following' : 'Follow'}</Text>
      </Pressable>
    </Pressable>
  );
}

/**
 * "Hikers to follow": a row of people at the top of Discover, those followed by people you
 * follow first. Nothing at all when there is nobody left to suggest.
 */
export function SuggestedHikers() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const { data, isLoading } = useSuggestedHikers();
  const hikers = useWithoutBlocked(data, (hiker) => hiker.id);

  if (!isLoading && hikers.length === 0) return null;

  return (
    <View style={styles.container} testID="suggested-hikers">
      <View style={styles.titleRow}>
        <Text style={styles.title}>Hikers to follow</Text>
        <Pressable
          onPress={() => router.push('/search')}
          hitSlop={10}
          style={styles.searchLink}
          accessibilityRole="button"
          accessibilityLabel="Search for hikers"
          testID="suggested-search"
        >
          <Icon name="search" size={15} color={Colors.primary} />
          <Text style={styles.searchText}>Search</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <View key={i} style={styles.card}>
                <Skeleton width={64} height={64} borderRadius={32} />
                <Skeleton height={13} widthPercent="70%" borderRadius={6} />
                <Skeleton height={11} widthPercent="50%" borderRadius={6} />
              </View>
            ))
          : hikers.map((hiker) => <HikerCard key={hiker.id} hiker={hiker} styles={styles} Colors={Colors} />)}
      </ScrollView>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      paddingTop: 4,
      paddingBottom: 12,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 10,
    },
    title: {
      fontSize: 16,
      fontWeight: '800',
      color: Colors.text,
    },
    searchLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 32,
    },
    searchText: {
      fontSize: 14,
      fontWeight: '700',
      color: Colors.primary,
    },
    row: {
      paddingHorizontal: 12,
      gap: 10,
    },
    card: {
      width: 148,
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingTop: 14,
      paddingBottom: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
    },
    pressed: {
      opacity: 0.75,
    },
    username: {
      marginTop: 2,
      fontSize: 14,
      fontWeight: '700',
      color: Colors.text,
      maxWidth: '100%',
    },
    reason: {
      minHeight: 32,
      fontSize: 12,
      lineHeight: 16,
      color: Colors.textSecondary,
      textAlign: 'center',
    },
    followButton: {
      alignSelf: 'stretch',
      minHeight: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 9,
      backgroundColor: Colors.primary,
    },
    followingButton: {
      backgroundColor: Colors.borderLight,
    },
    followText: {
      fontSize: 14,
      fontWeight: '700',
      color: Colors.textOnPrimary,
    },
    followingText: {
      color: Colors.text,
    },
  });
