/** The map picker on every map: closed it names the map; open, Map, Topo or Satellite. */
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../../utils/haptics', () => ({ haptics: { select: jest.fn(), tap: jest.fn() } }));
const mockNetwork = { status: 'online' };
jest.mock('../../hooks/useNetworkStatus', () => ({ useNetworkStatus: () => mockNetwork.status }));
jest.mock('../../services/offlineMaps', () => ({ topoTileCachePath: () => 'cache/topo' }));

import React from 'react';
import { Platform, Text } from 'react-native';
import TestRenderer, { act, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { MapStylePicker } from '../../components/map/MapStylePicker';
import { mapTypeFor } from '../../components/map/TopoTileLayer';
import { useMapStyle, MapStyleState } from '../../hooks/useMapStyle';
import { MapStyle, useSettingsStore } from '../../store/settingsStore';

function deepText(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(deepText).join('');
}
const pressable = (r: ReactTestRenderer, id: string) =>
  r.root.findAll((n) => n.props.testID === id && typeof n.props.onPress === 'function')[0];

describe('MapStylePicker', () => {
  function render(value: MapStyle, onChange = jest.fn()) {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<MapStylePicker value={value} onChange={onChange} />);
    });
    return { renderer, onChange };
  }

  it('names the map on screen until tapped', () => {
    const { renderer } = render('topo');
    expect(renderer.root.findAllByType(Text).map(deepText)).toEqual(['Topo']);
    expect(pressable(renderer, 'map-style-picker').props.accessibilityLabel).toBe('Map: Topo. Change the map');
  });

  it('opens into the three maps, with the current one selected', () => {
    const { renderer } = render('standard');
    act(() => pressable(renderer, 'map-style-picker').props.onPress());
    expect(renderer.root.findAllByType(Text).map(deepText)).toEqual(['Map', 'Topo', 'Satellite']);
    expect(pressable(renderer, 'map-style-standard').props.accessibilityState).toEqual({ selected: true });
    expect(pressable(renderer, 'map-style-satellite').props.accessibilityState).toEqual({ selected: false });
  });

  it('picks a map and closes again', () => {
    const { renderer, onChange } = render('standard');
    act(() => pressable(renderer, 'map-style-picker').props.onPress());
    act(() => pressable(renderer, 'map-style-satellite').props.onPress());
    expect(onChange).toHaveBeenCalledWith('satellite');
    expect(pressable(renderer, 'map-style-picker')).toBeDefined();
  });
});

describe('mapTypeFor', () => {
  it('shows satellite photos with roads and names, and turns the Android base map off under topo', () => {
    expect(mapTypeFor('satellite')).toBe('hybrid');
    expect(mapTypeFor('standard')).toBe('standard');
    expect(mapTypeFor('topo')).toBe(Platform.OS === 'android' ? 'none' : 'standard');
  });
});

describe('useMapStyle', () => {
  let state: MapStyleState;
  function Probe({ auto }: { auto?: boolean }) {
    state = useMapStyle({ autoTopoWhenOffline: auto });
    return null;
  }

  beforeEach(() => {
    mockNetwork.status = 'online';
    useSettingsStore.setState({ mapStyle: 'satellite' });
  });

  it('shows the saved map and saves a new choice', () => {
    act(() => {
      TestRenderer.create(<Probe />);
    });
    expect(state.style).toBe('satellite');
    act(() => state.setStyle('topo'));
    expect(useSettingsStore.getState().mapStyle).toBe('topo');
  });

  it('switches the hike screen to the saved topo tiles when offline, keeping the choice', () => {
    mockNetwork.status = 'offline';
    act(() => {
      TestRenderer.create(<Probe auto />);
    });
    expect(state).toEqual(expect.objectContaining({ style: 'topo', topo: true, topoBecauseOffline: true, chosen: 'satellite' }));
  });
});
