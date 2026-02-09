import { SupabaseService } from '../config/supabase.config';
import { CreateCheckpointDto } from './dto/create-checkpoint.dto';
import { UpdateCheckpointDto } from './dto/update-checkpoint.dto';
import { SubmitCheckpointCompletionDto } from './dto/submit-checkpoint-completion.dto';
export declare class CheckpointsService {
    private supabaseService;
    private readonly GPS_PROXIMITY_THRESHOLD_M;
    constructor(supabaseService: SupabaseService);
    create(dto: CreateCheckpointDto): Promise<any>;
    findByTrail(trailId: string): Promise<any[]>;
    findOne(id: string): Promise<any>;
    update(id: string, dto: UpdateCheckpointDto): Promise<any>;
    remove(id: string): Promise<{
        message: string;
    }>;
    submitCompletion(userId: string, dto: SubmitCheckpointCompletionDto): Promise<any>;
    private calculateDistanceToCheckpoint;
    getUserCheckpointCompletions(userId: string, trailId?: string): Promise<any[]>;
}
