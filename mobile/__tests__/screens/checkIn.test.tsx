/**
 * "Back by" in the app: the row and sheet on the hike screen, and the check-in screen that
 * "Are you back?" opens.
 */
const mockSecureStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockSecureStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecureStore.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecureStore.delete(key);
  }),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  Stack: { Screen: () => null },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../../utils/queryClient', () => ({ queryClient: { clear: jest.fn() } }));
jest.mock('../../utils/haptics', () => ({
  haptics: { tap: jest.fn(), select: jest.fn(), success: jest.fn(), warning: jest.fn() },
}));
jest.mock('../../components/ui/Icon', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { Icon: ({ name }: { name: string }) => React.createElement(Text, { testID: `icon-${name}` }) };
});
jest.mock('../../components/ui/Sheet', () => {
  const React = require('react');
  const { View, Text, Pressable } = require('react-native');
  return {
    Sheet: ({ visible, title, children, footer }: { visible: boolean; title: string; children: React.ReactNode; footer?: React.ReactNode }) =>
      visible ? React.createElement(View, null, React.createElement(Text, null, title), children, footer) : null,
    SheetButton: ({ title, onPress, disabled, testID }: { title: string; onPress: () => void; disabled?: boolean; testID?: string }) =>
      React.createElement(Pressable, { onPress: disabled ? undefined : onPress, testID: testID ?? `button-${title}` }, React.createElement(Text, null, title)),
  };
});
jest.mock('@react-native-community/datetimepicker', () => () => null);
jest.mock('../../services/checkins', () => ({
  checkinsService: { get: jest.fn(), set: jest.fn(), finish: jest.fn() },
}));

import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import { BackByRow } from '../../components/hike/BackBy';
import CheckInScreen from '../../app/trail/check-in';
import { checkinsService } from '../../services/checkins';
import { resetCheckInSyncForTests } from '../../utils/checkInSync';

const get = checkinsService.get as jest.Mock;
const set = checkinsService.set as jest.Mock;
const finish = checkinsService.finish as jest.Mock;

const inMinutes = (m: number) => new Date(Date.now() + m * 60 * 1000).toISOString();
const checkIn = (extra: Record<string, unknown> = {}) => ({
  id: 'k1',
  trail_id: 't1',
  trail_name: 'Juta to Roshka',
  status: 'active',
  back_by: inMinutes(120),
  started_at: inMinutes(-60),
  reminded_at: null,
  alerted_at: null,
  last_position_at: null,
  ...extra,
});
const gio = { id: 'u2', username: 'gio' };

let renderer: ReactTestRenderer | null = null;

function deepText(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(deepText).join('');
}
const shown = () => (renderer?.toJSON() ? renderer.root.findAllByType(Text).map(deepText) : []);
const pressable = (id: string) =>
  renderer!.root.findAll((n) => n.props.testID === id && typeof n.props.onPress === 'function')[0];

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
    pressable(id).props.onPress();
  });
  await flush();
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  resetCheckInSyncForTests();
  set.mockResolvedValue(undefined);
  finish.mockResolvedValue(undefined);
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

const row = (
  <BackByRow trailId="t1" estimatedHours={4} currentPosition={() => ({ lat: 42.6, lng: 44.6 })} />
);

describe('the Back by row on the hike screen', () => {
  it('is off until set, naming the emergency contact', async () => {
    get.mockResolvedValue({ check_in: null, emergency_contact: gio });
    await render(row);
    expect(shown()).toEqual(expect.arrayContaining(['Back by · Off', 'Tell gio if you are late']));
  });

  it('sets the suggested time with the current position', async () => {
    get.mockResolvedValue({ check_in: null, emergency_contact: gio });
    await render(row);

    await press('back-by-row');
    expect(shown()).toContain('Back by');
    await press('back-by-save');

    expect(set).toHaveBeenCalledWith(expect.objectContaining({ trail_id: 't1', lat: 42.6, lng: 44.6 }));
    const sentBackBy = new Date(set.mock.calls[0][0].back_by).getTime();
    // 4 h × 1.5 = 6 h, rounded up to the half hour
    expect(sentBackBy - Date.now()).toBeGreaterThan(6 * 3600 * 1000 - 60 * 1000);
    expect(sentBackBy - Date.now()).toBeLessThan(6.5 * 3600 * 1000 + 60 * 1000);
  });

  it('says why it is needed when there is no emergency contact, and leads to finding one', async () => {
    get.mockResolvedValue({ check_in: null, emergency_contact: null });
    await render(row);

    await press('back-by-row');
    expect(renderer!.root.findAll((n) => n.props.testID === 'back-by-no-contact').length).toBeGreaterThan(0);
    await press('button-Find your emergency contact');
    expect(router.push).toHaveBeenCalledWith('/search');
    expect(set).not.toHaveBeenCalled();
  });

  it('shows the time once set, and can be turned off', async () => {
    get.mockResolvedValue({ check_in: checkIn(), emergency_contact: gio });
    await render(row);
    expect(shown()).toContain('gio is alerted if you are late');

    await press('back-by-row');
    await press('back-by-off');
    expect(finish).toHaveBeenCalledTimes(1);
  });

  it('explains when the server could not be reached', async () => {
    get.mockResolvedValue({ check_in: null, emergency_contact: gio });
    set.mockRejectedValueOnce({ message: 'Network Error' });
    await render(row);

    await press('back-by-row');
    await press('back-by-save');
    expect(shown().some((t) => t.includes('Could not reach the server') || t.includes('Network'))).toBe(true);
  });
});

describe('the check-in screen', () => {
  it('asks "Are you back?" after the time, and checks in', async () => {
    get.mockResolvedValue({ check_in: checkIn({ back_by: inMinutes(-5), reminded_at: inMinutes(-5) }), emergency_contact: gio });
    await render(<CheckInScreen />);

    expect(shown()).toContain('Are you back?');
    expect(shown()).toContain('Check in now, or gio is alerted 30 minutes after that time.');

    get.mockResolvedValue({ check_in: null, emergency_contact: gio });
    await press('check-in-back');
    expect(finish).toHaveBeenCalledTimes(1);
    expect(shown()).toContain('Welcome back!');
  });

  it('adds an hour', async () => {
    const backBy = inMinutes(-5);
    get.mockResolvedValue({ check_in: checkIn({ back_by: backBy }), emergency_contact: gio });
    await render(<CheckInScreen />);

    await press('check-in-add-hour');
    const sent = new Date(set.mock.calls[0][0].back_by).getTime();
    expect(sent - Date.now()).toBeGreaterThan(59 * 60 * 1000);
    expect(sent - Date.now()).toBeLessThan(61 * 60 * 1000);
  });

  it('tells the hiker their contact was alerted, and that checking in tells them too', async () => {
    get.mockResolvedValue({ check_in: checkIn({ status: 'alerted', back_by: inMinutes(-40) }), emergency_contact: gio });
    await render(<CheckInScreen />);

    expect(shown()).toContain('gio was told you are late. Check in so they know you are fine.');
    await press('check-in-back');
    expect(shown()).toContain('Checked in. gio hears you are back.');
  });

  it('has nothing to ask when there is no open check-in', async () => {
    get.mockResolvedValue({ check_in: null, emergency_contact: gio });
    await render(<CheckInScreen />);
    expect(shown()).toContain('You are checked in');
  });
});
