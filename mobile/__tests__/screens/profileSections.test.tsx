jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn() } }));
jest.mock('../../hooks/useRegionProgress', () => ({
  useRegionProgress: () => ({ data: { totals: { regions_started: 4, regions_total: 15 } } }),
}));
const mockCompletions: { data: unknown[] | undefined; isLoading: boolean } = { data: [], isLoading: false };
jest.mock('../../hooks/useCompletions', () => ({
  useMyCompletions: () => mockCompletions,
  useDeleteCompletion: () => ({ mutate: jest.fn() }),
}));

import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { router } from 'expo-router';
import { HikingSummary } from '../../components/profile/HikingSummary';
import { CompletionsSection } from '../../components/profile/CompletionsSection';

function render(el: React.ReactElement) {
  let r!: ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(el);
  });
  return r;
}

const texts = (r: ReactTestRenderer) =>
  r.root.findAllByType(Text).map((t) => [t.props.children].flat().join(''));

describe('HikingSummary', () => {
  it('shows the difficulty split and the way into My Georgia', () => {
    const r = render(<HikingSummary stats={{ total: 7, easy: 1, medium: 3, hard: 3, ultra: 0 } as never} />);
    const shown = texts(r).join(' | ');
    expect(shown).toContain('My hiking');
    const bar = r.root.findAll((n) => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.includes('easy'))[0];
    expect(bar.props.accessibilityLabel).toBe('1 easy, 3 medium, 3 hard, 0 ultra');
    expect(shown).toContain('4 of 15 regions');
  });
});

describe('CompletionsSection', () => {
  it('invites a first hike when there are none', () => {
    mockCompletions.data = [];
    const r = render(<CompletionsSection />);
    expect(texts(r)).toEqual(expect.arrayContaining(['No hikes yet', 'Explore trails']));
  });

  it('lists hikes with a menu instead of a delete button on every row', () => {
    mockCompletions.data = [
      { id: 'c1', trail_id: 't1', status: 'approved', source: 'hike', completed_at: '2026-11-13T10:00:00Z', trails: { name_en: 'Gergeti Trinity', difficulty: 'easy' } },
    ];
    const r = render(<CompletionsSection />);
    expect(texts(r)).toContain('Gergeti Trinity');
    const menu = r.root.findAll((n) => n.props.accessibilityLabel === 'More options for Gergeti Trinity');
    expect(menu.length).toBeGreaterThan(0);
    act(() => {
      menu[0].props.onPress();
    });
    expect(texts(r)).toEqual(expect.arrayContaining(['Open trail', 'Remove from my trails']));
    expect(router.push).not.toHaveBeenCalled();
  });
});
