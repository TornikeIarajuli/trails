import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';
import { CreateTrailDto } from './dto/create-trail.dto';
import { UpdateTrailDetailsDto } from './dto/update-trail-details.dto';
import { TrailFilterDto, NearbyQueryDto } from './dto/trail-filter.dto';
import { TtlCache, stableStringify } from '../common/ttl-cache';
import { throwIfError } from '../common/supabase-error';

const TRAIL_LIST_TTL = 5 * 60 * 1000; // 5 min — trail lists rarely change
const TRAIL_DETAIL_TTL = 10 * 60 * 1000; // 10 min — trail details change even less

@Injectable()
export class TrailsService {
  private cache = new TtlCache<any>();
  constructor(private supabaseService: SupabaseService) {}

  async create(dto: CreateTrailDto) {
    const admin = this.supabaseService.getAdminClient();

    const trailData: Record<string, unknown> = {
      name_en: dto.name_en,
      name_ka: dto.name_ka,
      description_en: dto.description_en,
      description_ka: dto.description_ka,
      difficulty: dto.difficulty,
      region: dto.region,
      distance_km: dto.distance_km,
      elevation_gain_m: dto.elevation_gain_m,
      estimated_hours: dto.estimated_hours,
      start_address: dto.start_address,
      gpx_file_url: dto.gpx_file_url,
      cover_image_url: dto.cover_image_url,
      is_published: dto.is_published ?? false,
    };

    // Convert coordinates to PostGIS geometry via raw SQL
    if (dto.start_point) {
      trailData.start_point = `SRID=4326;POINT(${dto.start_point[0]} ${dto.start_point[1]})`;
    }
    if (dto.end_point) {
      trailData.end_point = `SRID=4326;POINT(${dto.end_point[0]} ${dto.end_point[1]})`;
    }
    if (dto.route_coordinates?.length) {
      const coords = dto.route_coordinates
        .map(([lng, lat]) => `${lng} ${lat}`)
        .join(',');
      trailData.route = `SRID=4326;LINESTRING(${coords})`;
    }

    const { data, error } = await admin
      .from('trails')
      .insert(trailData)
      .select()
      .single();

    throwIfError(error);
    return data;
  }

  async findAll(filter: TrailFilterDto) {
    const cacheKey = `trails:list:${stableStringify(filter)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const admin = this.supabaseService.getAdminClient();
    const { page = 1, limit = 20 } = filter;
    const offset = (page - 1) * limit;

    let query = admin
      .from('trails')
      .select(
        'id, name_en, name_ka, difficulty, region, cover_image_url, distance_km, elevation_gain_m, estimated_hours, status, status_note, created_at, start_point',
        { count: 'exact' },
      )
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (filter.difficulty) {
      query = query.eq('difficulty', filter.difficulty);
    }

    if (filter.region) {
      const safeRegion = filter.region.replace(/[,.()"'\\]/g, '');
      query = query.ilike('region', `%${safeRegion}%`);
    }

    if (filter.search) {
      const safeSearch = filter.search.replace(/[,.()"'\\]/g, '');
      query = query.or(
        `name_en.ilike.%${safeSearch}%,name_ka.ilike.%${safeSearch}%,description_en.ilike.%${safeSearch}%`,
      );
    }

    if (filter.min_distance !== undefined) {
      query = query.gte('distance_km', filter.min_distance);
    }

    if (filter.max_distance !== undefined) {
      query = query.lte('distance_km', filter.max_distance);
    }

    const { data, error, count } = await query;

    throwIfError(error);

    const result = {
      data,
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    };
    this.cache.set(cacheKey, result, TRAIL_LIST_TTL);
    return result;
  }

  async findOne(id: string) {
    const cacheKey = `trails:detail:${id}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const admin = this.supabaseService.getAdminClient();

    const { data: trail, error } = await admin
      .from('trails')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !trail) {
      throw new NotFoundException('Trail not found');
    }

    // Fetch all supplementary data in parallel
    const [
      { data: media },
      { data: checkpoints },
      { data: reviews },
      { data: conditions, count: conditionsCount },
      { count: photosCount },
    ] = await Promise.all([
      admin
        .from('trail_media')
        .select('*')
        .eq('trail_id', id)
        .order('sort_order', { ascending: true }),
      admin
        .from('trail_checkpoints')
        .select('*')
        .eq('trail_id', id)
        .order('sort_order', { ascending: true }),
      admin
        .from('trail_reviews')
        .select('rating')
        .eq('trail_id', id),
      admin
        .from('trail_conditions')
        .select('id, condition_type, severity, description, reported_at', {
          count: 'exact',
        })
        .eq('trail_id', id)
        .eq('is_active', true)
        .gte('reported_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
        .order('reported_at', { ascending: false })
        .limit(3),
      admin
        .from('trail_photos')
        .select('id', { count: 'exact', head: true })
        .eq('trail_id', id),
    ]);

    const avgRating =
      reviews && reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : null;

    const result = {
      ...trail,
      media: media ?? [],
      checkpoints: checkpoints ?? [],
      avg_rating: avgRating ? Math.round(avgRating * 10) / 10 : null,
      review_count: reviews?.length ?? 0,
      conditions_count: conditionsCount ?? 0,
      recent_conditions: conditions ?? [],
      photos_count: photosCount ?? 0,
    };
    this.cache.set(cacheKey, result, TRAIL_DETAIL_TTL);
    return result;
  }

  async updateDetails(id: string, dto: UpdateTrailDetailsDto) {
    const admin = this.supabaseService.getAdminClient();

    // Only allow non-coordinate fields to be updated
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'name_en',
      'name_ka',
      'description_en',
      'description_ka',
      'difficulty',
      'region',
      'distance_km',
      'elevation_gain_m',
      'estimated_hours',
      'start_address',
      'cover_image_url',
      'is_published',
    ];

    for (const field of allowedFields) {
      if ((dto as Record<string, unknown>)[field] !== undefined) {
        updateData[field] = (dto as Record<string, unknown>)[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new NotFoundException('No valid fields to update');
    }

    const { data, error } = await admin
      .from('trails')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    throwIfError(error);
    if (!data) throw new NotFoundException('Trail not found');

    // Invalidate caches for this trail and all list caches
    this.cache.delete(`trails:detail:${id}`);
    this.cache.deleteByPrefix('trails:list:');
    return data;
  }

  invalidateCache(id: string) {
    this.cache.delete(`trails:detail:${id}`);
    this.cache.deleteByPrefix('trails:list:');
  }

  async remove(id: string) {
    const admin = this.supabaseService.getAdminClient();

    const { error } = await admin.from('trails').delete().eq('id', id);

    throwIfError(error);

    this.cache.delete(`trails:detail:${id}`);
    this.cache.deleteByPrefix('trails:list:');
    return { message: 'Trail deleted successfully' };
  }

  async findNearby(query: NearbyQueryDto) {
    const admin = this.supabaseService.getAdminClient();
    const radiusMeters = (query.radius_km ?? 50) * 1000;

    // Use Supabase RPC to call PostGIS function
    const { data, error } = await admin.rpc('find_nearby_trails', {
      user_lat: query.lat,
      user_lng: query.lng,
      radius_m: radiusMeters,
    });

    throwIfError(error);
    return data;
  }

  async getRecommendations(userId: string, limit = 10) {
    const admin = this.supabaseService.getAdminClient();

    // 1. Get user's completed trail IDs and difficulty distribution
    const { data: completions } = await admin
      .from('trail_completions')
      .select('trail_id, trails:trail_id (difficulty)')
      .eq('user_id', userId)
      .eq('status', 'approved');

    const completedIds = new Set(
      (completions ?? []).map((c: any) => c.trail_id),
    );

    // Count completions per difficulty
    const counts: Record<string, number> = { easy: 0, medium: 0, hard: 0, ultra: 0 };
    (completions ?? []).forEach((c: any) => {
      const diff = (c.trails as any)?.difficulty;
      if (diff && diff in counts) counts[diff]++;
    });

    // 2. Determine target difficulties: current level + next level up
    const PROGRESSION = ['easy', 'medium', 'hard', 'ultra'];
    const targetDifficulties: string[] = [];

    // Find highest difficulty with at least 1 completion
    let highestIdx = -1;
    for (let i = PROGRESSION.length - 1; i >= 0; i--) {
      if (counts[PROGRESSION[i]] > 0) {
        highestIdx = i;
        break;
      }
    }

    if (highestIdx === -1) {
      // No completions — recommend easy trails
      targetDifficulties.push('easy');
    } else {
      targetDifficulties.push(PROGRESSION[highestIdx]);
      // If they've done 3+ at this level, suggest the next level up
      if (
        highestIdx < PROGRESSION.length - 1 &&
        counts[PROGRESSION[highestIdx]] >= 3
      ) {
        targetDifficulties.push(PROGRESSION[highestIdx + 1]);
      }
    }

    // 3. Fetch matching trails the user hasn't completed
    let query = admin
      .from('trails')
      .select(
        'id, name_en, name_ka, difficulty, region, cover_image_url, distance_km, elevation_gain_m, estimated_hours, status, avg_rating:trail_reviews(rating)',
      )
      .eq('is_published', true)
      .eq('status', 'open')
      .in('difficulty', targetDifficulties)
      .order('created_at', { ascending: false })
      .limit(limit + completedIds.size); // fetch extra to filter out completed

    const { data: trails, error } = await query;
    throwIfError(error);

    // Filter out already completed and compute avg rating
    const result = (trails ?? [])
      .filter((t: any) => !completedIds.has(t.id))
      .slice(0, limit)
      .map((t: any) => {
        const ratings = t.avg_rating ?? [];
        const avg =
          ratings.length > 0
            ? Math.round(
                (ratings.reduce((s: number, r: any) => s + r.rating, 0) /
                  ratings.length) *
                  10,
              ) / 10
            : null;
        return { ...t, avg_rating: avg, review_count: ratings.length };
      });

    return {
      data: result,
      target_difficulties: targetDifficulties,
      user_stats: counts,
    };
  }

  async getRegions() {
    const admin = this.supabaseService.getAdminClient();

    const { data, error } = await admin.rpc('get_distinct_regions');

    throwIfError(error);

    return (data ?? []).map((r: { region: string }) => r.region);
  }
}
