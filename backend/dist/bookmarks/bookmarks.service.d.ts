import { SupabaseService } from '../config/supabase.config';
export declare class BookmarksService {
    private supabaseService;
    constructor(supabaseService: SupabaseService);
    toggle(userId: string, trailId: string): Promise<{
        bookmarked: boolean;
    }>;
    getMyBookmarks(userId: string, page?: number, limit?: number): Promise<{
        data: {
            id: any;
            created_at: any;
            trails: {
                id: any;
                name_en: any;
                name_ka: any;
                difficulty: any;
                region: any;
                distance_km: any;
                elevation_gain_m: any;
                estimated_hours: any;
                cover_image_url: any;
            }[];
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    isBookmarked(userId: string, trailId: string): Promise<{
        bookmarked: boolean;
    }>;
}
