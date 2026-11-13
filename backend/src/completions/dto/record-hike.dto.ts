import {
  IsISO8601,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateBy,
  ValidationOptions,
  buildMessage,
} from 'class-validator';
import { IsLooseUuid } from '../../common/validators/is-loose-uuid';

export const MAX_TRACK_POINTS = 5000;
const MAX_ELAPSED_SECONDS = 30 * 24 * 3600;
// Earliest plausible track timestamp (2020-01-01), in unix seconds.
const MIN_TRACK_TIME = 1_577_836_800;
const MAX_CLOCK_SKEW_SECONDS = 24 * 3600;

/** [lat, lng, unixSeconds] */
export type TrackPoint = [number, number, number];

/**
 * True for an array of at most MAX_TRACK_POINTS [lat, lng, unixSeconds] triples with
 * finite, in-range numbers. Checked in one loop: per-element decorators would be far
 * slower on 5000 points.
 */
export function isValidTrack(value: unknown, now = Date.now()): boolean {
  if (!Array.isArray(value) || value.length > MAX_TRACK_POINTS) return false;
  const latest = now / 1000 + MAX_CLOCK_SKEW_SECONDS;

  for (const point of value) {
    if (!Array.isArray(point) || point.length !== 3) return false;
    const [lat, lng, time] = point as unknown[];
    if (
      typeof lat !== 'number' ||
      typeof lng !== 'number' ||
      typeof time !== 'number' ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      !Number.isFinite(time)
    ) {
      return false;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
    if (time < MIN_TRACK_TIME || time > latest) return false;
  }
  return true;
}

function IsTrack(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isTrack',
      validator: {
        validate: (value): boolean => isValidTrack(value),
        defaultMessage: buildMessage(
          (eachPrefix) =>
            eachPrefix +
            `$property must be at most ${MAX_TRACK_POINTS} [lat, lng, unixSeconds] points`,
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}

/**
 * Everything but trail_id is optional: released app builds send only trail_id and
 * elapsed_seconds.
 */
export class RecordHikeDto {
  @IsLooseUuid()
  trail_id: string;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(MAX_ELAPSED_SECONDS)
  elapsed_seconds?: number;

  @IsOptional()
  @IsISO8601({ strict: true })
  started_at?: string;

  /** Checked against the accepted time window by the service. */
  @IsOptional()
  @IsISO8601({ strict: true })
  completed_at?: string;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1_000_000)
  distance_m?: number;

  @IsOptional()
  @IsTrack()
  track?: TrackPoint[];
}
