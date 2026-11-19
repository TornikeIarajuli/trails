/**
 * Writing a post: text, photos (uploaded when posting, once each), a trail and a place;
 * editing your own post; and the question before leaving with something written.
 */
const mockListeners: Record<string, (e: unknown) => void> = {};
const mockParams: Record<string, string> = {};
jest.mock('expo-router', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    router: { back: jest.fn(), push: jest.fn() },
    useLocalSearchParams: () => mockParams,
    useNavigation: () => ({
      addListener: (name: string, fn: (e: unknown) => void) => {
        mockListeners[name] = fn;
        return () => delete mockListeners[name];
      },
      dispatch: jest.fn(),
    }),
    // Draws the header's right button so the test can press "Post"
    Stack: { Screen: ({ options }: { options?: { headerRight?: () => unknown } }) => React.createElement(View, null, options?.headerRight?.() ?? null) },
  };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../../utils/haptics', () => ({ haptics: { tap: jest.fn(), select: jest.fn(), success: jest.fn() } }));
jest.mock('../../components/ui/Icon', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { Icon: ({ name }: { name: string }) => React.createElement(Text, { testID: `icon-${name}` }) };
});
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestCameraPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}));
// The real services load the API client (and its network watcher); nothing here talks to it
jest.mock('../../services/api', () => ({ __esModule: true, default: {} }));
jest.mock('../../services/posts', () => ({
  ...jest.requireActual('../../services/posts'),
  postsService: { create: jest.fn(), update: jest.fn(), remove: jest.fn() },
}));
jest.mock('../../services/media', () => ({
  ...jest.requireActual('../../services/media'),
  mediaService: { uploadPostPhoto: jest.fn() },
}));
jest.mock('../../services/feed', () => ({ feedService: { getPost: jest.fn() } }));
jest.mock('../../services/users', () => ({ usersService: {} }));
// The trail picker searches the trail list; not what this test is about
jest.mock('../../components/trail/TrailPickerSheet', () => ({ TrailPickerSheet: () => null }));

import React from 'react';
import { Alert, Text, TextInput } from 'react-native';
import TestRenderer, { act, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import ComposeScreen from '../../app/trail/compose';
import { postsService } from '../../services/posts';
import { mediaService } from '../../services/media';
import { queryKeys } from '../../utils/queryKeys';
import { SHEET_EXIT_MS } from '../../components/ui/Sheet';
import type { FeedItem } from '../../types/feed';

const create = postsService.create as jest.Mock;
const update = postsService.update as jest.Mock;
const upload = mediaService.uploadPostPhoto as jest.Mock;
const pickLibrary = ImagePicker.launchImageLibraryAsync as jest.Mock;

let renderer: ReactTestRenderer | null = null;
let client: QueryClient;

function deepText(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(deepText).join('');
}
const shown = () => renderer!.root.findAllByType(Text).map(deepText);
const input = (id: string) => renderer!.root.findAll((n) => n.props.testID === id && n.type === TextInput)[0];
const pressable = (id: string) => renderer!.root.findAll((n) => n.props.testID === id && typeof n.props.onPress === 'function')[0];
const byLabel = (label: string) =>
  renderer!.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];

async function flush() {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await new Promise((resolve) => setImmediate(resolve));
    });
  }
}

async function render() {
  await act(async () => {
    renderer = TestRenderer.create(
      <QueryClientProvider client={client}>
        <ComposeScreen />
      </QueryClientProvider>,
    );
  });
  await flush();
}

async function type(id: string, text: string) {
  await act(async () => {
    input(id).props.onChangeText(text);
  });
}

async function submit() {
  await act(async () => {
    pressable('compose-submit').props.onPress();
  });
  await flush();
}

const feedPost = (extra: Partial<FeedItem> = {}): FeedItem => ({
  activity_id: 'p1',
  activity_type: 'post',
  user_id: 'u1',
  trail_id: 't1',
  created_at: '2026-11-19T08:00:00Z',
  extra_text: 'Old text',
  photo_url: 'https://cdn/a.jpg',
  photo_urls: ['https://cdn/a.jpg'],
  user_username: 'nino',
  user_full_name: null,
  user_avatar_url: null,
  trail_name_en: 'Juta to Roshka',
  trail_name_ka: null,
  trail_cover_image_url: null,
  place_name: 'Juta',
  ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(mockParams)) delete mockParams[key];
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  create.mockResolvedValue(feedPost({ activity_id: 'new' }));
  update.mockResolvedValue(feedPost({ extra_text: 'New text' }));
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  jest.useRealTimers();
});

it('posts some text and goes back', async () => {
  await render();
  await type('compose-body', '  Snow above 2,500 m  ');
  await type('compose-place', 'Ushguli');
  await submit();
  expect(create).toHaveBeenCalledWith({ body: 'Snow above 2,500 m', trail_id: null, place_name: 'Ushguli', photo_urls: [] });
  expect(router.back).toHaveBeenCalled();
});

it('asks for some text or a photo before posting nothing', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await render();
  await submit();
  expect(alert).toHaveBeenCalledWith('Write something or add a photo');
  expect(create).not.toHaveBeenCalled();
  alert.mockRestore();
});

it('uploads the chosen photos when posting, in order, and posts their addresses', async () => {
  pickLibrary.mockResolvedValue({
    canceled: false,
    assets: [
      { uri: 'file:///1.jpg', fileName: '1.jpg', mimeType: 'image/jpeg', fileSize: 1000 },
      { uri: 'file:///2.png', fileName: '2.png', mimeType: 'image/png', fileSize: 1000 },
    ],
  });
  upload.mockImplementation(async (uri: string) => ({ url: `https://cdn/${uri.slice(8)}` }));
  jest.useFakeTimers({ doNotFake: ['setImmediate'] });
  await render();

  await act(async () => {
    pressable('compose-add-photo').props.onPress();
  });
  await act(async () => {
    byLabel('Choose up to 6 photos').props.onPress();
  });
  act(() => {
    jest.advanceTimersByTime(SHEET_EXIT_MS + 50);
  });
  await flush();
  expect(pickLibrary).toHaveBeenCalledWith(expect.objectContaining({ allowsMultipleSelection: true, selectionLimit: 6 }));
  expect(shown()).toContain('4 more');

  await submit();
  expect(upload.mock.calls.map((c) => c[0])).toEqual(['file:///1.jpg', 'file:///2.png']);
  expect(create).toHaveBeenCalledWith(expect.objectContaining({ photo_urls: ['https://cdn/1.jpg', 'https://cdn/2.png'] }));
});

it('keeps uploaded photos when posting fails, so trying again does not upload them twice', async () => {
  pickLibrary.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///1.jpg', fileName: '1.jpg', mimeType: 'image/jpeg' }] });
  upload.mockResolvedValue({ url: 'https://cdn/1.jpg' });
  create.mockRejectedValueOnce(new Error('offline'));
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.useFakeTimers({ doNotFake: ['setImmediate'] });
  await render();
  await act(async () => {
    pressable('compose-add-photo').props.onPress();
  });
  await act(async () => {
    byLabel('Choose up to 6 photos').props.onPress();
  });
  act(() => {
    jest.advanceTimersByTime(SHEET_EXIT_MS + 50);
  });
  await flush();

  await submit();
  expect(alert).toHaveBeenCalledWith("Couldn't post", expect.any(String));
  await submit();
  expect(upload).toHaveBeenCalledTimes(1);
  expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ photo_urls: ['https://cdn/1.jpg'] }));
  alert.mockRestore();
});

it('starts with the trail it was opened from', async () => {
  mockParams.trailId = 't7';
  mockParams.trailName = 'Truso Valley';
  await render();
  expect(shown()).toContain('Truso Valley');
  await type('compose-body', 'Lovely');
  await submit();
  expect(create).toHaveBeenCalledWith(expect.objectContaining({ trail_id: 't7' }));
});

it('edits your post: filled in, changes saved, its photos not uploaded again', async () => {
  mockParams.postId = 'p1';
  client.setQueryData(queryKeys.feedPost('p1'), feedPost());
  await render();
  expect(input('compose-body').props.value).toBe('Old text');
  expect(input('compose-place').props.value).toBe('Juta');
  expect(shown()).toContain('Juta to Roshka');

  await type('compose-body', 'New text');
  await act(async () => {
    pressable('compose-clear-trail').props.onPress();
  });
  await submit();
  expect(upload).not.toHaveBeenCalled();
  expect(update).toHaveBeenCalledWith('p1', {
    body: 'New text',
    trail_id: null,
    place_name: 'Juta',
    photo_urls: ['https://cdn/a.jpg'],
  });
  expect(router.back).toHaveBeenCalled();
});

it('asks before leaving with something written, and not after posting', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await render();
  const leave = { preventDefault: jest.fn(), data: { action: { type: 'GO_BACK' } } };

  mockListeners.beforeRemove(leave);
  expect(leave.preventDefault).not.toHaveBeenCalled();

  await type('compose-body', 'Half a trip report');
  mockListeners.beforeRemove(leave);
  expect(leave.preventDefault).toHaveBeenCalled();
  expect(alert).toHaveBeenCalledWith('Discard this post?', undefined, expect.any(Array));

  leave.preventDefault.mockClear();
  await submit();
  mockListeners.beforeRemove(leave);
  expect(leave.preventDefault).not.toHaveBeenCalled();
  alert.mockRestore();
});
