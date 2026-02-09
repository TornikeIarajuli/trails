import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { SupabaseService } from '../config/supabase.config';

@Module({
  controllers: [UsersController],
  providers: [UsersService, SupabaseService],
  exports: [UsersService],
})
export class UsersModule {}
