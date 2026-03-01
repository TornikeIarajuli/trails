import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TrailsService } from './trails.service';
import { SupabaseService } from '../config/supabase.config';

// ---------------------------------------------------------------------------
// Chainable Supabase query-builder mock
//
// - Every chainable method returns `self` so calls can be verified with
//   expect(builder.eq).toHaveBeenCalledWith(...)
// - The chain is made thenable so `await query` resolves to `resolveValue`
// - `.single()` also resolves to `resolveValue` (override per-test when needed)
// ---------------------------------------------------------------------------
function makeBuilder(resolveValue: object) {
  const self: Record<string, jest.Mock> & {
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise<unknown>;
    catch: (fn: (e: unknown) => unknown) => Promise<unknown>;
  } = {} as any;

  const chainMethods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'ilike', 'or', 'gte', 'lte', 'gt', 'lt',
    'order', 'range', 'limit', 'head',
  ];

  chainMethods.forEach((m) => {
    self[m] = jest.fn(() => self);
  });

  // .single() returns a standalone promise (not the chain)
  self.single = jest.fn().mockResolvedValue(resolveValue);

  // Make the chain itself awaitable: `const { data } = await query;`
  self.then = (res: any, rej?: any) =>
    Promise.resolve(resolveValue).then(res, rej);
  (self as any).catch = (fn: any) => Promise.resolve(resolveValue).catch(fn);

  return self;
}

// ---------------------------------------------------------------------------
// Test module
// ---------------------------------------------------------------------------
describe('TrailsService', () => {
  let service: TrailsService;
  let adminMock: { from: jest.Mock; rpc: jest.Mock };

  const mockSupabaseService = {
    getAdminClient: jest.fn(),
    getClient: jest.fn(),
  };

  beforeEach(async () => {
    adminMock = {
      from: jest.fn(),
      rpc: jest.fn(),
    };
    mockSupabaseService.getAdminClient.mockReturnValue(adminMock);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrailsService,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    service = module.get<TrailsService>(TrailsService);
    jest.clearAllMocks();
    mockSupabaseService.getAdminClient.mockReturnValue(adminMock);
  });

  // -------------------------------------------------------------------------
  // findAll
  // -------------------------------------------------------------------------
  describe('findAll', () => {
    it('returns data wrapped in a pagination envelope', async () => {
      const rows = [{ id: '1', name_en: 'Ridge Walk' }];
      const builder = makeBuilder({ data: rows, error: null, count: 1 });
      adminMock.from.mockReturnValue(builder);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toEqual(rows);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
    });

    it('computes totalPages correctly via ceiling division', async () => {
      const builder = makeBuilder({ data: [], error: null, count: 42 });
      adminMock.from.mockReturnValue(builder);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.pagination.total).toBe(42);
      expect(result.pagination.totalPages).toBe(3); // ceil(42/20)
    });

    it('defaults to page 1, limit 20 and treats undefined count as 0', async () => {
      const builder = makeBuilder({ data: [], error: null, count: null });
      adminMock.from.mockReturnValue(builder);

      const result = await service.findAll({});

      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
    });

    it('calculates the correct SQL range offset for page 2 with limit 10', async () => {
      const builder = makeBuilder({ data: [], error: null, count: 0 });
      adminMock.from.mockReturnValue(builder);

      await service.findAll({ page: 2, limit: 10 });

      // offset = (2-1)*10 = 10  →  range(10, 19)
      expect(builder.range).toHaveBeenCalledWith(10, 19);
    });

    it('applies an equality filter when difficulty is provided', async () => {
      const builder = makeBuilder({ data: [], error: null, count: 0 });
      adminMock.from.mockReturnValue(builder);

      await service.findAll({ page: 1, limit: 20, difficulty: 'hard' as any });

      expect(builder.eq).toHaveBeenCalledWith('difficulty', 'hard');
    });

    it('applies an ilike filter when region is provided', async () => {
      const builder = makeBuilder({ data: [], error: null, count: 0 });
      adminMock.from.mockReturnValue(builder);

      await service.findAll({ page: 1, limit: 20, region: 'Kazbegi' });

      expect(builder.ilike).toHaveBeenCalledWith('region', '%Kazbegi%');
    });

    it('applies an OR search across name_en, name_ka, description_en', async () => {
      const builder = makeBuilder({ data: [], error: null, count: 0 });
      adminMock.from.mockReturnValue(builder);

      await service.findAll({ page: 1, limit: 20, search: 'peak' });

      expect(builder.or).toHaveBeenCalledWith(expect.stringContaining('name_en.ilike.%peak%'));
      expect(builder.or).toHaveBeenCalledWith(expect.stringContaining('name_ka.ilike.%peak%'));
    });

    it('applies gte filter for min_distance', async () => {
      const builder = makeBuilder({ data: [], error: null, count: 0 });
      adminMock.from.mockReturnValue(builder);

      await service.findAll({ page: 1, limit: 20, min_distance: 5 });

      expect(builder.gte).toHaveBeenCalledWith('distance_km', 5);
    });

    it('applies lte filter for max_distance', async () => {
      const builder = makeBuilder({ data: [], error: null, count: 0 });
      adminMock.from.mockReturnValue(builder);

      await service.findAll({ page: 1, limit: 20, max_distance: 20 });

      expect(builder.lte).toHaveBeenCalledWith('distance_km', 20);
    });

    it('does NOT apply difficulty filter when difficulty is absent', async () => {
      const builder = makeBuilder({ data: [], error: null, count: 0 });
      adminMock.from.mockReturnValue(builder);

      await service.findAll({ page: 1, limit: 20 });

      const eqCalls: [string, unknown][] = builder.eq.mock.calls;
      const difficultyCall = eqCalls.find(([col]) => col === 'difficulty');
      expect(difficultyCall).toBeUndefined();
    });

    it('throws when Supabase returns an error', async () => {
      const builder = makeBuilder({ data: null, error: new Error('DB down'), count: null });
      adminMock.from.mockReturnValue(builder);

      await expect(service.findAll({ page: 1, limit: 20 })).rejects.toThrow();
    });

    it('only queries published trails (is_published = true)', async () => {
      const builder = makeBuilder({ data: [], error: null, count: 0 });
      adminMock.from.mockReturnValue(builder);

      await service.findAll({ page: 1, limit: 20 });

      expect(builder.eq).toHaveBeenCalledWith('is_published', true);
    });
  });

  // -------------------------------------------------------------------------
  // findOne
  // -------------------------------------------------------------------------
  describe('findOne', () => {
    it('throws NotFoundException when the trail row does not exist', async () => {
      const trailBuilder = makeBuilder({ data: null, error: { message: 'Row not found' } });
      adminMock.from.mockReturnValue(trailBuilder);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException with the correct message', async () => {
      const trailBuilder = makeBuilder({ data: null, error: { code: 'PGRST116' } });
      adminMock.from.mockReturnValue(trailBuilder);

      await expect(service.findOne('bad-id')).rejects.toThrow('Trail not found');
    });

    it('returns a trail enriched with media, checkpoints, reviews, conditions, photos', async () => {
      const trail = { id: 'trail-1', name_en: 'Test Trail' };
      const media = [{ id: 'm1', url: 'https://cdn.example.com/img.jpg' }];
      const checkpoints = [{ id: 'cp1', name: 'Summit' }];
      const reviews = [{ rating: 4 }, { rating: 5 }];
      const conditions = [{ id: 'cond1', condition_type: 'slippery' }];

      // Each from() call gets its own builder with the matching resolve value
      const trailB = makeBuilder({ data: trail, error: null });
      const mediaB = makeBuilder({ data: media, error: null });
      const cpB = makeBuilder({ data: checkpoints, error: null });
      const revB = makeBuilder({ data: reviews, error: null });
      const condB = makeBuilder({ data: conditions, error: null, count: 1 });
      const photoB = makeBuilder({ data: null, error: null, count: 3 });

      adminMock.from
        .mockReturnValueOnce(trailB)    // trails
        .mockReturnValueOnce(mediaB)    // trail_media
        .mockReturnValueOnce(cpB)       // trail_checkpoints
        .mockReturnValueOnce(revB)      // trail_reviews
        .mockReturnValueOnce(condB)     // trail_conditions
        .mockReturnValueOnce(photoB);   // trail_photos

      const result = await service.findOne('trail-1');

      expect(result.media).toEqual(media);
      expect(result.checkpoints).toEqual(checkpoints);
      expect(result.photos_count).toBe(3);
      expect(result.conditions_count).toBe(1);
    });

    it('computes avg_rating as a 1-decimal rounded average of review ratings', async () => {
      const trail = { id: 't1', name_en: 'Peak' };
      const reviews = [{ rating: 4 }, { rating: 5 }]; // avg = 4.5

      const trailB = makeBuilder({ data: trail, error: null });
      const emptyB = makeBuilder({ data: [], error: null, count: 0 });
      const revB = makeBuilder({ data: reviews, error: null });

      adminMock.from
        .mockReturnValueOnce(trailB)   // trails
        .mockReturnValueOnce(emptyB)   // trail_media
        .mockReturnValueOnce(emptyB)   // trail_checkpoints
        .mockReturnValueOnce(revB)     // trail_reviews
        .mockReturnValueOnce(emptyB)   // trail_conditions
        .mockReturnValueOnce(emptyB);  // trail_photos

      const result = await service.findOne('t1');

      expect(result.avg_rating).toBe(4.5);
    });

    it('returns null for avg_rating when there are no reviews', async () => {
      const trail = { id: 't1', name_en: 'Empty' };
      const emptyB = makeBuilder({ data: [], error: null, count: 0 });
      const trailB = makeBuilder({ data: trail, error: null });

      adminMock.from
        .mockReturnValueOnce(trailB)
        .mockReturnValueOnce(emptyB)
        .mockReturnValueOnce(emptyB)
        .mockReturnValueOnce(emptyB)
        .mockReturnValueOnce(emptyB)
        .mockReturnValueOnce(emptyB);

      const result = await service.findOne('t1');

      expect(result.avg_rating).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // findNearby
  // -------------------------------------------------------------------------
  describe('findNearby', () => {
    it('converts radius_km to metres before calling the RPC', async () => {
      adminMock.rpc.mockResolvedValue({ data: [], error: null });

      await service.findNearby({ lat: 41.6, lng: 44.8, radius_km: 25 });

      expect(adminMock.rpc).toHaveBeenCalledWith('find_nearby_trails', {
        user_lat: 41.6,
        user_lng: 44.8,
        radius_m: 25_000, // 25 km → 25 000 m
      });
    });

    it('defaults radius_km to 50 km (50 000 m) when not provided', async () => {
      adminMock.rpc.mockResolvedValue({ data: [], error: null });

      await service.findNearby({ lat: 41.6, lng: 44.8 });

      expect(adminMock.rpc).toHaveBeenCalledWith('find_nearby_trails', {
        user_lat: 41.6,
        user_lng: 44.8,
        radius_m: 50_000,
      });
    });

    it('returns the raw RPC data array', async () => {
      const nearby = [{ id: 'n1', name_en: 'Close Peak', distance_from_user_m: 1200 }];
      adminMock.rpc.mockResolvedValue({ data: nearby, error: null });

      const result = await service.findNearby({ lat: 41.0, lng: 44.0, radius_km: 10 });

      expect(result).toEqual(nearby);
    });

    it('throws when the RPC returns an error', async () => {
      adminMock.rpc.mockResolvedValue({ data: null, error: new Error('RPC error') });

      await expect(service.findNearby({ lat: 0, lng: 0 })).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // getRegions
  // -------------------------------------------------------------------------
  describe('getRegions', () => {
    it('returns a de-duplicated, alphabetically sorted list', async () => {
      const builder = makeBuilder({
        data: [
          { region: 'Svaneti' },
          { region: 'Kazbegi' },
          { region: 'Svaneti' }, // duplicate
          { region: 'Racha' },
        ],
        error: null,
      });
      adminMock.from.mockReturnValue(builder);

      const result = await service.getRegions();

      expect(result).toEqual(['Kazbegi', 'Racha', 'Svaneti']);
    });

    it('returns an empty array when no published trails exist', async () => {
      const builder = makeBuilder({ data: [], error: null });
      adminMock.from.mockReturnValue(builder);

      expect(await service.getRegions()).toEqual([]);
    });

    it('only queries published trails', async () => {
      const builder = makeBuilder({ data: [], error: null });
      adminMock.from.mockReturnValue(builder);

      await service.getRegions();

      expect(builder.eq).toHaveBeenCalledWith('is_published', true);
    });

    it('throws when Supabase returns an error', async () => {
      const builder = makeBuilder({ data: null, error: new Error('DB error') });
      adminMock.from.mockReturnValue(builder);

      await expect(service.getRegions()).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // updateDetails
  // -------------------------------------------------------------------------
  describe('updateDetails', () => {
    it('throws NotFoundException when no valid fields are supplied', async () => {
      // Empty DTO — no allowed field is present
      await expect(service.updateDetails('trail-1', {} as any)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.updateDetails('trail-1', {} as any)).rejects.toThrow(
        'No valid fields to update',
      );
    });

    it('updates only the fields that are in the allowlist', async () => {
      const updatedRow = { id: 'trail-1', name_en: 'New Name' };
      const builder = makeBuilder({ data: updatedRow, error: null });
      adminMock.from.mockReturnValue(builder);

      await service.updateDetails('trail-1', { name_en: 'New Name' } as any);

      expect(builder.update).toHaveBeenCalledWith({ name_en: 'New Name' });
    });

    it('filters out fields that are NOT in the allowlist', async () => {
      const builder = makeBuilder({
        data: { id: 't1', name_en: 'Valid' },
        error: null,
      });
      adminMock.from.mockReturnValue(builder);

      await service.updateDetails('t1', {
        name_en: 'Valid',
        // These should be ignored because they are not in allowedFields:
        start_point: [44.8, 41.6] as any,
        route_coordinates: [[44.8, 41.6]] as any,
      } as any);

      expect(builder.update).toHaveBeenCalledWith({ name_en: 'Valid' });
    });

    it('returns the updated trail data on success', async () => {
      const updatedTrail = { id: 't1', name_en: 'Updated', difficulty: 'easy' };
      const builder = makeBuilder({ data: updatedTrail, error: null });
      adminMock.from.mockReturnValue(builder);

      const result = await service.updateDetails('t1', { name_en: 'Updated' } as any);

      expect(result).toEqual(updatedTrail);
    });

    it('targets the correct trail by id', async () => {
      const builder = makeBuilder({ data: { id: 'specific-id' }, error: null });
      adminMock.from.mockReturnValue(builder);

      await service.updateDetails('specific-id', { is_published: true } as any);

      expect(builder.eq).toHaveBeenCalledWith('id', 'specific-id');
    });
  });

  // -------------------------------------------------------------------------
  // remove
  // -------------------------------------------------------------------------
  describe('remove', () => {
    it('returns a success message after deletion', async () => {
      const builder = makeBuilder({ error: null });
      adminMock.from.mockReturnValue(builder);

      const result = await service.remove('trail-1');

      expect(result).toEqual({ message: 'Trail deleted successfully' });
    });

    it('calls DELETE on the correct trail id', async () => {
      const builder = makeBuilder({ error: null });
      adminMock.from.mockReturnValue(builder);

      await service.remove('del-trail');

      expect(builder.delete).toHaveBeenCalled();
      expect(builder.eq).toHaveBeenCalledWith('id', 'del-trail');
    });

    it('throws when Supabase returns an error', async () => {
      const builder = makeBuilder({ error: new Error('Foreign key violation') });
      adminMock.from.mockReturnValue(builder);

      await expect(service.remove('trail-1')).rejects.toThrow();
    });
  });
});
