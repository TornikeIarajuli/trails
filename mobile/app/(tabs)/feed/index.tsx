import React, { useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useFeed } from '../../../hooks/useFeed';
import { useWithoutBlocked } from '../../../hooks/useModeration';
import { ActivityCard } from '../../../components/feed/ActivityCard';
import { EmptyFeed } from '../../../components/feed/EmptyFeed';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { FeedItemSkeleton } from '../../../components/ui/Skeleton';
import { FeedItem } from '../../../types/feed';

const SKELETON_COUNT = 4;

export default function FeedScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const {
    data,
    isLoading,
    isError,
    error,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useFeed();

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
      <View style={styles.container}>
        <Text style={styles.screenTitle}>Activity Feed</Text>
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <FeedItemSkeleton key={i} />
        ))}
      </View>
    );
  }

  if (isError && items.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.screenTitle}>Activity Feed</Text>
        <ErrorState
          error={error}
          title="Couldn't load your feed"
          onRetry={() => refetch()}
          retrying={isRefetching}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>Activity Feed</Text>
      <FlatList
        data={items}
        keyExtractor={(item) => `${item.activity_type}-${item.activity_id}`}
        renderItem={({ item }) => <ActivityCard item={item} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={8}
        windowSize={5}
        initialNumToRender={8}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={<EmptyFeed />}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.footer}>
              <LoadingSpinner />
            </View>
          ) : null
        }
      />
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  list: {
    padding: 16,
    paddingTop: 4,
  },
  footer: {
    paddingVertical: 20,
  },
});
