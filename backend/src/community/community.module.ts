import { Module } from '@nestjs/common';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';
import { SupabaseService } from '../config/supabase.config';

@Module({
  controllers: [CommunityController],
  providers: [CommunityService, SupabaseService],
  exports: [CommunityService],
})
export class CommunityModule {}
