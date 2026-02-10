import { SupabaseService } from '../config/supabase.config';
import { NotificationsService } from '../notifications/notifications.service';
export declare class FollowsService {
    private supabaseService;
    private notificationsService;
    constructor(supabaseService: SupabaseService, notificationsService: NotificationsService);
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
