import { Module } from '@nestjs/common';
import { CompletionsController } from './completions.controller';
import { CompletionsService } from './completions.service';
import { SupabaseService } from '../config/supabase.config';

@Module({
  controllers: [CompletionsController],
  providers: [CompletionsService, SupabaseService],
  exports: [CompletionsService],
})
export class CompletionsModule {}
