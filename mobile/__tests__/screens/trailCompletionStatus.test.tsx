/**
 * The trail screen's "your completion" row and the past-hike year picker,
 * rendered with a real query client and mocked API.
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
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../../utils/queryClient', () => ({ queryClient: { clear: jest.fn() } }));
jest.mock('../../utils/haptics', () => ({
  haptics: { tap: jest.fn(), select: jest.fn(), success: jest.fn(), warning: jest.fn() },
}));
jest.mock('../../utils/analytics', () => ({ analytics: { badgeEarned: jest.fn() } }));
jest.mock('../../services/completions', () => ({
  completionsService: { getMyCompletions: jest.fn(), logPastHike: jest.fn(), deleteCompletion: jest.fn() },
}));
jest.mock('../../services/badges', () => ({ badgesService: { getAllBadges: jest.fn() } }));
jest.mock('../../components/badges/BadgeUnlockModal', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    BadgeUnlockModal: ({ badges, visible }: { badges: { name_en: string }[]; visible: boolean }) =>
      visible ? React.createElement(Text, null, `Unlocked: ${badges.map((b) => b.name_en).join(', ')}`) : null,
  };
});

import React from 'react';
import { Alert, Text } from 'react-native';
import TestRenderer, { act, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import { TrailCompletionStatus } from '../../components/trail/TrailCompletionStatus';
import { completionsService } from '../../services/completions';
import { badgesService } from '../../services/badges';
import { useAuthStore } from '../../store/authStore';
import { TrailCompletion } from '../../types/completion';

const getMine = completionsService.getMyCompletions as jest.Mock;
const logPastHike = completionsService.logPastHike as jest.Mock;
const deleteCompletion = completionsService.deleteCompletion as jest.Mock;
const getAllBadges = badgesService.getAllBadges as jest.Mock;
const push = router.push as jest.Mock;

const THIS_YEAR = new Date().getUTCFullYear();

const completion = (overrides: Partial<TrailCompletion> = {}): TrailCompletion => ({
  id: 'c-1',
  user_id: 'user-1',
  trail_id: 'trail-1',
  proof_photo_url: null,
  photo_lat: null,
  photo_lng: null,
  status: 'approved',
  source: 'hike',
  elapsed_seconds: 5400,
  reviewer_note: null,
  completed_at: '2026-11-13T08:30:00.000Z',
  created_at: '2026-11-13T08:30:00.000Z',
  ...overrides,
});
const pastCompletion = (year: number) =>
  completion({ id: 'c-past', source: 'past', completed_at: `${year}-01-01T12:00:00.000Z`, elapsed_seconds: null });

let renderer: ReactTestRenderer | null = null;
let client: QueryClient;

function texts(node: ReactTestInstance): string[] {
  return node.findAllByType(Text).map((t) =>
    ([] as unknown[]).concat(t.props.children).filter((c) => typeof c === 'string' || typeof c === 'number').join(''),
  );
}

const shown = () => (renderer?.toJSON() ? texts(renderer.root) : []);

async function flush() {
  await act(async () => {
    for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function render(props: { trailId?: string; hikeActiveHere?: boolean } = {}) {
  // gcTime Infinity: no garbage-collection timers left running after a test (they would keep Jest alive)
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  await act(async () => {
    renderer = TestRenderer.create(
      <QueryClientProvider client={client}>
        <TrailCompletionStatus trailId={props.trailId ?? 'trail-1'} hikeActiveHere={props.hikeActiveHere ?? false} />
      </QueryClientProvider>,
    );
  });
  await flush();
}

/** Presses the nearest pressable around the text that reads exactly `label`. */
async function press(label: string) {
  const text = renderer!.root.findAllByType(Text).find((t) => texts(t)[0] === label);
  if (!text) throw new Error(`no text "${label}" in: ${shown().join(' | ')}`);
  let node: ReactTestInstance | null = text;
  while (node && typeof node.props.onPress !== 'function') node = node.parent;
  if (!node) throw new Error(`"${label}" cannot be pressed`);
  const target = node;
  await act(async () => {
    await target.props.onPress();
  });
  await flush();
}

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({
    user: { id: 'user-1', email: 'nino@example.com', user_metadata: { username: 'nino' } },
    accessToken: 'access',
    refreshToken: 'refresh',
    isAuthenticated: true,
  });
});

afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = null;
  client?.clear();
});

describe('TrailCompletionStatus', () => {
  it('shows nothing when signed out, and does not ask the server', async () => {
    useAuthStore.setState({ isAuthenticated: false, user: null, accessToken: null, refreshToken: null });
    await render();
    expect(renderer!.toJSON()).toBeNull();
    expect(getMine).not.toHaveBeenCalled();
  });

  it('shows nothing until the completions are loaded', async () => {
    getMine.mockReturnValue(new Promise(() => {}));
    await render();
    expect(renderer!.toJSON()).toBeNull();
  });

  it('offers to mark the trail as done when it is not', async () => {
    getMine.mockResolvedValue([completion({ trail_id: 'another-trail' })]);
    await render();
    expect(shown()).toContain('Hiked it before? Mark as done');
  });

  it('offers nothing while a hike on this trail is being recorded', async () => {
    getMine.mockResolvedValue([]);
    await render({ hikeActiveHere: true });
    expect(renderer!.toJSON()).toBeNull();
  });

  it('shows a recorded completion with its date and opens it', async () => {
    getMine.mockResolvedValue([completion()]);
    await render();

    expect(shown()).toContain('You completed this trail · Nov 13, 2026');
    await press('You completed this trail · Nov 13, 2026');
    expect(push).toHaveBeenCalledWith('/trail/completion/c-1');
  });

  it('shows a past hike with only its year', async () => {
    getMine.mockResolvedValue([pastCompletion(2019)]);
    await render();

    expect(shown()).toContain('You hiked this in 2019 · before the app');
    expect(shown().join(' ')).not.toMatch(/Jan|2019-01-01|12:00/);
  });

  it('keeps a past hike done while a hike recorded later is reviewed, without offering to remove it', async () => {
    getMine.mockResolvedValue([{ ...pastCompletion(2019), pending_hike_id: 'hike-7', completed_at: '2019-01-01T12:00:00+00:00' }]);
    await render();

    expect(shown()).toContain('You hiked this in 2019 · your recorded hike is being reviewed');
    expect(shown()).not.toContain('Remove');
  });

  it('says when a recorded hike is waiting for review', async () => {
    getMine.mockResolvedValue([completion({ status: 'pending' })]);
    await render();
    expect(shown()).toContain('Your hike is waiting for review');
  });

  it('removes a past hike after confirmation', async () => {
    getMine.mockResolvedValueOnce([pastCompletion(2019)]).mockResolvedValue([]);
    deleteCompletion.mockResolvedValue(undefined);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render();

    await press('Remove');
    const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    expect(alert.mock.calls[0][0]).toBe('Remove past hike?');
    await act(async () => buttons.find((b) => b.text === 'Remove')!.onPress!());
    await flush();

    expect(deleteCompletion).toHaveBeenCalledWith('c-past');
    expect(shown()).toContain('Hiked it before? Mark as done');
    alert.mockRestore();
  });
});

describe('marking a past hike', () => {
  beforeEach(() => {
    getMine.mockResolvedValue([]);
  });

  it('asks for the year, offers older years behind "Earlier…", and marks the trail as done', async () => {
    const created = {
      id: 'c-9',
      user_id: 'user-1',
      trail_id: 'trail-1',
      status: 'approved',
      source: 'past',
      completed_at: '2019-01-01T12:00:00.000Z',
      new_badge_ids: [],
      already_existed: false,
    };
    logPastHike.mockResolvedValue(created);
    // What the server lists before and after the past hike is recorded
    getMine.mockResolvedValueOnce([]).mockResolvedValue([pastCompletion(2019)]);
    await render();

    await press('Hiked it before? Mark as done');
    expect(shown()).toContain('When did you hike it?');
    expect(shown()).toContain('Pick a year');
    expect(shown()).toContain(String(THIS_YEAR));
    expect(shown()).toContain(String(THIS_YEAR - 6));
    expect(shown()).not.toContain(String(THIS_YEAR - 7));
    expect(shown().join(' ')).toMatch(/leaderboard counts only hikes recorded with the app/);

    await press('Earlier…');
    expect(shown()).toContain('1950');

    await press('2019');
    expect(shown()).toContain('Mark as done · 2019');
    await press('Mark as done · 2019');

    expect(logPastHike).toHaveBeenCalledWith('trail-1', 2019);
    expect(shown()).toContain('You hiked this in 2019 · before the app');
    expect(shown()).toContain('Marked as done. It shows on your profile and in My Georgia.');
    expect(shown()).not.toContain('When did you hike it?');
  });

  it('shows the server’s answer and keeps the picker open when it refuses', async () => {
    logPastHike.mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { message: 'Your hike on this trail is waiting for review.' } },
    });
    await render();

    await press('Hiked it before? Mark as done');
    await press(String(THIS_YEAR));
    await press(`Mark as done · ${THIS_YEAR}`);

    expect(shown()).toContain('Your hike on this trail is waiting for review.');
    expect(shown()).toContain('When did you hike it?');
  });

  it('says so when the trail was already done', async () => {
    logPastHike.mockResolvedValue({ ...completion(), already_existed: true, new_badge_ids: [] });
    getMine.mockResolvedValueOnce([]).mockResolvedValue([completion()]);
    await render();

    await press('Hiked it before? Mark as done');
    await press(String(THIS_YEAR));
    await press(`Mark as done · ${THIS_YEAR}`);

    expect(shown()).toContain('This trail was already on your profile.');
    expect(shown()).toContain('You completed this trail · Nov 13, 2026');
  });

  it('shows the badges the past hike earned, once the picker has closed', async () => {
    logPastHike.mockResolvedValue({
      id: 'c-9',
      user_id: 'user-1',
      trail_id: 'trail-1',
      status: 'approved',
      source: 'past',
      completed_at: '2018-01-01T12:00:00.000Z',
      new_badge_ids: ['b-1'],
      already_existed: false,
    });
    getAllBadges.mockResolvedValue([{ id: 'b-1', key: 'summit', name_en: 'Summit Seeker' }]);
    await render();

    await press('Hiked it before? Mark as done');
    await press(String(THIS_YEAR - 1));
    await press(`Mark as done · ${THIS_YEAR - 1}`);
    expect(shown().join(' ')).not.toMatch(/Unlocked/);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 700));
    });
    expect(shown()).toContain('Unlocked: Summit Seeker');
  });
});
