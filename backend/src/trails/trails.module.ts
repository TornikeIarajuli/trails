import { Module } from '@nestjs/common';
import { TrailsController } from './trails.controller';
import { TrailsService } from './trails.service';

@Module({
  controllers: [TrailsController],
  providers: [TrailsService],
  exports: [TrailsService],
})
export class TrailsModule {}
