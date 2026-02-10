import { CompletionsService } from './completions.service';
import { SubmitCompletionDto } from './dto/submit-completion.dto';
export declare class CompletionsController {
    private completionsService;
    constructor(completionsService: CompletionsService);
    submit(userId: string, dto: SubmitCompletionDto): Promise<any>;
    recordHike(userId: string, trailId: string, elapsedSeconds?: number): Promise<any>;
    getMyCompletions(userId: string): Promise<any[]>;
    getTrailCompletions(trailId: string): Promise<any[]>;
    reviewCompletion(id: string, status: 'approved' | 'rejected', reviewerNote?: string): Promise<any>;
    deleteCompletion(userId: string, id: string): Promise<{
        deleted: boolean;
    }>;
}
