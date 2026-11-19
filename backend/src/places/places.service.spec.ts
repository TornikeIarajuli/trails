import { Test } from '@nestjs/testing';
import { Logger, NotFoundException } from '@nestjs/common';
import { PlacesService, nameFilter } from './places.service';
import { SupabaseService } from '../config/supabase.config';

type Builder = Record<string, jest.Mock> & { then: unknown };

function makeBuilder(result: object): Builder {
  const self = {} as Builder;
  [
    'select',
    'eq',
    'neq',
    'or',
    'gte',
    'lte',
    'order',
    'range',
    'limit',
    'maybeSingle',
  ].forEach((m) => {
    self[m] = jest.fn(() => self);
  });
  self.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(res, rej);
  return self;
}

const queues = new Map<string, Builder[]>();
function onTable(table: string, result: object): Builder {
  const builder = makeBuilder(result);
  queues.set(table, [...(queues.get(table) ?? []), builder]);
  return builder;
}

const mockAdmin = {
  from: jest.fn((table: string) => {
    const next = queues.get(table)?.shift();
    if (!next) throw new Error(`Unexpected query on ${table}`);
    return next;
  }),
};

const SUMMARY_COLUMNS =
  'id, kind, name_en, name_ka, latitude, longitude, elevation_m, region, notability';
const missingTable = {
  code: 'PGRST205',
  message: "Could not find the table 'public.places' in the schema cache",
};
const ID = 'b3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

// Around Mestia (43.045 N, 42.73 E): 0.01° of latitude is 1.1 km
const place = (id: string, over: object = {}) => ({
  id,
  kind: 'peak',
  name_en: `Peak ${id}`,
  name_ka: null,
  latitude: 43.045,
  longitude: 42.73,
  elevation_m: 3000,
  region: 'Svaneti',
  notability: 2,
  ...over,
});

describe('PlacesService', () => {
  let service: PlacesService;
  let warn: jest.SpyInstance;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PlacesService,
        {
          provide: SupabaseService,
          useValue: { getAdminClient: () => mockAdmin },
        },
      ],
    }).compile();
    service = module.get(PlacesService);
    jest.clearAllMocks();
    queues.clear();
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => warn.mockRestore());

  describe('list', () => {
    it('lists the most notable places first, a page at a time, with the total', async () => {
      const rows = [place('p1', { notability: 9 }), place('p2')];
      const places = onTable('places', { data: rows, error: null, count: 120 });

      const result = await service.list({ limit: 20, offset: 40 });

      expect(places.select).toHaveBeenCalledWith(SUMMARY_COLUMNS, {
        count: 'exact',
      });
      expect(places.order.mock.calls).toEqual([
        ['notability', { ascending: false }],
        ['name_en', { ascending: true }],
        ['id', { ascending: true }],
      ]);
      expect(places.range).toHaveBeenCalledWith(40, 59);
      expect(places.eq).not.toHaveBeenCalled();
      expect(places.or).not.toHaveBeenCalled();
      expect(result).toEqual({ data: rows, total: 120 });
    });

    it('reads 50 from the start by default', async () => {
      const places = onTable('places', { data: [], error: null, count: 0 });
      await expect(service.list({})).resolves.toEqual({ data: [], total: 0 });
      expect(places.range).toHaveBeenCalledWith(0, 49);
    });

    it('filters by kind, region and part of either name', async () => {
      const places = onTable('places', { data: [], error: null, count: 0 });

      await service.list({ kind: 'lake', region: 'Svaneti', q: 'Koruldi' });

      expect(places.eq.mock.calls).toEqual([
        ['kind', 'lake'],
        ['region', 'Svaneti'],
      ]);
      expect(places.or).toHaveBeenCalledWith(
        'name_en.ilike."%Koruldi%",name_ka.ilike."%Koruldi%"',
      );
    });

    it('answers a page past the last one with nothing and the real total', async () => {
      onTable('places', {
        data: null,
        error: { code: 'PGRST103', message: 'Requested range not satisfiable' },
        count: null,
      });
      const head = onTable('places', { data: null, error: null, count: 12 });

      await expect(
        service.list({ kind: 'cave', offset: 100 }),
      ).resolves.toEqual({ data: [], total: 12 });
      expect(head.select).toHaveBeenCalledWith('id', {
        count: 'exact',
        head: true,
      });
      expect(head.eq).toHaveBeenCalledWith('kind', 'cave');
    });

    it('is empty, with one warning, until migration 068 is applied', async () => {
      onTable('places', { data: null, error: missingTable, count: null });
      onTable('places', { data: null, error: missingTable });

      await expect(service.list({})).resolves.toEqual({ data: [], total: 0 });
      await expect(service.list({ near: '42.66,44.64' })).resolves.toEqual({
        data: [],
        total: 0,
      });
      expect(warn).toHaveBeenCalledTimes(1);
    });
  });

  describe('list near a point', () => {
    it('lists the places within the radius nearest first, each with its distance', async () => {
      const places = onTable('places', {
        data: [
          place('a', { latitude: 43.145, notability: 9 }), // 11.1 km north
          place('b', { latitude: 43.055, notability: 1 }), // 1.1 km north
          place('corner', { latitude: 43.445, longitude: 43.28 }), // in the box, 63 km away
          place('d', { latitude: 43.055, notability: 5 }), // as near as b, more notable
        ],
        error: null,
      });

      const result = await service.list({ near: '43.045,42.73' });

      // the box around a 50 km circle
      expect(places.gte).toHaveBeenCalledWith(
        'latitude',
        expect.closeTo(42.59534, 3),
      );
      expect(places.lte).toHaveBeenCalledWith(
        'latitude',
        expect.closeTo(43.49466, 3),
      );
      expect(places.gte).toHaveBeenCalledWith(
        'longitude',
        expect.closeTo(42.11471, 3),
      );
      expect(places.lte).toHaveBeenCalledWith(
        'longitude',
        expect.closeTo(43.34529, 3),
      );
      expect(places.order.mock.calls).toEqual([
        ['notability', { ascending: false }],
        ['id', { ascending: true }],
      ]);
      expect(places.range).toHaveBeenCalledWith(0, 999);
      expect(result.total).toBe(3);
      expect(result.data.map((p) => [p.id, p.distance_km])).toEqual([
        ['d', 1.1],
        ['b', 1.1],
        ['a', 11.1],
      ]);
      expect(result.data[0]).toEqual({
        ...place('d', { latitude: 43.055, notability: 5 }),
        distance_km: 1.1,
      });
    });

    it('applies the filters and pages through the box', async () => {
      const page = Array.from({ length: 1000 }, (_, i) =>
        place(`p${i}`, { latitude: 43.05 }),
      );
      const first = onTable('places', { data: page, error: null });
      const second = onTable('places', {
        data: [place('last', { latitude: 43.06 })],
        error: null,
      });

      const result = await service.list({
        near: '43.045,42.73',
        radius_km: 10,
        kind: 'tower',
        limit: 2,
        offset: 1000,
      });

      expect(first.eq).toHaveBeenCalledWith('kind', 'tower');
      expect(first.range).toHaveBeenCalledWith(0, 999);
      expect(second.range).toHaveBeenCalledWith(1000, 1999);
      expect(result.total).toBe(1001);
      expect(result.data.map((p) => p.id)).toEqual(['last']);
    });

    it('reads at most 3000 places from the box', async () => {
      const full = (n: number) =>
        Array.from({ length: 1000 }, (_, i) => place(`${n}-${i}`));
      onTable('places', { data: full(1), error: null });
      onTable('places', { data: full(2), error: null });
      const third = onTable('places', { data: full(3), error: null });

      const result = await service.list({ near: '43.045,42.73', limit: 200 });

      expect(third.range).toHaveBeenCalledWith(2000, 2999);
      expect(mockAdmin.from).toHaveBeenCalledTimes(3);
      expect(result.total).toBe(3000);
      expect(result.data).toHaveLength(200);
      expect(result.data[0].distance_km).toBe(0);
    });
  });

  describe('findOne', () => {
    const detailRow = {
      ...place(ID, {
        kind: 'lake',
        name_en: 'Koruldi Lakes',
        name_ka: 'ქორულდის ტბები',
        elevation_m: 2740,
        notability: 5,
      }),
      osm_type: 'way',
      osm_id: 123456,
      wikidata: 'Q1',
      wikipedia: 'en:Koruldi Lakes',
      tags: { water: 'lake' },
    };
    const geo = (lng: number, lat: number) => ({
      type: 'Point',
      crs: { type: 'name', properties: { name: 'EPSG:4326' } },
      coordinates: [lng, lat],
    });
    const trails = [
      {
        id: 't-far',
        name_en: 'Far',
        region: 'Racha',
        difficulty: 'hard',
        start_point: geo(43.5, 42.6),
      }, // 80 km
      {
        id: 't-5',
        name_en: 'Five',
        region: 'Svaneti',
        difficulty: 'medium',
        start_point: geo(42.73, 43.09),
      },
      {
        id: 't-1',
        name_en: 'One',
        region: 'Svaneti',
        difficulty: 'easy',
        start_point: geo(42.73, 43.054),
      },
      {
        id: 't-none',
        name_en: 'No start',
        region: 'Svaneti',
        difficulty: 'easy',
        start_point: null,
      },
      // the start point as JSON text
      {
        id: 't-10',
        name_en: 'Ten',
        region: 'Svaneti',
        difficulty: 'easy',
        start_point: JSON.stringify(geo(42.73, 43.135)),
      },
    ];
    const around = [
      place('n1', { latitude: 43.065, notability: 3 }), // 2.2 km
      place('n2', { latitude: 43.145, notability: 9 }), // 11.1 km
      place('n3', { latitude: 43.055, notability: 3 }), // 1.1 km
      place('edge', { latitude: 43.145, longitude: 42.87, notability: 12 }), // in the box, 15.9 km
    ];

    it('returns the place with the trails and places around it', async () => {
      onTable('places', { data: detailRow, error: null });
      const trailQuery = onTable('trails', { data: trails, error: null });
      const nearby = onTable('places', { data: around, error: null });

      const result = await service.findOne(ID);

      expect(trailQuery.select).toHaveBeenCalledWith(
        'id, name_en, region, difficulty, start_point',
      );
      expect(trailQuery.eq).toHaveBeenCalledWith('is_published', true);
      expect(nearby.select).toHaveBeenCalledWith(SUMMARY_COLUMNS);
      expect(nearby.neq).toHaveBeenCalledWith('id', ID);
      expect(nearby.gte).toHaveBeenCalledWith(
        'latitude',
        expect.closeTo(42.91, 2),
      );
      expect(nearby.limit).toHaveBeenCalledWith(200);
      expect(result).toEqual({
        id: ID,
        kind: 'lake',
        name_en: 'Koruldi Lakes',
        name_ka: 'ქორულდის ტბები',
        latitude: 43.045,
        longitude: 42.73,
        elevation_m: 2740,
        region: 'Svaneti',
        notability: 5,
        osm_type: 'way',
        osm_id: 123456,
        wikidata: 'Q1',
        wikipedia: 'en:Koruldi Lakes',
        tags: { water: 'lake' },
        nearby_trails: [
          {
            id: 't-1',
            name_en: 'One',
            region: 'Svaneti',
            difficulty: 'easy',
            distance_km: 1,
          },
          {
            id: 't-5',
            name_en: 'Five',
            region: 'Svaneti',
            difficulty: 'medium',
            distance_km: 5,
          },
          {
            id: 't-10',
            name_en: 'Ten',
            region: 'Svaneti',
            difficulty: 'easy',
            distance_km: 10,
          },
        ],
        nearby_places: [
          { ...around[1], distance_km: 11.1 },
          { ...around[2], distance_km: 1.1 },
          { ...around[0], distance_km: 2.2 },
        ],
      });
    });

    it('keeps at most eight trails and eight places', async () => {
      const many = Array.from({ length: 12 }, (_, i) => ({
        id: `t${i}`,
        name_en: `Trail ${i}`,
        region: 'Svaneti',
        difficulty: 'easy',
        start_point: geo(42.73, 43.045 + i * 0.001),
      }));
      onTable('places', { data: detailRow, error: null });
      onTable('trails', { data: many, error: null });
      onTable('places', {
        data: Array.from({ length: 12 }, (_, i) => place(`n${i}`)),
        error: null,
      });

      const result = await service.findOne(ID);

      expect(result.nearby_trails.map((t) => t.id)).toEqual([
        't0',
        't1',
        't2',
        't3',
        't4',
        't5',
        't6',
        't7',
      ]);
      expect(result.nearby_places).toHaveLength(8);
    });

    it('reads the trails once in ten minutes', async () => {
      onTable('places', { data: detailRow, error: null });
      onTable('trails', { data: trails, error: null });
      onTable('places', { data: [], error: null });
      onTable('places', { data: detailRow, error: null });
      onTable('places', { data: [], error: null });

      await service.findOne(ID);
      const again = await service.findOne(ID);

      expect(
        mockAdmin.from.mock.calls.filter(([table]) => table === 'trails'),
      ).toHaveLength(1);
      expect(again.nearby_trails.map((t) => t.id)).toEqual([
        't-1',
        't-5',
        't-10',
      ]);
    });

    it('answers 404 for a place that does not exist', async () => {
      onTable('places', { data: null, error: null });
      await expect(service.findOne(ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('answers 404, with one warning, until migration 068 is applied', async () => {
      onTable('places', { data: null, error: missingTable });
      onTable('places', { data: null, error: missingTable });

      await expect(service.findOne(ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.findOne(ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(warn).toHaveBeenCalledTimes(1);
    });
  });
});

describe('nameFilter', () => {
  it('quotes the text and takes out what would change the filter', () => {
    expect(nameFilter('St. George (old), "x"')).toBe(
      'name_en.ilike."%St. George (old), x%",name_ka.ilike."%St. George (old), x%"',
    );
    expect(nameFilter('100% *')).toBe(
      'name_en.ilike."%100%",name_ka.ilike."%100%"',
    );
    expect(nameFilter('ტბა')).toBe(
      'name_en.ilike."%ტბა%",name_ka.ilike."%ტბა%"',
    );
    expect(nameFilter(' "%* ')).toBeNull();
    expect(nameFilter(undefined)).toBeNull();
  });
});
