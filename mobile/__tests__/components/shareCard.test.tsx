/**
 * The share picture itself: it draws the trail, the date, the numbers and the route (or
 * mountains when there is no route), at story proportions.
 */
jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: { cache: 'cache' } }));

import React from 'react';
import TestRenderer, { act, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { ShareCard } from '../../components/completion/ShareCard';

function render(route: { lat: number; lng: number }[]) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <ShareCard
        width={270}
        data={{
          trailName: 'Juta to Roshka via Chaukhi Pass',
          subtitle: 'Kazbegi · 14 November 2026',
          stats: [
            { value: '12 km', label: 'Distance' },
            { value: '1,210 m', label: 'Ascent' },
          ],
          route,
        }}
      />,
    );
  });
  return renderer;
}

/** Every string drawn in the picture (react-native-svg puts text in its TSpans' content). */
function texts(root: ReactTestInstance): string[] {
  return root.findAll((n) => typeof n.type === 'string' && typeof n.props.content === 'string').map((n) => n.props.content as string);
}

it('draws the trail, the date and the numbers', () => {
  const drawn = texts(render([]).root).join('|');
  expect(drawn).toContain('Juta to Roshka|via Chaukhi Pass');
  expect(drawn).toContain('Kazbegi · 14 November 2026');
  expect(drawn).toContain('12 km');
  expect(drawn).toContain('ASCENT');
  expect(drawn).toContain('MIKIRI TRAILS');
});

it('is story-shaped, and draws the route when there is one', () => {
  const renderer = render([
    { lat: 42.0, lng: 44.0 },
    { lat: 42.01, lng: 44.02 },
  ]);
  const svg = renderer.root.findAll((n) => typeof n.type !== 'string' && n.props.viewBox === '0 0 1080 1920')[0];
  expect(svg.props.width).toBe(270);
  expect(svg.props.height).toBe(480);
  const paths = renderer.root.findAll((n) => n.type === 'RNSVGPath' && n.props.strokeWidth === 12);
  expect(paths.length).toBe(1);
});
