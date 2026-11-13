export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface ClusterPoint {
  id: string;
  latitude: number;
  longitude: number;
}

export interface MapCluster<T extends ClusterPoint> {
  /** Stable while panning at the same zoom: the grid cell for clusters, the point id otherwise. */
  key: string;
  latitude: number;
  longitude: number;
  points: T[];
}

/** Below this latitude span (well zoomed in) every point is shown on its own. */
export const MIN_CLUSTER_LATITUDE_DELTA = 0.04;
/** Roughly the size of a pin: points closer than this on screen are grouped. */
export const DEFAULT_CLUSTER_CELL_PX = 56;

/**
 * Groups map points that would overlap at the current zoom: each point not yet in a
 * cluster collects the remaining points within `cellPx` of it on screen. Only screen
 * distances matter, so clusters stay the same while the user pans and change only
 * when they zoom (given the same point order).
 */
export function clusterPoints<T extends ClusterPoint>(
  points: T[],
  region: MapRegion,
  mapWidthPx: number,
  mapHeightPx: number,
  cellPx = DEFAULT_CLUSTER_CELL_PX,
): MapCluster<T>[] {
  const valid = points.filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
  const single = (p: T): MapCluster<T> => ({ key: p.id, latitude: p.latitude, longitude: p.longitude, points: [p] });

  if (
    region.latitudeDelta < MIN_CLUSTER_LATITUDE_DELTA ||
    mapWidthPx <= 0 ||
    mapHeightPx <= 0 ||
    region.longitudeDelta <= 0
  ) {
    return valid.map(single);
  }

  const pxPerLng = mapWidthPx / region.longitudeDelta;
  const pxPerLat = mapHeightPx / region.latitudeDelta;
  const taken = new Array<boolean>(valid.length).fill(false);
  const clusters: MapCluster<T>[] = [];

  for (let i = 0; i < valid.length; i++) {
    if (taken[i]) continue;
    taken[i] = true;
    const seed = valid[i];
    const members = [seed];
    for (let j = i + 1; j < valid.length; j++) {
      if (taken[j]) continue;
      const other = valid[j];
      if (
        Math.abs(other.longitude - seed.longitude) * pxPerLng <= cellPx &&
        Math.abs(other.latitude - seed.latitude) * pxPerLat <= cellPx
      ) {
        taken[j] = true;
        members.push(other);
      }
    }

    if (members.length === 1) {
      clusters.push(single(seed));
    } else {
      clusters.push({
        key: `cluster:${seed.id}`,
        latitude: members.reduce((sum, p) => sum + p.latitude, 0) / members.length,
        longitude: members.reduce((sum, p) => sum + p.longitude, 0) / members.length,
        points: members,
      });
    }
  }
  return clusters;
}

/**
 * The region that shows all of a cluster's points with some margin — where tapping a
 * cluster zooms to. Never zooms in further than the level at which clustering stops.
 */
export function regionForPoints(points: ClusterPoint[], padding = 1.6): MapRegion | null {
  if (points.length === 0) return null;
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minDelta = MIN_CLUSTER_LATITUDE_DELTA * 0.75;
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * padding, minDelta),
    longitudeDelta: Math.max((maxLng - minLng) * padding, minDelta),
  };
}
