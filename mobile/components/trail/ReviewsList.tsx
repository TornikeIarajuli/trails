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

interface Props {
  reviews: Review[];
  trailId: string;
  onWriteReview: () => void;
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

function ReviewItem({ review, trailId }: { review: Review; trailId: string }) {
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

  const date = new Date(review.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <View style={styles.reviewItem}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewUser}>
          {review.profiles?.avatar_url ? (
            <Image
              source={{ uri: review.profiles.avatar_url }}
              style={styles.avatar}
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
          {isOwn && (
            <TouchableOpacity onPress={handleDelete} hitSlop={8}>
              <Ionicons name="trash-outline" size={16} color={Colors.error} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      {review.comment && (
        <Text style={styles.comment}>{review.comment}</Text>
      )}
    </View>
  );
}

export function ReviewsList({ reviews, trailId, onWriteReview }: Props) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id);
  const hasReviewed = reviews.some((r) => r.user_id === userId);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Reviews ({reviews.length})</Text>
        {isAuthenticated && !hasReviewed && (
          <TouchableOpacity onPress={onWriteReview}>
            <Text style={styles.writeButton}>Write Review</Text>
          </TouchableOpacity>
        )}
      </View>

      {reviews.length === 0 ? (
        <Text style={styles.emptyText}>
          No reviews yet. Be the first to share your experience!
        </Text>
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
  emptyText: {
    fontSize: 14,
    color: Colors.textLight,
    textAlign: 'center',
    paddingVertical: 20,
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
