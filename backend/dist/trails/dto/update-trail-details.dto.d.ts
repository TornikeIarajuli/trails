import { TrailDifficulty } from './create-trail.dto';
export declare class UpdateTrailDetailsDto {
    name_en?: string;
    name_ka?: string;
    description_en?: string;
    description_ka?: string;
    difficulty?: TrailDifficulty;
    region?: string;
    distance_km?: number;
    elevation_gain_m?: number;
    estimated_hours?: number;
    start_address?: string;
    cover_image_url?: string;
    is_published?: boolean;
}
