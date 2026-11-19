import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { XP_PERIODS } from '../xp';
import type { XpPeriod } from '../xp';

/**
 * `?period=week|month|all` ranks hikers by XP over that period. Without it the leaderboard
 * ranks by trails hiked with the app, as released app builds expect.
 */
export class LeaderboardQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn(XP_PERIODS)
  period?: XpPeriod;
}
