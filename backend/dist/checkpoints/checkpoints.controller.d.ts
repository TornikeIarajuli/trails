import { CheckpointsService } from './checkpoints.service';
import { CreateCheckpointDto } from './dto/create-checkpoint.dto';
import { UpdateCheckpointDto } from './dto/update-checkpoint.dto';
import { SubmitCheckpointCompletionDto } from './dto/submit-checkpoint-completion.dto';
export declare class CheckpointsController {
    private checkpointsService;
    constructor(checkpointsService: CheckpointsService);
    getByTrail(trailId: string): Promise<any[]>;
    getMyCompletions(userId: string): Promise<any[]>;
    getMyTrailCompletions(userId: string, trailId: string): Promise<any[]>;
    getOne(id: string): Promise<any>;
    create(dto: CreateCheckpointDto): Promise<any>;
    submitCompletion(userId: string, dto: SubmitCheckpointCompletionDto): Promise<any>;
    update(id: string, dto: UpdateCheckpointDto): Promise<any>;
    remove(id: string): Promise<{
        message: string;
    }>;
}
