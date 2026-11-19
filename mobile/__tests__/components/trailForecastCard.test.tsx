/** The hiking weather card on the trail screen: a verdict per day, the reason, the window, the sun. */
jest.mock('../../components/ui/Icon', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { Icon: ({ name }: { name: string }) => React.createElement(Text, { testID: `icon-${name}` }) };
});
const mockForecast: { data: unknown } = { data: undefined };
jest.mock('../../hooks/useTrailForecast', () => ({
  useTrailForecast: () => ({ data: mockForecast.data, point: { latitude: 42.5, longitude: 44.7, elevationM: 2400, atTop: true } }),
}));
jest.mock('../../hooks/useWeather', () => ({
  useWeather: () => ({ data: { temperature: 9.4, windspeed: 10, weathercode: 2, is_day: true } }),
}));

import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { TrailForecastCard } from '../../components/trail/TrailForecastCard';
import type { HourForecast, MountainForecast } from '../../services/forecast';
import type { TrailDetail } from '../../types/trail';

function deepText(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(deepText).join('');
}

const hourOn = (date: string, h: number, extra: Partial<HourForecast> = {}): HourForecast => ({
  time: `${date}T${String(h).padStart(2, '0')}:00`,
  tempC: 4,
  feelsC: 2,
  precipMm: 0,
  precipProbability: 0,
  snowCm: 0,
  weathercode: 1,
  visibilityM: 30000,
  windKmh: 8,
  gustKmh: 20,
  freezingLevelM: 3500,
  ...extra,
});
const DATES = ['2026-11-21', '2026-11-22', '2026-11-23'];

function forecast(fetchedAt: number): MountainForecast {
  return {
    fetchedAt,
    elevationM: 2400,
    utcOffsetSeconds: 4 * 3600,
    current: { time: '2026-11-21T10:00', tempC: 3.6, feelsC: -1.2, weathercode: 1, windKmh: 8, gustKmh: 20 },
    days: DATES.map((date) => ({
      date,
      sunrise: `${date}T07:00`,
      sunset: `${date}T18:00`,
      daylightSeconds: 39600,
      uvMax: 2.4,
      tempMaxC: 6,
      tempMinC: -2,
    })),
    hours: [
      // Today: storms from 14:00. Tomorrow: a gale. The day after: fine.
      ...Array.from({ length: 24 }, (_, h) => hourOn(DATES[0], h, h >= 14 ? { weathercode: 95 } : h === 7 ? { tempC: -2 } : {})),
      ...Array.from({ length: 24 }, (_, h) => hourOn(DATES[1], h, h === 12 ? { gustKmh: 88 } : {})),
      ...Array.from({ length: 24 }, (_, h) => hourOn(DATES[2], h)),
    ],
  };
}

const trail = {
  id: 't1',
  estimated_hours: 4,
  distance_km: 10,
  elevation_gain_m: 700,
  start_point: { type: 'Point', coordinates: [44.7, 42.5] },
} as unknown as TrailDetail;

let renderer: ReactTestRenderer;
const shown = () => renderer.root.findAllByType(Text).map(deepText);
const press = (id: string) => act(() => renderer.root.findAll((n) => n.props.testID === id && n.props.onPress)[0].props.onPress());

function render(nowUtc: string, fetchedAtUtc = nowUtc) {
  jest.setSystemTime(new Date(nowUtc));
  mockForecast.data = forecast(Date.parse(fetchedAtUtc));
  act(() => {
    renderer = TestRenderer.create(<TrailForecastCard trail={trail} ready />);
  });
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  act(() => renderer?.unmount());
  jest.useRealTimers();
});

it('opens on today: the verdict, why, the best window and the sun', () => {
  render('2026-11-21T06:00:00Z'); // 10:00 at the trail
  const text = shown();
  expect(text).toEqual(expect.arrayContaining(['at 2,400 m', 'Today', 'Tomorrow', 'Mon']));
  expect(text).toEqual(expect.arrayContaining(['Go early', 'Thunderstorms likely from 14:00', 'Best window 07:00–14:00']));
  expect(text).toEqual(expect.arrayContaining(['07:00', '18:00', '11 h 0 min', '-2° to 4°', 'UV 2']));
  expect(text).toContain('Now at the top: 4° (feels -1°) · at the start: 9°, partly cloudy');
});

it('shows another day when its chip is tapped', () => {
  render('2026-11-21T06:00:00Z');
  press('forecast-day-1');
  expect(shown()).toEqual(expect.arrayContaining(['Skip', 'Gusts up to 88 km/h at the top 12:00–13:00']));
  expect(shown().some((t) => t.startsWith('Now at the top'))).toBe(false);
});

it('opens on tomorrow after 2 pm, when people are planning the next day', () => {
  render('2026-11-21T11:00:00Z'); // 15:00 at the trail
  expect(shown()).toContain('Gusts up to 88 km/h at the top 12:00–13:00');
});

it('says when a saved forecast is from, and gives no "now" from it', () => {
  render('2026-11-21T06:00:00Z', '2026-11-21T03:30:00Z');
  const source = shown().find((t) => t.startsWith('Open-Meteo forecast'))!;
  expect(source).toMatch(/for the highest point, updated \d{2}:\d{2}\. Mountain weather changes fast/);
  expect(shown().some((t) => t.startsWith('Now at the top'))).toBe(false);
});

it('warns when a hike started now would end after sunset', () => {
  render('2026-11-21T06:00:00Z');
  expect(shown()).not.toContain('Starting now, you would finish after sunset (18:00).');
  act(() => renderer.unmount());
  render('2026-11-21T10:30:00Z'); // 14:30 + 4 h: after sunset. After 2 pm, so tap back to today
  press('forecast-day-0');
  expect(shown()).toContain('Starting now, you would finish after sunset (18:00).');
});
