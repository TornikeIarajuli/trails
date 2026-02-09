import { SupabaseService } from '../config/supabase.config';
import { SubmitReviewDto } from './dto/submit-review.dto';
export declare class ReviewsService {
    private supabaseService;
    constructor(supabaseService: SupabaseService);
    submit(userId: string, dto: SubmitReviewDto): Promise<any>;
    getTrailReviews(trailId: string): Promise<any[]>;
    update(userId: string, reviewId: string, rating: number, comment?: string): Promise<any>;
    remove(userId: string, reviewId: string): Promise<{
        message: string;
    }>;
}
