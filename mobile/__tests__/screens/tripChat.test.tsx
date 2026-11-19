/**
 * A trip's chat: the messages (yours on the right), sending (shown at once, then confirmed),
 * deleting your own, and the screen for someone who has not joined.
 */
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 't1', eventId: 'e1' }),
  Stack: { Screen: () => null },
  router: { back: jest.fn(), push: jest.fn() },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../../utils/haptics', () => ({ haptics: { tap: jest.fn(), select: jest.fn(), success: jest.fn() } }));
jest.mock('../../components/ui/Icon', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { Icon: ({ name }: { name: string }) => React.createElement(Text, { testID: `icon-${name}` }) };
});
jest.mock('../../components/ui/Avatar', () => ({ Avatar: () => null }));
jest.mock('../../components/moderation/ContentMenu', () => ({ ContentMenu: () => null }));
jest.mock('../../hooks/useModeration', () => ({ useWithoutBlocked: (items: unknown[] | undefined) => items ?? [] }));
jest.mock('../../services/api', () => ({ __esModule: true, default: {} }));
jest.mock('@react-native-community/netinfo', () => require('@react-native-community/netinfo/jest/netinfo-mock'));
jest.mock('../../services/events', () => ({
  eventsService: {
    getEvent: jest.fn(),
    getMessages: jest.fn(),
    sendMessage: jest.fn(),
    deleteMessage: jest.fn(),
  },
}));

import React from 'react';
import { Alert, Text } from 'react-native';
import TestRenderer, { act, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TripChatScreen from '../../app/trail/[id]/event/[eventId]/chat';
import { eventsService } from '../../services/events';
import { useAuthStore } from '../../store/authStore';

const svc = eventsService as unknown as Record<string, jest.Mock>;
let renderer: ReactTestRenderer | null = null;

function deepText(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(deepText).join('');
}
const shown = () => renderer!.root.findAllByType(Text).map(deepText);
const byTestId = (id: string) => renderer!.root.findAll((n) => n.props.testID === id && typeof n.type !== 'string');

async function flush() {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

const msg = (id: string, userId: string, username: string, body: string, minutesAgo: number) => ({
  id,
  event_id: 'e1',
  user_id: userId,
  body,
  created_at: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
  profiles: { username, avatar_url: null },
});

async function render() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  await act(async () => {
    renderer = TestRenderer.create(
      <QueryClientProvider client={client}>
        <TripChatScreen />
      </QueryClientProvider>,
    );
  });
  await flush();
}

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ isAuthenticated: true, user: { id: 'me', email: 'x', user_metadata: { username: 'toko' } } } as never);
  svc.getEvent.mockResolvedValue({ id: 'e1', title: 'Kazbegi weekend', organizer_id: 'org', trail_id: 't1', participants: [] });
  // Newest first, as the API sends them
  svc.getMessages.mockResolvedValue([msg('m2', 'me', 'toko', 'I can drive', 2), msg('m1', 'gio', 'gio', 'Who has a car?', 5)]);
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  useAuthStore.setState({ isAuthenticated: false, user: null } as never);
});

it('shows the messages, with names on the others', async () => {
  await render();
  expect(svc.getMessages).toHaveBeenCalledWith('e1');
  expect(shown()).toEqual(expect.arrayContaining(['gio', 'Who has a car?', 'I can drive']));
  expect(byTestId('chat-message-mine')).toHaveLength(1);
  expect(byTestId('chat-message')).toHaveLength(1);
});

it('shows a message at once while it sends, then the server copy', async () => {
  let resolve!: (v: unknown) => void;
  svc.sendMessage.mockImplementation(() => new Promise((r) => (resolve = r)));
  await render();

  await act(async () => {
    renderer!.root.findAll((n) => n.props.testID === 'chat-input' && n.props.onChangeText)[0].props.onChangeText('  Meet at 7?  ');
  });
  await act(async () => {
    renderer!.root.findAll((n) => n.props.testID === 'chat-send' && n.props.onPress)[0].props.onPress();
  });
  expect(svc.sendMessage).toHaveBeenCalledWith('e1', 'Meet at 7?');
  expect(shown()).toEqual(expect.arrayContaining(['Meet at 7?', 'Sending…']));

  await act(async () => {
    resolve(msg('m3', 'me', 'toko', 'Meet at 7?', 0));
  });
  await flush();
  expect(shown()).not.toContain('Sending…');
  expect(shown()).toContain('Meet at 7?');
});

it('deletes your own message after asking', async () => {
  svc.deleteMessage.mockResolvedValue(undefined);
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await render();

  const mine = renderer!.root.findAll((n) => typeof n.props.onLongPress === 'function')[0];
  await act(async () => mine.props.onLongPress());
  const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
  await act(async () => buttons.find((b) => b.text === 'Delete')!.onPress!());
  await flush();

  expect(svc.deleteMessage).toHaveBeenCalledWith('e1', 'm2');
  expect(shown()).not.toContain('I can drive');
  alert.mockRestore();
});

it('tells someone who has not joined to join first', async () => {
  svc.getMessages.mockRejectedValue({ response: { status: 403 } });
  await render();
  expect(shown()).toContain('Join the trip to see its chat');
});
