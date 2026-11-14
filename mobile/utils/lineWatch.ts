/**
 * Watches a running hike for the occupation line and the state border. Every GPS fix (from the
 * hike screen, or from the background task while the phone is in a pocket) goes through
 * `processFix`; the banner on the hike screen reads the current warning from
 * `useLineWarning`, and a new, closer warning also buzzes the phone, or comes as a notification
 * when the hike screen is not in front. Everything happens on the phone, offline.
 */
import { AppState } from 'react-native';
import { create } from 'zustand';
import { IDLE_WATCH, LineWarning, WatchState, checkLines, describeLevel, watchStep } from './borderLines';

let watch: WatchState = IDLE_WATCH;
let watchedHike: string | null = null;
let screenShowing = false;

interface LineWarningState {
  /** What the banner shows now; null when no line is near. */
  warning: LineWarning | null;
}

export const useLineWarning = create<LineWarningState>(() => ({ warning: null }));

/** The hike screen is in front (it shows the banner and buzzes) or not (a notification is sent). */
export function setLineWarningScreen(showing: boolean) {
  screenShowing = showing;
}

/** Forgets everything: a new hike starts with no warning given yet. */
export function resetLineWatch() {
  watch = IDLE_WATCH;
  watchedHike = null;
  useLineWarning.setState({ warning: null });
}

let Notifications: typeof import('expo-notifications') | null | undefined;
let Haptics: typeof import('expo-haptics') | null | undefined;

function notifications() {
  if (Notifications === undefined) {
    try {
      Notifications = require('expo-notifications');
    } catch {
      Notifications = null;
    }
  }
  return Notifications;
}

function haptics() {
  if (Haptics === undefined) {
    try {
      Haptics = require('expo-haptics');
    } catch {
      Haptics = null;
    }
  }
  return Haptics;
}

async function deliver(warning: LineWarning, trailId: string | null) {
  try {
    if (screenShowing && AppState.currentState === 'active') {
      await haptics()?.notificationAsync(haptics()!.NotificationFeedbackType.Warning);
      return;
    }
    await notifications()?.scheduleNotificationAsync({
      content: {
        title: warning.title,
        body: warning.body,
        sound: 'default',
        data: { type: 'line_warning', level: warning.level, ...(trailId ? { trailId } : {}) },
      },
      // Right away, on the channel that is allowed to pop up
      trigger: { channelId: 'default' },
    });
  } catch {
    // A warning that cannot be shown must never break the recording
  }
}

/**
 * One GPS fix of a running hike. `hikeKey` identifies the hike (a new key starts over);
 * returns the warning when this fix raised one.
 */
export function processFix(
  lat: number,
  lng: number,
  options: { hikeKey: string; trailId?: string | null; language?: string; now?: number },
): LineWarning | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (watchedHike !== options.hikeKey) {
    watch = IDLE_WATCH;
    watchedHike = options.hikeKey;
  }

  const check = checkLines(lat, lng);
  const step = watchStep(watch, check, options.now ?? Date.now());
  watch = step.state;

  const warning = describeLevel(step.state.level, check, options.language);
  useLineWarning.setState({ warning });

  if (step.alert && warning) {
    void deliver(warning, options.trailId ?? null);
    return warning;
  }
  return null;
}
