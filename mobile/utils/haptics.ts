import * as Haptics from 'expo-haptics';

/**
 * Small, consistent tactile feedback. Every call is fire-and-forget: a device without a
 * vibration motor (or with haptics disabled) must never surface an error.
 */
export const haptics = {
  /** A light tap: toggles, chips, opening something. */
  tap: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  /** Picking a value from a set (filters, tabs, segments). */
  select: () => {
    Haptics.selectionAsync().catch(() => {});
  },
  /** Something completed: hike saved, checkpoint reached, bookmark added. */
  success: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  /** Attention before a consequential action (end hike, SOS, delete). */
  warning: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  },
};
