import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';
import { TtlCache } from '../common/ttl-cache';
import {
  isMissingRelationError,
  SupabaseErrorLike,
  throwIfError,
} from '../common/supabase-error';
import { parsePoint } from '../trails/region-stats';
import { PlacesQueryDto, parseNear } from './dto/places-query.dto';
import { boundingBox, haversineKm, roundKm } from './distance';

const SUMMARY_COLUMNS =
  'id, kind, name_en, name_ka, latitude, longitude, elevation_m, region, notability';
const DETAIL_COLUMNS =
  'id, kind, name_en, name_ka, latitude, longitude, elevation_m, region, notability, osm_type, osm_id, wikidata, wikipedia, tags';

const DEFAULT_LIMIT = 50;
const DEFAULT_RADIUS_KM = 50;
/** PostgREST answers at most this many rows per request. */
const PAGE_SIZE = 1000;
/** A search around a point reads at most this many places from its box (most notable first). */
const NEAR_MAX_ROWS = 3000;

const NEARBY_TRAILS_KM = 20;
const NEARBY_PLACES_KM = 15;
const NEARBY_MAX = 8;
/** Places read from the box around a place for its nearby list, most notable first. */
const NEARBY_PLACES_ROWS = 200;

const TRAIL_STARTS_KEY = 'trail-starts';
const TRAIL_STARTS_TTL = 10 * 60 * 1000;
const TRAIL_PAGES = 5;

export interface PlaceSummary {
  id: string;
  kind: string;
  name_en: string;
  name_ka: string | null;
  latitude: number;
  longitude: number;
  elevation_m: number | null;
  region: string | null;
  notability: number;
  /** From the point searched around, or from the place shown; to 0.1 km. */
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
  osm_type: string;
  osm_id: number;
  wikidata: string | null;
  wikipedia: string | null;
  tags: Record<string, unknown>;
  nearby_trails: NearbyTrail[];
  nearby_places: PlaceSummary[];
}

export interface PlaceList {
  data: PlaceSummary[];
  total: number;
}

type PlaceRow = Omit<PlaceSummary, 'distance_km'>;

type PlaceDetailRow = PlaceRow & {
  osm_type: string;
  osm_id: number | string;
  wikidata: string | null;
  wikipedia: string | null;
  tags: Record<string, unknown> | null;
};

interface TrailRow {
  id: string;
  name_en: string;
  region: string | null;
  difficulty: string | null;
  start_point: unknown;
}

interface TrailStart {
  id: string;
  name_en: string;
  region: string | null;
  difficulty: string | null;
  lat: number;
  lng: number;
}

function toSummary(row: PlaceRow): PlaceSummary {
  return {
    id: row.id,
    kind: row.kind,
    name_en: row.name_en,
    name_ka: row.name_ka ?? null,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    elevation_m: row.elevation_m ?? null,
    region: row.region ?? null,
    notability: Number(row.notability ?? 0),
  };
}

/**
 * The PostgREST `or` filter for a name search: the text as a quoted value (so commas, dots and
 * brackets are plain text), without quotes, backslashes or LIKE wildcards; null when nothing is left.
 */
export function nameFilter(q: string | undefined): string | null {
  const term = (q ?? '')
    .replace(/["\\%*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!term) return null;
  return `name_en.ilike."%${term}%",name_ka.ilike."%${term}%"`;
}

/**
 * Named outdoor places of Georgia from OpenStreetMap (migration 068): lists by kind, region and
 * name or around a point, and one place with the trails and places near it. Until the table
 * exists, lists are empty and every place is not found.
 */
@Injectable()
export class PlacesService {
  private readonly logger = new Logger(PlacesService.name);
  private readonly cache = new TtlCache<TrailStart[]>(1);
  private missingTableLogged = false;

  constructor(private supabaseService: SupabaseService) {}

  private get admin() {
    return this.supabaseService.getAdminClient();
  }

  private tableMissing(error: SupabaseErrorLike | null): boolean {
    if (!isMissingRelationError(error)) return false;
    if (!this.missingTableLogged) {
      this.missingTableLogged = true;
      this.logger.warn(
        'The places table does not exist yet (migration 068); places are empty',
      );
    }
    return true;
  }

  /** The places table with the list filters (kind, region, name) applied. */
  private filtered(
    query: PlacesQueryDto,
    columns: string,
    options?: { count: 'exact'; head?: boolean },
  ) {
    let request = this.admin.from('places').select(columns, options);
    if (query.kind) request = request.eq('kind', query.kind);
    if (query.region) request = request.eq('region', query.region);
    const names = nameFilter(query.q);
    if (names) request = request.or(names);
    return request;
  }

  /**
   * Places by kind, region and name, most notable first; or, with `near`, those within
   * `radius_km` (50 by default) of the point, nearest first, each with its distance.
   */
  async list(query: PlacesQueryDto): Promise<PlaceList> {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const offset = query.offset ?? 0;
    const near = query.near ? parseNear(query.near) : null;
    if (near) {
      const radiusKm = query.radius_km ?? DEFAULT_RADIUS_KM;
      return this.listNear(query, near, radiusKm, limit, offset);
    }

    const { data, error, count } = await this.filtered(query, SUMMARY_COLUMNS, {
      count: 'exact',
    })
      .order('notability', { ascending: false })
      .order('name_en', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + limit - 1);
    if (this.tableMissing(error)) return { data: [], total: 0 };
    // A page after the last one: nothing on it, and the real total
    if (error?.code === 'PGRST103') {
      return { data: [], total: await this.count(query) };
    }
    throwIfError(error);
    return {
      data: ((data ?? []) as unknown as PlaceRow[]).map(toSummary),
      total: count ?? 0,
    };
  }

  private async count(query: PlacesQueryDto): Promise<number> {
    const { count, error } = await this.filtered(query, 'id', {
      count: 'exact',
      head: true,
    });
    throwIfError(error);
    return count ?? 0;
  }

  /** The box around the point prefilters in the database; the radius and the order are applied here. */
  private async listNear(
    query: PlacesQueryDto,
    near: { lat: number; lng: number },
    radiusKm: number,
    limit: number,
    offset: number,
  ): Promise<PlaceList> {
    const box = boundingBox(near.lat, near.lng, radiusKm);
    const rows: PlaceRow[] = [];
    for (let from = 0; from < NEAR_MAX_ROWS; from += PAGE_SIZE) {
      const { data, error } = await this.filtered(query, SUMMARY_COLUMNS)
        .gte('latitude', box.minLat)
        .lte('latitude', box.maxLat)
        .gte('longitude', box.minLng)
        .lte('longitude', box.maxLng)
        .order('notability', { ascending: false })
        .order('id', { ascending: true })
        .range(from, Math.min(from + PAGE_SIZE, NEAR_MAX_ROWS) - 1);
      if (this.tableMissing(error)) return { data: [], total: 0 };
      throwIfError(error);
      const page = (data ?? []) as unknown as PlaceRow[];
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }

    const within = rows
      .map((row) => ({
        row,
        km: haversineKm(
          near.lat,
          near.lng,
          Number(row.latitude),
          Number(row.longitude),
        ),
      }))
      .filter((item) => item.km <= radiusKm)
      .sort((a, b) => a.km - b.km || b.row.notability - a.row.notability);
    return {
      data: within.slice(offset, offset + limit).map(({ row, km }) => ({
        ...toSummary(row),
        distance_km: roundKm(km),
      })),
      total: within.length,
    };
  }

  /** One place, with the published trails starting within 20 km and the places within 15 km. */
  async findOne(id: string): Promise<PlaceDetail> {
    const { data, error } = await this.admin
      .from('places')
      .select(DETAIL_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (this.tableMissing(error)) {
      throw new NotFoundException('Place not found');
    }
    throwIfError(error);
    if (!data) throw new NotFoundException('Place not found');

    const place = data as unknown as PlaceDetailRow;
    const summary = toSummary(place);
    const [nearbyTrails, nearbyPlaces] = await Promise.all([
      this.nearbyTrails(summary.latitude, summary.longitude),
      this.nearbyPlaces(summary.id, summary.latitude, summary.longitude),
    ]);
    return {
      ...summary,
      osm_type: place.osm_type,
      osm_id: Number(place.osm_id),
      wikidata: place.wikidata ?? null,
      wikipedia: place.wikipedia ?? null,
      tags: place.tags ?? {},
      nearby_trails: nearbyTrails,
      nearby_places: nearbyPlaces,
    };
  }

  /** Published trails whose start is within 20 km, nearest first (8 at most). */
  private async nearbyTrails(lat: number, lng: number): Promise<NearbyTrail[]> {
    const starts = await this.trailStarts();
    return starts
      .map((trail) => ({
        trail,
        km: haversineKm(lat, lng, trail.lat, trail.lng),
      }))
      .filter((item) => item.km <= NEARBY_TRAILS_KM)
      .sort((a, b) => a.km - b.km)
      .slice(0, NEARBY_MAX)
      .map(({ trail, km }) => ({
        id: trail.id,
        name_en: trail.name_en,
        region: trail.region,
        difficulty: trail.difficulty,
        distance_km: roundKm(km),
      }));
  }

  /** Where every published trail starts (a couple of hundred rows), kept for 10 minutes. */
  private async trailStarts(): Promise<TrailStart[]> {
    const cached = this.cache.get(TRAIL_STARTS_KEY);
    if (cached) return cached;

    const starts: TrailStart[] = [];
    for (let page = 0; page < TRAIL_PAGES; page++) {
      const from = page * PAGE_SIZE;
      const { data, error } = await this.admin
        .from('trails')
        .select('id, name_en, region, difficulty, start_point')
        .eq('is_published', true)
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      throwIfError(error);
      const rows = (data ?? []) as unknown as TrailRow[];
      for (const row of rows) {
        const point = parsePoint(row.start_point);
        if (!point) continue;
        starts.push({
          id: row.id,
          name_en: row.name_en,
          region: row.region ?? null,
          difficulty: row.difficulty ?? null,
          lng: point[0],
          lat: point[1],
        });
      }
      if (rows.length < PAGE_SIZE) break;
    }
    this.cache.set(TRAIL_STARTS_KEY, starts, TRAIL_STARTS_TTL);
    return starts;
  }

  /** The other places within 15 km, most notable first (8 at most), each with its distance. */
  private async nearbyPlaces(
    id: string,
    lat: number,
    lng: number,
  ): Promise<PlaceSummary[]> {
    const box = boundingBox(lat, lng, NEARBY_PLACES_KM);
    const { data, error } = await this.admin
      .from('places')
      .select(SUMMARY_COLUMNS)
      .neq('id', id)
      .gte('latitude', box.minLat)
      .lte('latitude', box.maxLat)
      .gte('longitude', box.minLng)
      .lte('longitude', box.maxLng)
      .order('notability', { ascending: false })
      .order('id', { ascending: true })
      .limit(NEARBY_PLACES_ROWS);
    throwIfError(error);
    return ((data ?? []) as unknown as PlaceRow[])
      .map((row) => ({
        row,
        km: haversineKm(lat, lng, Number(row.latitude), Number(row.longitude)),
      }))
      .filter((item) => item.km <= NEARBY_PLACES_KM)
      .sort((a, b) => b.row.notability - a.row.notability || a.km - b.km)
      .slice(0, NEARBY_MAX)
      .map(({ row, km }) => ({ ...toSummary(row), distance_km: roundKm(km) }));
  }
}
