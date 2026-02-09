import { Module } from '@nestjs/common';
import { CheckpointsController } from './checkpoints.controller';
import { CheckpointsService } from './checkpoints.service';
import { SupabaseService } from '../config/supabase.config';

@Module({
  controllers: [CheckpointsController],
  providers: [CheckpointsService, SupabaseService],
  exports: [CheckpointsService],
})
export class CheckpointsModule {}
