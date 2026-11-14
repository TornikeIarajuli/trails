/**
 * The Explore search bar with its Filters button and bottom sheet, driven by a small parent
 * that holds the filter state the way the Explore screen does.
 */
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../../utils/haptics', () => ({
  haptics: { tap: jest.fn(), select: jest.fn(), success: jest.fn(), warning: jest.fn() },
}));

import React, { useState } from 'react';
import { ActivityIndicator, Keyboard, Text } from 'react-native';
import TestRenderer, { act, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { TrailFilters } from '../../components/trail/TrailFilters';
import { TrailDifficulty } from '../../types/trail';
import { haptics } from '../../utils/haptics';

const REGIONS = ['Svaneti', 'Tusheti', 'Kakheti'];

let renderer: ReactTestRenderer | null = null;
let searches: string[] = [];

interface HarnessProps {
  difficulty?: TrailDifficulty | null;
  region?: string | null;
  regionNote?: string | null;
  resultCount?: number | null;
  resultsLoading?: boolean;
}

function Harness(props: HarnessProps) {
  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState<TrailDifficulty | null>(props.difficulty ?? null);
  const [region, setRegion] = useState<string | null>(props.region ?? null);
  return (
    <TrailFilters
      search={search}
      onSearchChange={(text) => {
        searches.push(text);
        setSearch(text);
      }}
      difficulty={difficulty}
      onDifficultyChange={setDifficulty}
      region={region}
      onRegionChange={setRegion}
      regions={REGIONS}
      regionNote={props.regionNote}
      onClearAll={() => {
        setDifficulty(null);
        setRegion(null);
      }}
      resultCount={props.resultCount === undefined ? 24 : props.resultCount}
      resultsLoading={props.resultsLoading ?? false}
    />
  );
}

function render(props: HarnessProps = {}) {
  act(() => {
    renderer = TestRenderer.create(<Harness {...props} />);
  });
}

function textOf(node: ReactTestInstance): string {
  return ([] as unknown[])
    .concat(node.props.children)
    .filter((c) => typeof c === 'string' || typeof c === 'number')
    .join('');
}

const shown = () => renderer!.root.findAllByType(Text).map(textOf);

/** The pressable around the text that reads exactly `label`. */
function pressableFor(label: string): ReactTestInstance {
  const text = renderer!.root.findAllByType(Text).find((t) => textOf(t) === label);
  if (!text) throw new Error(`no text "${label}" in: ${shown().join(' | ')}`);
  let node: ReactTestInstance | null = text;
  while (node && typeof node.props.onPress !== 'function') node = node.parent;
  if (!node) throw new Error(`"${label}" is not pressable`);
  return node;
}

function press(label: string) {
  const node = pressableFor(label);
  act(() => node.props.onPress());
}

const byTestId = (id: string) =>
  renderer!.root.findAll((n) => n.props.testID === id && typeof n.props.onPress === 'function')[0];

const filtersButton = () => byTestId('filters-button');
const openSheet = () => act(() => filtersButton().props.onPress());
const sheetOpen = () => shown().includes('Difficulty');
const selected = (label: string) => !!pressableFor(label).props.accessibilityState?.selected;

beforeEach(() => {
  jest.clearAllMocks();
  searches = [];
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

describe('Explore filters', () => {
  it('shows the search bar and a Filters button instead of chip rows', () => {
    render();
    expect(byTestId('filters-button')).toBeDefined();
    expect(filtersButton().props.accessibilityLabel).toBe('Filters');
    // The chips live in the closed sheet, so none are on screen
    expect(shown()).not.toContain('Easy');
    expect(shown()).not.toContain('Svaneti');
    expect(sheetOpen()).toBe(false);
  });

  it('keeps the search working, with its clear button', () => {
    render();
    const input = renderer!.root.findAll((n) => n.props.testID === 'search-input' && typeof n.props.onChangeText === 'function')[0];
    act(() => input.props.onChangeText('Kazbegi'));
    const clear = renderer!.root.findAll((n) => n.props.accessibilityLabel === 'Clear search' && typeof n.props.onPress === 'function')[0];
    act(() => clear.props.onPress());
    expect(searches).toEqual(['Kazbegi', '']);
  });

  it('counts the active filters on the button', () => {
    render({ difficulty: 'hard', region: 'Svaneti' });
    expect(filtersButton().props.accessibilityLabel).toBe('Filters, 2 active');
    expect(shown()).toContain('2');
  });

  it('opens the sheet, dismissing the keyboard', () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss');
    render();
    openSheet();
    expect(sheetOpen()).toBe(true);
    expect(dismiss).toHaveBeenCalled();
    expect(haptics.tap).toHaveBeenCalled();
    expect(shown()).toEqual(expect.arrayContaining(['Any', 'Easy', 'Medium', 'Hard', 'Ultra', 'All regions', ...REGIONS]));
    dismiss.mockRestore();
  });

  it('applies each choice at once and updates the count', () => {
    render();
    openSheet();
    expect(selected('Any')).toBe(true);
    expect(selected('All regions')).toBe(true);

    press('Hard');
    expect(selected('Hard')).toBe(true);
    expect(selected('Any')).toBe(false);
    expect(haptics.select).toHaveBeenCalled();
    expect(filtersButton().props.accessibilityLabel).toBe('Filters, 1 active');

    press('Tusheti');
    expect(selected('Tusheti')).toBe(true);
    expect(filtersButton().props.accessibilityLabel).toBe('Filters, 2 active');

    press('All regions');
    expect(selected('All regions')).toBe(true);
    expect(filtersButton().props.accessibilityLabel).toBe('Filters, 1 active');
  });

  it('clears all filters, and offers that only when some are set', () => {
    render();
    openSheet();
    expect(shown()).not.toContain('Clear all');

    press('Easy');
    press('Kakheti');
    press('Clear all');
    expect(selected('Any')).toBe(true);
    expect(selected('All regions')).toBe(true);
    expect(filtersButton().props.accessibilityLabel).toBe('Filters');
    expect(shown()).not.toContain('Clear all');
  });

  it('closes with a button naming how many trails match', () => {
    render({ resultCount: 24 });
    openSheet();
    press('Show 24 trails');
    expect(sheetOpen()).toBe(false);
  });

  it('says when nothing matches, and still closes', () => {
    render({ resultCount: 0 });
    openSheet();
    press('No trails match');
    expect(sheetOpen()).toBe(false);
  });

  it('shows a spinner instead of a number while results load', () => {
    render({ resultCount: 24, resultsLoading: true });
    openSheet();
    expect(shown()).toContain('Show trails');
    expect(shown()).not.toContain('Show 24 trails');
    expect(renderer!.root.findAllByType(ActivityIndicator).length).toBeGreaterThan(0);
  });

  it('explains why the region does not apply in Near Me, and leaves it out of the count', () => {
    render({ region: 'Svaneti', regionNote: 'Near Me shows trails within 15 km of you, in any region.' });
    expect(filtersButton().props.accessibilityLabel).toBe('Filters');
    openSheet();
    expect(shown()).toContain('Near Me shows trails within 15 km of you, in any region.');
    expect(shown()).not.toContain('All regions');
    expect(shown()).not.toContain('Svaneti');
  });

  it('closes on the Android back button', () => {
    render();
    openSheet();
    const modal = renderer!.root.findAll((n) => typeof n.props.onRequestClose === 'function')[0];
    act(() => modal.props.onRequestClose());
    expect(sheetOpen()).toBe(false);
  });
});
