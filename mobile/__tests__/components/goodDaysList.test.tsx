/**
 * Feed > Good days: the trails whose forecast says go in the next three days, grouped by day
 * with the ones you bookmarked first, and what shows when there are none.
 */
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../../utils/haptics', () => ({
  haptics: { tap: jest.fn(), select: jest.fn(), success: jest.fn(), warning: jest.fn() },
}));
jest.mock('../../components/ui/Icon', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Icon: ({ name, testID }: { name: string; testID?: string }) => React.createElement(Text, { testID: testID ?? `icon-${name}` }),
  };
});
jest.mock('../../components/trail/TrailCover', () => ({ TrailCover: () => null }));
jest.mock('../../components/ui/ErrorState', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { ErrorState: ({ title }: { title: string }) => React.createElement(Text, null, title) };
});
const mockPrefetch = jest.fn();
jest.mock('../../hooks/useTrails', () => ({ usePrefetchTrail: () => mockPrefetch }));
jest.mock('../../services/outlook', () => ({ outlookService: { goodDays: jest.fn() } }));
jest.mock('../../services/bookmarks', () => ({ bookmarksService: { getMyBookmarks: jest.fn() } }));

import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  GoodDaysList,
  georgianToday,
  goodDayTitle,
  groupGoodDays,
  tempRange,
} from '../../components/feed/GoodDaysList';
import { outlookService } from '../../services/outlook';
import type { GoodDay } from '../../services/outlook';
import { bookmarksService } from '../../services/bookmarks';

const goodDays = outlookService.goodDays as jest.Mock;
const getMyBookmarks = bookmarksService.getMyBookmarks as jest.Mock;

const inDays = (n: number) => {
  const d = new Date(`${georgianToday()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const goodDay = (trailId: string, name: string, day: string, extra: Partial<GoodDay> = {}): GoodDay => ({
  trail_id: trailId,
  day,
  verdict: 'go',
  label: 'Go',
  headline: 'Dry and calm',
  temp_min_c: -2,
  temp_max_c: 6,
  trail: {
    id: trailId,
    name_en: name,
    name_ka: null,
    region: 'Kazbegi',
    difficulty: 'medium',
    cover_image_url: null,
    distance_km: 8,
    elevation_gain_m: 600,
  },
  ...extra,
});

const bookmarkPage = (trailIds: string[], page = 1, totalPages = 1) => ({
  data: trailIds.map((id) => ({
    id: `b-${id}`,
    created_at: '2026-11-01T08:00:00Z',
    category: 'saved',
    note: null,
    trails: { id, name_en: id },
  })),
  pagination: { page, limit: 20, total: trailIds.length, totalPages },
});

let renderer: ReactTestRenderer | null = null;

function deepText(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(deepText).join('');
}
const shown = () => (renderer?.toJSON() ? renderer.root.findAllByType(Text).map(deepText) : []);
// A touchable and the view inside it both carry the testID: each row once, in order
const rows = () => [
  ...new Set(
    renderer!.root
      .findAll((n) => /^good-day-t-/.test(String(n.props.testID)) && typeof n.props.onPress === 'function')
      .map((n) => n.props.testID as string),
  ),
];
const byTestId = (id: string) => renderer!.root.findAll((n) => n.props.testID === id);

async function flush() {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setImmediate(resolve));
    });
  }
}

async function render() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  await act(async () => {
    renderer = TestRenderer.create(
      <QueryClientProvider client={client}>
        <GoodDaysList />
      </QueryClientProvider>,
    );
  });
  await flush();
}

beforeEach(() => {
  jest.clearAllMocks();
  getMyBookmarks.mockResolvedValue(bookmarkPage([]));
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

describe('GoodDaysList', () => {
  it('lists the good days by day, the trails you bookmarked first and marked', async () => {
    goodDays.mockResolvedValue([
      goodDay('t-arsha', 'Arsha', inDays(0)),
      goodDay('t-juta', 'Juta', inDays(0), {
        label: 'Go early',
        headline: 'Thunderstorms likely from 14:00',
        temp_min_c: 1.6,
        temp_max_c: 2.4,
      }),
      goodDay('t-gergeti', 'Gergeti', inDays(1)),
    ]);
    getMyBookmarks.mockResolvedValue(bookmarkPage(['t-juta']));
    await render();

    expect(goodDays).toHaveBeenCalledWith(3);
    expect(rows()).toEqual(['good-day-t-juta', 'good-day-t-arsha', 'good-day-t-gergeti']);
    expect(byTestId('good-day-saved-t-juta')).not.toHaveLength(0);
    expect(byTestId('good-day-saved-t-arsha')).toHaveLength(0);
    const texts = shown();
    expect(texts).toEqual(
      expect.arrayContaining([
        "Trails with a good day ahead, by the forecast at each trail's highest point.",
        goodDayTitle(inDays(0), inDays(0)),
        goodDayTitle(inDays(1), inDays(0)),
        'Juta',
        'Kazbegi',
        'Go early',
        'Thunderstorms likely from 14:00',
        '2°',
        'Go',
        'Dry and calm',
        '-2° to 6°',
      ]),
    );
    expect(texts.filter((t) => t.startsWith('Today · '))).toHaveLength(1);
    expect(texts.filter((t) => t.startsWith('Tomorrow · '))).toHaveLength(1);
  });

  it('opens the trail when a row is tapped, loading it from the first touch', async () => {
    goodDays.mockResolvedValue([goodDay('t-juta', 'Juta', inDays(1))]);
    await render();

    const row = renderer!.root.findAll((n) => n.props.testID === 'good-day-t-juta' && typeof n.props.onPress === 'function')[0];
    act(() => row.props.onPressIn());
    expect(mockPrefetch).toHaveBeenCalledWith('t-juta');
    act(() => row.props.onPress());
    expect(router.push).toHaveBeenCalledWith('/trail/t-juta');
  });

  it('says so when no day ahead is clearly good', async () => {
    goodDays.mockResolvedValue([]);
    await render();

    expect(byTestId('empty-good-days')).not.toHaveLength(0);
    expect(shown()).toContain('No clearly good days in the next three days. Check back tomorrow.');
  });

  it('refreshes when pulled down', async () => {
    goodDays.mockResolvedValue([goodDay('t-juta', 'Juta', inDays(1))]);
    await render();
    expect(goodDays).toHaveBeenCalledTimes(1);

    const refresh = renderer!.root.findAll((n) => typeof n.props.onRefresh === 'function')[0];
    await act(async () => {
      refresh.props.onRefresh();
    });
    await flush();
    expect(goodDays).toHaveBeenCalledTimes(2);
  });

  it('says when the good days could not be loaded', async () => {
    goodDays.mockRejectedValue(new Error('offline'));
    await render();

    expect(shown()).toContain("Couldn't load the good days");
  });

  it('counts older bookmarks too, loading their further pages', async () => {
    getMyBookmarks
      .mockResolvedValueOnce(bookmarkPage(['t-other'], 1, 2))
      .mockResolvedValueOnce(bookmarkPage(['t-arsha'], 2, 2));
    goodDays.mockResolvedValue([goodDay('t-juta', 'Juta', inDays(0)), goodDay('t-arsha', 'Arsha', inDays(0))]);
    await render();

    expect(getMyBookmarks).toHaveBeenCalledWith(1, 20, undefined);
    expect(getMyBookmarks).toHaveBeenCalledWith(2, 20, undefined);
    expect(rows()).toEqual(['good-day-t-arsha', 'good-day-t-juta']);
  });
});

describe('good days helpers', () => {
  it('names the days, with today and tomorrow called so', () => {
    expect(goodDayTitle('2026-11-20', '2026-11-20')).toBe('Today · Friday 20 Nov');
    expect(goodDayTitle('2026-11-21', '2026-11-20')).toBe('Tomorrow · Saturday 21 Nov');
    expect(goodDayTitle('2026-11-22', '2026-11-20')).toBe('Sunday 22 Nov');
    expect(goodDayTitle('2026-12-01', '2026-11-30')).toBe('Tomorrow · Tuesday 1 Dec');
  });

  it('counts the days in Georgian time', () => {
    expect(georgianToday(Date.parse('2026-11-20T19:59:00Z'))).toBe('2026-11-20');
    expect(georgianToday(Date.parse('2026-11-20T20:30:00Z'))).toBe('2026-11-21');
  });

  it('writes the temperatures as a range, or one when they round the same', () => {
    expect(tempRange(-2, 6)).toBe('-2° to 6°');
    expect(tempRange(1.6, 2.4)).toBe('2°');
    expect(tempRange(-0.3, 0.2)).toBe('0°');
    expect(tempRange(null, 5)).toBe('5°');
    expect(tempRange(null, null)).toBeNull();
  });

  it('groups by day, soonest first, bookmarked trails first and the rest as listed', () => {
    const list = [
      goodDay('t-c', 'C', '2026-11-22'),
      goodDay('t-a', 'A', '2026-11-21'),
      goodDay('t-b', 'B', '2026-11-21'),
      goodDay('t-d', 'D', '2026-11-21'),
    ];
    const sections = groupGoodDays(list, new Set(['t-d']), '2026-11-20');
    expect(sections.map((s) => [s.title, s.data.map((d) => d.trail_id)])).toEqual([
      ['Tomorrow · Saturday 21 Nov', ['t-d', 't-a', 't-b']],
      ['Sunday 22 Nov', ['t-c']],
    ]);
  });
});
