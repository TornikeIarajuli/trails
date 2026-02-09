import { FeedService } from './feed.service';
export declare class FeedController {
    private feedService;
    constructor(feedService: FeedService);
    getFeed(userId: string, page?: string, limit?: string): Promise<{
        data: any;
        pagination: {
            page: number;
            limit: number;
            total: any;
            totalPages: number;
        };
    }>;
}
