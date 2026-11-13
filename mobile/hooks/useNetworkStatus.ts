import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

export type NetworkQuality = 'online' | 'poor' | 'offline';

interface NetworkSnapshot {
  isConnected: boolean | null;
  isInternetReachable?: boolean | null;
  type?: string;
  details?: unknown;
}

/**
 * `isInternetReachable` stays null until it has been probed, so only an
 * explicit `false` (connected to a network that leads nowhere) counts as offline.
 */
export function toNetworkQuality(state: NetworkSnapshot): NetworkQuality {
  if (state.isConnected === false || state.isInternetReachable === false) return 'offline';

  // Cellular 2G/3G counts as poor
  if (state.type === 'cellular') {
    const generation = (state.details as { cellularGeneration?: string | null } | null | undefined)
      ?.cellularGeneration;
    if (generation === '2g' || generation === '3g') return 'poor';
  }

  return 'online';
}

export function useNetworkStatus(): NetworkQuality {
  const [quality, setQuality] = useState<NetworkQuality>('online');

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setQuality(toNetworkQuality(state));
    });

    return unsubscribe;
  }, []);

  return quality;
}
