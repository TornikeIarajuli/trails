import { SupabaseService } from '../config/supabase.config';
import { NotificationsService } from '../notifications/notifications.service';
import { SubmitCompletionDto } from './dto/submit-completion.dto';
export declare class CompletionsService {
    private supabaseService;
    private notificationsService;
    private readonly GPS_PROXIMITY_THRESHOLD_M;
    constructor(supabaseService: SupabaseService, notificationsService: NotificationsService);
    submit(userId: string, dto: SubmitCompletionDto): Promise<any>;
    private calculateDistanceToEndpoint;
    private incrementUserCompletionCount;
    recordHike(userId: string, trailId: string, elapsedSeconds?: number): Promise<any>;
    deleteCompletion(userId: string, completionId: string): Promise<{
        deleted: boolean;
    }>;
    getUserCompletions(userId: string): Promise<any[]>;
    getTrailCompletions(trailId: string): Promise<any[]>;
    reviewCompletion(completionId: string, status: 'approved' | 'rejected', reviewerNote?: string): Promise<any>;
}
