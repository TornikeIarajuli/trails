import React, { useState } from 'react';
import { TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../constants/colors';
import { useAuthStore } from '../../store/authStore';
import { ActionSheet, ActionSheetOption } from '../ui/ActionSheet';
import { haptics } from '../../utils/haptics';
import { REPORT_REASONS, ReportReason, ReportTargetType } from '../../services/moderation';
import {
  moderationErrorMessage,
  useBlockUser,
  useBlockedUserIds,
  useReportContent,
  useUnblockUser,
} from '../../hooks/useModeration';

type Step =
  | { name: 'closed' }
  | { name: 'menu' }
  | { name: 'reasons' }
  | { name: 'confirmBlock' }
  | { name: 'working' }
  | { name: 'result'; title: string; message: string };

interface ContentMenuProps {
  targetType: ReportTargetType;
  targetId: string;
  /** What is being reported, as worded in the menu: "photo", "comment", "user"… */
  targetLabel: string;
  /** The author of the content; enables "Block user". */
  authorId?: string | null;
  authorName?: string | null;
  iconSize?: number;
  iconColor?: string;
  style?: StyleProp<ViewStyle>;
  onBlocked?: () => void;
}

/**
 * "⋯" button with Report / Block for a piece of user-generated content.
 * Renders nothing for signed-out users and for the user's own content.
 * The whole flow, including its outcome, stays inside one sheet: opening an
 * alert while a modal is still closing is unreliable on iOS.
 */
export function ContentMenu({
  targetType,
  targetId,
  targetLabel,
  authorId,
  authorName,
  iconSize = 18,
  iconColor,
  style,
  onBlocked,
}: ContentMenuProps) {
  const Colors = useColors();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const blockedIds = useBlockedUserIds();
  const report = useReportContent();
  const blockUser = useBlockUser();
  const unblockUser = useUnblockUser();
  const [step, setStep] = useState<Step>({ name: 'closed' });

  if (!isAuthenticated || !targetId) return null;
  if (authorId && authorId === currentUserId) return null;

  const who = authorName ? `@${authorName}` : 'this user';
  const canBlock = !!authorId;
  const isBlocked = !!authorId && blockedIds.has(authorId);

  const fail = (err: unknown) =>
    setStep({ name: 'result', title: "Couldn't do that", message: moderationErrorMessage(err) });

  const submitReport = async (reason: ReportReason) => {
    setStep({ name: 'working' });
    try {
      await report.mutateAsync({ target_type: targetType, target_id: targetId, reason });
      haptics.success();
      setStep({
        name: 'result',
        title: 'Report sent',
        message: 'Thank you. We will review it and take action if it breaks the rules.',
      });
    } catch (err) {
      fail(err);
    }
  };

  const submitBlock = async () => {
    if (!authorId) return;
    setStep({ name: 'working' });
    try {
      await blockUser.mutateAsync(authorId);
      setStep({
        name: 'result',
        title: `You blocked ${who}`,
        message: 'You can unblock them any time in Settings → Blocked users.',
      });
      onBlocked?.();
    } catch (err) {
      fail(err);
    }
  };

  const submitUnblock = async () => {
    if (!authorId) return;
    setStep({ name: 'working' });
    try {
      await unblockUser.mutateAsync(authorId);
      setStep({ name: 'result', title: `You unblocked ${who}`, message: 'Their content is visible to you again.' });
    } catch (err) {
      fail(err);
    }
  };

  let title: string | undefined;
  let message: string | undefined;
  let options: ActionSheetOption[] = [];

  if (step.name === 'menu') {
    options = [{ key: 'report', label: `Report this ${targetLabel}`, icon: 'flag-outline' }];
    if (canBlock) {
      options.push(
        isBlocked
          ? { key: 'unblock', label: `Unblock ${who}`, icon: 'person-add-outline' }
          : { key: 'block', label: `Block ${who}`, icon: 'ban-outline', destructive: true },
      );
    }
  } else if (step.name === 'reasons') {
    title = `Report this ${targetLabel}`;
    message = 'What is wrong with it?';
    options = REPORT_REASONS.map((r) => ({ key: r.key, label: r.label }));
  } else if (step.name === 'confirmBlock') {
    title = `Block ${who}?`;
    message =
      'You will no longer see their photos, comments, reviews or activity, and you will stop following each other.';
    options = [{ key: 'confirmBlock', label: 'Block', icon: 'ban-outline', destructive: true }];
  } else if (step.name === 'result') {
    title = step.title;
    message = step.message;
  }

  const onSelect = (key: string) => {
    if (key === 'report') setStep({ name: 'reasons' });
    else if (key === 'block') setStep({ name: 'confirmBlock' });
    else if (key === 'confirmBlock') submitBlock();
    else if (key === 'unblock') submitUnblock();
    else if (REPORT_REASONS.some((r) => r.key === key)) submitReport(key as ReportReason);
  };

  return (
    <>
      <TouchableOpacity
        style={style}
        onPress={() => setStep({ name: 'menu' })}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel={`More options for this ${targetLabel}`}
      >
        <Ionicons name="ellipsis-horizontal" size={iconSize} color={iconColor ?? Colors.textSecondary} />
      </TouchableOpacity>

      {step.name !== 'closed' && (
        <ActionSheet
          visible
          title={title}
          message={message}
          options={options}
          loading={step.name === 'working'}
          cancelLabel={step.name === 'result' ? 'Close' : 'Cancel'}
          onSelect={onSelect}
          onClose={() => {
            if (step.name !== 'working') setStep({ name: 'closed' });
          }}
        />
      )}
    </>
  );
}
