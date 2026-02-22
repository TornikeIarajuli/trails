import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';
import { CreateTrailDto } from './dto/create-trail.dto';
import { UpdateTrailDetailsDto } from './dto/update-trail-details.dto';
import { TrailFilterDto, NearbyQueryDto } from './dto/trail-filter.dto';

@Injectable()
export class TrailsService {
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

    if (error) throw error;
    return data;
  }

  async findAll(filter: TrailFilterDto) {
    const admin = this.supabaseService.getAdminClient();
    const { page = 1, limit = 20 } = filter;
    const offset = (page - 1) * limit;

    let query = admin
      .from('trails')
      .select(
        'id, name_en, name_ka, difficulty, region, cover_image_url, distance_km, elevation_gain_m, estimated_hours, created_at',
        { count: 'exact' },
      )
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (filter.difficulty) {
      query = query.eq('difficulty', filter.difficulty);
    }

    if (filter.region) {
      query = query.ilike('region', `%${filter.region}%`);
    }

    if (filter.search) {
      query = query.or(
        `name_en.ilike.%${filter.search}%,name_ka.ilike.%${filter.search}%,description_en.ilike.%${filter.search}%`,
      );
    }

    if (filter.min_distance !== undefined) {
      query = query.gte('distance_km', filter.min_distance);
    }

    if (filter.max_distance !== undefined) {
      query = query.lte('distance_km', filter.max_distance);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      data,
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    };
  }

  async findOne(id: string) {
    const admin = this.supabaseService.getAdminClient();

    const { data: trail, error } = await admin
      .from('trails')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !trail) {
      throw new NotFoundException('Trail not found');
    }

    // Fetch media for this trail
    const { data: media } = await admin
      .from('trail_media')
      .select('*')
      .eq('trail_id', id)
      .order('sort_order', { ascending: true });

    // Fetch checkpoints
    const { data: checkpoints } = await admin
      .from('trail_checkpoints')
      .select('*')
      .eq('trail_id', id)
      .order('sort_order', { ascending: true });

    // Fetch average rating
    const { data: reviews } = await admin
      .from('trail_reviews')
      .select('rating')
      .eq('trail_id', id);

    const avgRating =
      reviews && reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : null;

    // Fetch active conditions count + latest 3
    const { data: conditions, count: conditionsCount } = await admin
      .from('trail_conditions')
      .select('id, condition_type, severity, description, reported_at', {
        count: 'exact',
      })
      .eq('trail_id', id)
      .eq('is_active', true)
      .order('reported_at', { ascending: false })
      .limit(3);

    // Fetch community photos count
    const { count: photosCount } = await admin
      .from('trail_photos')
      .select('id', { count: 'exact', head: true })
      .eq('trail_id', id);

    return {
      ...trail,
      media: media ?? [],
      checkpoints: checkpoints ?? [],
      avg_rating: avgRating ? Math.round(avgRating * 10) / 10 : null,
      review_count: reviews?.length ?? 0,
      conditions_count: conditionsCount ?? 0,
      recent_conditions: conditions ?? [],
      photos_count: photosCount ?? 0,
    };
  }

  async updateDetails(id: string, dto: UpdateTrailDetailsDto) {
    const admin = this.supabaseService.getAdminClient();

    // Only allow non-coordinate fields to be updated
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'name_en', 'name_ka', 'description_en', 'description_ka',
      'difficulty', 'region', 'distance_km', 'elevation_gain_m',
      'estimated_hours', 'start_address', 'cover_image_url', 'is_published',
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

    if (error) throw error;
    if (!data) throw new NotFoundException('Trail not found');

    return data;
  }

  async remove(id: string) {
    const admin = this.supabaseService.getAdminClient();

    const { error } = await admin.from('trails').delete().eq('id', id);

    if (error) throw error;

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

    if (error) throw error;
    return data;
  }

  async getRegions() {
    const admin = this.supabaseService.getAdminClient();

    const { data, error } = await admin
      .from('trails')
      .select('region')
      .eq('is_published', true);

    if (error) throw error;

    const regions = [...new Set(data?.map((t) => t.region))].sort();
    return regions;
  }
}
