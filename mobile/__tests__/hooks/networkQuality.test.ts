jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: jest.fn() },
}));

import { toNetworkQuality } from '../../hooks/useNetworkStatus';

describe('toNetworkQuality', () => {
  it('is online on a working connection', () => {
    expect(toNetworkQuality({ isConnected: true, isInternetReachable: true, type: 'wifi', details: {} })).toBe('online');
  });

  it('is online while reachability has not been probed yet', () => {
    expect(toNetworkQuality({ isConnected: true, isInternetReachable: null, type: 'wifi', details: {} })).toBe('online');
    expect(toNetworkQuality({ isConnected: null, isInternetReachable: null, type: 'unknown', details: null })).toBe('online');
  });

  it('is offline without a connection', () => {
    expect(toNetworkQuality({ isConnected: false, isInternetReachable: false, type: 'none', details: null })).toBe('offline');
  });

  it('is offline on a network that does not reach the internet', () => {
    expect(toNetworkQuality({ isConnected: true, isInternetReachable: false, type: 'wifi', details: {} })).toBe('offline');
  });

  it('is poor on 2G and 3G', () => {
    for (const cellularGeneration of ['2g', '3g']) {
      expect(
        toNetworkQuality({ isConnected: true, isInternetReachable: true, type: 'cellular', details: { cellularGeneration } }),
      ).toBe('poor');
    }
  });

  it('is online on 4G and 5G', () => {
    for (const cellularGeneration of ['4g', '5g', null]) {
      expect(
        toNetworkQuality({ isConnected: true, isInternetReachable: true, type: 'cellular', details: { cellularGeneration } }),
      ).toBe('online');
    }
  });

  it('offline wins over a slow cellular connection', () => {
    expect(
      toNetworkQuality({
        isConnected: true,
        isInternetReachable: false,
        type: 'cellular',
        details: { cellularGeneration: '3g' },
      }),
    ).toBe('offline');
  });
});
