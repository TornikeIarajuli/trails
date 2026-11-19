/**
 * Guides: a guide's page (contact only after they accepted, a booking request), and My bookings
 * (the guide accepts with a reply, the hiker cancels).
 */
const mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
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
jest.mock('@react-native-community/datetimepicker', () => () => null);
jest.mock('../../services/api', () => ({ __esModule: true, default: {} }));
jest.mock('@react-native-community/netinfo', () => require('@react-native-community/netinfo/jest/netinfo-mock'));
jest.mock('../../services/guides', () => ({
  guidesService: {
    get: jest.fn(),
    contact: jest.fn(),
    bookings: jest.fn(),
    requestBooking: jest.fn(),
    answerBooking: jest.fn(),
  },
}));

import React from 'react';
import { Alert, Text } from 'react-native';
import TestRenderer, { act, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import GuideProfileScreen from '../../app/trail/guides/[userId]';
import BookingsScreen from '../../app/trail/bookings';
import { guidesService } from '../../services/guides';
import { useAuthStore } from '../../store/authStore';

const svc = guidesService as unknown as Record<string, jest.Mock>;
let renderer: ReactTestRenderer | null = null;

function deepText(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(deepText).join('');
}
const shown = () => renderer!.root.findAllByType(Text).map(deepText);
const press = async (id: string) => {
  await act(async () => {
    renderer!.root.findAll((n) => n.props.testID === id && typeof n.props.onPress === 'function')[0].props.onPress();
  });
};

async function flush() {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function render(element: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  await act(async () => {
    renderer = TestRenderer.create(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
  });
  await flush();
}

const guide = {
  user_id: 'g1',
  headline: 'Mountain guide in Svaneti',
  bio: 'Ten years of guiding in Svaneti and Racha.',
  regions: ['Svaneti'],
  languages: ['Georgian', 'English'],
  certifications: null,
  price_gel: 250,
  price_note: 'up to 6 people',
  trail_ids: ['t1'],
  verified_at: '2026-11-01',
  profiles: { username: 'giorgi', full_name: 'Giorgi M', avatar_url: null },
  trails: [{ id: 't1', name_en: 'Mestia to Zhabeshi', region: 'Svaneti', difficulty: 'medium' }],
};

const booking = (extra: Record<string, unknown> = {}) => ({
  id: 'b1',
  guide_id: 'g1',
  hiker_id: 'me',
  trail_id: 't1',
  start_date: '2026-12-12',
  days: 2,
  group_size: 3,
  message: 'Can you take us to Ushguli?',
  status: 'requested',
  guide_reply: null,
  created_at: '2026-11-20T08:00:00Z',
  trails: { id: 't1', name_en: 'Mestia to Zhabeshi' },
  guide: { headline: 'Mountain guide', profiles: { username: 'giorgi', avatar_url: null } },
  hiker: { username: 'nino', avatar_url: null },
  ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(mockParams)) delete mockParams[key];
  useAuthStore.setState({ isAuthenticated: true, user: { id: 'me', email: 'x', user_metadata: { username: 'nino' } } } as never);
  svc.get.mockResolvedValue(guide);
  svc.bookings.mockResolvedValue({ as_hiker: [], as_guide: [] });
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  jest.useRealTimers();
  useAuthStore.setState({ isAuthenticated: false, user: null } as never);
});

describe("a guide's page", () => {
  it('shows who they are and the price, without contact before they accept', async () => {
    mockParams.userId = 'g1';
    await render(<GuideProfileScreen />);
    expect(shown()).toEqual(
      expect.arrayContaining(['Giorgi M', 'Verified guide', 'Mountain guide in Svaneti', '250 GEL a day · up to 6 people', 'Mestia to Zhabeshi']),
    );
    expect(svc.contact).not.toHaveBeenCalled();
    expect(renderer!.root.findAll((n) => n.props.testID === 'guide-contact')).toHaveLength(0);
  });

  it('shows their phone and messengers once they accepted your request', async () => {
    mockParams.userId = 'g1';
    svc.bookings.mockResolvedValue({ as_hiker: [booking({ status: 'accepted' })], as_guide: [] });
    svc.contact.mockResolvedValue({ phone: '+995 599 123456', whatsapp_url: 'https://wa.me/995599123456', telegram: null, telegram_url: null });
    await render(<GuideProfileScreen />);
    expect(svc.contact).toHaveBeenCalledWith('g1');
    expect(shown()).toEqual(expect.arrayContaining(['Contact Giorgi M', '+995 599 123456', 'WhatsApp']));
  });

  it('sends a booking request from the sheet', async () => {
    mockParams.userId = 'g1';
    mockParams.trailId = 't1';
    svc.requestBooking.mockResolvedValue(booking());
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<GuideProfileScreen />);

    await act(async () => {
      renderer!.root.findAll((n) => n.props.title === 'Request a booking' && n.props.onPress)[0].props.onPress();
    });
    await press('booking-people-plus');
    await act(async () => {
      renderer!.root.findAll((n) => n.props.testID === 'booking-message' && n.props.onChangeText)[0].props.onChangeText('Ushguli in December?');
    });
    await press('booking-send');
    await flush();

    expect(svc.requestBooking).toHaveBeenCalledWith(
      expect.objectContaining({ guide_id: 'g1', trail_id: 't1', days: 1, group_size: 3, message: 'Ushguli in December?' }),
    );
    expect(alert).toHaveBeenCalledWith('Request sent', expect.stringContaining('My bookings'));
    alert.mockRestore();
  });
});

describe('My bookings', () => {
  it('lets the guide accept a request with a reply', async () => {
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'g1', email: 'x', user_metadata: { username: 'giorgi' } } } as never);
    mockParams.tab = 'guide';
    svc.bookings.mockResolvedValue({ as_hiker: [], as_guide: [booking({ hiker_id: 'me' })] });
    svc.answerBooking.mockResolvedValue(booking({ status: 'accepted' }));
    await render(<BookingsScreen />);

    expect(shown()).toEqual(expect.arrayContaining(['nino', 'New request', 'Can you take us to Ushguli?']));
    await press('booking-accept-b1');
    await act(async () => {
      renderer!.root.findAll((n) => n.props.accessibilityLabel === 'Reply' && n.props.onChangeText)[0].props.onChangeText('See you at 7 in Mestia');
    });
    await press('booking-answer-send');
    await flush();
    expect(svc.answerBooking).toHaveBeenCalledWith('b1', 'accepted', 'See you at 7 in Mestia');
  });

  it('lets the hiker cancel after asking', async () => {
    svc.bookings.mockResolvedValue({ as_hiker: [booking({ status: 'accepted' })], as_guide: [] });
    svc.answerBooking.mockResolvedValue(booking({ status: 'cancelled' }));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<BookingsScreen />);

    expect(shown()).toEqual(expect.arrayContaining(['giorgi', 'Accepted', 'Open the guide to see their phone number.']));
    await press('booking-cancel-b1');
    const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    await act(async () => buttons.find((b) => b.text === 'Cancel booking')!.onPress!());
    await flush();
    expect(svc.answerBooking).toHaveBeenCalledWith('b1', 'cancelled', undefined);
    alert.mockRestore();
  });
});
