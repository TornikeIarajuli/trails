import { FollowsService } from './follows.service';
export declare class FollowsController {
    private followsService;
    constructor(followsService: FollowsService);
    toggle(currentUserId: string, targetUserId: string): Promise<{
        following: boolean;
    }>;
    isFollowing(currentUserId: string, targetUserId: string): Promise<{
        following: boolean;
    }>;
    getFollowers(userId: string, page?: string, limit?: string): Promise<{
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
    getFollowing(userId: string, page?: string, limit?: string): Promise<{
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
