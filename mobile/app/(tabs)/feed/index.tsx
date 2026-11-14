import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useFeed } from '../../../hooks/useFeed';
import { useWithoutBlocked } from '../../../hooks/useModeration';
import { ActivityCard } from '../../../components/feed/ActivityCard';
import { EmptyFeed } from '../../../components/feed/EmptyFeed';
import { LeaderboardView } from '../../../components/leaderboard/LeaderboardView';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { FeedItemSkeleton } from '../../../components/ui/Skeleton';
import { FeedItem } from '../../../types/feed';
import { haptics } from '../../../utils/haptics';
import { FEED_SEGMENTS, FeedSegment, feedSegmentFromParam } from '../../../utils/feedSegment';

const SKELETON_COUNT = 4;

type Styles = ReturnType<typeof createStyles>;

/** Friends' activity: the Feed tab's first segment. */
const ActivityList = React.memo(function ActivityList({ styles, Colors }: { styles: Styles; Colors: ColorPalette }) {
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
      <View>
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <FeedItemSkeleton key={i} />
        ))}
      </View>
    );
  }

  if (isError && items.length === 0) {
    return (
      <ErrorState
        error={error}
        title="Couldn't load your feed"
        onRetry={() => refetch()}
        retrying={isRefetching}
      />
    );
  }

  return (
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
  );
});

/**
 * One segment's content. Segments stay mounted once opened, so switching back keeps the
 * list where it was. The hidden one stays laid out, only invisible and untouchable:
 * collapsing a list to nothing can leave its rows blank on Android when it comes back.
 */
function SegmentPane({ visible, styles, children }: { visible: boolean; styles: Styles; children: React.ReactNode }) {
  return (
    <View
      style={[styles.pane, !visible && styles.paneHidden]}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    >
      {children}
    </View>
  );
}

/** The Feed tab: friends' activity, and the leaderboard (formerly its own "Ranks" tab). */
export default function FeedScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const params = useLocalSearchParams<{ segment?: string }>();
  const [segment, setSegment] = useState<FeedSegment>(() => feedSegmentFromParam(params.segment) ?? 'activity');
  // The leaderboard is only loaded once someone opens it
  const [leaderboardOpened, setLeaderboardOpened] = useState(segment === 'leaderboard');

  // A link can ask for a segment (`/feed?segment=leaderboard`, e.g. from the old Ranks tab).
  // Without one, for instance when the Feed tab button is pressed, the current segment stays.
  const requested = feedSegmentFromParam(params.segment);
  useEffect(() => {
    if (!requested) return;
    setSegment(requested);
    if (requested === 'leaderboard') setLeaderboardOpened(true);
  }, [requested]);

  const select = (next: FeedSegment) => {
    if (next === segment) return;
    haptics.select();
    setSegment(next);
    if (next === 'leaderboard') setLeaderboardOpened(true);
    // Keep the screen's params in step, so a later link to the other segment is a change
    router.setParams({ segment: next });
  };

  return (
    <View style={styles.container}>
      <View style={styles.segmented} accessibilityRole="tablist">
        {FEED_SEGMENTS.map(({ key, label }) => {
          const active = segment === key;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.segment, active && styles.segmentActive]}
              onPress={() => select(key)}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: active }}
              testID={`feed-segment-${key}`}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.panes}>
        <SegmentPane visible={segment === 'activity'} styles={styles}>
          <ActivityList styles={styles} Colors={Colors} />
        </SegmentPane>
        {leaderboardOpened && (
          <SegmentPane visible={segment === 'leaderboard'} styles={styles}>
            <LeaderboardView />
          </SegmentPane>
        )}
      </View>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  segmented: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    padding: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  segment: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  segmentActive: {
    backgroundColor: Colors.primary,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  segmentTextActive: {
    color: Colors.textOnPrimary,
  },
  panes: {
    flex: 1,
  },
  pane: {
    ...StyleSheet.absoluteFillObject,
  },
  paneHidden: {
    opacity: 0,
  },
  list: {
    padding: 16,
    paddingTop: 4,
  },
  footer: {
    paddingVertical: 20,
  },
});
