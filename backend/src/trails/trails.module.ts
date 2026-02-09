import { Module } from '@nestjs/common';
import { TrailsController } from './trails.controller';
import { TrailsService } from './trails.service';
import { SupabaseService } from '../config/supabase.config';

@Module({
  controllers: [TrailsController],
  providers: [TrailsService, SupabaseService],
  exports: [TrailsService],
})
export class TrailsModule {}
