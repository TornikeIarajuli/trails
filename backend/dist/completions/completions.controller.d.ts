import { CompletionsService } from './completions.service';
import { SubmitCompletionDto } from './dto/submit-completion.dto';
export declare class CompletionsController {
    private completionsService;
    constructor(completionsService: CompletionsService);
    submit(userId: string, dto: SubmitCompletionDto): Promise<any>;
    getMyCompletions(userId: string): Promise<any[]>;
    getTrailCompletions(trailId: string): Promise<any[]>;
    reviewCompletion(id: string, status: 'approved' | 'rejected', reviewerNote?: string): Promise<any>;
}
