import { Module } from '@nestjs/common';
import { BadgesController } from './badges.controller';
import { BadgesService } from './badges.service';
import { SupabaseService } from '../config/supabase.config';

@Module({
  controllers: [BadgesController],
  providers: [BadgesService, SupabaseService],
  exports: [BadgesService],
})
export class BadgesModule {}
