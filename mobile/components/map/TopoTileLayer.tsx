import React from 'react';
import { Platform } from 'react-native';
import { UrlTile, MapType } from 'react-native-maps';
import { TILE_CACHE_MAX_AGE_S, TOPO_MAX_ZOOM, TOPO_TILE_URL } from '../../utils/topoTiles';
import { topoTileCachePath } from '../../services/offlineMaps';

const CACHE_PATH = topoTileCachePath();

/** Under topo tiles Android turns the Google base map off; on iOS the tiles replace Apple's map. */
export function topoMapType(topo: boolean): MapType {
  return topo && Platform.OS === 'android' ? 'none' : 'standard';
}

/**
 * OpenTopoMap tiles for a MapView. Tiles seen while browsing are kept on the phone (and
 * refreshed after a month), next to the tiles saved for trails; offline, only those are used.
 * Show `TopoAttribution` whenever this layer is on.
 */
export function TopoTileLayer({ offline }: { offline: boolean }) {
  return (
    <UrlTile
      urlTemplate={TOPO_TILE_URL}
      // Android asks only for levels the server has and scales the top one up beyond it;
      // on iOS the caching overlay does that scaling itself (maximumNativeZ)
      maximumZ={Platform.OS === 'android' ? TOPO_MAX_ZOOM : undefined}
      maximumNativeZ={TOPO_MAX_ZOOM}
      tileCachePath={CACHE_PATH}
      tileCacheMaxAge={TILE_CACHE_MAX_AGE_S}
      offlineMode={offline}
      shouldReplaceMapContent
      // Below the route line and markers
      zIndex={-1}
    />
  );
}
