import { ReviewsService } from './reviews.service';
import { SubmitReviewDto } from './dto/submit-review.dto';
export declare class ReviewsController {
    private reviewsService;
    constructor(reviewsService: ReviewsService);
    submit(userId: string, dto: SubmitReviewDto): Promise<any>;
    getTrailReviews(trailId: string): Promise<any[]>;
    update(userId: string, id: string, rating: number, comment?: string): Promise<any>;
    remove(userId: string, id: string): Promise<{
        message: string;
    }>;
}
