import { MapStyle, useSettingsStore } from '../store/settingsStore';
import { useNetworkStatus } from './useNetworkStatus';
import { haptics } from '../utils/haptics';

export interface MapStyleState {
  /** The map on screen: the saved choice, or topo when the hike screen is offline. */
  style: MapStyle;
  /** Whether topo tiles are shown. */
  topo: boolean;
  /** No connection: topo tiles come only from the phone. */
  offline: boolean;
  /** Topo is shown only because the phone is offline (the saved choice is another map). */
  topoBecauseOffline: boolean;
  /** The choice saved in settings. */
  chosen: MapStyle;
  setStyle: (style: MapStyle) => void;
}

/**
 * The map style every map shares, saved in settings. `autoTopoWhenOffline` (the hike screen)
 * switches to the topo tiles kept on the phone whenever there is no connection, because the
 * standard and satellite maps cannot load then.
 */
export function useMapStyle({ autoTopoWhenOffline = false }: { autoTopoWhenOffline?: boolean } = {}): MapStyleState {
  const chosen = useSettingsStore((s) => s.mapStyle);
  const setMapStyle = useSettingsStore((s) => s.setMapStyle);
  const offline = useNetworkStatus() === 'offline';
  const topoBecauseOffline = autoTopoWhenOffline && offline && chosen !== 'topo';
  const style: MapStyle = topoBecauseOffline ? 'topo' : chosen;

  return {
    style,
    topo: style === 'topo',
    offline,
    topoBecauseOffline,
    chosen,
    setStyle: (next) => {
      if (next === chosen) return;
      haptics.select();
      setMapStyle(next);
    },
  };
}
