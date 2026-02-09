import { SupabaseService } from '../config/supabase.config';
export declare class FollowsService {
    private supabaseService;
    constructor(supabaseService: SupabaseService);
    toggle(followerId: string, followingId: string): Promise<{
        following: boolean;
    }>;
    isFollowing(followerId: string, followingId: string): Promise<{
        following: boolean;
    }>;
    getFollowers(userId: string, page?: number, limit?: number): Promise<{
        data: {
            id: any;
            created_at: any;
            profiles: {
                id: any;
                username: any;
                full_name: any;
                avatar_url: any;
            }[];
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    getFollowing(userId: string, page?: number, limit?: number): Promise<{
        data: {
            id: any;
            created_at: any;
            profiles: {
                id: any;
                username: any;
                full_name: any;
                avatar_url: any;
            }[];
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    getCounts(userId: string): Promise<{
        followers_count: number;
        following_count: number;
    }>;
}
