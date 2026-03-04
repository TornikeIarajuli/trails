import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

export type NetworkQuality = 'online' | 'poor' | 'offline';

export function useNetworkStatus(): NetworkQuality {
  const [quality, setQuality] = useState<NetworkQuality>('online');

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected === false) {
        setQuality('offline');
        return;
      }

      // Cellular 2G/3G counts as poor
      if (
        state.type === 'cellular' &&
        (state.details?.cellularGeneration === '2g' ||
          state.details?.cellularGeneration === '3g')
      ) {
        setQuality('poor');
        return;
      }

      setQuality('online');
    });

    return unsubscribe;
  }, []);

  return quality;
}
