export declare enum TrailDifficulty {
    EASY = "easy",
    MEDIUM = "medium",
    HARD = "hard",
    ULTRA = "ultra"
}
export declare class CreateTrailDto {
    name_en: string;
    name_ka?: string;
    description_en?: string;
    description_ka?: string;
    difficulty: TrailDifficulty;
    region: string;
    distance_km?: number;
    elevation_gain_m?: number;
    estimated_hours?: number;
    route_coordinates?: [number, number][];
    start_point?: [number, number];
    end_point?: [number, number];
    start_address?: string;
    gpx_file_url?: string;
    cover_image_url?: string;
    is_published?: boolean;
}
