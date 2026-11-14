/**
 * Settings → Appearance: the theme cards, and picking one applying it at once.
 */
jest.mock('../../utils/haptics', () => ({
  haptics: { tap: jest.fn(), select: jest.fn(), success: jest.fn(), warning: jest.fn() },
}));
jest.mock('../../components/ui/Icon', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { Icon: ({ name }: { name: string }) => React.createElement(Text, { testID: `icon-${name}` }) };
});

import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { ThemePicker } from '../../components/settings/ThemePicker';
import { useSettingsStore } from '../../store/settingsStore';
import { THEMES } from '../../constants/themes';
import { haptics } from '../../utils/haptics';

let renderer: ReactTestRenderer | null = null;

const option = (id: string): ReactTestInstance =>
  renderer!.root.findAll((n) => n.props.testID === `theme-${id}` && typeof n.props.onPress === 'function')[0];
const checked = (id: string) => !!option(id).props.accessibilityState?.checked;
const names = () =>
  renderer!.root
    .findAllByType(Text)
    .map((t) => ([] as unknown[]).concat(t.props.children).filter((c) => typeof c === 'string').join(''))
    .filter(Boolean);

function render() {
  act(() => {
    renderer = TestRenderer.create(<ThemePicker />);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState({ theme: 'slate', isDarkMode: false });
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

describe('ThemePicker', () => {
  it('offers Automatic and the six themes by name', () => {
    render();
    expect(names()).toEqual(
      expect.arrayContaining(['Automatic', 'Slate', 'Forest', 'Glacier', 'Kakheti', 'Night', 'Midnight']),
    );
    for (const id of ['auto', 'slate', 'forest', 'glacier', 'kakheti', 'night', 'midnight']) {
      expect(option(id)).toBeDefined();
    }
  });

  it('checks the theme in use, and only that one', () => {
    useSettingsStore.setState({ theme: 'glacier' });
    render();
    expect(checked('glacier')).toBe(true);
    expect(['auto', 'slate', 'forest', 'kakheti', 'night', 'midnight'].some(checked)).toBe(false);
    const checks = renderer!.root.findAll(
      (n) => n.props.testID === 'icon-checkmark-circle' && typeof n.type === 'string',
    );
    expect(checks).toHaveLength(1);
  });

  it('applies a theme as soon as it is picked, with a tick of feedback', () => {
    render();
    act(() => option('kakheti').props.onPress());
    expect(useSettingsStore.getState().theme).toBe('kakheti');
    expect(haptics.select).toHaveBeenCalledTimes(1);
    expect(checked('kakheti')).toBe(true);
    expect(checked('slate')).toBe(false);
    // The picker itself is now drawn in the new theme
    expect(option('kakheti').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ borderColor: THEMES.kakheti.colors.primary })]),
    );
  });

  it('can pick Automatic', () => {
    render();
    act(() => option('auto').props.onPress());
    expect(useSettingsStore.getState().theme).toBe('auto');
    expect(checked('auto')).toBe(true);
  });

  it('does nothing when the current theme is picked again', () => {
    render();
    act(() => option('slate').props.onPress());
    expect(haptics.select).not.toHaveBeenCalled();
  });

  it('labels dark themes for screen readers', () => {
    render();
    expect(option('midnight').props.accessibilityLabel).toBe('Midnight theme, dark');
    expect(option('forest').props.accessibilityLabel).toBe('Forest theme');
  });
});
