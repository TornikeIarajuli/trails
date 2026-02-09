import { TrailDifficulty } from './create-trail.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
export declare class TrailFilterDto extends PaginationDto {
    difficulty?: TrailDifficulty;
    region?: string;
    search?: string;
    min_distance?: number;
    max_distance?: number;
}
export declare class NearbyQueryDto {
    lat: number;
    lng: number;
    radius_km?: number;
}
