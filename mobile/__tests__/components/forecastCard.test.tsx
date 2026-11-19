/** The forecast card for any place: the activity picker, the day hour by hour, the night sky. */
jest.mock('../../components/ui/Icon', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { Icon: ({ name }: { name: string }) => React.createElement(Text, { testID: `icon-${name}` }) };
});

import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { ForecastCard } from '../../components/weather/ForecastCard';
import type { Activity } from '../../utils/activities';
import type { HourForecast, MountainForecast } from '../../services/forecast';

function deepText(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(deepText).join('');
}

const DATES = ['2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'];
const NOW = '2026-11-20T06:00:00Z'; // 10:00 at the place

function forecast(): MountainForecast {
  return {
    fetchedAt: Date.parse(NOW),
    elevationM: 1700,
    utcOffsetSeconds: 4 * 3600,
    current: { time: '2026-11-20T10:00', tempC: 5, feelsC: 2, weathercode: 2, windKmh: 9, gustKmh: 18 },
    days: DATES.map((date) => ({
      date,
      sunrise: `${date}T07:58`,
      sunset: `${date}T17:35`,
      daylightSeconds: 34600,
      uvMax: 2,
      tempMaxC: 8,
      tempMinC: -1,
    })),
    hours: DATES.flatMap((date) =>
      Array.from(
        { length: 24 },
        (_, h): HourForecast => ({
          time: `${date}T${String(h).padStart(2, '0')}:00`,
          tempC: 4,
          feelsC: 2,
          precipMm: 0,
          precipProbability: h === 15 ? 40 : 0,
          snowCm: 0,
          weathercode: 2,
          visibilityM: 30000,
          windKmh: 8,
          gustKmh: 16,
          freezingLevelM: 2900,
          cloudCover: 40,
          pressureHpa: 830,
        }),
      ),
    ),
  };
}

let renderer: ReactTestRenderer;
const shown = () => renderer.root.findAllByType(Text).map(deepText);
const byTest = (id: string) => renderer.root.findAll((n) => n.props.testID === id && n.props.onPress);
const press = (id: string) => act(() => byTest(id)[0].props.onPress());
// The first match: a component and its native view both carry the testID
const first = (id: string) => renderer.root.findAll((n) => n.props.testID === id)[0];

function render(props: { activities?: Activity[]; defaultActivity?: Activity } = {}) {
  act(() => {
    renderer = TestRenderer.create(
      <ForecastCard
        forecast={forecast()}
        latitude={42.66}
        longitude={44.64}
        where="at 1,700 m"
        title="Weather"
        nowLine="Now: 5° (feels 2°)"
        sourcePlace="Gergeti"
        tempLabel="Temperature"
        {...props}
      />,
    );
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(NOW));
});
afterEach(() => {
  act(() => renderer?.unmount());
  jest.useRealTimers();
});

it('opens on hiking and switches to another activity', () => {
  render();
  expect(shown()).toEqual(expect.arrayContaining(['Weather', 'at 1,700 m', 'Hiking', 'Camping', 'Stars', 'Climbing']));
  expect(shown()).toContain('Now: 5° (feels 2°)');
  press('activity-camping');
  expect(shown()).toContain('Calm, dry night, low 4°');
  expect(shown()).toEqual(expect.arrayContaining(['Night low', '4°', 'Wind tonight']));
});

it('opens on the place\'s own activity and offers only those given', () => {
  render({ activities: ['photography', 'hiking', 'stargazing'], defaultActivity: 'photography' });
  expect(byTest('activity-fishing')).toHaveLength(0);
  expect(byTest('activity-stargazing')).not.toHaveLength(0);
  expect(shown().some((t) => /^Golden hour \d{2}:\d{2}–\d{2}:\d{2}: good chance of colour in the clouds$/.test(t))).toBe(true);
  expect(shown()).toEqual(expect.arrayContaining(['Golden morning', 'Golden evening', 'Blue hour']));
});

it('shows today hour by hour from now, and another day from 06:00', () => {
  render();
  const strip = () => first('forecast-hours');
  const hours = () => strip().findAllByType(Text).map(deepText).filter((t) => /^\d{2}$/.test(t));
  expect(hours()).toHaveLength(24);
  expect(hours()[0]).toBe('10');
  expect(strip().findAllByType(Text).map(deepText)).toContain('40%');
  press('forecast-day-1');
  expect(hours()[0]).toBe('06');
  expect(hours()[hours().length - 1]).toBe('21');
});

it('gives the moon and how good the night is for stars', () => {
  render();
  const sky = first('forecast-sky').findAllByType(Text).map(deepText).filter(Boolean)[0];
  expect(sky).toMatch(/^(New moon|Waxing crescent|First quarter|Waxing gibbous|Full moon|Waning gibbous|Last quarter|Waning crescent) \(\d+%\) · (Great|Good|So-so|Poor) night for stars/);
});

it('names its source and says to check again', () => {
  render();
  expect(shown()).toContain('Open-Meteo forecast for Gergeti. Mountain weather changes fast: check again before you go.');
});
