import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { useColors } from '../../constants/colors';
import { useReducedMotion } from 'react-native-reanimated';

interface SkeletonProps {
  width?: number;
  widthPercent?: string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width, widthPercent = '100%', height = 16, borderRadius = 8, style }: SkeletonProps) {
  const Colors = useColors();
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reducedMotion) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity, reducedMotion]);

  const resolvedWidth: ViewStyle['width'] = width !== undefined ? width : (widthPercent as `${number}%`);

  return (
    <Animated.View
      style={[
        { width: resolvedWidth, height, borderRadius, backgroundColor: Colors.borderLight, opacity },
        style,
      ]}
    />
  );
}

export function TrailCardSkeleton() {
  const Colors = useColors();
  return (
    <View style={[skeletonStyles.card, { backgroundColor: Colors.surface }]}>
      <Skeleton height={160} borderRadius={12} style={skeletonStyles.image} />
      <View style={skeletonStyles.body}>
        <Skeleton height={18} widthPercent="70%" borderRadius={6} />
        <Skeleton height={13} widthPercent="45%" borderRadius={6} style={{ marginTop: 6 }} />
        <View style={skeletonStyles.statsRow}>
          <Skeleton height={13} width={60} borderRadius={6} />
          <Skeleton height={13} width={60} borderRadius={6} />
          <Skeleton height={13} width={60} borderRadius={6} />
        </View>
      </View>
    </View>
  );
}

export function LeaderboardRowSkeleton() {
  const Colors = useColors();
  return (
    <View style={[skeletonStyles.leaderRow, { backgroundColor: Colors.surface }]}>
      <Skeleton width={32} height={32} borderRadius={16} />
      <Skeleton width={40} height={40} borderRadius={20} />
      <Skeleton height={16} widthPercent="45%" borderRadius={6} />
      <View style={{ marginLeft: 'auto' }}>
        <Skeleton width={40} height={18} borderRadius={6} />
      </View>
    </View>
  );
}

export function FeedItemSkeleton() {
  const Colors = useColors();
  return (
    <View style={[skeletonStyles.feedCard, { backgroundColor: Colors.surface }]}>
      <View style={skeletonStyles.feedHeader}>
        <Skeleton width={44} height={44} borderRadius={22} />
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton height={14} widthPercent="60%" borderRadius={6} />
          <Skeleton height={12} widthPercent="35%" borderRadius={6} />
        </View>
      </View>
      <Skeleton height={180} borderRadius={12} style={{ marginTop: 10 }} />
      <View style={skeletonStyles.feedFooter}>
        <Skeleton width={64} height={14} borderRadius={6} />
        <Skeleton width={64} height={14} borderRadius={6} />
      </View>
    </View>
  );
}

/** A two-column grid of product cards, matching the shop grid's layout. */
export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  const Colors = useColors();
  return (
    <View style={skeletonStyles.productGrid}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[skeletonStyles.productCard, { backgroundColor: Colors.card, borderColor: Colors.borderLight }]}
        >
          <Skeleton height={140} borderRadius={0} />
          <View style={skeletonStyles.productBody}>
            <Skeleton height={14} widthPercent="85%" borderRadius={6} />
            <Skeleton height={14} widthPercent="40%" borderRadius={6} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** A notification row: round icon, title and two body lines. */
export function NotificationRowSkeleton() {
  const Colors = useColors();
  return (
    <View style={[skeletonStyles.notificationRow, { backgroundColor: Colors.surface }]}>
      <Skeleton width={44} height={44} borderRadius={22} />
      <View style={{ flex: 1, gap: 6 }}>
        <Skeleton height={14} widthPercent="55%" borderRadius={6} />
        <Skeleton height={12} widthPercent="90%" borderRadius={6} />
        <Skeleton height={12} widthPercent="70%" borderRadius={6} />
      </View>
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 12,
  },
  productCard: {
    width: '48.5%',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
  },
  productBody: {
    padding: 10,
    gap: 6,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: StyleSheet.hairlineWidth,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
  },
  body: {
    padding: 12,
    gap: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    gap: 12,
  },
  feedCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 14,
  },
  feedHeader: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  feedFooter: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
  },
});
