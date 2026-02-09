import { SupabaseService } from '../config/supabase.config';
import { ReportConditionDto } from './dto/report-condition.dto';
import { UploadPhotoDto } from './dto/upload-photo.dto';
export declare class CommunityService {
    private supabaseService;
    constructor(supabaseService: SupabaseService);
    reportCondition(userId: string, dto: ReportConditionDto): Promise<any>;
    getTrailConditions(trailId: string): Promise<any[]>;
    deactivateCondition(userId: string, conditionId: string): Promise<{
        message: string;
    }>;
    uploadPhoto(userId: string, dto: UploadPhotoDto): Promise<any>;
    getTrailPhotos(trailId: string, page?: number, limit?: number): Promise<{
        data: any[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    toggleLike(userId: string, photoId: string): Promise<any>;
    deletePhoto(userId: string, photoId: string): Promise<{
        message: string;
    }>;
}
