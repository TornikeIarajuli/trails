import { Module } from '@nestjs/common';
import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';
import { SupabaseService } from '../config/supabase.config';

@Module({
  controllers: [ShopController],
  providers: [ShopService, SupabaseService],
  exports: [ShopService],
})
export class ShopModule {}
