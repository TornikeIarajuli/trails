jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

import React from 'react';
import TestRenderer, { act, ReactTestRenderer } from 'react-test-renderer';

function render(el: React.ReactElement) {
  let r!: ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(el);
  });
  return r;
}
import { Icon, resolveIcon } from '../../components/ui/Icon';
import { requiredSketchyNames, splitIoniconName } from '../../components/ui/iconMap';
import { SKETCHY_PATHS } from '../../components/ui/icons/sketchyPaths';

describe('Icon', () => {
  it('has a drawing for every name the map can produce', () => {
    const missing = requiredSketchyNames().filter((n) => !(n in SKETCHY_PATHS));
    expect(missing).toEqual([]);
  });

  it('maps Ionicons names, outline and filled, to the same drawing', () => {
    const outline = resolveIcon('heart-outline');
    const filled = resolveIcon('heart');
    expect(outline?.paths).toBe(filled?.paths);
    expect(outline?.filled).toBe(false);
    expect(filled?.filled).toBe(true);
    expect(resolveIcon('arrow-back')?.paths).toBe(SKETCHY_PATHS['arrow-left']);
    expect(resolveIcon('footsteps-outline')?.paths).toBe(SKETCHY_PATHS.footprints);
  });

  it('only paints in shapes whose filled state means something', () => {
    expect(resolveIcon('compass')?.filled).toBe(false);
    expect(resolveIcon('checkmark')?.filled).toBe(false);
    expect(resolveIcon('star')?.filled).toBe(true);
  });

  it('accepts Sketchy names directly, including the Svaneti tower', () => {
    expect(resolveIcon('svaneti-tower')?.paths.length).toBeGreaterThan(3);
    expect(resolveIcon('mountain-snow')?.paths).toBe(SKETCHY_PATHS['mountain-snow']);
  });

  it('falls back to Ionicons for names without a drawing', () => {
    expect(resolveIcon('logo-github')).toBeNull();
    expect(() => render(<Icon name="logo-github" size={20} color="#123" />)).not.toThrow();
  });

  it('renders a drawing at the requested size', () => {
    const r = render(<Icon name="compass-outline" size={22} color="#123456" testID="ic" />);
    expect(JSON.stringify(r.toJSON())).toContain('22');
  });

  it('splits Ionicons names', () => {
    expect(splitIoniconName('bag-handle-outline')).toEqual({ base: 'bag-handle', outline: true, sharp: false });
    expect(splitIoniconName('trophy')).toEqual({ base: 'trophy', outline: false, sharp: false });
  });
});
