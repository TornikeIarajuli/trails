import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useFeed } from '../../../hooks/useFeed';
import { EmptyFeed } from '../../../components/feed/EmptyFeed';
import { PostList } from '../../../components/feed/PostList';
import { DiscoverList } from '../../../components/feed/DiscoverList';
import { LeaderboardView } from '../../../components/leaderboard/LeaderboardView';
import { haptics } from '../../../utils/haptics';
import { FEED_SEGMENTS, FeedSegment, feedSegmentFromParam } from '../../../utils/feedSegment';

type Styles = ReturnType<typeof createStyles>;

/** Posts by the people you follow (and yours): the Feed tab's first segment. */
function FollowingList() {
  const query = useFeed();
  return <PostList query={query} empty={<EmptyFeed />} errorTitle="Couldn't load your feed" testID="following-list" />;
}

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

/**
 * The Feed tab: the people you follow, Discover (everyone's posts and hikers to follow), and
 * the leaderboard (formerly its own "Ranks" tab).
 */
export default function FeedScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const params = useLocalSearchParams<{ segment?: string }>();
  const [segment, setSegment] = useState<FeedSegment>(() => feedSegmentFromParam(params.segment) ?? 'activity');
  // Discover and the leaderboard are only loaded once someone opens them
  const [opened, setOpened] = useState<ReadonlySet<FeedSegment>>(() => new Set([segment]));
  const open = useCallback(
    (next: FeedSegment) => setOpened((prev) => (prev.has(next) ? prev : new Set(prev).add(next))),
    [],
  );

  // A link can ask for a segment (`/feed?segment=leaderboard`, e.g. from the old Ranks tab, or
  // Discover from the empty feed). Without one, for instance when the Feed tab button is
  // pressed, the current segment stays.
  const requested = feedSegmentFromParam(params.segment);
  useEffect(() => {
    if (!requested) return;
    setSegment(requested);
    open(requested);
  }, [requested, open]);

  const select = (next: FeedSegment) => {
    if (next === segment) return;
    haptics.select();
    setSegment(next);
    open(next);
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
          <FollowingList />
        </SegmentPane>
        {opened.has('discover') && (
          <SegmentPane visible={segment === 'discover'} styles={styles}>
            <DiscoverList />
          </SegmentPane>
        )}
        {opened.has('leaderboard') && (
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
});
