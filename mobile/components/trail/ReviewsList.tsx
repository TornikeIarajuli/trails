import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../../constants/colors';
import { Review } from '../../types/review';
import { useAuthStore } from '../../store/authStore';
import { useDeleteReview } from '../../hooks/useReviews';
import { ErrorState } from '../ui/ErrorState';
import { ContentMenu } from '../moderation/ContentMenu';

interface Props {
  reviews: Review[];
  trailId: string;
  onWriteReview: () => void;
  /** The reviews request failed — say so instead of claiming there are no reviews. */
  isError?: boolean;
  error?: unknown;
  onRetry?: () => void;
}

function StarRating({ rating }: { rating: number }) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= rating ? 'star' : 'star-outline'}
          size={14}
          color="#FFB800"
        />
      ))}
    </View>
  );
}

const ReviewItem = React.memo(function ReviewItem({ review, trailId }: { review: Review; trailId: string }) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const userId = useAuthStore((s) => s.user?.id);
  const deleteMutation = useDeleteReview();
  const isOwn = userId === review.user_id;

  const handleDelete = () => {
    Alert.alert('Delete Review', 'Are you sure you want to delete your review?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteMutation.mutate({ id: review.id, trail_id: trailId }),
      },
    ]);
  };

  const date = useMemo(() => new Date(review.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }), [review.created_at]);

  return (
    <View style={styles.reviewItem}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewUser}>
          {review.profiles?.avatar_url ? (
            <Image
              source={{ uri: review.profiles.avatar_url }}
              style={styles.avatar}
              cachePolicy="memory-disk"
              transition={150}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={14} color={Colors.textLight} />
            </View>
          )}
          <View>
            <Text style={styles.username}>
              {review.profiles?.username || 'Anonymous'}
            </Text>
            <Text style={styles.date}>{date}</Text>
          </View>
        </View>
        <View style={styles.reviewHeaderRight}>
          <StarRating rating={review.rating} />
          {isOwn ? (
            <TouchableOpacity onPress={handleDelete} hitSlop={8} accessibilityLabel="Delete review" accessibilityRole="button">
              <Ionicons name="trash-outline" size={16} color={Colors.error} />
            </TouchableOpacity>
          ) : (
            <ContentMenu
              targetType="review"
              targetId={review.id}
              targetLabel="review"
              authorId={review.user_id}
              authorName={review.profiles?.username}
              iconSize={16}
            />
          )}
        </View>
      </View>
      {review.comment && (
        <Text style={styles.comment}>{review.comment}</Text>
      )}
    </View>
  );
});

export function ReviewsList({ reviews, trailId, onWriteReview, isError = false, error, onRetry }: Props) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id);
  const hasReviewed = reviews.some((r) => r.user_id === userId);
  const failed = isError && reviews.length === 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Reviews{failed ? '' : ` (${reviews.length})`}</Text>
        {isAuthenticated && !hasReviewed && !failed && (
          <TouchableOpacity onPress={onWriteReview} accessibilityRole="button">
            <Text style={styles.writeButton}>Write Review</Text>
          </TouchableOpacity>
        )}
      </View>

      {failed ? (
        <ErrorState compact error={error} message="Couldn't load the reviews." onRetry={onRetry} />
      ) : reviews.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="chatbox-ellipses-outline" size={28} color={Colors.textLight} />
          <Text style={styles.emptyText}>No reviews yet</Text>
          <Text style={styles.emptyHint}>
            {isAuthenticated
              ? 'Hiked this trail? Be the first to tell others what it was like.'
              : 'Log in to write the first one.'}
          </Text>
        </View>
      ) : (
        reviews.map((review) => (
          <ReviewItem key={review.id} review={review} trailId={trailId} />
        ))
      )}
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  writeButton: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  empty: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 20,
    paddingHorizontal: 24,
    backgroundColor: Colors.surface,
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  emptyHint: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textLight,
    textAlign: 'center',
  },
  reviewItem: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  reviewUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  date: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 1,
  },
  reviewHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stars: {
    flexDirection: 'row',
    gap: 1,
  },
  comment: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
    marginTop: 10,
  },
});
