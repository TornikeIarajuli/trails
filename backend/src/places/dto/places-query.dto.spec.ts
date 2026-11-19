import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  NEAR_BOUNDS,
  PLACE_KINDS,
  PlacesQueryDto,
  parseNear,
} from './places-query.dto';

async function check(plain: object) {
  const dto = plainToInstance(PlacesQueryDto, plain);
  return { dto, errors: (await validate(dto)).map((e) => e.property).sort() };
}

describe('PlacesQueryDto', () => {
  it('takes no filters at all', async () => {
    expect((await check({})).errors).toEqual([]);
  });

  it('takes every filter, numbers as they come in a query string', async () => {
    const { dto, errors } = await check({
      kind: 'waterfall',
      region: 'Svaneti',
      q: 'Shdugra',
      near: '43.04,42.73',
      radius_km: '25.5',
      limit: '20',
      offset: '40',
    });
    expect(errors).toEqual([]);
    expect(dto.radius_km).toBe(25.5);
    expect(dto.limit).toBe(20);
    expect(dto.offset).toBe(40);
  });

  it('knows the fifteen kinds and nothing else', async () => {
    expect(PLACE_KINDS).toHaveLength(15);
    for (const kind of PLACE_KINDS) {
      expect((await check({ kind })).errors).toEqual([]);
    }
    expect((await check({ kind: 'volcano' })).errors).toEqual(['kind']);
  });

  it('keeps the region and the search text short', async () => {
    expect(
      (await check({ region: 'x'.repeat(40), q: 'y'.repeat(60) })).errors,
    ).toEqual([]);
    expect(
      (await check({ region: 'x'.repeat(41), q: 'y'.repeat(61) })).errors,
    ).toEqual(['q', 'region']);
  });

  it('wants near as "lat,lng" in or around Georgia', async () => {
    for (const near of [
      '41.69,44.80',
      ' 42.66 , 44.64 ',
      '40,39.5',
      '44.5,47',
    ]) {
      expect((await check({ near })).errors).toEqual([]);
    }
    for (const near of [
      '44.80,41.69', // lng,lat
      '41.69',
      '41.69;44.80',
      'tbilisi',
      '39.9,44',
      '41,47.1',
      '41.69,44.80,1',
    ]) {
      expect((await check({ near })).errors).toEqual(['near']);
    }
  });

  it('keeps radius, limit and offset in range', async () => {
    expect((await check({ radius_km: 1, limit: 1, offset: 0 })).errors).toEqual(
      [],
    );
    expect(
      (await check({ radius_km: 300, limit: 200, offset: 10000 })).errors,
    ).toEqual([]);
    expect(
      (await check({ radius_km: 0.5, limit: 0, offset: -1 })).errors,
    ).toEqual(['limit', 'offset', 'radius_km']);
    expect(
      (await check({ radius_km: 301, limit: 201, offset: 10001 })).errors,
    ).toEqual(['limit', 'offset', 'radius_km']);
    expect((await check({ limit: '2.5', offset: 'abc' })).errors).toEqual([
      'limit',
      'offset',
    ]);
  });

  it('takes an empty parameter as none', async () => {
    const { dto, errors } = await check({
      kind: '',
      region: ' ',
      q: '',
      near: '',
      radius_km: '',
      limit: '',
      offset: '',
    });
    expect(errors).toEqual([]);
    expect(dto.kind).toBeUndefined();
    expect(dto.region).toBeUndefined();
    expect(dto.q).toBeUndefined();
    expect(dto.near).toBeUndefined();
    expect(dto.limit).toBeUndefined();
  });

  it('trims the search text and the region', async () => {
    const { dto } = await check({ q: '  Okatse ', region: ' Samegrelo ' });
    expect(dto.q).toBe('Okatse');
    expect(dto.region).toBe('Samegrelo');
  });
});

describe('parseNear', () => {
  it('reads "lat,lng" inside the bounds', () => {
    expect(parseNear('41.6938,44.8015')).toEqual({
      lat: 41.6938,
      lng: 44.8015,
    });
    expect(parseNear('-41,44')).toBeNull();
    expect(parseNear(`${NEAR_BOUNDS.maxLat + 0.01},44`)).toBeNull();
    expect(parseNear(undefined)).toBeNull();
    expect(parseNear(41.69)).toBeNull();
  });
});
