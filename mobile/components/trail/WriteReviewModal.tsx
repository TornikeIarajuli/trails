import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../../constants/colors';
import { useSubmitReview } from '../../hooks/useReviews';
import { haptics } from '../../utils/haptics';
import { Sheet, SheetButton, SheetTextInput } from '../ui/Sheet';

interface Props {
  trailId: string;
  visible: boolean;
  onClose: () => void;
}

export function WriteReviewModal({ trailId, visible, onClose }: Props) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const submitMutation = useSubmitReview();

  // A fresh form each time it opens; while it slides away it keeps what was typed
  useEffect(() => {
    if (!visible) return;
    setRating(0);
    setComment('');
  }, [visible]);

  const handleSubmit = () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a star rating');
      return;
    }

    submitMutation.mutate(
      {
        trail_id: trailId,
        rating,
        comment: comment.trim() || undefined,
      },
      {
        // Errors are reported by the hook
        onSuccess: () => {
          haptics.success();
          onClose();
        },
      },
    );
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Write a Review"
      closeLabel="Close review form"
      dismissible={!submitMutation.isPending}
      footer={
        <SheetButton
          title="Submit Review"
          onPress={handleSubmit}
          disabled={rating === 0}
          loading={submitMutation.isPending}
        />
      }
    >
      <Text style={styles.label}>Your Rating</Text>
      <View style={styles.starRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => setRating(star)}
            hitSlop={4}
            accessibilityLabel={`Rate ${star} star${star !== 1 ? 's' : ''}`}
            accessibilityRole="button"
            accessibilityState={{ selected: star === rating }}
          >
            <Ionicons
              name={star <= rating ? 'star' : 'star-outline'}
              size={36}
              color="#FFB800"
            />
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Comment (optional)</Text>
      <SheetTextInput
        style={styles.input}
        placeholder="Share your experience on this trail..."
        placeholderTextColor={Colors.textLight}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        value={comment}
        onChangeText={setComment}
        maxLength={500}
        accessibilityLabel="Comment"
      />
      <Text style={styles.charCount}>{comment.length}/500</Text>
    </Sheet>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  starRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.background,
    minHeight: 100,
  },
  charCount: {
    fontSize: 12,
    color: Colors.textLight,
    textAlign: 'right',
    marginTop: 4,
  },
});
