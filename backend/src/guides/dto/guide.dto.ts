import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { IsLooseUuid } from '../../common/validators/is-loose-uuid';

/** The regions trails are listed under (trails.region). */
export const GUIDE_REGIONS = [
  'Adjara',
  'Borjomi-Kharagauli',
  'Imereti',
  'Kakheti',
  'Kazbegi',
  'Khevsureti',
  'Kvemo Kartli',
  'Mtskheta-Mtianeti',
  'Racha',
  'Samegrelo',
  'Samtskhe-Javakheti',
  'Shida Kartli',
  'Svaneti',
  'Tbilisi',
  'Tusheti',
] as const;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
/** An empty optional field means none. */
const trimOrNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;
/** "@nino_guide" and "nino_guide" are the same Telegram name. */
const telegramName = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/^@/, '') || null : value;

/** Your guide profile: what hikers see, and how they reach you once you accept. */
export class GuideProfileDto {
  @IsString()
  @Transform(trim)
  @MinLength(3)
  @MaxLength(80)
  headline: string;

  @IsString()
  @Transform(trim)
  @MinLength(20)
  @MaxLength(2000)
  bio: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(GUIDE_REGIONS.length)
  @IsIn(GUIDE_REGIONS, { each: true })
  regions: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  languages: string[];

  @IsOptional()
  @Transform(trimOrNull)
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(300)
  certifications?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(100000)
  price_gel?: number | null;

  @IsOptional()
  @Transform(trimOrNull)
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  price_note?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @ValidateIf((_, value) => value !== null)
  @Matches(/^\+?[0-9 ()-]{6,30}$/, {
    message: 'contact_phone must be a phone number',
  })
  contact_phone?: string | null;

  @IsOptional()
  @IsBoolean()
  contact_whatsapp?: boolean;

  @IsOptional()
  @Transform(telegramName)
  @ValidateIf((_, value) => value !== null)
  @Matches(/^[A-Za-z0-9_]{3,40}$/, {
    message: 'contact_telegram must be a Telegram username',
  })
  contact_telegram?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsLooseUuid({ each: true })
  trail_ids?: string[];

  /** false takes the listing down for now; true puts it back. */
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class GuidesQueryDto {
  @IsOptional()
  @IsIn(GUIDE_REGIONS)
  region?: string;

  @IsOptional()
  @IsLooseUuid()
  trail_id?: string;
}

/** A hiker's request to hike with a guide. */
export class CreateBookingDto {
  @IsLooseUuid()
  guide_id: string;

  @IsOptional()
  @IsLooseUuid()
  trail_id?: string;

  /** The first day, YYYY-MM-DD (today or later, Georgian time). */
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'start_date must be a date (YYYY-MM-DD)',
  })
  start_date: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  days: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  group_size: number;

  @IsString()
  @Transform(trim)
  @MinLength(1)
  @MaxLength(1000)
  message: string;
}

export const BOOKING_ANSWERS = ['accepted', 'declined', 'cancelled'] as const;
export type BookingAnswer = (typeof BOOKING_ANSWERS)[number];

/** The guide accepts or declines (with a reply); the hiker cancels. */
export class UpdateBookingDto {
  @IsIn(BOOKING_ANSWERS)
  status: BookingAnswer;

  @IsOptional()
  @Transform(trimOrNull)
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(1000)
  reply?: string | null;
}
