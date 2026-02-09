import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useSubmitReview } from '../../hooks/useReviews';

interface Props {
  trailId: string;
  visible: boolean;
  onClose: () => void;
}

export function WriteReviewModal({ trailId, visible, onClose }: Props) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const submitMutation = useSubmitReview();

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
        onSuccess: () => {
          setRating(0);
          setComment('');
          onClose();
        },
        onError: (error: any) => {
          const raw = error?.response?.data?.message;
          const message = Array.isArray(raw) ? raw.join(', ') : raw || 'Failed to submit review';
          Alert.alert('Error', message);
        },
      },
    );
  };

  const handleClose = () => {
    setRating(0);
    setComment('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>Write a Review</Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Your Rating</Text>
          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => setRating(star)}
                hitSlop={4}
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
          <TextInput
            style={styles.input}
            placeholder="Share your experience on this trail..."
            placeholderTextColor={Colors.textLight}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={comment}
            onChangeText={setComment}
            maxLength={500}
          />
          <Text style={styles.charCount}>{comment.length}/500</Text>

          <TouchableOpacity
            style={[
              styles.submitButton,
              (rating === 0 || submitMutation.isPending) && styles.submitDisabled,
            ]}
            onPress={handleSubmit}
            disabled={rating === 0 || submitMutation.isPending}
          >
            <Text style={styles.submitText}>
              {submitMutation.isPending ? 'Submitting...' : 'Submit Review'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 34,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
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
    minHeight: 100,
  },
  charCount: {
    fontSize: 12,
    color: Colors.textLight,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
});
