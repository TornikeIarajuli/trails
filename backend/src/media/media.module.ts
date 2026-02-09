import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { SupabaseService } from '../config/supabase.config';

@Module({
  controllers: [MediaController],
  providers: [MediaService, SupabaseService],
  exports: [MediaService],
})
export class MediaModule {}
