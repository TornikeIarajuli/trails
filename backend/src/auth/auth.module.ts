import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SupabaseService } from '../config/supabase.config';

@Module({
  controllers: [AuthController],
  providers: [AuthService, SupabaseService],
  exports: [AuthService, SupabaseService],
})
export class AuthModule {}
