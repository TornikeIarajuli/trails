/** Weather where you stand: asks for location, rounds it, and shows the forecast and places around. */
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  Stack: { Screen: () => null },
  router: { back: jest.fn(), push: jest.fn() },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../../utils/haptics', () => ({ haptics: { tap: jest.fn(), select: jest.fn() } }));
jest.mock('../../components/ui/Icon', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { Icon: ({ name }: { name: string }) => React.createElement(Text, { testID: `icon-${name}` }) };
});
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));
jest.mock('../../services/api', () => ({ __esModule: true, default: {} }));
jest.mock('@react-native-community/netinfo', () => require('@react-native-community/netinfo/jest/netinfo-mock'));
jest.mock('../../services/places', () => ({ placesService: { list: jest.fn(), get: jest.fn() } }));
jest.mock('../../services/forecast', () => ({
  ...jest.requireActual('../../services/forecast'),
  forecastService: { getMountainForecast: jest.fn() },
}));

import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Location from 'expo-location';
import WeatherHereScreen from '../../app/trail/weather-here';
import { placesService } from '../../services/places';
import { forecastService, MountainForecast } from '../../services/forecast';

const location = Location as unknown as Record<string, jest.Mock>;
const list = placesService.list as jest.Mock;
const getForecast = forecastService.getMountainForecast as jest.Mock;
let renderer: ReactTestRenderer | null = null;

function deepText(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(deepText).join('');
}
const shown = () => renderer!.root.findAllByType(Text).map(deepText);

async function flush() {
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function render() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    renderer = TestRenderer.create(
      <QueryClientProvider client={client}>
        <WeatherHereScreen />
      </QueryClientProvider>,
    );
  });
  await flush();
}

const localDate = (days: number) => new Date(Date.now() + 4 * 3_600_000 + days * 86_400_000).toISOString().slice(0, 10);

function forecast(): MountainForecast {
  const dates = [localDate(0), localDate(1)];
  return {
    fetchedAt: Date.now(),
    elevationM: 1740,
    utcOffsetSeconds: 4 * 3600,
    current: { time: `${dates[0]}T10:00`, tempC: 3.4, feelsC: 0.6, weathercode: 3, windKmh: 11.6, gustKmh: 25 },
    days: dates.map((date) => ({ date, sunrise: `${date}T07:58`, sunset: `${date}T17:35`, daylightSeconds: 34600, uvMax: 2, tempMaxC: 6, tempMinC: -2 })),
    hours: dates.flatMap((date) =>
      Array.from({ length: 24 }, (_, h) => ({
        time: `${date}T${String(h).padStart(2, '0')}:00`,
        tempC: 3,
        feelsC: 1,
        precipMm: 0,
        precipProbability: 0,
        snowCm: 0,
        weathercode: 2,
        visibilityM: 30000,
        windKmh: 8,
        gustKmh: 15,
        freezingLevelM: 2600,
        cloudCover: 30,
        pressureHpa: 820,
      })),
    ),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
  location.getLastKnownPositionAsync.mockResolvedValue(null);
  location.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 42.65731, longitude: 44.64212 }, timestamp: 0 });
  location.reverseGeocodeAsync.mockResolvedValue([{ city: 'Stepantsminda' }]);
  getForecast.mockResolvedValue(forecast());
  list.mockResolvedValue({
    data: [
      {
        id: 'g1',
        kind: 'monastery',
        name_en: 'Gergeti Trinity Church',
        name_ka: null,
        latitude: 42.662,
        longitude: 44.62,
        elevation_m: 2170,
        region: 'Kazbegi',
        notability: 9,
        distance_km: 2.3,
      },
    ],
    total: 1,
  });
});
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

it('shows the weather where you are, from rounded coordinates, and the places around', async () => {
  await render();
  expect(getForecast).toHaveBeenCalledWith({ latitude: 42.657, longitude: 44.642, elevationM: null });
  expect(list).toHaveBeenCalledWith(expect.objectContaining({ near: { latitude: 42.657, longitude: 44.642 }, radiusKm: 30, limit: 6 }));
  const text = shown();
  expect(text).toEqual(expect.arrayContaining(['Stepantsminda', 'Weather here', 'at 1,740 m', 'Places near you', 'Gergeti Trinity Church', '2.3 km']));
  expect(text.some((t) => t.startsWith('42.65700° N, 44.64200° E'))).toBe(true);
});

it('uses a recent fix without waiting for the GPS', async () => {
  location.getLastKnownPositionAsync.mockResolvedValue({ coords: { latitude: 41.7151, longitude: 44.8271 }, timestamp: 0 });
  await render();
  expect(location.getCurrentPositionAsync).not.toHaveBeenCalled();
  expect(getForecast).toHaveBeenCalledWith({ latitude: 41.715, longitude: 44.827, elevationM: null });
});

it('asks again when location is not allowed', async () => {
  location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
  await render();
  expect(shown()).toContain('Location is off for Kvali');
  expect(getForecast).not.toHaveBeenCalled();
  await act(async () => {
    renderer!.root.findAll((n) => n.props.testID === 'weather-here-retry' && typeof n.props.onPress === 'function')[0].props.onPress();
  });
  await flush();
  expect(location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(2);
});

it('says when the phone could not find where it is', async () => {
  location.getCurrentPositionAsync.mockRejectedValue(new Error('Location services are disabled'));
  await render();
  expect(shown()).toContain("Couldn't find where you are");
});
