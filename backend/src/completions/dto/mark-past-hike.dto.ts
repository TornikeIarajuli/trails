import { IsInt, Min, ValidateBy, ValidationOptions } from 'class-validator';
import { IsLooseUuid } from '../../common/validators/is-loose-uuid';

export const MIN_PAST_HIKE_YEAR = 1950;
const TBILISI_UTC_OFFSET_MS = 4 * 60 * 60 * 1000;

/** The current year in Georgia (Asia/Tbilisi, UTC+4 all year). */
export function currentYearInTbilisi(now: Date = new Date()): number {
  try {
    const year = Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Tbilisi',
        year: 'numeric',
      }).format(now),
    );
    if (Number.isInteger(year)) return year;
  } catch {
    // Node built without time zone data
  }
  return new Date(now.getTime() + TBILISI_UTC_OFFSET_MS).getUTCFullYear();
}

function IsNotFutureYear(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isNotFutureYear',
      validator: {
        validate: (value): boolean =>
          typeof value === 'number' && value <= currentYearInTbilisi(),
        defaultMessage: () => '$property must not be in the future',
      },
    },
    validationOptions,
  );
}

export class MarkPastHikeDto {
  @IsLooseUuid()
  trail_id: string;

  /** The year of the hike; the completion is dated 1 January of that year. */
  @IsInt()
  @Min(MIN_PAST_HIKE_YEAR)
  @IsNotFutureYear()
  year: number;
}
