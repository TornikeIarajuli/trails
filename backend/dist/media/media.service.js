"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaService = void 0;
const common_1 = require("@nestjs/common");
const supabase_config_1 = require("../config/supabase.config");
const crypto_1 = require("crypto");
let MediaService = class MediaService {
    supabaseService;
    constructor(supabaseService) {
        this.supabaseService = supabaseService;
    }
    async uploadTrailMedia(trailId, file, fileName, mimeType, type, caption) {
        const admin = this.supabaseService.getAdminClient();
        const { data: trail } = await admin
            .from('trails')
            .select('id')
            .eq('id', trailId)
            .single();
        if (!trail) {
            throw new common_1.NotFoundException('Trail not found');
        }
        const ext = fileName.split('.').pop();
        const storagePath = `trails/${trailId}/${(0, crypto_1.randomUUID)()}.${ext}`;
        const { error: uploadError } = await admin.storage
            .from('trail-media')
            .upload(storagePath, file, {
            contentType: mimeType,
            upsert: false,
        });
        if (uploadError) {
            throw new common_1.BadRequestException(`Upload failed: ${uploadError.message}`);
        }
        const { data: { publicUrl }, } = admin.storage.from('trail-media').getPublicUrl(storagePath);
        const { data: existing } = await admin
            .from('trail_media')
            .select('sort_order')
            .eq('trail_id', trailId)
            .order('sort_order', { ascending: false })
            .limit(1);
        const nextOrder = existing?.[0] ? existing[0].sort_order + 1 : 0;
        const { data: media, error: dbError } = await admin
            .from('trail_media')
            .insert({
            trail_id: trailId,
            type,
            url: publicUrl,
            caption,
            sort_order: nextOrder,
        })
            .select()
            .single();
        if (dbError)
            throw dbError;
        return media;
    }
    async uploadProofPhoto(file, fileName, mimeType) {
        const admin = this.supabaseService.getAdminClient();
        const ext = fileName.split('.').pop();
        const storagePath = `proofs/${(0, crypto_1.randomUUID)()}.${ext}`;
        const { error: uploadError } = await admin.storage
            .from('proof-photos')
            .upload(storagePath, file, {
            contentType: mimeType,
            upsert: false,
        });
        if (uploadError) {
            throw new common_1.BadRequestException(`Upload failed: ${uploadError.message}`);
        }
        const { data: { publicUrl }, } = admin.storage.from('proof-photos').getPublicUrl(storagePath);
        return { url: publicUrl };
    }
    async uploadAvatar(userId, file, fileName, mimeType) {
        const admin = this.supabaseService.getAdminClient();
        const ext = fileName.split('.').pop();
        const storagePath = `avatars/${userId}.${ext}`;
        const { error: uploadError } = await admin.storage
            .from('proof-photos')
            .upload(storagePath, file, {
            contentType: mimeType,
            upsert: true,
        });
        if (uploadError) {
            throw new common_1.BadRequestException(`Upload failed: ${uploadError.message}`);
        }
        const { data: { publicUrl }, } = admin.storage.from('proof-photos').getPublicUrl(storagePath);
        await admin
            .from('profiles')
            .update({ avatar_url: publicUrl })
            .eq('id', userId);
        return { url: publicUrl };
    }
    async deleteMedia(mediaId) {
        const admin = this.supabaseService.getAdminClient();
        const { data: media, error: fetchError } = await admin
            .from('trail_media')
            .select('*')
            .eq('id', mediaId)
            .single();
        if (fetchError || !media) {
            throw new common_1.NotFoundException('Media not found');
        }
        const url = new URL(media.url);
        const pathParts = url.pathname.split('/trail-media/');
        if (pathParts[1]) {
            await admin.storage.from('trail-media').remove([pathParts[1]]);
        }
        const { error } = await admin
            .from('trail_media')
            .delete()
            .eq('id', mediaId);
        if (error)
            throw error;
        return { message: 'Media deleted successfully' };
    }
};
exports.MediaService = MediaService;
exports.MediaService = MediaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_config_1.SupabaseService])
], MediaService);
//# sourceMappingURL=media.service.js.map