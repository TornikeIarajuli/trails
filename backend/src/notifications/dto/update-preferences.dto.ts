import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  new_follower?: boolean;

  @IsOptional()
  @IsBoolean()
  badge_earned?: boolean;

  @IsOptional()
  @IsBoolean()
  completion_approved?: boolean;

  @IsOptional()
  @IsBoolean()
  event_invite?: boolean;

  @IsOptional()
  @IsBoolean()
  trail_condition?: boolean;
}
