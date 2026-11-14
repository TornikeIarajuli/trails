/**
 * The trail screen's topo download row in each of its states.
 */
let mockNetwork: 'online' | 'offline' = 'online';

jest.mock('../../hooks/useNetworkStatus', () => ({ useNetworkStatus: () => mockNetwork }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../../utils/haptics', () => ({
  haptics: { tap: jest.fn(), select: jest.fn(), success: jest.fn(), warning: jest.fn() },
}));
jest.mock('../../services/offlineMaps', () => ({
  readManifest: jest.fn(() => ({ version: 1, trails: {} })),
  saveTrailTopo: jest.fn(),
  removeTrailTopo: jest.fn(() => ({ version: 1, trails: {} })),
  deleteAllOfflineMaps: jest.fn(),
}));

import React from 'react';
import { Alert, Text } from 'react-native';
import TestRenderer, { act, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { TopoDownloadRow, topoDownloadSizeLabel } from '../../components/trail/TopoDownloadRow';
import { useOfflineMapsStore } from '../../store/offlineMapsStore';
import * as service from '../../services/offlineMaps';
import { TilePlan } from '../../utils/topoTiles';

const saveTrailTopo = service.saveTrailTopo as jest.Mock;
const removeTrailTopo = service.removeTrailTopo as jest.Mock;

const plan: TilePlan = {
  tiles: ['10/638/377', '14/10223/6041', '15/20447/12082', '15/20447/12083'],
  minZoom: 10,
  maxZoom: 15,
  droppedZooms: [],
};

let renderer: ReactTestRenderer | null = null;

function textOf(node: ReactTestInstance): string {
  return ([] as unknown[])
    .concat(node.props.children)
    .filter((c) => typeof c === 'string' || typeof c === 'number')
    .join('');
}
const shown = () => (renderer?.toJSON() ? renderer.root.findAllByType(Text).map(textOf) : []);

function render(p: TilePlan = plan) {
  act(() => {
    renderer = TestRenderer.create(<TopoDownloadRow trailId="gergeti" trailName="Gergeti Trinity" plan={p} />);
  });
}

function pressText(label: string) {
  const text = renderer!.root.findAllByType(Text).find((t) => textOf(t) === label);
  if (!text) throw new Error(`no text "${label}" in: ${shown().join(' | ')}`);
  let node: ReactTestInstance | null = text;
  while (node && typeof node.props.onPress !== 'function') node = node.parent;
  // Not awaiting a download the press may start
  act(() => {
    node!.props.onPress();
  });
}

const row = () =>
  renderer!.root.findAll((n) => n.props.testID === 'topo-download-row' && n.props.accessibilityState !== undefined)[0];

beforeEach(() => {
  jest.clearAllMocks();
  saveTrailTopo.mockReset();
  mockNetwork = 'online';
  useOfflineMapsStore.setState({ loaded: false, saved: {}, active: null, failedTrailId: null });
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

describe('TopoDownloadRow', () => {
  it('offers the download with its approximate size', () => {
    render();
    const label = `Download topo map for offline use · ${topoDownloadSizeLabel(plan)}`;
    expect(topoDownloadSizeLabel(plan)).toBe('~0.2 MB');
    expect(shown()).toContain(label);
    expect(row().props.accessibilityState).toEqual({ disabled: false });
  });

  it('starts the download only when tapped', () => {
    saveTrailTopo.mockReturnValue(new Promise(() => {}));
    render();
    expect(saveTrailTopo).not.toHaveBeenCalled();
    pressText(`Download topo map for offline use · ${topoDownloadSizeLabel(plan)}`);
    expect(saveTrailTopo).toHaveBeenCalledWith('gergeti', 'Gergeti Trinity', plan, expect.any(Object));
  });

  it('shows progress with a way to cancel', () => {
    useOfflineMapsStore.setState({ active: { trailId: 'gergeti', done: 1, total: 4 } });
    const cancel = jest.spyOn(useOfflineMapsStore.getState(), 'cancel');
    render();
    expect(shown()).toContain('Downloading topo map… 25%');
    pressText('Cancel');
    expect(cancel).toHaveBeenCalled();
  });

  it('says when the map is saved, and removes it after confirmation', () => {
    useOfflineMapsStore.setState({ loaded: true, saved: { gergeti: { bytes: 150_000, tiles: 4 } } });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    render();
    expect(shown()).toEqual(expect.arrayContaining(['Topo map saved on this phone', 'Remove']));

    pressText('Remove');
    expect(removeTrailTopo).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0][2]!;
    act(() => {
      buttons.find((b) => b.text === 'Remove')!.onPress!();
    });
    expect(removeTrailTopo).toHaveBeenCalledWith('gergeti');
    expect(shown()).toContain(`Download topo map for offline use · ${topoDownloadSizeLabel(plan)}`);
    alert.mockRestore();
  });

  it('is disabled offline, saying why', () => {
    mockNetwork = 'offline';
    render();
    expect(row().props.accessibilityState).toEqual({ disabled: true });
    expect(shown()).toContain('Connect to the internet to download it.');
  });

  it('waits while another trail downloads', () => {
    useOfflineMapsStore.setState({ active: { trailId: 'juta', done: 1, total: 10 } });
    render();
    expect(row().props.accessibilityState).toEqual({ disabled: true });
    expect(shown()).toContain('Another topo map is downloading.');
  });

  it('invites a retry after a download stopped', () => {
    useOfflineMapsStore.setState({ failedTrailId: 'gergeti' });
    render();
    expect(row().props.accessibilityState).toEqual({ disabled: false });
    expect(shown()).toContain('The last download stopped. Check your connection and try again.');
  });

  it('shows nothing when there is nothing to save', () => {
    render({ ...plan, tiles: [], maxZoom: null });
    expect(renderer!.toJSON()).toBeNull();
  });
});
