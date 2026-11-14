import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityCard } from '../../../components/feed/ActivityCard';
import { FeedPostSkeleton } from '../../../components/feed/FeedPostSkeleton';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Icon } from '../../../components/ui/Icon';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useFeedPost } from '../../../hooks/useFeed';
import { getErrorStatus } from '../../../utils/showError';
import { withBottomInset } from '../../../utils/insets';

/**
 * One post, as the feed shows it: what a like or comment notification opens ("nino liked
 * your hike"). From a comment notification (?comments=1) the comments open by themselves.
 * `trailId` lets a deleted post still lead to its trail.
 */
export default function PostScreen() {
  const { id, comments, trailId } = useLocalSearchParams<{ id: string; comments?: string; trailId?: string }>();
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();
  const { data: post, isLoading, error, refetch, isRefetching } = useFeedPost(id);

  const header = <Stack.Screen options={{ headerShown: true, title: 'Post' }} />;

  if (!post) {
    if (isLoading) {
      return (
        <>
          {header}
          <FeedPostSkeleton />
        </>
      );
    }

    if (getErrorStatus(error) === 404) {
      return (
        <>
          {header}
          <View style={styles.gone} testID="post-gone">
            <View style={styles.goneIcon}>
              <Icon name="images-outline" size={36} color={Colors.textLight} />
            </View>
            <Text style={styles.goneTitle}>This post is no longer available</Text>
            <Text style={styles.goneText}>It may have been deleted.</Text>
            {trailId ? (
              <TouchableOpacity
                style={styles.trailButton}
                onPress={() => router.replace(`/trail/${trailId}` as never)}
                accessibilityRole="button"
                testID="post-gone-open-trail"
              >
                <Text style={styles.trailButtonText}>Open the trail</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </>
      );
    }

    return (
      <>
        {header}
        <ErrorState error={error} title="Couldn't load this post" onRetry={() => refetch()} retrying={isRefetching} />
      </>
    );
  }

  return (
    <>
      {header}
      <ScrollView
        style={styles.container}
        contentContainerStyle={withBottomInset(styles.content, insets.bottom)}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        <ActivityCard item={post} openCommentsOnMount={comments === '1'} />
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
      paddingBottom: 16,
    },
    gone: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 32,
      backgroundColor: Colors.background,
    },
    goneIcon: {
      width: 76,
      height: 76,
      borderRadius: 38,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.borderLight,
      marginBottom: 8,
    },
    goneTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: Colors.text,
      textAlign: 'center',
    },
    goneText: {
      fontSize: 14,
      color: Colors.textSecondary,
      textAlign: 'center',
    },
    trailButton: {
      marginTop: 12,
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: 24,
      borderRadius: 12,
      backgroundColor: Colors.primary,
    },
    trailButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: Colors.textOnPrimary,
    },
  });
