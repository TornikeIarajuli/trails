/**
 * "Share your hike": the picture goes to the share sheet as a PNG; when it cannot be made the
 * sheet says so, and sharing as text stays one tap away.
 */
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../utils/haptics', () => ({
  haptics: { tap: jest.fn(), select: jest.fn(), success: jest.fn(), warning: jest.fn() },
}));
jest.mock('../../components/ui/Sheet', () => {
  const React = require('react');
  const { View, Text, Pressable } = require('react-native');
  return {
    Sheet: ({ visible, title, children, footer }: { visible: boolean; title: string; children: React.ReactNode; footer?: React.ReactNode }) =>
      visible ? React.createElement(View, null, React.createElement(Text, null, title), children, footer) : null,
    SheetButton: ({ title, onPress, disabled, testID }: { title: string; onPress: () => void; disabled?: boolean; testID?: string }) =>
      React.createElement(Pressable, { onPress: disabled ? undefined : onPress, testID }, React.createElement(Text, null, title)),
  };
});
const mockExportPng = jest.fn();
jest.mock('../../components/completion/ShareCard', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    ShareCard: React.forwardRef(
      ({ data }: { data: { trailName: string } }, ref: React.Ref<{ exportPng: () => Promise<string> }>) => {
        React.useImperativeHandle(ref, () => ({ exportPng: mockExportPng }));
        return React.createElement(Text, null, `Card: ${data.trailName}`);
      },
    ),
  };
});

import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import * as Sharing from 'expo-sharing';
import { ShareHikeSheet } from '../../components/completion/ShareHikeSheet';

const shareAsync = Sharing.shareAsync as jest.Mock;
const data = { trailName: 'Juta to Roshka', subtitle: 'Kazbegi · 14 November 2026', stats: [], route: [] };

let renderer: ReactTestRenderer | null = null;
function deepText(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(deepText).join('');
}
const shown = () => renderer!.root.findAllByType(Text).map(deepText);
const pressable = (id: string) =>
  renderer!.root.findAll((n) => n.props.testID === id && typeof n.props.onPress === 'function')[0];

function render(onShareText = jest.fn(), onClose = jest.fn()) {
  act(() => {
    renderer = TestRenderer.create(<ShareHikeSheet visible onClose={onClose} data={data} onShareText={onShareText} />);
  });
  return { onShareText, onClose };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockExportPng.mockResolvedValue('file:///cache/hike-1.png');
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

it('shows the picture before sharing it', () => {
  render();
  expect(shown()).toEqual(expect.arrayContaining(['Share your hike', 'Card: Juta to Roshka', 'Share picture', 'Share as text']));
});

it('shares the picture as a PNG', async () => {
  render();
  await act(async () => {
    await pressable('share-picture').props.onPress();
  });
  expect(mockExportPng).toHaveBeenCalled();
  expect(shareAsync).toHaveBeenCalledWith('file:///cache/hike-1.png', expect.objectContaining({ mimeType: 'image/png' }));
});

it('says so when the picture cannot be made', async () => {
  mockExportPng.mockRejectedValueOnce(new Error('no toDataURL'));
  render();
  await act(async () => {
    await pressable('share-picture').props.onPress();
  });
  expect(shareAsync).not.toHaveBeenCalled();
  expect(shown().some((t) => t.startsWith("Couldn't make the picture"))).toBe(true);
});

it('still shares as text', () => {
  const { onShareText, onClose } = render();
  act(() => pressable('share-text').props.onPress());
  expect(onClose).toHaveBeenCalled();
  expect(onShareText).toHaveBeenCalled();
});
