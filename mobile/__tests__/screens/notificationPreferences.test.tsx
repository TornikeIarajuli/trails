/**
 * Notification settings: likes and comments can be turned off like the other kinds, and a
 * setting an older server does not send yet counts as on.
 */
jest.mock('expo-router', () => ({ Stack: { Screen: () => null } }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../../components/ui/Icon', () => ({ Icon: () => null }));
const mockMutate = jest.fn();
let mockPrefs: Record<string, boolean> | undefined;
jest.mock('../../hooks/useNotifications', () => ({
  useNotificationPrefs: () => ({ data: mockPrefs, isLoading: false }),
  useUpdateNotificationPrefs: () => ({ mutate: mockMutate, isPending: false }),
}));

import React from 'react';
import { Switch, Text } from 'react-native';
import TestRenderer, { act, ReactTestRenderer } from 'react-test-renderer';
import NotificationPreferencesScreen from '../../app/(tabs)/profile/notification-preferences';

const base = { new_follower: true, badge_earned: true, completion_approved: true, event_invite: true, trail_condition: true };

function render() {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<NotificationPreferencesScreen />);
  });
  return renderer;
}

/** The switch in the row with this label. */
function switchFor(renderer: ReactTestRenderer, label: string) {
  const rows = renderer.root.findAll((n) => n.findAllByType(Text).some((t) => t.props.children === label) && n.findAllByType(Switch).length === 1);
  return rows[rows.length - 1].findAllByType(Switch)[0];
}

beforeEach(() => {
  mockMutate.mockClear();
});

it('lists likes and comments next to the other kinds', () => {
  mockPrefs = { ...base, new_like: true, new_comment: true };
  const renderer = render();
  const labels = renderer.root.findAllByType(Text).map((t) => t.props.children);
  expect(labels).toEqual(expect.arrayContaining(['New Followers', 'Likes', 'Comments', 'Badge Earned', 'Group Hikes']));
});

it('turns like notifications off', () => {
  mockPrefs = { ...base, new_like: true, new_comment: true };
  const renderer = render();
  act(() => switchFor(renderer, 'Likes').props.onValueChange(false));
  expect(mockMutate).toHaveBeenCalledWith({ new_like: false });
});

it('treats a setting an older server does not send as on', () => {
  mockPrefs = { ...base };
  const renderer = render();
  expect(switchFor(renderer, 'Comments').props.value).toBe(true);
  act(() => switchFor(renderer, 'Comments').props.onValueChange(false));
  expect(mockMutate).toHaveBeenCalledWith({ new_comment: false });
});
