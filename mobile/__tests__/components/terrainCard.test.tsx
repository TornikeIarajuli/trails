/** The terrain card on the trail screen: one row per fact, bars for grades and mixed ground. */
jest.mock('../../components/ui/Icon', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { Icon: ({ name }: { name: string }) => React.createElement(Text, { testID: `icon-${name}` }) };
});

import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { TerrainCard } from '../../components/trail/TerrainCard';
import type { TrailTerrain } from '../../types/trail';

function deepText(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(deepText).join('');
}

function render(terrain: TrailTerrain) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<TerrainCard terrain={terrain} />);
  });
  return renderer;
}

const juta: TrailTerrain = {
  source: 'osm',
  fetched_at: '2026-11-13',
  coverage: 1,
  max_sac: 'T3',
  sac_km: { T1: 11.8, T2: 4.4, T3: 3.6 },
  surfaces_km: { ground: 13.8 },
  fords: 24,
  water_points: 3,
  shelters: 4,
};

it('shows the grade, ground, river crossings, water and huts, and where it comes from', () => {
  const renderer = render(juta);
  const shown = renderer.root.findAllByType(Text).map(deepText);
  expect(shown).toEqual(
    expect.arrayContaining([
      'Terrain',
      'Demanding mountain path (T3)',
      'Mostly dirt path',
      '24 river crossings without a bridge',
      'Deeper after rain and snowmelt. River shoes help.',
      '3 springs or taps near the route',
      '4 huts or shelters near the route',
      'From OpenStreetMap, 13 November 2026.',
    ]),
  );
  // One river-crossing row a screen reader can read in one go
  const fords = renderer.root.findAll((n) => n.props.testID === 'terrain-fords' && n.props.accessible)[0];
  expect(fords.props.accessibilityLabel).toBe('24 river crossings without a bridge. Deeper after rain and snowmelt. River shoes help.');
});

it('draws a bar of km per grade when the route has more than one', () => {
  const renderer = render(juta);
  const grade = renderer.root.findAll((n) => n.props.testID === 'terrain-grade' && typeof n.type === 'string')[0];
  const segments = grade.findAll((n) => typeof n.type === 'string' && n.props.style && typeof n.props.style.flex === 'number' && n.props.style.backgroundColor);
  expect(segments.map((s) => s.props.style.backgroundColor)).toEqual(['#66BB6A', '#9CCC65', '#FFCA28']);
});
