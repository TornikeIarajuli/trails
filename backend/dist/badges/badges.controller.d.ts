import { BadgesService } from './badges.service';
export declare class BadgesController {
    private badgesService;
    constructor(badgesService: BadgesService);
    getAllBadges(): Promise<any[]>;
    getMyBadges(userId: string): Promise<{
        id: any;
        earned_at: any;
        badges: any[];
    }[]>;
    getProgress(userId: string): Promise<any>;
    checkBadges(userId: string): Promise<{
        new_badges: any[];
        count: any;
    }>;
}
