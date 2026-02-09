import { CommunityService } from './community.service';
import { ReportConditionDto } from './dto/report-condition.dto';
import { UploadPhotoDto } from './dto/upload-photo.dto';
export declare class CommunityController {
    private communityService;
    constructor(communityService: CommunityService);
    reportCondition(userId: string, dto: ReportConditionDto): Promise<any>;
    getTrailConditions(trailId: string): Promise<any[]>;
    deactivateCondition(userId: string, id: string): Promise<{
        message: string;
    }>;
    uploadPhoto(userId: string, dto: UploadPhotoDto): Promise<any>;
    getTrailPhotos(trailId: string, page?: string, limit?: string): Promise<{
        data: any[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    toggleLike(userId: string, id: string): Promise<any>;
    deletePhoto(userId: string, id: string): Promise<{
        message: string;
    }>;
}
