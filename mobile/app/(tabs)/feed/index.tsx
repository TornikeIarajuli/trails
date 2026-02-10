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
import { ActivityCard } from '../../../components/feed/ActivityCard';
import { EmptyFeed } from '../../../components/feed/EmptyFeed';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { FeedItem } from '../../../types/feed';

export default function FeedScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const {
    data,
    isLoading,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useFeed();

  const items: FeedItem[] = data?.pages.flatMap((page) => page.data) ?? [];

  if (isLoading) return <LoadingSpinner />;

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>Activity Feed</Text>
      <FlatList
        data={items}
        keyExtractor={(item) => `${item.activity_type}-${item.activity_id}`}
        renderItem={({ item }) => <ActivityCard item={item} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
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
