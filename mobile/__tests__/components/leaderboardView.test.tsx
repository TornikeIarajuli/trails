/** The leaderboard: XP this week / month / all time, your own place, and how XP works. */
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn() } }));
jest.mock('../../utils/haptics', () => ({ haptics: { tap: jest.fn(), select: jest.fn() } }));
jest.mock('../../components/ui/Icon', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { Icon: ({ name }: { name: string }) => React.createElement(Text, { testID: `icon-${name}` }) };
});
jest.mock('../../components/ui/Avatar', () => ({ Avatar: () => null }));
jest.mock('../../hooks/useModeration', () => ({ useWithoutBlocked: (items: unknown[] | undefined) => items ?? [] }));
jest.mock('../../services/users', () => ({ usersService: { getXpLeaderboard: jest.fn(), getMyXp: jest.fn() } }));
// The sign-in store loads the API client (and its network watcher); nothing here talks to it
jest.mock('../../services/api', () => ({ __esModule: true, default: {} }));
jest.mock('@react-native-community/netinfo', () => require('@react-native-community/netinfo/jest/netinfo-mock'));

import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LeaderboardView } from '../../components/leaderboard/LeaderboardView';
import { usersService } from '../../services/users';
import { useAuthStore } from '../../store/authStore';

const getBoard = usersService.getXpLeaderboard as jest.Mock;
const getMine = usersService.getMyXp as jest.Mock;
let renderer: ReactTestRenderer | null = null;

function deepText(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(deepText).join('');
}
const shown = () => renderer!.root.findAllByType(Text).map(deepText);
const pressable = (id: string) => renderer!.root.findAll((n) => n.props.testID === id && typeof n.props.onPress === 'function')[0];

async function flush() {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

const row = (rank: number, id: string, username: string, xp: number) => ({ rank, id, username, full_name: null, avatar_url: null, xp });

async function render() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    renderer = TestRenderer.create(
      <QueryClientProvider client={client}>
        <LeaderboardView />
      </QueryClientProvider>,
    );
  });
  await flush();
}

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ isAuthenticated: true, user: { id: 'me', email: 'x', user_metadata: { username: 'toko' } } } as never);
  getBoard.mockImplementation(async (period: string) =>
    period === 'week' ? [row(1, 'u1', 'nino', 640), row(2, 'u2', 'gio', 300)] : [row(1, 'u3', 'ana', 5200)],
  );
  getMine.mockResolvedValue({ total_xp: 1240, week_xp: 120, month_xp: 300, ranks: { all: 9, week: 7, month: 4 } });
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  useAuthStore.setState({ isAuthenticated: false, user: null } as never);
});

it("opens on this week's XP, with your place at the bottom when you are not in the list", async () => {
  await render();
  expect(getBoard).toHaveBeenCalledWith('week', 50);
  expect(shown()).toEqual(expect.arrayContaining(['nino', '640', 'gio', '300']));
  expect(pressable('leaderboard-me').props.accessibilityLabel).toBe('7. You, 120 XP');
});

it('shows the all-time board with levels', async () => {
  await render();
  await act(async () => {
    pressable('leaderboard-period-all').props.onPress();
  });
  await flush();
  expect(getBoard).toHaveBeenCalledWith('all', 50);
  expect(shown()).toEqual(expect.arrayContaining(['ana', 'Peak bagger', '5,200']));
  // Your total and level, as level 4 at 1,240 XP
  expect(shown()).toEqual(expect.arrayContaining(['toko (you)', 'Trekker', '1,240']));
});

it('says so when you have no XP in the period yet', async () => {
  getMine.mockResolvedValue({ total_xp: 0, week_xp: 0, month_xp: 0, ranks: { all: null, week: null, month: null } });
  await render();
  expect(shown()).toContain('You have no XP this week yet. A hike puts you on the board.');
});

it('explains how XP is earned', async () => {
  await render();
  await act(async () => {
    renderer!.root.findAll((n) => n.props.testID === 'xp-rules-link' && n.props.onPress)[0].props.onPress();
  });
  expect(shown()).toEqual(expect.arrayContaining(['How XP works', 'Hike recorded in the app', '100 + 10 per km + 1 per 10 m climbed']));
});
