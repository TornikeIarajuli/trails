/** Profile > Saved posts: the posts you kept, as in the feed, or what to do when there are none. */
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn() },
  Stack: { Screen: () => null },
}));
jest.mock('../../utils/haptics', () => ({ haptics: { tap: jest.fn(), select: jest.fn() } }));
jest.mock('../../components/ui/Icon', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { Icon: ({ name }: { name: string }) => React.createElement(Text, { testID: `icon-${name}` }) };
});
jest.mock('../../services/feed', () => ({ feedService: { getSaved: jest.fn() } }));
jest.mock('../../services/users', () => ({ usersService: {} }));
jest.mock('../../hooks/useModeration', () => ({ useWithoutBlocked: (items: unknown[] | undefined) => items ?? [] }));
jest.mock('../../components/feed/ActivityCard', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { ActivityCard: ({ item }: { item: { activity_id: string } }) => React.createElement(Text, null, `post ${item.activity_id}`) };
});

import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SavedPostsScreen from '../../app/(tabs)/profile/saved-posts';
import { feedService } from '../../services/feed';

const getSaved = feedService.getSaved as jest.Mock;
let renderer: ReactTestRenderer | null = null;

function deepText(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(deepText).join('');
}
const shown = () => renderer!.root.findAllByType(Text).map(deepText);

async function render() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    renderer = TestRenderer.create(
      <QueryClientProvider client={client}>
        <SavedPostsScreen />
      </QueryClientProvider>,
    );
  });
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

it('lists the saved posts, most recently saved first', async () => {
  getSaved.mockResolvedValue({
    data: [
      { activity_id: 's2', activity_type: 'photo', user_id: 'u1' },
      { activity_id: 's1', activity_type: 'completion', user_id: 'u2' },
    ],
    pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
  });
  await render();
  expect(getSaved).toHaveBeenCalledWith(1);
  expect(shown()).toEqual(['post s2', 'post s1']);
});

it('explains how to save posts when there are none', async () => {
  getSaved.mockResolvedValue({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
  await render();
  expect(shown()).toEqual(expect.arrayContaining(['Nothing saved yet']));
});
