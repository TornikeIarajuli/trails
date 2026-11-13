import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CompletionsService,
  resolveCompletedAt,
  trackToEwkt,
} from './completions.service';
import { SupabaseService } from '../config/supabase.config';
import { NotificationsService } from '../notifications/notifications.service';
import type { RecordHikeDto, TrackPoint } from './dto/record-hike.dto';

// ---------------------------------------------------------------------------
// Supabase mock: every query method returns the builder; awaiting the builder (or
// calling .single() / .maybeSingle()) resolves to the result queued for that table.
// ---------------------------------------------------------------------------
type Builder = Record<string, jest.Mock> & { then: unknown };

function makeBuilder(result: object): Builder {
  const self = {} as Builder;
  [
    'select',
    'insert',
    'update',
    'upsert',
    'delete',
    'eq',
    'neq',
    'in',
    'not',
    'order',
    'limit',
  ].forEach((m) => {
    self[m] = jest.fn(() => self);
  });
  self.single = jest.fn().mockResolvedValue(result);
  self.maybeSingle = jest.fn().mockResolvedValue(result);
  self.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(res, rej);
  return self;
}

const queues = new Map<string, Builder[]>();

/** Queue the result of the next query against `table`; returns its builder. */
function onTable(table: string, result: object): Builder {
  const builder = makeBuilder(result);
  queues.set(table, [...(queues.get(table) ?? []), builder]);
  return builder;
}

const rpcResults = new Map<string, object>();

const mockAdmin = {
  from: jest.fn((table: string) => {
    const next = queues.get(table)?.shift();
    if (!next) throw new Error(`Unexpected query on ${table}`);
    return next;
  }),
  rpc: jest.fn((name: string) =>
    Promise.resolve(
      rpcResults.get(name) ?? { data: null, error: { message: `no ${name}` } },
    ),
  ),
};

const mockSupabase = {
  getAdminClient: jest.fn(() => mockAdmin),
};

const mockNotifications = {
  sendToUser: jest.fn().mockResolvedValue({ sent: 1 }),
};

/** Lets fire-and-forget work (badge notifications) finish. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

// ---------------------------------------------------------------------------
// Fixtures: a 3 km trail heading north, and tracks along it
// ---------------------------------------------------------------------------
const USER = 'user-1';
const TRAIL_ID = 'a0000000-0000-0000-0000-000000000001';
const M_PER_DEG_LAT = 111_195;
const START = { lat: 42.66, lng: 44.6 };

const ROUTE = {
  type: 'LineString',
  crs: { type: 'name', properties: { name: 'EPSG:4326' } },
  coordinates: Array.from({ length: 61 }, (_, i) => [
    START.lng,
    START.lat + (i * 50) / M_PER_DEG_LAT,
  ]),
};

const TRAIL = { id: TRAIL_ID, distance_km: 3, route: ROUTE };

const T0 = Math.floor(Date.now() / 1000) - 7200;

/** One point every 20 m along the first `fraction` of the trail, 15 s apart. */
function track(fraction = 1): TrackPoint[] {
  const count = Math.floor((3000 * fraction) / 20) + 1;
  return Array.from({ length: count }, (_, i) => [
    START.lat + (i * 20) / M_PER_DEG_LAT,
    START.lng,
    T0 + i * 15,
  ]);
}

const dto = (overrides: Partial<RecordHikeDto> = {}): RecordHikeDto => ({
  trail_id: TRAIL_ID,
  ...overrides,
});

describe('CompletionsService', () => {
  let service: CompletionsService;
  let warnLog: jest.SpyInstance;
  let errorLog: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompletionsService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get<CompletionsService>(CompletionsService);
    jest.clearAllMocks();
    queues.clear();
    rpcResults.clear();
    warnLog = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    errorLog = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnLog.mockRestore();
    errorLog.mockRestore();
  });

  const expectNoCounterRpc = () => {
    const names = mockAdmin.rpc.mock.calls.map(([name]) => name);
    expect(names).not.toContain('increment_trail_count');
    expect(names).not.toContain('decrement_trail_count');
  };

  /** Queue the recount (count + profile update) and the badge check. */
  const expectApprovalSideEffects = (count = 4, badgeIds: string[] = []) => {
    const recount = onTable('trail_completions', { count, error: null });
    const profile = onTable('profiles', { error: null });
    rpcResults.set('check_and_award_badges', { data: badgeIds, error: null });
    if (badgeIds.length > 0) {
      onTable('badges', { data: [{ name_en: 'First Steps' }], error: null });
    }
    return { recount, profile };
  };

  // -------------------------------------------------------------------------
  // recordHike
  // -------------------------------------------------------------------------
  describe('recordHike', () => {
    it('approves a verified hike, recounts, awards badges and stores the track', async () => {
      onTable('trails', { data: TRAIL, error: null });
      onTable('trail_completions', { data: null, error: null });
      const insert = onTable('trail_completions', {
        data: {
          id: 'comp-1',
          user_id: USER,
          trail_id: TRAIL_ID,
          status: 'approved',
        },
        error: null,
      });
      const { recount, profile } = expectApprovalSideEffects(4, ['b1']);
      const hikes = onTable('hikes', { error: null });

      const result = await service.recordHike(
        USER,
        dto({ elapsed_seconds: 5400, distance_m: 3012.4, track: track() }),
      );
      await flush();

      expect(insert.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: USER,
          trail_id: TRAIL_ID,
          status: 'approved',
          reviewer_note: null,
          elapsed_seconds: 5400,
        }),
      );
      expect(recount.eq).toHaveBeenCalledWith('status', 'approved');
      expect(profile.update).toHaveBeenCalledWith({
        total_trails_completed: 4,
      });
      expect(profile.eq).toHaveBeenCalledWith('id', USER);
      expect(mockAdmin.rpc).toHaveBeenCalledWith('check_and_award_badges', {
        p_user_id: USER,
      });
      expectNoCounterRpc();

      expect(result).toMatchObject({
        id: 'comp-1',
        status: 'approved',
        verified: true,
        verification: { coverage: 1, required_coverage: 0.6, reason: 'ok' },
        new_badge_ids: ['b1'],
        already_existed: false,
      });

      const stored = hikes.insert.mock.calls[0][0];
      expect(stored).toMatchObject({
        user_id: USER,
        trail_id: TRAIL_ID,
        completion_id: 'comp-1',
        elapsed_seconds: 5400,
        distance_m: 3012,
        coverage: 1,
        verified: true,
        reason: 'ok',
      });
      expect(stored.track).toMatch(
        /^SRID=4326;LINESTRING\(44\.6000000 42\.6600000,44\.6000000 42\.66017\d+,/,
      );

      expect(mockNotifications.sendToUser).toHaveBeenCalledWith(
        USER,
        'Badge Earned!',
        'You earned: First Steps',
        { badgeIds: ['b1'] },
        'badge_earned',
      );
    });

    it('keeps a hike without a track (released app builds) pending', async () => {
      onTable('trails', { data: TRAIL, error: null });
      onTable('trail_completions', { data: null, error: null });
      const insert = onTable('trail_completions', {
        data: { id: 'comp-1', status: 'pending' },
        error: null,
      });
      const hikes = onTable('hikes', { error: null });

      const result = await service.recordHike(
        USER,
        dto({ elapsed_seconds: 3600 }),
      );

      expect(insert.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending',
          reviewer_note: 'auto: no_track (0%)',
          elapsed_seconds: 3600,
        }),
      );
      expect(result).toMatchObject({
        status: 'pending',
        verified: false,
        verification: { coverage: 0, reason: 'no_track' },
        new_badge_ids: [],
        already_existed: false,
      });
      // a pending completion neither counts nor earns badges
      expect(mockAdmin.from).not.toHaveBeenCalledWith('profiles');
      expect(mockAdmin.rpc).not.toHaveBeenCalled();
      expect(hikes.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          track: null,
          coverage: null,
          verified: false,
          reason: 'no_track',
        }),
      );
    });

    it.each([
      [
        'misses most of the route',
        { track: track(0.5), elapsed_seconds: 3600 },
        'auto: low_coverage (54%)',
        'low_coverage',
      ],
      [
        'is faster than the speed limit',
        { track: track(), elapsed_seconds: 600 },
        'auto: too_fast (100%)',
        'too_fast',
      ],
    ])('keeps a hike that %s pending', async (_label, input, note, reason) => {
      onTable('trails', { data: TRAIL, error: null });
      onTable('trail_completions', { data: null, error: null });
      const insert = onTable('trail_completions', {
        data: { id: 'comp-1', status: 'pending' },
        error: null,
      });
      onTable('hikes', { error: null });

      const result = await service.recordHike(USER, dto(input));

      expect(insert.insert).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending', reviewer_note: note }),
      );
      expect(result.verified).toBe(false);
      expect(result.verification.reason).toBe(reason);
      expect(mockAdmin.rpc).not.toHaveBeenCalled();
    });

    it('keeps a hike on a trail without a route pending', async () => {
      onTable('trails', { data: { ...TRAIL, route: null }, error: null });
      onTable('trail_completions', { data: null, error: null });
      onTable('trail_completions', {
        data: { id: 'comp-1', status: 'pending' },
        error: null,
      });
      const hikes = onTable('hikes', { error: null });

      const result = await service.recordHike(USER, dto({ track: track() }));

      expect(result.verification.reason).toBe('no_route');
      expect(result.verified).toBe(false);
      // the track is still kept for a reviewer
      expect(hikes.insert.mock.calls[0][0].track).toContain('LINESTRING');
    });

    it('asks PostGIS for GeoJSON when the route is not GeoJSON', async () => {
      onTable('trails', {
        data: { ...TRAIL, route: '0102000020E61000000300000000' },
        error: null,
      });
      rpcResults.set('get_trail_route', { data: ROUTE, error: null });
      onTable('trail_completions', { data: null, error: null });
      onTable('trail_completions', {
        data: { id: 'comp-1', status: 'approved' },
        error: null,
      });
      expectApprovalSideEffects();
      onTable('hikes', { error: null });

      const result = await service.recordHike(
        USER,
        dto({ track: track(), elapsed_seconds: 3600 }),
      );

      expect(mockAdmin.rpc).toHaveBeenCalledWith('get_trail_route', {
        trail_uuid: TRAIL_ID,
      });
      expect(result.verification.reason).toBe('ok');
    });

    it('returns an existing approved completion unchanged', async () => {
      const existing = {
        id: 'comp-0',
        user_id: USER,
        trail_id: TRAIL_ID,
        status: 'approved',
        completed_at: '2026-10-01T10:00:00.000Z',
      };
      onTable('trails', { data: TRAIL, error: null });
      onTable('trail_completions', { data: existing, error: null });
      const hikes = onTable('hikes', { error: null });

      const result = await service.recordHike(
        USER,
        dto({ elapsed_seconds: 3600 }),
      );

      expect(result).toMatchObject({
        ...existing,
        verified: true,
        already_existed: true,
        new_badge_ids: [],
      });
      // only the existence check touched trail_completions
      expect(
        mockAdmin.from.mock.calls.filter(([t]) => t === 'trail_completions'),
      ).toHaveLength(1);
      expect(mockAdmin.rpc).not.toHaveBeenCalled();
      // the repeat attempt is still recorded
      expect(hikes.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          completion_id: 'comp-0',
          reason: 'no_track',
        }),
      );
    });

    it.each(['pending', 'rejected'])(
      'upgrades a %s completion when the new attempt verifies',
      async (status) => {
        onTable('trails', { data: TRAIL, error: null });
        onTable('trail_completions', {
          data: { id: 'comp-0', user_id: USER, status },
          error: null,
        });
        const upgrade = onTable('trail_completions', {
          data: { id: 'comp-0', user_id: USER, status: 'approved' },
          error: null,
        });
        const { profile } = expectApprovalSideEffects(7);
        onTable('hikes', { error: null });

        const result = await service.recordHike(
          USER,
          dto({ track: track(), elapsed_seconds: 3600 }),
        );

        expect(upgrade.update).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'approved', reviewer_note: null }),
        );
        expect(upgrade.eq).toHaveBeenCalledWith('id', 'comp-0');
        expect(upgrade.neq).toHaveBeenCalledWith('status', 'approved');
        expect(profile.update).toHaveBeenCalledWith({
          total_trails_completed: 7,
        });
        expect(result).toMatchObject({
          id: 'comp-0',
          status: 'approved',
          verified: true,
          already_existed: false,
        });
      },
    );

    it('leaves a pending completion alone when the new attempt does not verify', async () => {
      onTable('trails', { data: TRAIL, error: null });
      onTable('trail_completions', {
        data: { id: 'comp-0', status: 'pending', reviewer_note: 'auto: x' },
        error: null,
      });
      onTable('hikes', { error: null });

      const result = await service.recordHike(USER, dto({ track: track(0.2) }));

      expect(result).toMatchObject({
        id: 'comp-0',
        status: 'pending',
        verified: false,
        already_existed: false,
      });
      expect(
        mockAdmin.from.mock.calls.filter(([t]) => t === 'trail_completions'),
      ).toHaveLength(1);
    });

    it('treats a concurrent duplicate as the existing completion', async () => {
      onTable('trails', { data: TRAIL, error: null });
      onTable('trail_completions', { data: null, error: null });
      onTable('trail_completions', {
        data: null,
        error: { code: '23505', message: 'duplicate key' },
      });
      onTable('trail_completions', {
        data: { id: 'comp-9', status: 'approved' },
        error: null,
      });
      onTable('hikes', { error: null });

      const result = await service.recordHike(
        USER,
        dto({ track: track(), elapsed_seconds: 3600 }),
      );

      expect(result).toMatchObject({ id: 'comp-9', already_existed: true });
      expect(mockAdmin.rpc).not.toHaveBeenCalled();
    });

    it('answers 404 for an unknown trail', async () => {
      onTable('trails', { data: null, error: null });

      await expect(service.recordHike(USER, dto())).rejects.toThrow(
        NotFoundException,
      );
      expect(mockAdmin.from).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['completed_at in the future', { completed_at: '2999-01-01T00:00:00Z' }],
      [
        'completed_at more than 60 days ago',
        { completed_at: '2020-01-01T00:00:00Z' },
      ],
      [
        'started_at after completed_at',
        {
          started_at: new Date(Date.now() - 1000).toISOString(),
          completed_at: new Date(Date.now() - 60_000).toISOString(),
        },
      ],
    ])('rejects %s without touching the database', async (_label, input) => {
      await expect(service.recordHike(USER, dto(input))).rejects.toThrow(
        BadRequestException,
      );
      expect(mockAdmin.from).not.toHaveBeenCalled();
    });

    it('stores an offline completion with its original time', async () => {
      const completedAt = new Date(
        Date.now() - 2 * 24 * 3600 * 1000,
      ).toISOString();
      const startedAt = new Date(
        Date.parse(completedAt) - 3600 * 1000,
      ).toISOString();
      onTable('trails', { data: TRAIL, error: null });
      onTable('trail_completions', { data: null, error: null });
      const insert = onTable('trail_completions', {
        data: { id: 'comp-1', status: 'pending' },
        error: null,
      });
      const hikes = onTable('hikes', { error: null });

      await service.recordHike(
        USER,
        dto({ completed_at: completedAt, started_at: startedAt }),
      );

      expect(insert.insert).toHaveBeenCalledWith(
        expect.objectContaining({ completed_at: completedAt }),
      );
      expect(hikes.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          completed_at: completedAt,
          started_at: startedAt,
        }),
      );
    });

    it('derives elapsed_seconds from the track when the app sends none', async () => {
      onTable('trails', { data: TRAIL, error: null });
      onTable('trail_completions', { data: null, error: null });
      const insert = onTable('trail_completions', {
        data: { id: 'comp-1', status: 'approved' },
        error: null,
      });
      expectApprovalSideEffects();
      onTable('hikes', { error: null });

      // 151 points 15 s apart
      await service.recordHike(USER, dto({ track: track() }));

      expect(insert.insert).toHaveBeenCalledWith(
        expect.objectContaining({ elapsed_seconds: 2250 }),
      );
    });

    it('still succeeds without the hikes table, and warns only once', async () => {
      for (let i = 0; i < 2; i++) {
        onTable('trails', { data: TRAIL, error: null });
        onTable('trail_completions', { data: null, error: null });
        onTable('trail_completions', {
          data: { id: `comp-${i}`, status: 'pending' },
          error: null,
        });
        onTable('hikes', {
          error: { code: 'PGRST205', message: 'table not found' },
        });
      }

      const first = await service.recordHike(USER, dto());
      const second = await service.recordHike(USER, dto());

      expect(first.id).toBe('comp-0');
      expect(second.id).toBe('comp-1');
      const hikeWarnings = warnLog.mock.calls.filter(([message]) =>
        String(message).includes('migration 048'),
      );
      expect(hikeWarnings).toHaveLength(1);
    });

    it('still succeeds when storing the hike throws', async () => {
      onTable('trails', { data: TRAIL, error: null });
      onTable('trail_completions', { data: null, error: null });
      onTable('trail_completions', {
        data: { id: 'comp-1', status: 'pending' },
        error: null,
      });
      // no hikes result queued: the query throws

      const result = await service.recordHike(USER, dto());

      expect(result.id).toBe('comp-1');
      expect(warnLog).toHaveBeenCalled();
    });

    it('still succeeds when the badge check fails', async () => {
      onTable('trails', { data: TRAIL, error: null });
      onTable('trail_completions', { data: null, error: null });
      onTable('trail_completions', {
        data: { id: 'comp-1', status: 'approved' },
        error: null,
      });
      onTable('trail_completions', { count: 1, error: null });
      onTable('profiles', { error: null });
      rpcResults.set('check_and_award_badges', {
        data: null,
        error: { message: 'function failed' },
      });
      onTable('hikes', { error: null });

      const result = await service.recordHike(
        USER,
        dto({ track: track(), elapsed_seconds: 3600 }),
      );

      expect(result.status).toBe('approved');
      expect(result.new_badge_ids).toEqual([]);
      expect(errorLog).toHaveBeenCalledWith(
        expect.stringContaining('function failed'),
      );
    });

    it('still succeeds when the recount fails', async () => {
      onTable('trails', { data: TRAIL, error: null });
      onTable('trail_completions', { data: null, error: null });
      onTable('trail_completions', {
        data: { id: 'comp-1', status: 'approved' },
        error: null,
      });
      onTable('trail_completions', {
        count: null,
        error: { message: 'timeout' },
      });
      rpcResults.set('check_and_award_badges', { data: [], error: null });
      onTable('hikes', { error: null });

      const result = await service.recordHike(
        USER,
        dto({ track: track(), elapsed_seconds: 3600 }),
      );

      expect(result.status).toBe('approved');
      expect(mockAdmin.from).not.toHaveBeenCalledWith('profiles');
      expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('timeout'));
    });

    it('fails when the completion cannot be saved', async () => {
      onTable('trails', { data: TRAIL, error: null });
      onTable('trail_completions', { data: null, error: null });
      onTable('trail_completions', {
        data: null,
        error: { code: 'XX000', message: 'disk full' },
      });

      await expect(service.recordHike(USER, dto())).rejects.toThrow(
        'Internal server error',
      );
    });
  });

  // -------------------------------------------------------------------------
  // submit (photo proof)
  // -------------------------------------------------------------------------
  describe('submit', () => {
    const submitDto = {
      trail_id: TRAIL_ID,
      proof_photo_url:
        'https://example.supabase.co/storage/v1/object/public/proof-photos/proofs/a.jpg',
      photo_lat: 41.7,
      photo_lng: 44.8,
    };

    it('throws ConflictException if trail already completed', async () => {
      onTable('trail_completions', { data: { id: 'existing' }, error: null });

      await expect(service.submit(USER, submitDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws NotFoundException if trail does not exist', async () => {
      onTable('trail_completions', { data: null, error: null });
      onTable('trails', { data: null, error: null });

      await expect(service.submit(USER, submitDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('auto-approves when GPS is within threshold and recounts', async () => {
      onTable('trail_completions', { data: null, error: null });
      onTable('trails', {
        data: { id: TRAIL_ID, end_point: { type: 'Point' }, name_en: 'Test' },
        error: null,
      });
      onTable('trail_completions', {
        data: { id: 'comp-1', status: 'approved' },
        error: null,
      });
      rpcResults.set('distance_to_trail_endpoint', { data: 100, error: null });
      const { profile } = expectApprovalSideEffects(2);

      const result = await service.submit(USER, submitDto);

      expect(result.auto_approved).toBe(true);
      expect(result.message).toContain('GPS verified');
      expect(profile.update).toHaveBeenCalledWith({
        total_trails_completed: 2,
      });
      expectNoCounterRpc();
    });

    it('sets status to pending when GPS is too far from endpoint', async () => {
      onTable('trail_completions', { data: null, error: null });
      onTable('trails', {
        data: { id: TRAIL_ID, end_point: { type: 'Point' }, name_en: 'Test' },
        error: null,
      });
      const insert = onTable('trail_completions', {
        data: { id: 'comp-1', status: 'pending' },
        error: null,
      });
      rpcResults.set('distance_to_trail_endpoint', { data: 1000, error: null });

      const result = await service.submit(USER, submitDto);

      expect(result.auto_approved).toBe(false);
      expect(result.message).toContain('Pending manual review');
      expect(insert.insert).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending' }),
      );
      expect(mockAdmin.from).not.toHaveBeenCalledWith('profiles');
    });

    it('keeps the completion pending when the distance cannot be computed', async () => {
      onTable('trail_completions', { data: null, error: null });
      onTable('trails', {
        data: { id: TRAIL_ID, end_point: { type: 'Point' }, name_en: 'Test' },
        error: null,
      });
      onTable('trail_completions', {
        data: { id: 'comp-1', status: 'pending' },
        error: null,
      });
      // no distance_to_trail_endpoint result: the RPC fails

      const result = await service.submit(USER, submitDto);

      expect(result.auto_approved).toBe(false);
    });

    it('answers 409 when a concurrent submit won the race', async () => {
      onTable('trail_completions', { data: null, error: null });
      onTable('trails', {
        data: { id: TRAIL_ID, end_point: null, name_en: 'Test' },
        error: null,
      });
      onTable('trail_completions', {
        data: null,
        error: { code: '23505', message: 'duplicate key' },
      });

      await expect(service.submit(USER, submitDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('rejects a completed_at in the future', async () => {
      await expect(
        service.submit(USER, {
          ...submitDto,
          completed_at: '2999-01-01T00:00:00Z',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockAdmin.from).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // deleteCompletion
  // -------------------------------------------------------------------------
  describe('deleteCompletion', () => {
    it('throws NotFoundException when completion does not exist', async () => {
      onTable('trail_completions', { data: null, error: null });

      await expect(service.deleteCompletion(USER, 'bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when user does not own the completion', async () => {
      onTable('trail_completions', {
        data: { id: 'comp-1', user_id: 'other-user', status: 'approved' },
        error: null,
      });

      await expect(service.deleteCompletion(USER, 'comp-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('recounts the approved completions after deleting an approved one', async () => {
      onTable('trail_completions', {
        data: { id: 'comp-1', user_id: USER, status: 'approved' },
        error: null,
      });
      const del = onTable('trail_completions', { error: null });
      onTable('trail_completions', { count: 3, error: null });
      const profile = onTable('profiles', { error: null });

      const result = await service.deleteCompletion(USER, 'comp-1');

      expect(result.deleted).toBe(true);
      expect(del.delete).toHaveBeenCalled();
      expect(profile.update).toHaveBeenCalledWith({
        total_trails_completed: 3,
      });
      expectNoCounterRpc();
    });

    it('does not recount when deleting a pending completion', async () => {
      onTable('trail_completions', {
        data: { id: 'comp-1', user_id: USER, status: 'pending' },
        error: null,
      });
      onTable('trail_completions', { error: null });

      await service.deleteCompletion(USER, 'comp-1');

      expect(mockAdmin.from).not.toHaveBeenCalledWith('profiles');
      expect(mockAdmin.rpc).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // reviewCompletion
  // -------------------------------------------------------------------------
  describe('reviewCompletion', () => {
    const pending = {
      id: 'c1',
      user_id: USER,
      trail_id: TRAIL_ID,
      status: 'pending',
      trails: { name_en: 'Gergeti Trinity Church' },
    };

    it('throws NotFoundException when completion does not exist', async () => {
      onTable('trail_completions', { data: null, error: null });

      await expect(
        service.reviewCompletion('bad-id', 'approved'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when completion is already reviewed', async () => {
      onTable('trail_completions', {
        data: { ...pending, status: 'approved' },
        error: null,
      });

      await expect(service.reviewCompletion('c1', 'approved')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('approves, recounts, awards badges and notifies the hiker', async () => {
      onTable('trail_completions', { data: pending, error: null });
      const update = onTable('trail_completions', {
        data: { id: 'c1', status: 'approved' },
        error: null,
      });
      const { profile } = expectApprovalSideEffects(5);

      const result = await service.reviewCompletion('c1', 'approved');

      expect(result.status).toBe('approved');
      expect(update.update).toHaveBeenCalledWith({ status: 'approved' });
      expect(update.eq).toHaveBeenCalledWith('status', 'pending');
      expect(profile.update).toHaveBeenCalledWith({
        total_trails_completed: 5,
      });
      expectNoCounterRpc();
      expect(mockNotifications.sendToUser).toHaveBeenCalledWith(
        USER,
        'Hike approved',
        'Your hike on Gergeti Trinity Church was approved.',
        { completionId: 'c1', trailId: TRAIL_ID },
        'completion_approved',
      );
    });

    it('rejects with a note and tells nobody', async () => {
      onTable('trail_completions', { data: pending, error: null });
      const update = onTable('trail_completions', {
        data: { id: 'c1', status: 'rejected' },
        error: null,
      });

      const result = await service.reviewCompletion(
        'c1',
        'rejected',
        'No GPS track',
      );

      expect(result.status).toBe('rejected');
      expect(update.update).toHaveBeenCalledWith({
        status: 'rejected',
        reviewer_note: 'No GPS track',
      });
      expect(mockNotifications.sendToUser).not.toHaveBeenCalled();
      expect(mockAdmin.from).not.toHaveBeenCalledWith('profiles');
    });

    it('answers 409 when someone reviewed it in the meantime', async () => {
      onTable('trail_completions', { data: pending, error: null });
      onTable('trail_completions', { data: null, error: null });

      await expect(service.reviewCompletion('c1', 'approved')).rejects.toThrow(
        ConflictException,
      );
      expect(mockNotifications.sendToUser).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // getTrailCompletions
  // -------------------------------------------------------------------------
  describe('getTrailCompletions', () => {
    it('returns only public columns of the newest 100 approved completions', async () => {
      const list = onTable('trail_completions', { data: [], error: null });

      const result = await service.getTrailCompletions(TRAIL_ID);

      expect(result).toEqual([]);
      const columns = String(list.select.mock.calls[0][0]);
      expect(columns).toContain('completed_at');
      expect(columns).toContain('profiles:user_id (id, username, avatar_url)');
      expect(columns).not.toContain('*');
      expect(columns).not.toContain('proof_photo_url');
      expect(columns).not.toContain('photo_lat');
      expect(columns).not.toContain('reviewer_note');
      expect(list.eq).toHaveBeenCalledWith('status', 'approved');
      expect(list.order).toHaveBeenCalledWith('completed_at', {
        ascending: false,
      });
      expect(list.limit).toHaveBeenCalledWith(100);
    });
  });

  // -------------------------------------------------------------------------
  // markHikeActive / markHikeInactive / getActiveCount
  // -------------------------------------------------------------------------
  describe('active hikes', () => {
    it('markHikeActive upserts and returns active: true', async () => {
      const upsert = onTable('active_hikes', { error: null });

      const result = await service.markHikeActive(USER, TRAIL_ID);

      expect(result.active).toBe(true);
      expect(upsert.upsert).toHaveBeenCalledWith(
        { trail_id: TRAIL_ID, user_id: USER },
        { onConflict: 'trail_id,user_id' },
      );
    });

    it('markHikeInactive deletes and returns active: false', async () => {
      onTable('active_hikes', { error: null });

      const result = await service.markHikeInactive(USER, TRAIL_ID);
      expect(result.active).toBe(false);
    });

    it('getActiveCount returns count from Supabase', async () => {
      onTable('active_hikes', { count: 5, error: null });

      const result = await service.getActiveCount(TRAIL_ID);
      expect(result.count).toBe(5);
    });
  });
});

describe('resolveCompletedAt', () => {
  const now = Date.parse('2026-11-13T12:00:00.000Z');

  it('defaults to now', () => {
    expect(resolveCompletedAt(undefined, now)).toBe('2026-11-13T12:00:00.000Z');
  });

  it('normalises an accepted time to UTC ISO', () => {
    expect(resolveCompletedAt('2026-11-13T14:30:00+04:00', now)).toBe(
      '2026-11-13T10:30:00.000Z',
    );
  });

  it('accepts up to 5 minutes in the future and up to 60 days ago', () => {
    expect(() => resolveCompletedAt('2026-11-13T12:05:00Z', now)).not.toThrow();
    expect(() => resolveCompletedAt('2026-09-14T12:00:00Z', now)).not.toThrow();
  });

  it.each(['2026-11-13T12:05:01Z', '2026-09-14T11:59:59Z', 'yesterday'])(
    'rejects %s',
    (value) => {
      expect(() => resolveCompletedAt(value, now)).toThrow(BadRequestException);
    },
  );
});

describe('trackToEwkt', () => {
  it('builds a LINESTRING in lng lat order', () => {
    expect(
      trackToEwkt([
        [42.6654914, 44.6145986, 1],
        [42.6656082, 44.6146712, 2],
      ]),
    ).toBe('SRID=4326;LINESTRING(44.6145986 42.6654914,44.6146712 42.6656082)');
  });

  it('is null for fewer than two points', () => {
    expect(trackToEwkt(undefined)).toBeNull();
    expect(trackToEwkt([])).toBeNull();
    expect(trackToEwkt([[42.66, 44.61, 1]])).toBeNull();
  });

  it('never lets anything but finite in-range numbers into the text', () => {
    const hostile = [
      [42.66, 44.61, 1],
      ['1) ; DROP TABLE hikes; --' as unknown as number, 44.61, 2],
      [NaN, 44.61, 3],
      [42.66, Infinity, 4],
      [100, 44.61, 5],
      [42.67, 44.62, 6],
    ];
    expect(trackToEwkt(hostile)).toBe(
      'SRID=4326;LINESTRING(44.6100000 42.6600000,44.6200000 42.6700000)',
    );
  });
});
