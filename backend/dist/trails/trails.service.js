"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrailsService = void 0;
const common_1 = require("@nestjs/common");
const supabase_config_1 = require("../config/supabase.config");
let TrailsService = class TrailsService {
    supabaseService;
    constructor(supabaseService) {
        this.supabaseService = supabaseService;
    }
    async create(dto) {
        const admin = this.supabaseService.getAdminClient();
        const trailData = {
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
        if (error)
            throw error;
        return data;
    }
    async findAll(filter) {
        const admin = this.supabaseService.getAdminClient();
        const { page = 1, limit = 20 } = filter;
        const offset = (page - 1) * limit;
        let query = admin
            .from('trails')
            .select('*', { count: 'exact' })
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
            query = query.or(`name_en.ilike.%${filter.search}%,name_ka.ilike.%${filter.search}%,description_en.ilike.%${filter.search}%`);
        }
        if (filter.min_distance !== undefined) {
            query = query.gte('distance_km', filter.min_distance);
        }
        if (filter.max_distance !== undefined) {
            query = query.lte('distance_km', filter.max_distance);
        }
        const { data, error, count } = await query;
        if (error)
            throw error;
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
    async findOne(id) {
        const admin = this.supabaseService.getAdminClient();
        const { data: trail, error } = await admin
            .from('trails')
            .select('*')
            .eq('id', id)
            .single();
        if (error || !trail) {
            throw new common_1.NotFoundException('Trail not found');
        }
        const { data: media } = await admin
            .from('trail_media')
            .select('*')
            .eq('trail_id', id)
            .order('sort_order', { ascending: true });
        const { data: checkpoints } = await admin
            .from('trail_checkpoints')
            .select('*')
            .eq('trail_id', id)
            .order('sort_order', { ascending: true });
        const { data: reviews } = await admin
            .from('trail_reviews')
            .select('rating')
            .eq('trail_id', id);
        const avgRating = reviews && reviews.length > 0
            ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
            : null;
        const { data: conditions, count: conditionsCount } = await admin
            .from('trail_conditions')
            .select('id, condition_type, severity, description, reported_at', {
            count: 'exact',
        })
            .eq('trail_id', id)
            .eq('is_active', true)
            .order('reported_at', { ascending: false })
            .limit(3);
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
    async updateDetails(id, dto) {
        const admin = this.supabaseService.getAdminClient();
        const updateData = {};
        const allowedFields = [
            'name_en', 'name_ka', 'description_en', 'description_ka',
            'difficulty', 'region', 'distance_km', 'elevation_gain_m',
            'estimated_hours', 'start_address', 'cover_image_url', 'is_published',
        ];
        for (const field of allowedFields) {
            if (dto[field] !== undefined) {
                updateData[field] = dto[field];
            }
        }
        if (Object.keys(updateData).length === 0) {
            throw new common_1.NotFoundException('No valid fields to update');
        }
        const { data, error } = await admin
            .from('trails')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();
        if (error)
            throw error;
        if (!data)
            throw new common_1.NotFoundException('Trail not found');
        return data;
    }
    async remove(id) {
        const admin = this.supabaseService.getAdminClient();
        const { error } = await admin.from('trails').delete().eq('id', id);
        if (error)
            throw error;
        return { message: 'Trail deleted successfully' };
    }
    async findNearby(query) {
        const admin = this.supabaseService.getAdminClient();
        const radiusMeters = (query.radius_km ?? 50) * 1000;
        const { data, error } = await admin.rpc('find_nearby_trails', {
            user_lat: query.lat,
            user_lng: query.lng,
            radius_m: radiusMeters,
        });
        if (error)
            throw error;
        return data;
    }
    async getRegions() {
        const admin = this.supabaseService.getAdminClient();
        const { data, error } = await admin
            .from('trails')
            .select('region')
            .eq('is_published', true);
        if (error)
            throw error;
        const regions = [...new Set(data?.map((t) => t.region))].sort();
        return regions;
    }
};
exports.TrailsService = TrailsService;
exports.TrailsService = TrailsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_config_1.SupabaseService])
], TrailsService);
//# sourceMappingURL=trails.service.js.map