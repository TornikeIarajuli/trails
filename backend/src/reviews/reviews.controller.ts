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
import { ReviewsService } from './reviews.service';
import { SubmitReviewDto } from './dto/submit-review.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('reviews')
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(AuthGuard)
  submit(@CurrentUser('id') userId: string, @Body() dto: SubmitReviewDto) {
    return this.reviewsService.submit(userId, dto);
  }

  @Get('trail/:trailId')
  getTrailReviews(@Param('trailId', ParseUUIDPipe) trailId: string) {
    return this.reviewsService.getTrailReviews(trailId);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('rating') rating: number,
    @Body('comment') comment?: string,
  ) {
    return this.reviewsService.update(userId, id, rating, comment);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  remove(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reviewsService.remove(userId, id);
  }
}
