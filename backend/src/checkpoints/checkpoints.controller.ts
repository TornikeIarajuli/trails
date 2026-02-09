import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CheckpointsService } from './checkpoints.service';
import { CreateCheckpointDto } from './dto/create-checkpoint.dto';
import { UpdateCheckpointDto } from './dto/update-checkpoint.dto';
import { SubmitCheckpointCompletionDto } from './dto/submit-checkpoint-completion.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('checkpoints')
export class CheckpointsController {
  constructor(private checkpointsService: CheckpointsService) {}

  @Get('trail/:trailId')
  getByTrail(@Param('trailId', ParseUUIDPipe) trailId: string) {
    return this.checkpointsService.findByTrail(trailId);
  }

  @Get('completions/me')
  @UseGuards(AuthGuard)
  getMyCompletions(@CurrentUser('id') userId: string) {
    return this.checkpointsService.getUserCheckpointCompletions(userId);
  }

  @Get('completions/me/:trailId')
  @UseGuards(AuthGuard)
  getMyTrailCompletions(
    @CurrentUser('id') userId: string,
    @Param('trailId', ParseUUIDPipe) trailId: string,
  ) {
    return this.checkpointsService.getUserCheckpointCompletions(
      userId,
      trailId,
    );
  }

  @Get(':id')
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.checkpointsService.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard)
  create(@Body() dto: CreateCheckpointDto) {
    return this.checkpointsService.create(dto);
  }

  @Post('complete')
  @UseGuards(AuthGuard)
  submitCompletion(
    @CurrentUser('id') userId: string,
    @Body() dto: SubmitCheckpointCompletionDto,
  ) {
    return this.checkpointsService.submitCompletion(userId, dto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCheckpointDto,
  ) {
    return this.checkpointsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.checkpointsService.remove(id);
  }
}
