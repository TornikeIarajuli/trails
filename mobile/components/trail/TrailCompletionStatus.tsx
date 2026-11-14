import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '../ui/Icon';
import { useQueryClient } from '@tanstack/react-query';
import { useColors, ColorPalette } from '../../constants/colors';
import { useAuthStore } from '../../store/authStore';
import { useDeleteCompletion, useMyCompletions } from '../../hooks/useCompletions';
import { badgesService } from '../../services/badges';
import { queryKeys } from '../../utils/queryKeys';
import { formatDate } from '../../utils/formatters';
import { selectTrailCompletionStatus } from '../../utils/pastHikes';
import { analytics } from '../../utils/analytics';
import { Badge } from '../../types/badge';
import { PastHikeResponse } from '../../types/completion';
import { BadgeUnlockModal } from '../badges/BadgeUnlockModal';
import { PastHikeModal } from './PastHikeModal';

interface Props {
  trailId: string;
  /** A hike on this trail is being recorded right now: no "mark as done" offer then. */
  hikeActiveHere: boolean;
}

const NOTICE_MS = 4000;
// Lets the year picker finish closing first: iOS cannot present a second modal while one is dismissing
const BADGE_DELAY_MS = 600;

/** The signed-in user's own completion of a trail, for the trail screen. */
export function TrailCompletionStatus({ trailId, hikeActiveHere }: Props) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: completions } = useMyCompletions({ enabled: isAuthenticated });
  const deleteCompletion = useDeleteCompletion();

  const [pickerVisible, setPickerVisible] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState<Badge[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const later = (run: () => void, ms: number) => {
    timers.current.push(setTimeout(run, ms));
  };

  // Signed out, or not loaded yet: never offer "mark as done" for a trail that may already be done
  if (!isAuthenticated || !completions) return null;

  const status = selectTrailCompletionStatus(completions, trailId);

  const handleLogged = (result: PastHikeResponse) => {
    setPickerVisible(false);
    setNotice(
      result.already_existed
        ? 'This trail was already on your profile.'
        : 'Marked as done. It shows on your profile and in My Georgia.',
    );
    later(() => setNotice(null), NOTICE_MS);

    const badgeIds = result.new_badge_ids ?? [];
    if (badgeIds.length === 0) return;
    queryClient
      .fetchQuery({
        queryKey: queryKeys.badges.all(),
        queryFn: () => badgesService.getAllBadges(),
        staleTime: 10 * 60 * 1000,
      })
      .then((all) => {
        const earned = badgeIds
          .map((id) => all.find((badge) => badge.id === id))
          .filter((badge): badge is Badge => !!badge);
        earned.forEach((badge) => analytics.badgeEarned(badge.key, badge.name_en));
        if (earned.length > 0) later(() => setUnlocked(earned), BADGE_DELAY_MS);
      })
      .catch(() => setNotice('Marked as done. You earned a new badge — see your profile.'));
  };

  const confirmRemove = (completionId: string) => {
    Alert.alert(
      'Remove past hike?',
      'This trail will no longer show as done on your profile or in My Georgia.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => deleteCompletion.mutate(completionId) },
      ],
    );
  };

  let row: React.ReactNode = null;
  if (status.kind === 'completed') {
    const label = `You completed this trail · ${formatDate(status.completion.completed_at)}`;
    row = (
      <TouchableOpacity
        style={styles.row}
        onPress={() => router.push(`/trail/completion/${status.completion.id}`)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Icon name="checkmark-circle" size={18} color={Colors.success} />
        <Text style={styles.statusText}>{label}</Text>
        <Icon name="chevron-forward" size={16} color={Colors.textLight} />
      </TouchableOpacity>
    );
  } else if (status.kind === 'past') {
    const removing = deleteCompletion.isPending;
    const when = status.year ? `You hiked this in ${status.year}` : 'You hiked this before the app';
    row = (
      <View style={styles.row}>
        <Icon name="checkmark-circle" size={18} color={Colors.success} />
        <Text style={styles.statusText}>
          {status.reviewing
            ? `${when} · your recorded hike is being reviewed`
            : status.year
              ? `${when} · before the app`
              : when}
        </Text>
        {/* Not while a recorded hike is in review: its outcome decides what becomes of this mark */}
        {!status.reviewing && (
          <TouchableOpacity
            onPress={() => confirmRemove(status.completion.id)}
            disabled={removing}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Remove past hike"
          >
            <Text style={styles.removeText}>{removing ? 'Removing…' : 'Remove'}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  } else if (status.kind === 'pending') {
    row = (
      <TouchableOpacity
        style={styles.row}
        onPress={() => router.push(`/trail/completion/${status.completion.id}`)}
        activeOpacity={0.7}
        accessibilityRole="button"
      >
        <Icon name="time-outline" size={18} color={Colors.warning} />
        <Text style={styles.statusText}>Your hike is waiting for review</Text>
        <Icon name="chevron-forward" size={16} color={Colors.textLight} />
      </TouchableOpacity>
    );
  } else if (!hikeActiveHere) {
    row = (
      <TouchableOpacity
        style={styles.row}
        onPress={() => setPickerVisible(true)}
        activeOpacity={0.7}
        accessibilityRole="button"
      >
        <Icon name="checkmark-done-outline" size={18} color={Colors.primary} />
        <Text style={styles.actionText}>Hiked it before? Mark as done</Text>
        <Icon name="chevron-forward" size={16} color={Colors.textLight} />
      </TouchableOpacity>
    );
  }

  // Nothing at all: no empty element for the screen to space out
  if (!row && !notice && !pickerVisible && unlocked.length === 0) return null;

  return (
    <View>
      {row}
      {notice && <Text style={styles.notice}>{notice}</Text>}
      <PastHikeModal
        trailId={trailId}
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onLogged={handleLogged}
      />
      <BadgeUnlockModal badges={unlocked} visible={unlocked.length > 0} onClose={() => setUnlocked([])} />
    </View>
  );
}

// Matches the action rows of the trail screen (`reportLink`)
const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  actionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  removeText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.error,
  },
  notice: {
    marginHorizontal: 20,
    marginTop: 2,
    fontSize: 13,
    color: Colors.textSecondary,
  },
});
