/**
 * "How was the trail?" after a hike: one tap rates the trail (again to change it), one tap
 * reports its condition, with Undo.
 */
const mockSecureStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockSecureStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecureStore.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecureStore.delete(key);
  }),
}));
jest.mock('../../utils/queryClient', () => ({ queryClient: { clear: jest.fn() } }));
jest.mock('../../utils/haptics', () => ({
  haptics: { tap: jest.fn(), select: jest.fn(), success: jest.fn(), warning: jest.fn() },
}));
jest.mock('../../utils/showError', () => ({ showError: jest.fn(), getErrorMessage: () => 'error' }));
jest.mock('../../components/ui/Icon', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { Icon: ({ name }: { name: string }) => React.createElement(Text, { testID: `icon-${name}` }) };
});
jest.mock('../../store/authStore', () => ({
  useAuthStore: (select: (s: { user: { id: string } }) => unknown) => select({ user: { id: 'me' } }),
}));
jest.mock('../../services/reviews', () => ({
  reviewsService: { getTrailReviews: jest.fn(), submitReview: jest.fn(), updateReview: jest.fn() },
}));
jest.mock('../../services/community', () => ({
  communityService: { reportCondition: jest.fn(), deactivateCondition: jest.fn() },
}));

import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HowWasTheTrail } from '../../components/completion/HowWasTheTrail';
import { reviewsService } from '../../services/reviews';
import { communityService } from '../../services/community';

const getReviews = reviewsService.getTrailReviews as jest.Mock;
const submitReview = reviewsService.submitReview as jest.Mock;
const updateReview = reviewsService.updateReview as jest.Mock;
const reportCondition = communityService.reportCondition as jest.Mock;
const deactivate = communityService.deactivateCondition as jest.Mock;

let renderer: ReactTestRenderer | null = null;

function deepText(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(deepText).join('');
}
const shown = () => (renderer?.toJSON() ? renderer.root.findAllByType(Text).map(deepText) : []);
const pressable = (id: string) =>
  renderer!.root.findAll((n) => n.props.testID === id && typeof n.props.onPress === 'function')[0];
const filledStars = () => renderer!.root.findAll((n) => n.props.testID === 'icon-star' && typeof n.type !== 'string').length;

async function flush() {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setImmediate(resolve));
    });
  }
}

async function render() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  await act(async () => {
    renderer = TestRenderer.create(
      <QueryClientProvider client={client}>
        <HowWasTheTrail trailId="t1" />
      </QueryClientProvider>,
    );
  });
  await flush();
}

async function press(id: string) {
  await act(async () => {
    pressable(id).props.onPress();
  });
  await flush();
}

beforeEach(() => {
  jest.clearAllMocks();
  getReviews.mockResolvedValue([]);
  submitReview.mockResolvedValue({ id: 'r-new', rating: 4 });
  updateReview.mockResolvedValue({ id: 'r-new', rating: 5 });
  reportCondition.mockResolvedValue({ id: 'c-new' });
  deactivate.mockResolvedValue(undefined);
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

it('rates the trail with one tap, and changes the rating with another', async () => {
  await render();

  await press('rate-4');
  expect(submitReview).toHaveBeenCalledWith({ trail_id: 't1', rating: 4 });
  expect(filledStars()).toBe(4);
  expect(shown()).toContain('Thanks! Your rating helps other hikers choose.');

  // The second tap changes the same review instead of writing another
  await press('rate-5');
  expect(submitReview).toHaveBeenCalledTimes(1);
  expect(updateReview).toHaveBeenCalledWith('r-new', { rating: 5, comment: undefined });
});

it('changes the rating of a review written before, keeping its words', async () => {
  getReviews.mockResolvedValue([{ id: 'r-old', trail_id: 't1', user_id: 'me', rating: 3, comment: 'Steep but lovely' }]);
  await render();
  expect(filledStars()).toBe(3);

  await press('rate-5');
  expect(submitReview).not.toHaveBeenCalled();
  expect(updateReview).toHaveBeenCalledWith('r-old', { rating: 5, comment: 'Steep but lovely' });
});

it('reports a condition with one tap, and can take it back', async () => {
  await render();

  await press('condition-muddy');
  expect(reportCondition).toHaveBeenCalledWith({ trail_id: 't1', condition_type: 'muddy', severity: 'warning' });
  expect(shown()).toContain('Muddy: reported for the next hikers');

  await press('condition-undo');
  expect(deactivate).toHaveBeenCalledWith('c-new');
  expect(pressable('condition-snow')).toBeDefined();
});

it('reports a closed trail as dangerous', async () => {
  await render();
  await press('condition-closed');
  expect(reportCondition).toHaveBeenCalledWith(expect.objectContaining({ condition_type: 'closed', severity: 'danger' }));
});
