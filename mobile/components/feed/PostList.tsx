import React, { useMemo } from 'react';
import { View, FlatList, RefreshControl, StyleSheet } from 'react-native';
import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import { useColors, ColorPalette } from '../../constants/colors';
import { useWithoutBlocked } from '../../hooks/useModeration';
import { ActivityCard } from './ActivityCard';
import { FeedPostSkeleton } from './FeedPostSkeleton';
import { ErrorState } from '../ui/ErrorState';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import type { FeedItem } from '../../types/feed';
import type { PaginatedResponse } from '../../types/api';

const SKELETON_COUNT = 3;

type PostsQuery = UseInfiniteQueryResult<InfiniteData<PaginatedResponse<FeedItem>>, Error>;

/**
 * A scrolling list of feed posts, page by page: Following and Discover. `header` stays on top
 * in every state (loading, failed, empty); `empty` shows when there are no posts.
 */
export const PostList = React.memo(function PostList({
  query,
  header,
  empty,
  errorTitle,
  testID,
}: {
  query: PostsQuery;
  header?: React.ReactElement | null;
  empty: React.ReactElement;
  errorTitle: string;
  testID?: string;
}) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const { data, isLoading, isError, error, isRefetching, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = query;

  const loadedItems = useMemo(() => {
    const seen = new Set<string>();
    return (data?.pages.flatMap((page) => page.data) ?? []).filter((item: FeedItem) => {
      const key = `${item.activity_type}-${item.activity_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [data]);
  // The API already leaves out blocked users; this also covers the moment right after blocking
  const items = useWithoutBlocked(loadedItems, (item) => item.user_id);

  if (isLoading) {
    return (
      <View style={styles.skeletons} testID={testID}>
        {header}
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <FeedPostSkeleton key={i} />
        ))}
      </View>
    );
  }

  if (isError && items.length === 0) {
    return (
      <View style={styles.fill} testID={testID}>
        {header}
        <ErrorState error={error} title={errorTitle} onRetry={() => refetch()} retrying={isRefetching} />
      </View>
    );
  }

  return (
    <FlatList
      testID={testID}
      data={items}
      keyExtractor={(item) => `${item.activity_type}-${item.activity_id}`}
      renderItem={({ item }) => <ActivityCard item={item} />}
      ListHeaderComponent={header}
      // Posts run edge to edge, Instagram-style; an empty list centres its message
      contentContainerStyle={[styles.list, items.length === 0 && styles.listEmpty]}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={true}
      // Posts are about a screen tall, so a few at a time is plenty
      maxToRenderPerBatch={4}
      windowSize={7}
      initialNumToRender={3}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[Colors.primary]} tintColor={Colors.primary} />
      }
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={empty}
      ListFooterComponent={
        isFetchingNextPage ? (
          <View style={styles.footer}>
            <LoadingSpinner />
          </View>
        ) : null
      }
    />
  );
});

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    fill: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    skeletons: {
      paddingTop: 4,
    },
    list: {
      paddingTop: 4,
      paddingBottom: 16,
    },
    listEmpty: {
      flexGrow: 1,
    },
    footer: {
      paddingVertical: 20,
    },
  });
