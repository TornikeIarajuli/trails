import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateBy,
  ValidationOptions,
  buildMessage,
} from 'class-validator';

/** The kinds of place (places.kind, migration 068). */
export const PLACE_KINDS = [
  'peak',
  'pass',
  'lake',
  'waterfall',
  'viewpoint',
  'campsite',
  'hut',
  'cave',
  'canyon',
  'glacier',
  'castle',
  'tower',
  'monastery',
  'hot_spring',
  'fishing',
] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

/** Where `near` may point: Georgia and a margin around it. */
export const NEAR_BOUNDS = {
  minLat: 40,
  maxLat: 44.5,
  minLng: 39.5,
  maxLng: 47,
} as const;

/** { lat, lng } from "lat,lng" inside NEAR_BOUNDS, or null. */
export function parseNear(value: unknown): { lat: number; lng: number } | null {
  if (typeof value !== 'string') return null;
  const match = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(value);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  const { minLat, maxLat, minLng, maxLng } = NEAR_BOUNDS;
  if (lat < minLat || lat > maxLat || lng < minLng || lng > maxLng) return null;
  return { lat, lng };
}

function IsNearPoint(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isNearPoint',
      validator: {
        validate: (value): boolean => parseNear(value) !== null,
        defaultMessage: buildMessage(
          (eachPrefix) =>
            eachPrefix + '$property must be "lat,lng" in or near Georgia',
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}

/** An empty query parameter (`?kind=`) means none. */
const blankToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

/**
 * A number parameter: blank means none, anything else becomes a number to validate. Reads the
 * raw value, since a type conversion would already have turned "" into 0.
 */
const blankOrNumber = ({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}) => {
  const raw = obj[key];
  if (typeof raw !== 'string') return raw;
  const text = raw.trim();
  return text === '' ? undefined : Number(text);
};

/** GET /places: filters, or a point to list the places around (nearest first). */
export class PlacesQueryDto {
  @IsOptional()
  @Transform(blankToUndefined)
  @IsIn(PLACE_KINDS)
  kind?: PlaceKind;

  @IsOptional()
  @Transform(blankToUndefined)
  @IsString()
  @MaxLength(40)
  region?: string;

  /** Part of the English or Georgian name, any case. */
  @IsOptional()
  @Transform(blankToUndefined)
  @IsString()
  @MaxLength(60)
  q?: string;

  /** "lat,lng" */
  @IsOptional()
  @Transform(blankToUndefined)
  @IsNearPoint()
  near?: string;

  /** Around `near` (50 km when not given); ignored without it. */
  @IsOptional()
  @Transform(blankOrNumber)
  @IsNumber()
  @Min(1)
  @Max(300)
  radius_km?: number;

  @IsOptional()
  @Transform(blankOrNumber)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @Transform(blankOrNumber)
  @IsInt()
  @Min(0)
  @Max(10000)
  offset?: number;
}
