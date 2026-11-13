import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  currentYearInTbilisi,
  MarkPastHikeDto,
  MIN_PAST_HIKE_YEAR,
} from './mark-past-hike.dto';

const TRAIL_ID = 'a0000000-0000-0000-0000-000000000001';

const errorsFor = async (plain: object) =>
  (await validate(plainToInstance(MarkPastHikeDto, plain))).map(
    (e) => e.property,
  );

describe('currentYearInTbilisi', () => {
  it('uses Georgian time (UTC+4)', () => {
    expect(currentYearInTbilisi(new Date('2026-12-31T19:59:00Z'))).toBe(2026);
    expect(currentYearInTbilisi(new Date('2026-12-31T20:00:00Z'))).toBe(2027);
    expect(currentYearInTbilisi(new Date('2027-01-01T03:00:00Z'))).toBe(2027);
  });
});

describe('MarkPastHikeDto', () => {
  const thisYear = currentYearInTbilisi();

  it.each([MIN_PAST_HIKE_YEAR, 2019, thisYear])(
    'accepts the year %p',
    async (year) => {
      expect(await errorsFor({ trail_id: TRAIL_ID, year })).toEqual([]);
    },
  );

  it.each([
    ['before 1950', 1949],
    ['in the future', thisYear + 1],
    ['not an integer', 2019.5],
    ['a string', '2019'],
    ['missing', undefined],
  ])('rejects a year %s', async (_label, year) => {
    expect(await errorsFor({ trail_id: TRAIL_ID, year })).toContain('year');
  });

  it('rejects a trail id that is not a UUID', async () => {
    expect(await errorsFor({ trail_id: 'trail-1', year: 2019 })).toContain(
      'trail_id',
    );
  });
});
