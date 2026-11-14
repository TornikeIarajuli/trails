/**
 * The "Back by" and "Share your hike" sheets with the app's real bottom sheet (a Modal), not a
 * stand-in: they open from their buttons, show their content, act, and close again. Only the
 * network, the phone's share sheet and the native drawing into a PNG are replaced.
 */
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../../utils/haptics', () => ({
  haptics: { tap: jest.fn(), select: jest.fn(), success: jest.fn(), warning: jest.fn() },
}));
jest.mock('@react-native-community/datetimepicker', () => () => null);
jest.mock('../../services/checkins', () => ({
  checkinsService: { get: jest.fn(), set: jest.fn(), finish: jest.fn() },
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn(() => Promise.resolve()),
}));
const mockWrite = jest.fn();
jest.mock('expo-file-system', () => ({
  Paths: { cache: 'cache' },
  File: jest.fn().mockImplementation((_dir: string, name: string) => ({ uri: `file:///cache/${name}`, write: mockWrite })),
}));
import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Sharing from 'expo-sharing';
import { BackByRow } from '../../components/hike/BackBy';
import { ShareHikeSheet } from '../../components/completion/ShareHikeSheet';
import { SHEET_EXIT_MS } from '../../components/ui/Sheet';
import { checkinsService } from '../../services/checkins';
import { resetCheckInSyncForTests } from '../../utils/checkInSync';

const get = checkinsService.get as jest.Mock;
const set = checkinsService.set as jest.Mock;
const shareAsync = Sharing.shareAsync as jest.Mock;

let renderer: ReactTestRenderer | null = null;

function deepText(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(deepText).join('');
}
const shown = () => (renderer?.toJSON() ? renderer.root.findAllByType(Text).map(deepText) : []);
const pressable = (id: string) =>
  renderer!.root.findAll((n) => n.props.testID === id && typeof n.props.onPress === 'function')[0];
/** The real sheet's Modal, while it is on screen. */
const modal = () => renderer!.root.findAll((n) => typeof n.props.onRequestClose === 'function')[0];

async function flush() {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setImmediate(resolve));
    });
  }
}

async function render(element: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  await act(async () => {
    renderer = TestRenderer.create(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
  });
  await flush();
}

async function press(id: string) {
  await act(async () => {
    await pressable(id).props.onPress();
  });
  await flush();
}

/** Lets the sheet finish sliding away. */
async function waitForExit() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, SHEET_EXIT_MS + 300));
  });
  await flush();
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  resetCheckInSyncForTests();
  set.mockResolvedValue(undefined);
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

describe('the real "Back by" sheet', () => {
  const row = <BackByRow trailId="t1" estimatedHours={4} currentPosition={() => ({ lat: 42.6, lng: 44.6 })} />;

  it('opens from the row on the hike screen, sets the time, and closes', async () => {
    get.mockResolvedValue({ check_in: null, emergency_contact: { id: 'u2', username: 'gio' } });
    await render(row);
    expect(modal()).toBeUndefined();

    await press('back-by-row');
    expect(modal()).toBeDefined();
    expect(modal().props.visible).toBe(true);
    expect(shown()).toEqual(expect.arrayContaining(['Back by', 'Set', 'Pick a time']));
    expect(shown().some((t) => t.includes('gio is alerted'))).toBe(true);

    await press('back-by-save');
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ trail_id: 't1', lat: 42.6, lng: 44.6 }));
    await waitForExit();
    expect(modal()).toBeUndefined();
  });

  it('explains how to choose an emergency contact when there is none', async () => {
    get.mockResolvedValue({ check_in: null, emergency_contact: null });
    await render(row);
    await press('back-by-row');
    expect(modal()).toBeDefined();
    expect(shown().some((t) => t.startsWith('Someone has to be told if you are not back'))).toBe(true);
    expect(shown()).toContain('Find your emergency contact');
  });
});

describe('the real "Share your hike" sheet', () => {
  const data = {
    trailName: 'Juta to Roshka',
    subtitle: 'Kazbegi · 14 November 2026',
    stats: [{ value: '12 km', label: 'Distance' }],
    route: [
      { lat: 42.0, lng: 44.0 },
      { lat: 42.01, lng: 44.02 },
    ],
  };

  it('shows the picture preview, makes the PNG and opens the phone’s share sheet', async () => {
    await render(<ShareHikeSheet visible onClose={() => {}} data={data} onShareText={() => {}} />);
    expect(modal().props.visible).toBe(true);
    expect(renderer!.root.findAll((n) => n.props.viewBox === '0 0 1080 1920').length).toBeGreaterThan(0);
    expect(shown()).toEqual(expect.arrayContaining(['Share your hike', 'Share picture', 'Share as text']));

    // The phone draws the SVG into a PNG natively; here the drawing hands back a tiny PNG
    const svg = renderer!.root.findAll((n) => typeof n.type !== 'string' && n.props.viewBox === '0 0 1080 1920')[0];
    const toDataURL = jest.fn((done: (base64: string) => void) => done('iVBORw0KGgo='));
    (svg as unknown as { instance: { toDataURL: unknown } }).instance.toDataURL = toDataURL;

    await press('share-picture');
    expect(toDataURL).toHaveBeenCalledWith(expect.any(Function), { width: 1080, height: 1920 });
    expect(mockWrite).toHaveBeenCalledWith('iVBORw0KGgo=', { encoding: 'base64' });
    expect(shareAsync).toHaveBeenCalledWith(expect.stringMatching(/^file:\/\/\/cache\/hike-\d+\.png$/), expect.objectContaining({ mimeType: 'image/png' }));
  });

  it('closes and shares as text when asked', async () => {
    const onShareText = jest.fn();
    function Screen() {
      const [open, setOpen] = React.useState(true);
      return <ShareHikeSheet visible={open} onClose={() => setOpen(false)} data={data} onShareText={onShareText} />;
    }
    await render(<Screen />);
    await press('share-text');
    expect(onShareText).toHaveBeenCalled();
    await waitForExit();
    expect(modal()).toBeUndefined();
  });
});
