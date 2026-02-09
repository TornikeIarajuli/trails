import { SupabaseService } from '../config/supabase.config';
import { SubmitCompletionDto } from './dto/submit-completion.dto';
export declare class CompletionsService {
    private supabaseService;
    private readonly GPS_PROXIMITY_THRESHOLD_M;
    constructor(supabaseService: SupabaseService);
    submit(userId: string, dto: SubmitCompletionDto): Promise<any>;
    private calculateDistanceToEndpoint;
    private incrementUserCompletionCount;
    getUserCompletions(userId: string): Promise<any[]>;
    getTrailCompletions(trailId: string): Promise<any[]>;
    reviewCompletion(completionId: string, status: 'approved' | 'rejected', reviewerNote?: string): Promise<any>;
}
