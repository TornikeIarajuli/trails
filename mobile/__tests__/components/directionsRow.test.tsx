/**
 * "Directions to the start" under the trail map, with the real action sheet: it opens the maps
 * app the hiker picks, falls back to the web map, and shares the start's location.
 */
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../../utils/haptics', () => ({ haptics: { tap: jest.fn(), select: jest.fn() } }));
jest.mock('../../utils/analytics', () => ({ analytics: { directionsOpened: jest.fn() } }));

import React from 'react';
import { Linking, Platform, Share, Text } from 'react-native';
import TestRenderer, { act, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { DirectionsRow } from '../../components/trail/DirectionsRow';
import { SHEET_EXIT_MS } from '../../components/ui/Sheet';
import { analytics } from '../../utils/analytics';

let renderer: ReactTestRenderer | null = null;
let openURL: jest.SpyInstance;
let share: jest.SpyInstance;

function deepText(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(deepText).join('');
}
const shown = () => (renderer?.toJSON() ? renderer.root.findAllByType(Text).map(deepText) : []);
const byLabel = (label: string) =>
  renderer!.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];

async function flush() {
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      await new Promise((resolve) => setImmediate(resolve));
    });
  }
}

function render(start: { latitude: number; longitude: number } | null = { latitude: 42.5786, longitude: 44.74494 }) {
  act(() => {
    renderer = TestRenderer.create(<DirectionsRow trailId="t1" trailName="Juta to Roshka" start={start} />);
  });
}

async function choose(label: string) {
  act(() => byLabel('Directions to the start, 42.57860° N, 44.74494° E').props.onPress());
  act(() => byLabel(label).props.onPress());
  // The choice runs once the sheet has slid away
  act(() => {
    jest.advanceTimersByTime(SHEET_EXIT_MS + 50);
  });
  await flush();
}

beforeEach(() => {
  // The app ships on Android, where "Another maps app" is offered
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.useFakeTimers({ doNotFake: ['setImmediate'] });
  // React Native's test setup already makes these mocks: start each test with no calls
  openURL = jest.spyOn(Linking, 'openURL').mockReset().mockResolvedValue(true);
  share = jest.spyOn(Share, 'share').mockReset().mockResolvedValue({ action: 'sharedAction' });
  (analytics.directionsOpened as jest.Mock).mockClear();
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('shows nothing for a trail without a start point', () => {
  render(null);
  expect(renderer!.toJSON()).toBeNull();
});

it('names the start and lists the maps apps', () => {
  render();
  expect(shown()).toEqual(['Directions to the start', '42.57860° N, 44.74494° E']);
  act(() => byLabel('Directions to the start, 42.57860° N, 44.74494° E').props.onPress());
  expect(shown().slice(2)).toEqual([
    'Directions to the start',
    'Juta to Roshka starts at 42.57860° N, 44.74494° E.',
    'Google Maps',
    'Waze',
    'Another maps app',
    'Share the location',
    'Cancel',
  ]);
});

it('opens driving directions in the app picked', async () => {
  render();
  await choose('Waze');
  expect(openURL).toHaveBeenCalledWith('https://waze.com/ul?ll=42.578600,44.744940&navigate=yes');
  expect(analytics.directionsOpened).toHaveBeenCalledWith('t1', 'waze');
});

it('falls back to the web map when no app opens the place', async () => {
  openURL.mockRejectedValueOnce(new Error('No Activity found'));
  render();
  await choose('Another maps app');
  expect(openURL).toHaveBeenNthCalledWith(1, expect.stringMatching(/^geo:42\.578600,44\.744940\?q=/));
  expect(openURL).toHaveBeenNthCalledWith(2, 'https://www.google.com/maps/search/?api=1&query=42.578600,44.744940');
});

it('shares the start with a link that opens anywhere', async () => {
  render();
  await choose('Share the location');
  expect(share).toHaveBeenCalledWith({
    message: 'Start of Juta to Roshka: 42.57860° N, 44.74494° E\nhttps://www.google.com/maps/search/?api=1&query=42.578600,44.744940',
  });
  expect(openURL).not.toHaveBeenCalled();
});
