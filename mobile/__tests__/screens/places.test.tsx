/**
 * Places beyond trails: the list (kinds, search, empty), a place's page (weather for what people
 * do there, the way there, trails nearby) and day routes through a region.
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
jest.mock('../../components/places/PlacesMap', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    PlacesMap: ({ points }: { points: { title: string }[] }) =>
      React.createElement(Text, { testID: 'places-map' }, points.map((p) => p.title).join(' | ')),
  };
});
jest.mock('../../components/trail/DirectionsRow', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    DirectionsRow: ({ trailName, isPlace }: { trailName: string; isPlace?: boolean }) =>
      React.createElement(Text, { testID: 'directions' }, `${isPlace ? 'Directions to' : 'Start of'} ${trailName}`),
  };
});
jest.mock('../../services/api', () => ({ __esModule: true, default: {} }));
jest.mock('@react-native-community/netinfo', () => require('@react-native-community/netinfo/jest/netinfo-mock'));
jest.mock('../../services/places', () => ({ placesService: { list: jest.fn(), get: jest.fn() } }));
jest.mock('../../services/forecast', () => ({
  ...jest.requireActual('../../services/forecast'),
  forecastService: { getMountainForecast: jest.fn() },
}));

import React from 'react';
import { Linking, Text } from 'react-native';
import TestRenderer, { act, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import PlacesScreen from '../../app/trail/places';
import PlaceScreen from '../../app/trail/places/[id]';
import DayRoutesScreen from '../../app/trail/places/routes';
import { placesService, PlaceSummary } from '../../services/places';
import { forecastService, MountainForecast } from '../../services/forecast';

const list = placesService.list as jest.Mock;
const get = placesService.get as jest.Mock;
const getForecast = forecastService.getMountainForecast as jest.Mock;
let renderer: ReactTestRenderer | null = null;

function deepText(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(deepText).join('');
}
const shown = () => renderer!.root.findAllByType(Text).map(deepText);
const pressable = (id: string) => renderer!.root.findAll((n) => n.props.testID === id && typeof n.props.onPress === 'function');
const press = async (id: string) => {
  await act(async () => {
    pressable(id)[0].props.onPress();
  });
};

async function flush() {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function render(element: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    renderer = TestRenderer.create(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
  });
  await flush();
}

const place = (id: string, extra: Partial<PlaceSummary> = {}): PlaceSummary => ({
  id,
  kind: 'lake',
  name_en: `Lake ${id}`,
  name_ka: null,
  latitude: 42.5,
  longitude: 44.6,
  elevation_m: 2300,
  region: 'Kazbegi',
  notability: 3,
  ...extra,
});

/** Today and tomorrow at the place (UTC+4), whenever the tests run. */
const localDate = (days: number) => new Date(Date.now() + 4 * 3_600_000 + days * 86_400_000).toISOString().slice(0, 10);

function forecast(): MountainForecast {
  const dates = [localDate(0), localDate(1)];
  return {
    fetchedAt: Date.now(),
    elevationM: 2300,
    utcOffsetSeconds: 4 * 3600,
    current: null,
    days: dates.map((date) => ({ date, sunrise: `${date}T07:58`, sunset: `${date}T17:35`, daylightSeconds: 34600, uvMax: 2, tempMaxC: 5, tempMinC: -3 })),
    hours: dates.flatMap((date) =>
      Array.from({ length: 24 }, (_, h) => ({
        time: `${date}T${String(h).padStart(2, '0')}:00`,
        tempC: 2,
        feelsC: 0,
        precipMm: 0,
        precipProbability: 0,
        snowCm: 0,
        weathercode: 1,
        visibilityM: 30000,
        windKmh: 6,
        gustKmh: 12,
        freezingLevelM: 2800,
        cloudCover: 30,
        pressureHpa: 770,
      })),
    ),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(mockParams)) delete mockParams[k];
});
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

describe('Places', () => {
  it('lists the most notable places with how many there are', async () => {
    list.mockResolvedValue({ data: [place('a', { name_en: 'Abudelauri Lakes', name_ka: 'აბუდელაურის ტბები' }), place('b')], total: 2 });
    await render(<PlacesScreen />);
    expect(list).toHaveBeenCalledWith({ kind: undefined, q: undefined, limit: 50, offset: 0 });
    expect(shown()).toEqual(expect.arrayContaining(['Abudelauri Lakes', 'აბუდელაურის ტბები', 'Lake · Kazbegi · 2,300 m', '2 places']));
  });

  it('filters by kind', async () => {
    list.mockResolvedValue({ data: [], total: 0 });
    await render(<PlacesScreen />);
    await press('places-kind-waterfall');
    await flush();
    expect(list).toHaveBeenLastCalledWith({ kind: 'waterfall', q: undefined, limit: 50, offset: 0 });
    expect(shown()).toEqual(expect.arrayContaining(['No places match', 'Try another name or kind.']));
  });

  it('opens a kind from a link', async () => {
    mockParams.kind = 'castle';
    list.mockResolvedValue({ data: [], total: 0 });
    await render(<PlacesScreen />);
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ kind: 'castle' }));
  });

  it('says places are coming when there are none at all yet', async () => {
    list.mockResolvedValue({ data: [], total: 0 });
    await render(<PlacesScreen />);
    expect(shown()).toContain('Places are on their way');
  });

  it('opens a place and the day routes', async () => {
    list.mockResolvedValue({ data: [place('a')], total: 1 });
    await render(<PlacesScreen />);
    await press('place-row-a');
    expect(router.push).toHaveBeenCalledWith('/trail/places/a');
    await press('places-routes');
    expect(router.push).toHaveBeenCalledWith('/trail/places/routes');
  });
});

describe('A place', () => {
  const detail = {
    ...place('w1', { kind: 'waterfall' as const, name_en: 'Gveleti Waterfall', elevation_m: 1580 }),
    osm_type: 'node' as const,
    osm_id: 42,
    wikidata: null,
    wikipedia: 'en:Gveleti Waterfall',
    tags: { fee: 'no' },
    nearby_trails: [{ id: 't1', name_en: 'Gveleti Waterfall Trail', region: 'Kazbegi', difficulty: 'easy', distance_km: 0.6 }],
    nearby_places: [place('l2', { name_en: 'Truso Lakes' })],
  };

  it('shows where it is, the way there, its weather for photos, and what is around it', async () => {
    mockParams.id = 'w1';
    get.mockResolvedValue(detail);
    getForecast.mockResolvedValue(forecast());
    await render(<PlaceScreen />);
    expect(get).toHaveBeenCalledWith('w1');
    expect(getForecast).toHaveBeenCalledWith({ latitude: 42.5, longitude: 44.6, elevationM: 1580 });
    const text = shown();
    expect(text).toEqual(expect.arrayContaining(['Gveleti Waterfall', 'Waterfall · Kazbegi', '1,580 m', 'Free', 'Directions to Gveleti Waterfall']));
    expect(text).toEqual(expect.arrayContaining(['Trails nearby', 'Gveleti Waterfall Trail', '600 m from here', 'Nearby places', 'Truso Lakes']));
    // A waterfall's weather opens on photography
    expect(text.some((t) => t.startsWith('Golden hour'))).toBe(true);
    await press('place-trail-t1');
    expect(router.push).toHaveBeenCalledWith('/trail/t1');
  });

  it('opens Wikipedia and OpenStreetMap', async () => {
    mockParams.id = 'w1';
    get.mockResolvedValue(detail);
    getForecast.mockResolvedValue(forecast());
    const openURL = jest.spyOn(Linking, 'openURL').mockReset().mockResolvedValue(true);
    await render(<PlaceScreen />);
    // Each link once (a touchable and its inner view share the handler)
    const presses = [
      ...new Set(
        renderer!.root
          .findAll((n) => n.props.accessibilityRole === 'link' && typeof n.props.onPress === 'function')
          .map((n) => n.props.onPress as () => void),
      ),
    ];
    expect(presses).toHaveLength(2);
    await act(async () => presses[0]());
    await act(async () => presses[1]());
    expect(openURL).toHaveBeenCalledWith('https://en.wikipedia.org/wiki/Gveleti_Waterfall');
    expect(openURL).toHaveBeenCalledWith('https://www.openstreetmap.org/node/42');
  });

  it('says so when the place is gone', async () => {
    mockParams.id = 'gone';
    get.mockRejectedValue(Object.assign(new Error('Not found'), { response: { status: 404 } }));
    await render(<PlaceScreen />);
    expect(shown()).toContain('This place is not on Kvali');
  });
});

describe('Day routes', () => {
  const imereti = [
    place('c', { kind: 'canyon', name_en: 'Martvili Canyon', latitude: 42.457, longitude: 42.377, elevation_m: 200, notability: 9, region: 'Imereti' }),
    place('o', { kind: 'canyon', name_en: 'Okatse Canyon', latitude: 42.455, longitude: 42.548, elevation_m: 600, notability: 8, region: 'Imereti' }),
    place('k', { kind: 'waterfall', name_en: 'Kinchkha Waterfall', latitude: 42.494, longitude: 42.552, elevation_m: 700, notability: 6, region: 'Imereti' }),
    place('p', { kind: 'cave', name_en: 'Prometheus Cave', latitude: 42.376, longitude: 42.601, elevation_m: 150, notability: 7, region: 'Imereti' }),
  ];

  it('plans a day through a region\'s sights and opens it in Google Maps', async () => {
    list.mockResolvedValue({ data: imereti, total: 4 });
    const openURL = jest.spyOn(Linking, 'openURL').mockReset().mockResolvedValue(true);
    await render(<DayRoutesScreen />);
    expect(list).toHaveBeenCalledWith({ region: 'Imereti', limit: 200 });
    const text = shown();
    expect(text).toEqual(expect.arrayContaining(['Martvili Canyon', 'Okatse Canyon', 'Kinchkha Waterfall', 'Prometheus Cave']));
    expect(text).toContain('Two canyons, a cave and a waterfall');
    const map = shown().find((t) => t.startsWith('1. '))!;
    expect(map.split(' | ')).toHaveLength(4);
    await press('route-open-maps');
    expect(openURL).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=.+&waypoints=.+&travelmode=driving$/));
  });

  it('switches region, and says when a region has no day route', async () => {
    list.mockResolvedValueOnce({ data: imereti, total: 4 }).mockResolvedValue({ data: [place('x', { kind: 'peak' })], total: 1 });
    await render(<DayRoutesScreen />);
    await press('routes-region-Tusheti');
    await flush();
    expect(list).toHaveBeenLastCalledWith({ region: 'Tusheti', limit: 200 });
    expect(shown()).toContain('No day route for Tusheti yet');
  });
});
