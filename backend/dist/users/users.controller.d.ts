import { UsersService } from './users.service';
export declare class UsersController {
    private usersService;
    constructor(usersService: UsersService);
    getMyProfile(userId: string): Promise<any>;
    updateMyProfile(userId: string, data: {
        full_name?: string;
        bio?: string;
        avatar_url?: string;
    }): Promise<any>;
    searchUsers(q: string): Promise<{
        id: any;
        username: any;
        full_name: any;
        avatar_url: any;
    }[]>;
    getLeaderboard(limit?: string): Promise<{
        id: any;
        username: any;
        full_name: any;
        avatar_url: any;
        total_trails_completed: any;
        rank: number;
    }[]>;
    getPublicProfile(id: string): Promise<{
        stats: {
            easy: number;
            medium: number;
            hard: number;
            ultra: number;
            total: number;
        };
        completions: {
            id: any;
            completed_at: any;
            proof_photo_url: any;
            trails: {
                id: any;
                name_en: any;
                difficulty: any;
                region: any;
                cover_image_url: any;
                distance_km: any;
                elevation_gain_m: any;
            }[];
        }[];
        id: any;
        username: any;
        full_name: any;
        avatar_url: any;
        bio: any;
        total_trails_completed: any;
        created_at: any;
    }>;
}
