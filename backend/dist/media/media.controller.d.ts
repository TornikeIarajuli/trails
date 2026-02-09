import { MediaService } from './media.service';
import type { Request } from 'express';
export declare class MediaController {
    private mediaService;
    constructor(mediaService: MediaService);
    uploadTrailMedia(trailId: string, req: Request): Promise<any>;
    uploadProofPhoto(req: Request): Promise<{
        url: string;
    }>;
    uploadAvatar(userId: string, req: Request): Promise<{
        url: string;
    }>;
    deleteMedia(id: string): Promise<{
        message: string;
    }>;
}
