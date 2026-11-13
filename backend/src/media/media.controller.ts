import {
  Controller,
  Post,
  Delete,
  Param,
  UseGuards,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { MediaService } from './media.service';
import { parseCaption, readUploadBody } from './upload';
import { AuthGuard } from '../common/guards/auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { Request } from 'express';

/**
 * Uploads are raw request bodies (contract C7). The file type is sniffed from the bytes;
 * the Content-Type header and x-file-name are ignored for that.
 */
@Controller('media')
@UseGuards(AuthGuard)
export class MediaController {
  constructor(private mediaService: MediaService) {}

  @Post('trail/:trailId')
  @UseGuards(AdminGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async uploadTrailMedia(
    @Param('trailId', ParseUUIDPipe) trailId: string,
    @Req() req: Request,
  ) {
    const caption = parseCaption(req.headers['x-caption']);
    const file = await readUploadBody(req);
    return this.mediaService.uploadTrailMedia(trailId, file, caption);
  }

  @Post('hike-photo/:trailId')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  async uploadHikePhoto(
    @Param('trailId', ParseUUIDPipe) trailId: string,
    @CurrentUser('id') userId: string,
    @Req() req: Request,
  ) {
    const caption = parseCaption(req.headers['x-caption']);
    const file = await readUploadBody(req);
    return this.mediaService.uploadHikePhoto(userId, trailId, file, caption);
  }

  @Post('proof')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async uploadProofPhoto(@Req() req: Request) {
    const file = await readUploadBody(req);
    return this.mediaService.uploadProofPhoto(file);
  }

  @Post('avatar')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async uploadAvatar(@CurrentUser('id') userId: string, @Req() req: Request) {
    const file = await readUploadBody(req);
    return this.mediaService.uploadAvatar(userId, file);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  deleteMedia(@Param('id', ParseUUIDPipe) id: string) {
    return this.mediaService.deleteMedia(id);
  }
}
