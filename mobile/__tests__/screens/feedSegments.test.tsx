/**
 * The Feed tab's "Following | Discover | Leaderboard" segments, and the hidden old Ranks tab
 * that now sends links on to the Feed's Leaderboard segment.
 */
let mockParams: { segment?: string } = {};

jest.mock('expo-router', () => ({
  router: { setParams: jest.fn(), navigate: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('../../utils/haptics', () => ({
  haptics: { tap: jest.fn(), select: jest.fn(), success: jest.fn(), warning: jest.fn() },
}));
jest.mock('../../hooks/useFeed', () => ({
  useFeed: () => ({
    data: { pages: [{ data: [{ activity_type: 'completion', activity_id: 'a1', user_id: 'u1' }] }] },
    isLoading: false,
    isError: false,
    error: null,
    isRefetching: false,
    refetch: jest.fn(),
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
  }),
}));
jest.mock('../../hooks/useModeration', () => ({ useWithoutBlocked: (items: unknown[]) => items }));
jest.mock('../../components/feed/ActivityCard', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    ActivityCard: ({ item }: { item: { activity_id: string } }) =>
      React.createElement(Text, null, `Activity ${item.activity_id}`),
  };
});
jest.mock('../../components/feed/EmptyFeed', () => ({ EmptyFeed: () => null }));
jest.mock('../../components/leaderboard/LeaderboardView', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    LeaderboardView: ({ showTitle }: { showTitle?: boolean }) =>
      React.createElement(Text, null, showTitle ? 'Ranked hikers, with title' : 'Ranked hikers'),
  };
});
jest.mock('../../components/feed/DiscoverList', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { DiscoverList: () => React.createElement(Text, null, 'Everyone’s hikes') };
});
jest.mock('../../components/ui/ErrorState', () => ({ ErrorState: () => null }));
jest.mock('../../components/ui/LoadingSpinner', () => ({ LoadingSpinner: () => null }));
jest.mock('../../components/feed/FeedPostSkeleton', () => ({ FeedPostSkeleton: () => null }));

import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { router } from 'expo-router';
import FeedScreen from '../../app/(tabs)/feed/index';
import LeaderboardRedirect from '../../app/(tabs)/leaderboard/index';
import { haptics } from '../../utils/haptics';

const setParams = router.setParams as jest.Mock;
const navigate = router.navigate as jest.Mock;

let renderer: ReactTestRenderer | null = null;

function textOf(node: ReactTestInstance): string {
  return ([] as unknown[])
    .concat(node.props.children)
    .filter((c) => typeof c === 'string' || typeof c === 'number')
    .join('');
}

const shown = () => renderer!.root.findAllByType(Text).map(textOf);

function render(element: React.ReactElement) {
  act(() => {
    renderer = TestRenderer.create(element);
  });
}

/** Re-renders after the screen's route params changed (a link, or the tab button). */
function rerenderWithParams(params: { segment?: string }) {
  mockParams = params;
  act(() => renderer!.update(<FeedScreen />));
}

type Key = 'activity' | 'discover' | 'leaderboard';
const tab = (key: Key) =>
  renderer!.root.findAll((n) => n.props.testID === `feed-segment-${key}` && typeof n.props.onPress === 'function')[0];
const isSelected = (key: Key) => !!tab(key).props.accessibilityState?.selected;
const choose = (key: Key) => act(() => tab(key).props.onPress());

/** Whether the segment pane holding `label` is the one that can be seen and touched. */
function paneVisible(label: string): boolean {
  const text = renderer!.root.findAllByType(Text).find((t) => textOf(t) === label);
  if (!text) throw new Error(`no text "${label}" in: ${shown().join(' | ')}`);
  let node: ReactTestInstance | null = text;
  while (node && node.props.importantForAccessibility === undefined) node = node.parent;
  if (!node) throw new Error(`"${label}" is not in a segment pane`);
  return node.props.pointerEvents === 'auto';
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

describe('Feed segments', () => {
  it('opens on Following and loads Discover and the leaderboard only when they are chosen', () => {
    render(<FeedScreen />);
    expect(shown()).toEqual(expect.arrayContaining(['Following', 'Discover', 'Leaderboard']));
    expect(isSelected('activity')).toBe(true);
    expect(isSelected('leaderboard')).toBe(false);
    expect(shown()).toContain('Activity a1');
    expect(shown()).not.toContain('Ranked hikers');
    expect(shown()).not.toContain('Everyone’s hikes');
  });

  it('switches to Discover, and keeps it when going back to Following', () => {
    render(<FeedScreen />);

    choose('discover');
    expect(isSelected('discover')).toBe(true);
    expect(setParams).toHaveBeenLastCalledWith({ segment: 'discover' });
    expect(paneVisible('Everyone’s hikes')).toBe(true);
    expect(paneVisible('Activity a1')).toBe(false);

    choose('activity');
    expect(paneVisible('Activity a1')).toBe(true);
    expect(paneVisible('Everyone’s hikes')).toBe(false);
  });

  it('opens Discover when the empty feed asks for it', () => {
    render(<FeedScreen />);
    rerenderWithParams({ segment: 'discover' });
    expect(isSelected('discover')).toBe(true);
    expect(paneVisible('Everyone’s hikes')).toBe(true);
  });

  it('switches to the leaderboard and back, keeping both mounted', () => {
    render(<FeedScreen />);

    choose('leaderboard');
    expect(isSelected('leaderboard')).toBe(true);
    expect(haptics.select).toHaveBeenCalledTimes(1);
    expect(setParams).toHaveBeenLastCalledWith({ segment: 'leaderboard' });
    expect(paneVisible('Ranked hikers')).toBe(true);
    expect(paneVisible('Activity a1')).toBe(false);

    choose('activity');
    expect(isSelected('activity')).toBe(true);
    expect(setParams).toHaveBeenLastCalledWith({ segment: 'activity' });
    expect(paneVisible('Activity a1')).toBe(true);
    // Still mounted, so its scroll position survives, but hidden and untouchable
    expect(paneVisible('Ranked hikers')).toBe(false);
  });

  it('does nothing when the chosen segment is pressed again', () => {
    render(<FeedScreen />);
    choose('activity');
    expect(haptics.select).not.toHaveBeenCalled();
    expect(setParams).not.toHaveBeenCalled();
  });

  it('opens straight on the leaderboard when a link asks for it', () => {
    mockParams = { segment: 'leaderboard' };
    render(<FeedScreen />);
    expect(isSelected('leaderboard')).toBe(true);
    expect(paneVisible('Ranked hikers')).toBe(true);
  });

  it('follows a link to the leaderboard while the Feed is already open', () => {
    render(<FeedScreen />);
    rerenderWithParams({ segment: 'leaderboard' });
    expect(isSelected('leaderboard')).toBe(true);
    expect(paneVisible('Ranked hikers')).toBe(true);
  });

  it('keeps the current segment when the params carry none (the Feed tab button)', () => {
    render(<FeedScreen />);
    choose('leaderboard');
    rerenderWithParams({ segment: 'leaderboard' }); // what setParams leaves behind
    rerenderWithParams({});
    expect(isSelected('leaderboard')).toBe(true);
  });

  it('ignores an unknown segment', () => {
    mockParams = { segment: 'ranks' };
    render(<FeedScreen />);
    expect(isSelected('activity')).toBe(true);
  });
});

describe('Old Ranks tab', () => {
  it('sends the user on to the Feed leaderboard once, showing the leaderboard meanwhile', () => {
    render(<LeaderboardRedirect />);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith({ pathname: '/(tabs)/feed', params: { segment: 'leaderboard' } });
    expect(shown()).toContain('Ranked hikers, with title');

    // Coming back to it later (tab history) does not bounce the user again
    act(() => renderer!.update(<LeaderboardRedirect />));
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('tries again on the next frame when the navigator is not ready yet', async () => {
    navigate.mockImplementationOnce(() => {
      throw new Error('Attempted to navigate before mounting the Root Layout component.');
    });
    render(<LeaderboardRedirect />);
    expect(navigate).toHaveBeenCalledTimes(1);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(navigate).toHaveBeenCalledTimes(2);
  });

  it('gives up after a few frames and keeps showing the leaderboard', async () => {
    navigate.mockImplementation(() => {
      throw new Error('not ready');
    });
    render(<LeaderboardRedirect />);
    await act(async () => {
      for (let i = 0; i < 15; i++) await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(navigate).toHaveBeenCalledTimes(10);
    expect(shown()).toContain('Ranked hikers, with title');
    navigate.mockReset();
  });
});
