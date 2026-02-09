import { SupabaseService } from '../config/supabase.config';
export type MediaType = 'photo' | 'video';
export declare class MediaService {
    private supabaseService;
    constructor(supabaseService: SupabaseService);
    uploadTrailMedia(trailId: string, file: Buffer, fileName: string, mimeType: string, type: MediaType, caption?: string): Promise<any>;
    uploadProofPhoto(file: Buffer, fileName: string, mimeType: string): Promise<{
        url: string;
    }>;
    uploadAvatar(userId: string, file: Buffer, fileName: string, mimeType: string): Promise<{
        url: string;
    }>;
    deleteMedia(mediaId: string): Promise<{
        message: string;
    }>;
}
