import { Global, Module } from '@nestjs/common';
import { SupabaseService } from './supabase.config';

/**
 * Provides the one SupabaseService instance (and therefore the one service-role client)
 * to every module. Import it only in AppModule.
 */
@Global()
@Module({
  providers: [SupabaseService],
  exports: [SupabaseService],
})
export class SupabaseModule {}
