import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  isValidTrack,
  MAX_TRACK_POINTS,
  RecordHikeDto,
} from './record-hike.dto';

const TRAIL_ID = 'a0000000-0000-0000-0000-000000000001';
const NOW = Math.floor(Date.now() / 1000);

const errorsFor = async (plain: object) =>
  (await validate(plainToInstance(RecordHikeDto, plain))).map(
    (e) => e.property,
  );

describe('RecordHikeDto', () => {
  it('accepts the payload released app builds send', async () => {
    expect(
      await errorsFor({ trail_id: TRAIL_ID, elapsed_seconds: 3600 }),
    ).toEqual([]);
    expect(await errorsFor({ trail_id: TRAIL_ID })).toEqual([]);
  });

  it('accepts a full payload', async () => {
    expect(
      await errorsFor({
        trail_id: TRAIL_ID,
        elapsed_seconds: 5400,
        started_at: '2026-11-13T07:00:00.000Z',
        completed_at: '2026-11-13T08:30:00.000Z',
        distance_m: 6120,
        track: [
          [42.6655, 44.6146, NOW - 5400],
          [42.6656, 44.6147, NOW - 5390],
        ],
      }),
    ).toEqual([]);
  });

  it.each([
    ['trail_id', { trail_id: 'not-a-uuid' }],
    ['elapsed_seconds', { trail_id: TRAIL_ID, elapsed_seconds: -1 }],
    ['elapsed_seconds', { trail_id: TRAIL_ID, elapsed_seconds: '3600' }],
    ['started_at', { trail_id: TRAIL_ID, started_at: 'yesterday' }],
    ['completed_at', { trail_id: TRAIL_ID, completed_at: '13/11/2026' }],
    ['distance_m', { trail_id: TRAIL_ID, distance_m: -5 }],
    ['track', { trail_id: TRAIL_ID, track: 'lots of points' }],
  ])('rejects an invalid %s', async (property, plain) => {
    expect(await errorsFor(plain)).toContain(property);
  });
});

describe('isValidTrack', () => {
  const point = (lat = 42.66, lng = 44.6, time = NOW - 60) => [lat, lng, time];

  it('accepts an empty track and a track at the size limit', () => {
    expect(isValidTrack([])).toBe(true);
    expect(
      isValidTrack(Array.from({ length: MAX_TRACK_POINTS }, () => point())),
    ).toBe(true);
  });

  it('rejects more than the maximum number of points', () => {
    expect(
      isValidTrack(Array.from({ length: MAX_TRACK_POINTS + 1 }, () => point())),
    ).toBe(false);
  });

  it.each([
    ['a point with two values', [[42.66, 44.6]]],
    ['a point with four values', [[42.66, 44.6, NOW, 1800]]],
    ['a point that is not an array', [{ lat: 42.66, lng: 44.6, t: NOW }]],
    ['a string coordinate', [['42.66', 44.6, NOW]]],
    ['a null coordinate', [[null, 44.6, NOW]]],
    ['NaN', [[NaN, 44.6, NOW]]],
    ['Infinity', [[42.66, Infinity, NOW]]],
    ['latitude above 90', [point(90.1)]],
    ['latitude below -90', [point(-90.1)]],
    ['longitude above 180', [point(42.66, 180.1)]],
    ['longitude below -180', [point(42.66, -180.1)]],
    ['a timestamp before 2020', [point(42.66, 44.6, 1_500_000_000)]],
    ['a timestamp in milliseconds', [point(42.66, 44.6, NOW * 1000)]],
    ['a timestamp days in the future', [point(42.66, 44.6, NOW + 3 * 86400)]],
  ])('rejects %s', (_label, track) => {
    expect(isValidTrack([point(), ...track])).toBe(false);
  });

  it('rejects anything that is not an array', () => {
    for (const value of [null, undefined, 'track', 42, { 0: point() }]) {
      expect(isValidTrack(value)).toBe(false);
    }
  });
});
