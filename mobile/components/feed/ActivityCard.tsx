import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Share } from 'react-native';
import { router } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { Icon, IconName } from '../ui/Icon';
import { Avatar } from '../ui/Avatar';
import { TrailCover } from '../trail/TrailCover';
import { useColors, ColorPalette } from '../../constants/colors';
import { FeedItem } from '../../types/feed';
import { useComments } from '../../hooks/useComments';
import { useLikes, useToggleLike } from '../../hooks/useLikes';
import { usePrefetchTrail } from '../../hooks/useTrails';
import { useSettingsStore } from '../../store/settingsStore';
import { hasLikeSummary } from '../../utils/feedCache';
import { localName } from '../../utils/i18n';
import { shortTimeAgo } from '../../utils/notificationGroups';
import { haptics } from '../../utils/haptics';
import {
  commentsLinkLabel,
  completionChips,
  conditionLabel,
  feedAction,
  feedMedia,
  likesLabel,
  reviewStars,
  shareMessage,
} from '../../utils/feedPost';
import { CommentsSheet } from './CommentsSheet';
import { PostMedia } from './PostMedia';
import { ContentMenu } from '../moderation/ContentMenu';

/** Liked-heart red: the same in every theme, like Instagram's. */
export const LIKE_RED = '#E53935';
const STAR_AMBER = '#FFB800';

const REPORT_LABEL: Record<string, string> = {
  completion: 'hike',
  photo: 'photo',
  condition: 'condition report',
  review: 'review',
};

type Styles = ReturnType<typeof createStyles>;

/** One of the big buttons under a post: at least 44pt square, with a ~27pt icon. */
function ActionButton({
  icon,
  color,
  onPress,
  label,
  selected,
  styles,
  testID,
  children,
}: {
  icon?: IconName;
  color: string;
  onPress: () => void;
  label: string;
  selected?: boolean;
  styles: Styles;
  testID: string;
  children?: React.ReactNode;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected === undefined ? undefined : { selected }}
      testID={testID}
    >
      {children ?? (icon ? <Icon name={icon} size={27} color={color} /> : null)}
    </Pressable>
  );
}

/** The heart, which gives a little bounce when the post gets liked. */
function LikeHeart({ liked, color }: { liked: boolean; color: string }) {
  const scale = useSharedValue(1);
  const reducedMotion = useReducedMotion();
  const wasLiked = useRef(liked);

  useEffect(() => {
    if (liked && !wasLiked.current && !reducedMotion) {
      scale.value = withSequence(withSpring(1.3, { damping: 8, stiffness: 320 }), withSpring(1, { damping: 12 }));
    }
    wasLiked.current = liked;
  }, [liked, reducedMotion, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={style}>
      <Icon name={liked ? 'heart' : 'heart-outline'} size={27} color={liked ? LIKE_RED : color} />
    </Animated.View>
  );
}

/** How long a post screen waits before opening the comments, so it can slide in first. */
export const COMMENTS_OPEN_DELAY_MS = 350;

/**
 * A post in the feed: who did what on which trail, the photos (double-tap to like), big like,
 * comment and share buttons, the like count, details (hike stats, caption, condition, rating)
 * and the way into the comments.
 */
export const ActivityCard = React.memo(function ActivityCard({
  item,
  openCommentsOnMount = false,
}: {
  item: FeedItem;
  /** Opens the comments right away: the post screen, opened from a comment notification. */
  openCommentsOnMount?: boolean;
}) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const language = useSettingsStore((s) => s.language);
  const [showComments, setShowComments] = useState(false);
  // The sheet is mounted on first use (not per card), then kept so it can animate out
  const [commentsOpened, setCommentsOpened] = useState(false);
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    if (!openCommentsOnMount) return;
    const timer = setTimeout(() => {
      setCommentsOpened(true);
      setShowComments(true);
    }, COMMENTS_OPEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [openCommentsOnMount]);

  // Current API versions put the counts on the feed item. Only when they are
  // missing (older backend) fall back to one request per card.
  const feedHasLikes = hasLikeSummary(item);
  const feedHasCommentCount = typeof item.comment_count === 'number';

  const likesFallback = useLikes(item.activity_id, !feedHasLikes);
  const liked = (feedHasLikes ? item.liked_by_me : likesFallback.liked) ?? false;
  const likeCount = (feedHasLikes ? item.like_count : likesFallback.count) ?? 0;

  const { data: fallbackComments } = useComments(item.activity_id, 1, 50, !feedHasCommentCount);
  const commentCount = feedHasCommentCount ? item.comment_count ?? 0 : fallbackComments?.length ?? 0;

  const toggleLike = useToggleLike();

  const chips = completionChips(item);

  const prefetchTrail = usePrefetchTrail();
  const trailName = localName(item.trail_name_en, item.trail_name_ka, language);
  const openTrail = () => {
    haptics.tap();
    router.push(`/trail/${item.trail_id}`);
  };
  const warmTrail = () => prefetchTrail(item.trail_id);
  const openUser = () => router.push(`/trail/user/${item.user_id}`);

  const setLike = (next: boolean) => {
    // One request at a time per post; the server's answer settles the count
    if (toggleLike.isPending || next === liked) return;
    haptics.tap();
    toggleLike.mutate({ activity_id: item.activity_id, activity_type: item.activity_type });
  };

  // Like Instagram: a double tap only ever likes, and the heart plays either way
  const onDoubleTap = () => {
    setBurst((b) => b + 1);
    setLike(true);
  };

  const openComments = () => {
    setCommentsOpened(true);
    setShowComments(true);
  };

  const share = () => {
    haptics.tap();
    Share.share({ message: shareMessage(item) }).catch(() => {});
  };

  const media = feedMedia(item);
  const stars = item.activity_type === 'review' ? reviewStars(item.extra_text) : 0;
  const caption = item.activity_type === 'photo' ? item.extra_text?.trim() : null;
  const condition = item.activity_type === 'condition' ? conditionLabel(item.extra_text) : '';
  const likes = likesLabel(likeCount);
  const latestComment = item.latest_comment ?? null;
  // Like Instagram: a single comment is simply shown; "View all" only when there are more
  const commentsLink = latestComment && commentCount <= 1 ? null : commentsLinkLabel(commentCount);

  return (
    <View style={styles.post} testID="feed-post">
      {/* Header: who, what, where, when */}
      <View style={styles.header}>
        <Pressable
          onPress={openUser}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`${item.user_username}'s profile`}
          testID="post-avatar"
        >
          <Avatar uri={item.user_avatar_url} name={item.user_full_name || item.user_username} size={38} />
        </Pressable>
        <Text style={styles.headerText} numberOfLines={2}>
          <Text style={styles.username} onPress={openUser} suppressHighlighting>
            {item.user_username}
          </Text>
          {` ${feedAction(item.activity_type)} `}
          <Text style={styles.trailName} onPressIn={warmTrail} onPress={openTrail} suppressHighlighting>
            {trailName}
          </Text>
          <Text style={styles.time}>{`  ${shortTimeAgo(item.created_at)}`}</Text>
        </Text>
        <ContentMenu
          style={styles.menu}
          targetType={item.activity_type}
          targetId={item.activity_id}
          targetLabel={REPORT_LABEL[item.activity_type] ?? 'post'}
          authorId={item.user_id}
          authorName={item.user_username}
          iconSize={22}
        />
      </View>

      {/* Photos, or the trail as a compact card */}
      {media.kind !== 'none' ? (
        <PostMedia
          urls={media.urls}
          kind={media.kind}
          onDoubleTap={onDoubleTap}
          onSingleTap={openTrail}
          burstTrigger={burst}
          accessibilityLabel={
            media.kind === 'cover' ? `${trailName}, trail photo` : `Photo by ${item.user_username} on ${trailName}`
          }
        />
      ) : (
        <Pressable
          style={({ pressed }) => [styles.compact, pressed && styles.actionPressed]}
          onPressIn={warmTrail}
          onPress={openTrail}
          accessibilityRole="button"
          accessibilityLabel={`Open ${trailName}`}
          testID="post-trail-card"
        >
          <TrailCover uri={item.trail_cover_image_url} style={styles.compactCover} iconSize={22} />
          <View style={styles.compactText}>
            <Text style={styles.compactTitle} numberOfLines={1}>{trailName}</Text>
            <Text style={styles.compactHint}>View trail</Text>
          </View>
          <Icon name="chevron-forward" size={18} color={Colors.textLight} />
        </Pressable>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <ActionButton
          color={Colors.text}
          onPress={() => setLike(!liked)}
          label={liked ? 'Unlike' : 'Like'}
          selected={liked}
          styles={styles}
          testID="like-button"
        >
          <LikeHeart liked={liked} color={Colors.text} />
        </ActionButton>
        <ActionButton
          icon="chatbubble-outline"
          color={Colors.text}
          onPress={openComments}
          label={commentCount > 0 ? `Comments, ${commentCount}` : 'Comment'}
          styles={styles}
          testID="comment-button"
        />
        <ActionButton
          icon="send"
          color={Colors.text}
          onPress={share}
          label={`Share ${trailName}`}
          styles={styles}
          testID="share-button"
        />
      </View>

      <View style={styles.details}>
        {likes ? (
          <Text style={styles.likes} testID="like-count">{likes}</Text>
        ) : null}

        {chips.length > 0 && (
          <View style={styles.chips}>
            {chips.map((chip) => (
              <View key={chip.key} style={styles.chip}>
                <Icon name={chip.icon as IconName} size={14} color={Colors.textSecondary} />
                <Text style={styles.chipText}>{chip.label}</Text>
              </View>
            ))}
          </View>
        )}

        {stars > 0 && (
          <View style={styles.stars} accessible accessibilityLabel={`Rated ${stars} out of 5`}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Icon key={i} name={i < stars ? 'star' : 'star-outline'} size={17} color={i < stars ? STAR_AMBER : Colors.border} />
            ))}
          </View>
        )}

        {condition ? (
          <View style={styles.condition}>
            <Icon name="warning-outline" size={15} color={Colors.warning} />
            <Text style={styles.conditionText}>{condition}</Text>
          </View>
        ) : null}

        {caption ? (
          <Text style={styles.caption} numberOfLines={3}>
            <Text style={styles.username} onPress={openUser} suppressHighlighting>
              {item.user_username}
            </Text>
            {` ${caption}`}
          </Text>
        ) : null}

        {commentsLink ? (
          <Text style={styles.commentsLink} onPress={openComments} testID="comments-link">
            {commentsLink}
          </Text>
        ) : null}

        {latestComment ? (
          <Text
            style={styles.caption}
            numberOfLines={2}
            onPress={openComments}
            accessibilityRole="button"
            accessibilityHint="Opens the comments"
            testID="latest-comment"
          >
            <Text style={styles.username}>{latestComment.username}</Text>
            {` ${latestComment.comment}`}
          </Text>
        ) : null}

        {!commentsLink && !latestComment ? (
          <Text style={styles.addComment} onPress={openComments} testID="comments-link">
            Add a comment…
          </Text>
        ) : null}
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

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    post: {
      backgroundColor: Colors.surface,
      marginBottom: 8,
      paddingBottom: 12,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingLeft: 12,
      paddingRight: 4,
      paddingVertical: 10,
    },
    headerText: {
      flex: 1,
      fontSize: 14,
      lineHeight: 19,
      color: Colors.textSecondary,
    },
    username: {
      fontWeight: '700',
      color: Colors.text,
    },
    trailName: {
      fontWeight: '700',
      color: Colors.primary,
    },
    time: {
      fontSize: 13,
      color: Colors.textLight,
    },
    menu: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    compact: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginHorizontal: 12,
      padding: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.background,
    },
    compactCover: {
      width: 56,
      height: 56,
      borderRadius: 10,
      overflow: 'hidden',
    },
    compactText: {
      flex: 1,
      gap: 2,
    },
    compactTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: Colors.text,
    },
    compactHint: {
      fontSize: 13,
      color: Colors.textSecondary,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 4,
      paddingTop: 4,
    },
    action: {
      minWidth: 48,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 24,
    },
    actionPressed: {
      opacity: 0.6,
    },
    details: {
      paddingHorizontal: 14,
      gap: 6,
    },
    likes: {
      fontSize: 14,
      fontWeight: '700',
      color: Colors.text,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 14,
      backgroundColor: Colors.background,
      borderWidth: 1,
      borderColor: Colors.borderLight,
    },
    chipText: {
      fontSize: 13,
      fontWeight: '600',
      color: Colors.text,
    },
    stars: {
      flexDirection: 'row',
      gap: 2,
    },
    condition: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 14,
      backgroundColor: Colors.warning + '1F',
    },
    conditionText: {
      fontSize: 13,
      fontWeight: '600',
      color: Colors.text,
    },
    caption: {
      fontSize: 14,
      lineHeight: 20,
      color: Colors.text,
    },
    commentsLink: {
      fontSize: 14,
      color: Colors.textSecondary,
      paddingVertical: 2,
    },
    addComment: {
      fontSize: 14,
      color: Colors.textLight,
      paddingVertical: 2,
    },
  });
