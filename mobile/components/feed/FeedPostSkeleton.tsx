import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useColors } from '../../constants/colors';
import { Skeleton } from '../ui/Skeleton';

/** A feed post while loading: header, a full-width photo, the action row and two lines. */
export function FeedPostSkeleton() {
  const Colors = useColors();
  return (
    <View style={[styles.post, { backgroundColor: Colors.surface }]} testID="feed-post-skeleton">
      <View style={styles.header}>
        <Skeleton width={38} height={38} borderRadius={19} />
        <View style={styles.headerLines}>
          <Skeleton height={13} widthPercent="65%" borderRadius={6} />
          <Skeleton height={11} widthPercent="30%" borderRadius={6} />
        </View>
      </View>
      <Skeleton height={300} borderRadius={0} />
      <View style={styles.actions}>
        <Skeleton width={28} height={28} borderRadius={14} />
        <Skeleton width={28} height={28} borderRadius={14} />
        <Skeleton width={28} height={28} borderRadius={14} />
      </View>
      <View style={styles.lines}>
        <Skeleton height={13} widthPercent="25%" borderRadius={6} />
        <Skeleton height={13} widthPercent="55%" borderRadius={6} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  post: {
    marginBottom: 8,
    paddingBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  headerLines: {
    flex: 1,
    gap: 6,
  },
  actions: {
    flexDirection: 'row',
    gap: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  lines: {
    paddingHorizontal: 14,
    gap: 8,
  },
});
