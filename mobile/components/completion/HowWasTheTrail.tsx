import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Icon } from '../ui/Icon';
import { useColors, ColorPalette } from '../../constants/colors';
import { useSubmitReview, useTrailReviews, useUpdateReview } from '../../hooks/useReviews';
import { useReportCondition } from '../../hooks/useCommunity';
import { communityService } from '../../services/community';
import { useAuthStore } from '../../store/authStore';
import { conditionLabel } from '../../utils/feedPost';
import { queryKeys } from '../../utils/queryKeys';
import { haptics } from '../../utils/haptics';
import type { ConditionType, SeverityLevel } from '../../types/community';

const STAR_AMBER = '#FFB800';

/** The conditions offered after a hike, and how serious each is for the trail page. */
export const AFTER_HIKE_CONDITIONS: { type: ConditionType; severity: SeverityLevel }[] = [
  { type: 'trail_clear', severity: 'info' },
  { type: 'muddy', severity: 'warning' },
  { type: 'snow', severity: 'warning' },
  { type: 'fallen_tree', severity: 'warning' },
  { type: 'overgrown', severity: 'warning' },
  { type: 'flooded', severity: 'warning' },
  { type: 'damaged', severity: 'warning' },
  { type: 'closed', severity: 'danger' },
];

/**
 * Right after a hike: "How was the trail?" One tap on the stars rates it (tap again to
 * change), one tap on a condition reports it for the next hikers (with Undo).
 */
export function HowWasTheTrail({ trailId }: { trailId: string }) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: reviews } = useTrailReviews(trailId);
  const mine = reviews?.find((review) => review.user_id === userId);

  const submit = useSubmitReview();
  const update = useUpdateReview();
  const report = useReportCondition();
  const undo = useMutation({
    mutationFn: (id: string) => communityService.deactivateCondition(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.conditions.trail(trailId) }),
  });

  // The review this card rates: one written before, or the one its first tap created
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [rated, setRated] = useState(false);
  const [reported, setReported] = useState<{ id: string; type: ConditionType } | null>(null);

  useEffect(() => {
    if (mine && !reviewId) {
      setReviewId(mine.id);
      if (!rating) setRating(mine.rating);
    }
  }, [mine, reviewId, rating]);

  const rate = (stars: number) => {
    haptics.select();
    setRating(stars);
    const done = () => setRated(true);
    if (reviewId) {
      update.mutate({ id: reviewId, trail_id: trailId, rating: stars, comment: mine?.comment ?? undefined }, { onSuccess: done });
    } else {
      submit.mutate(
        { trail_id: trailId, rating: stars },
        {
          onSuccess: (review) => {
            setReviewId(review.id);
            done();
          },
        },
      );
    }
  };

  const reportCondition = (type: ConditionType, severity: SeverityLevel) => {
    if (report.isPending) return;
    haptics.tap();
    report.mutate({ trail_id: trailId, condition_type: type, severity }, { onSuccess: (condition) => setReported({ id: condition.id, type }) });
  };

  const undoReport = () => {
    if (!reported) return;
    haptics.tap();
    const { id } = reported;
    setReported(null);
    undo.mutate(id);
  };

  const busy = submit.isPending || update.isPending;

  return (
    <View style={styles.card} testID="how-was-the-trail">
      <Text style={styles.title}>How was the trail?</Text>

      <View style={styles.stars} accessibilityRole="adjustable" accessibilityLabel={`Rating, ${rating} of 5`}>
        {[1, 2, 3, 4, 5].map((stars) => (
          <Pressable
            key={stars}
            onPress={() => rate(stars)}
            disabled={busy}
            hitSlop={4}
            style={styles.star}
            accessibilityRole="button"
            accessibilityLabel={`${stars} ${stars === 1 ? 'star' : 'stars'}`}
            testID={`rate-${stars}`}
          >
            <Icon name={stars <= rating ? 'star' : 'star-outline'} size={34} color={stars <= rating ? STAR_AMBER : Colors.border} />
          </Pressable>
        ))}
      </View>
      {rated ? (
        <Text style={styles.thanks} testID="rated">
          Thanks! Your rating helps other hikers choose.
        </Text>
      ) : null}

      <Text style={styles.subtitle}>What was it like on the ground?</Text>
      {reported ? (
        <View style={styles.reportedRow} testID="condition-reported">
          <Icon name="checkmark-circle" size={18} color={Colors.success} />
          <Text style={styles.reportedText}>{conditionLabel(reported.type)}: reported for the next hikers</Text>
          <Pressable onPress={undoReport} hitSlop={8} accessibilityRole="button" testID="condition-undo">
            <Text style={styles.undo}>Undo</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.chips}>
          {AFTER_HIKE_CONDITIONS.map(({ type, severity }) => (
            <Pressable
              key={type}
              style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
              onPress={() => reportCondition(type, severity)}
              disabled={report.isPending}
              accessibilityRole="button"
              testID={`condition-${type}`}
            >
              <Text style={styles.chipText}>{conditionLabel(type)}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    card: {
      marginTop: 16,
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
      gap: 10,
    },
    title: {
      fontSize: 17,
      fontWeight: '800',
      color: Colors.text,
    },
    stars: {
      flexDirection: 'row',
      gap: 4,
    },
    star: {
      minWidth: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    thanks: {
      fontSize: 13,
      color: Colors.success,
    },
    subtitle: {
      marginTop: 4,
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
      minHeight: 38,
      justifyContent: 'center',
      paddingHorizontal: 14,
      borderRadius: 19,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.background,
    },
    pressed: {
      opacity: 0.7,
    },
    chipText: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.text,
    },
    reportedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    reportedText: {
      flex: 1,
      fontSize: 14,
      color: Colors.text,
    },
    undo: {
      fontSize: 14,
      fontWeight: '700',
      color: Colors.primary,
    },
  });
