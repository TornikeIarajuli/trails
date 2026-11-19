import api from './api';

export type PlaceKind =
  | 'peak'
  | 'pass'
  | 'lake'
  | 'waterfall'
  | 'viewpoint'
  | 'campsite'
  | 'hut'
  | 'cave'
  | 'canyon'
  | 'glacier'
  | 'castle'
  | 'tower'
  | 'monastery'
  | 'hot_spring'
  | 'fishing';

/** A place from OpenStreetMap: a lake, a waterfall, a peak, a fortress… */
export interface PlaceSummary {
  id: string;
  kind: PlaceKind;
  name_en: string;
  name_ka: string | null;
  latitude: number;
  longitude: number;
  elevation_m: number | null;
  region: string | null;
  notability: number;
  /** Only when searching near a point. */
  distance_km?: number;
}

export interface NearbyTrail {
  id: string;
  name_en: string;
  region: string | null;
  difficulty: string | null;
  distance_km: number;
}

export interface PlaceDetail extends PlaceSummary {
  osm_type: 'node' | 'way' | 'relation';
  osm_id: number;
  wikidata: string | null;
  wikipedia: string | null;
  tags: Record<string, string>;
  nearby_trails: NearbyTrail[];
  nearby_places: PlaceSummary[];
}

export interface PlaceFilter {
  kind?: PlaceKind;
  region?: string;
  q?: string;
  near?: { latitude: number; longitude: number };
  radiusKm?: number;
  limit?: number;
  offset?: number;
}

export interface PlacePage {
  data: PlaceSummary[];
  total: number;
}

export const placesService = {
  async list(filter: PlaceFilter = {}): Promise<PlacePage> {
    const response = await api.get('/places', {
      params: {
        kind: filter.kind,
        region: filter.region,
        q: filter.q || undefined,
        near: filter.near ? `${filter.near.latitude.toFixed(5)},${filter.near.longitude.toFixed(5)}` : undefined,
        radius_km: filter.radiusKm,
        limit: filter.limit,
        offset: filter.offset,
      },
    });
    const body = response.data ?? {};
    return { data: Array.isArray(body.data) ? body.data : [], total: typeof body.total === 'number' ? body.total : 0 };
  },

  async get(id: string): Promise<PlaceDetail> {
    const response = await api.get(`/places/${encodeURIComponent(id)}`);
    return response.data;
  },
};
