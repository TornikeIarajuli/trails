import { SupabaseService } from '../config/supabase.config';
export declare class FeedService {
    private supabaseService;
    constructor(supabaseService: SupabaseService);
    getFeed(userId: string, page?: number, limit?: number): Promise<{
        data: any;
        pagination: {
            page: number;
            limit: number;
            total: any;
            totalPages: number;
        };
    }>;
}
