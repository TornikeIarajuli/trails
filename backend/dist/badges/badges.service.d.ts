import { SupabaseService } from '../config/supabase.config';
export declare class BadgesService {
    private supabaseService;
    constructor(supabaseService: SupabaseService);
    getAllBadges(): Promise<any[]>;
    getUserBadges(userId: string): Promise<{
        id: any;
        earned_at: any;
        badges: any[];
    }[]>;
    checkAndAward(userId: string): Promise<{
        new_badges: any[];
        count: any;
    }>;
}
