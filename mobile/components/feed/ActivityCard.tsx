import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../../constants/colors';
import { Avatar } from '../ui/Avatar';
import { FeedItem } from '../../types/feed';
import { useComments } from '../../hooks/useComments';
import { useLikes, useToggleLike } from '../../hooks/useLikes';
import { hasLikeSummary } from '../../utils/feedCache';
import { CommentsSheet } from './CommentsSheet';
import { ContentMenu } from '../moderation/ContentMenu';

function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getConditionLabel(conditionType: string): string {
  const labels: Record<string, string> = {
    trail_clear: 'Trail Clear',
    muddy: 'Muddy',
    snow: 'Snow',
    fallen_tree: 'Fallen Tree',
    flooded: 'Flooded',
    overgrown: 'Overgrown',
    damaged: 'Damaged',
    closed: 'Closed',
  };
  return labels[conditionType] || conditionType;
}

function PhotoCarousel({ urls, onPress, styles, Colors }: {
  urls: string[];
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  Colors: ColorPalette;
}) {
  const [page, setPage] = useState(0);
  // Measured rather than derived from the screen width, so each page is exactly as wide as the card body
  const [width, setWidth] = useState(0);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width > 0) setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  if (urls.length === 1) {
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={onPress} accessibilityRole="button" accessibilityLabel="Open trail">
        <Image
          source={{ uri: urls[0] }}
          placeholder={{ blurhash: 'L76F~B?bWD%M~qxuxEtS%MNFWqxt' }}
          contentFit="cover"
          transition={300}
          cachePolicy="memory-disk"
          style={styles.photo}
        />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.carouselContainer}>
      <View
        style={styles.carouselWrapper}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        {width > 0 && (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScroll}
          >
            {urls.map((url, i) => (
              <TouchableOpacity key={i} activeOpacity={0.8} onPress={onPress} accessibilityRole="button" accessibilityLabel="Open trail">
                <Image
                  source={{ uri: url }}
                  placeholder={{ blurhash: 'L76F~B?bWD%M~qxuxEtS%MNFWqxt' }}
                  contentFit="cover"
                  transition={300}
                  cachePolicy="memory-disk"
                  style={[styles.carouselPhoto, { width }]}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
      <View style={styles.dotsRow}>
        {urls.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === page ? { backgroundColor: Colors.primary, width: 14 } : { backgroundColor: Colors.border }]}
          />
        ))}
      </View>
    </View>
  );
}

const ACTION_CONFIG: Record<string, { verb: string; icon: string; color: string }> = {
  completion: { verb: 'completed', icon: 'checkmark-circle', color: '#4CAF50' },
  photo: { verb: 'uploaded a photo on', icon: 'camera', color: '#2196F3' },
  condition: { verb: 'reported a condition on', icon: 'warning', color: '#FF9800' },
  review: { verb: 'reviewed', icon: 'star', color: '#FFC107' },
};
const UNKNOWN_ACTION = { verb: 'was active on', icon: 'ellipse', color: '#9E9E9E' };

const REPORT_LABEL: Record<string, string> = {
  completion: 'hike',
  photo: 'photo',
  condition: 'condition report',
  review: 'review',
};

export const ActivityCard = React.memo(function ActivityCard({ item }: { item: FeedItem }) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const [showComments, setShowComments] = useState(false);
  // The sheet is mounted on first use (not per card), then kept so it can animate out
  const [commentsOpened, setCommentsOpened] = useState(false);

  // Current API versions put the counts on the feed item. Only when they are
  // missing (older backend) fall back to one request per card.
  const feedHasLikes = hasLikeSummary(item);
  const feedHasCommentCount = typeof item.comment_count === 'number';

  const likesFallback = useLikes(item.activity_id, !feedHasLikes);
  const liked = feedHasLikes ? item.liked_by_me : likesFallback.liked;
  const likeCount = feedHasLikes ? item.like_count : likesFallback.count;

  const { data: fallbackComments } = useComments(item.activity_id, 1, 50, !feedHasCommentCount);
  const commentCount = feedHasCommentCount ? item.comment_count ?? 0 : fallbackComments?.length ?? 0;

  const toggleLike = useToggleLike();

  const config = ACTION_CONFIG[item.activity_type] ?? UNKNOWN_ACTION;
  const openTrail = () => router.push(`/trail/${item.trail_id}`);
  const openUser = () => router.push(`/trail/user/${item.user_id}`);
  const stars = Math.min(5, Math.max(0, parseInt(item.extra_text ?? '', 10) || 0));

  const openComments = () => {
    setCommentsOpened(true);
    setShowComments(true);
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.avatarContainer}
        onPress={openUser}
        accessibilityRole="button"
        accessibilityLabel={`View ${item.user_username}'s profile`}
      >
        <Avatar
          uri={item.user_avatar_url}
          name={item.user_full_name || item.user_username}
          size={44}
        />
      </TouchableOpacity>

      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text style={styles.headerText} numberOfLines={2}>
            <Text style={styles.username} onPress={openUser}>
              {item.user_username}
            </Text>
            {' '}{config.verb}{' '}
            <Text style={styles.trailName} onPress={openTrail}>
              {item.trail_name_en}
            </Text>
          </Text>
          <Text style={styles.timestamp}>{getRelativeTime(item.created_at)}</Text>
        </View>

        {/* Extra context based on type */}
        {item.activity_type === 'condition' && item.extra_text && (
          <View style={[styles.conditionBadge, { backgroundColor: config.color + '20' }]}>
            <Ionicons name={config.icon as any} size={14} color={config.color} />
            <Text style={[styles.conditionText, { color: config.color }]}>
              {getConditionLabel(item.extra_text)}
            </Text>
          </View>
        )}

        {item.activity_type === 'review' && stars > 0 && (
          <View style={styles.ratingRow} accessibilityLabel={`${stars} out of 5 stars`}>
            {Array.from({ length: stars }).map((_, i) => (
              <Ionicons key={i} name="star" size={14} color="#FFC107" />
            ))}
          </View>
        )}

        {/* Photos — carousel if multiple, single if one */}
        {item.activity_type === 'completion' && item.photo_urls && item.photo_urls.length > 0 ? (
          <PhotoCarousel urls={item.photo_urls} onPress={openTrail} styles={styles} Colors={Colors} />
        ) : item.photo_url ? (
          <PhotoCarousel urls={[item.photo_url]} onPress={openTrail} styles={styles} Colors={Colors} />
        ) : item.trail_cover_image_url && item.activity_type === 'completion' ? (
          <PhotoCarousel urls={[item.trail_cover_image_url]} onPress={openTrail} styles={styles} Colors={Colors} />
        ) : null}

        {/* Actions row: like + comment */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() =>
              toggleLike.mutate({
                activity_id: item.activity_id,
                activity_type: item.activity_type,
              })
            }
            disabled={toggleLike.isPending}
            hitSlop={8}
            accessibilityLabel={liked ? 'Unlike' : 'Like'}
            accessibilityRole="button"
            accessibilityState={{ selected: liked }}
          >
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={16}
              color={liked ? '#E53935' : Colors.textSecondary}
            />
            {likeCount > 0 && (
              <Text style={[styles.actionCount, liked && styles.likedCount]}>{likeCount}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={openComments}
            hitSlop={8}
            accessibilityLabel={commentCount > 0 ? `Comments, ${commentCount}` : 'Comments'}
            accessibilityRole="button"
          >
            <Ionicons name="chatbubble-outline" size={15} color={Colors.textSecondary} />
            {commentCount > 0 && (
              <Text style={styles.actionCount}>{commentCount}</Text>
            )}
          </TouchableOpacity>

          <ContentMenu
            style={styles.menuBtn}
            targetType={item.activity_type}
            targetId={item.activity_id}
            targetLabel={REPORT_LABEL[item.activity_type] ?? 'post'}
            authorId={item.user_id}
            authorName={item.user_username}
            iconSize={16}
          />
        </View>
      </View>

      {commentsOpened && (
        <CommentsSheet
          activityId={item.activity_id}
          activityType={item.activity_type}
          visible={showComments}
          onClose={() => setShowComments(false)}
        />
      )}
    </View>
  );
});

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  avatarContainer: {
    paddingTop: 2,
  },
  body: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  headerText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  username: {
    fontWeight: '700',
    color: Colors.text,
  },
  trailName: {
    fontWeight: '600',
    color: Colors.primary,
  },
  timestamp: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 2,
  },
  conditionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  conditionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 6,
  },
  photo: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    marginTop: 10,
    backgroundColor: Colors.borderLight,
  },
  carouselContainer: {
    marginTop: 10,
  },
  carouselWrapper: {
    overflow: 'hidden',
    borderRadius: 10,
    height: 180,
    backgroundColor: Colors.borderLight,
  },
  carouselPhoto: {
    height: 180,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  dot: {
    height: 5,
    width: 5,
    borderRadius: 3,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  actionCount: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  likedCount: {
    color: '#E53935',
  },
  menuBtn: {
    marginLeft: 'auto',
  },
});
