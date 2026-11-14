import { useSettingsStore } from '../store/settingsStore';
import { useNetworkStatus } from './useNetworkStatus';
import { haptics } from '../utils/haptics';

export interface MapStyleState {
  /** Whether topo tiles are shown. */
  topo: boolean;
  /** No connection: topo tiles come only from the phone. */
  offline: boolean;
  /** Topo is shown only because the phone is offline (the saved choice is the standard map). */
  topoBecauseOffline: boolean;
  toggle: () => void;
}

/**
 * The map style every map shares, saved in settings. `autoTopoWhenOffline` (the hike screen)
 * switches to the topo tiles kept on the phone whenever there is no connection, because the
 * standard map cannot load then.
 */
export function useMapStyle({ autoTopoWhenOffline = false }: { autoTopoWhenOffline?: boolean } = {}): MapStyleState {
  const mapStyle = useSettingsStore((s) => s.mapStyle);
  const setMapStyle = useSettingsStore((s) => s.setMapStyle);
  const offline = useNetworkStatus() === 'offline';
  const chosenTopo = mapStyle === 'topo';
  const topoBecauseOffline = autoTopoWhenOffline && offline && !chosenTopo;

  return {
    topo: chosenTopo || topoBecauseOffline,
    offline,
    topoBecauseOffline,
    toggle: () => {
      haptics.select();
      setMapStyle(chosenTopo ? 'standard' : 'topo');
    },
  };
}
