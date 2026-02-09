import {
  Controller,
  Post,
  Delete,
  Param,
  UseGuards,
  ParseUUIDPipe,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { MediaService, MediaType } from './media.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { Request } from 'express';

@Controller('media')
@UseGuards(AuthGuard)
export class MediaController {
  constructor(private mediaService: MediaService) {}

  @Post('trail/:trailId')
  async uploadTrailMedia(
    @Param('trailId', ParseUUIDPipe) trailId: string,
    @Req() req: Request,
  ) {
    // NestJS raw body handling — in production, use @nestjs/platform-express with multer
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }
    const fileBuffer = Buffer.concat(chunks);

    const fileName =
      (req.headers['x-file-name'] as string) || 'upload.jpg';
    const mimeType =
      (req.headers['content-type'] as string) || 'image/jpeg';
    const mediaType =
      ((req.headers['x-media-type'] as string) || 'photo') as MediaType;
    const caption = req.headers['x-caption'] as string | undefined;

    if (!fileBuffer.length) {
      throw new BadRequestException('No file provided');
    }

    return this.mediaService.uploadTrailMedia(
      trailId,
      fileBuffer,
      fileName,
      mimeType,
      mediaType,
      caption,
    );
  }

  @Post('proof')
  async uploadProofPhoto(@Req() req: Request) {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }
    const fileBuffer = Buffer.concat(chunks);

    const fileName =
      (req.headers['x-file-name'] as string) || 'proof.jpg';
    const mimeType =
      (req.headers['content-type'] as string) || 'image/jpeg';

    if (!fileBuffer.length) {
      throw new BadRequestException('No file provided');
    }

    return this.mediaService.uploadProofPhoto(fileBuffer, fileName, mimeType);
  }

  @Post('avatar')
  async uploadAvatar(
    @CurrentUser('id') userId: string,
    @Req() req: Request,
  ) {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }
    const fileBuffer = Buffer.concat(chunks);

    const fileName =
      (req.headers['x-file-name'] as string) || 'avatar.jpg';
    const mimeType =
      (req.headers['content-type'] as string) || 'image/jpeg';

    if (!fileBuffer.length) {
      throw new BadRequestException('No file provided');
    }

    return this.mediaService.uploadAvatar(userId, fileBuffer, fileName, mimeType);
  }

  @Delete(':id')
  deleteMedia(@Param('id', ParseUUIDPipe) id: string) {
    return this.mediaService.deleteMedia(id);
  }
}
