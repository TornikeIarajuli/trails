import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { SupabaseService } from '../config/supabase.config';

type Builder = Record<string, jest.Mock> & { then: unknown };

function makeBuilder(result: object): Builder {
  const self = {} as Builder;
  ['select', 'insert', 'upsert', 'delete', 'eq', 'or', 'limit'].forEach((m) => {
    self[m] = jest.fn(() => self);
  });
  self.maybeSingle = jest.fn().mockResolvedValue(result);
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

const ME = 'a0000000-0000-0000-0000-000000000001';
const OTHER = 'a0000000-0000-0000-0000-000000000002';
const MISSING_TABLE = { code: 'PGRST205', message: 'table not found' };

describe('ModerationService', () => {
  let service: ModerationService;
  let warnLog: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModerationService,
        {
          provide: SupabaseService,
          useValue: { getAdminClient: () => mockAdmin },
        },
      ],
    }).compile();

    service = module.get(ModerationService);
    jest.clearAllMocks();
    queues.clear();
    warnLog = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => warnLog.mockRestore());

  describe('report', () => {
    const dto = {
      target_type: 'photo' as const,
      target_id: 'photo-1',
      reason: 'spam' as const,
    };

    it('stores the report', async () => {
      const insert = onTable('content_reports', { error: null });

      await expect(service.report(ME, dto)).resolves.toEqual({
        reported: true,
      });
      expect(insert.insert).toHaveBeenCalledWith({
        reporter_id: ME,
        target_type: 'photo',
        target_id: 'photo-1',
        reason: 'spam',
        details: null,
      });
    });

    it('stores a report about a trail itself', async () => {
      const insert = onTable('content_reports', { error: null });

      await expect(
        service.report(ME, {
          target_type: 'trail',
          target_id: 'a0000000-0000-0000-0000-000000000014',
          reason: 'wrong_route',
          details: 'The path leaves the valley 2 km earlier',
        }),
      ).resolves.toEqual({ reported: true });
      expect(insert.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          target_type: 'trail',
          reason: 'wrong_route',
        }),
      );
    });

    it('treats a repeated report as success', async () => {
      onTable('content_reports', {
        error: { code: '23505', message: 'duplicate' },
      });

      await expect(service.report(ME, dto)).resolves.toEqual({
        reported: true,
      });
    });

    it('answers 503 before migration 050 is applied', async () => {
      onTable('content_reports', { error: MISSING_TABLE });

      await expect(service.report(ME, dto)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('blocks', () => {
    it('lists the blocked user ids', async () => {
      onTable('user_blocks', {
        data: [{ blocked_id: OTHER }],
        error: null,
      });

      await expect(service.listBlocks(ME)).resolves.toEqual({
        blocked_user_ids: [OTHER],
      });
    });

    it('lists nobody (and warns once) before migration 050 is applied', async () => {
      onTable('user_blocks', { data: null, error: MISSING_TABLE });
      onTable('user_blocks', { data: null, error: MISSING_TABLE });

      expect(await service.getBlockedUserIds(ME)).toEqual([]);
      expect(await service.getBlockedUserIds(ME)).toEqual([]);
      expect(warnLog).toHaveBeenCalledTimes(1);
    });

    it('blocks a user and removes follows in both directions', async () => {
      onTable('profiles', { data: { id: OTHER }, error: null });
      const upsert = onTable('user_blocks', { error: null });
      const unfollow = onTable('user_follows', { error: null });

      await expect(service.block(ME, OTHER)).resolves.toEqual({
        blocked: true,
      });
      expect(upsert.upsert).toHaveBeenCalledWith(
        { blocker_id: ME, blocked_id: OTHER },
        { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true },
      );
      expect(unfollow.delete).toHaveBeenCalled();
      expect(unfollow.or).toHaveBeenCalledWith(
        `and(follower_id.eq.${ME},following_id.eq.${OTHER}),and(follower_id.eq.${OTHER},following_id.eq.${ME})`,
      );
    });

    it('refuses to block yourself', async () => {
      await expect(service.block(ME, ME.toUpperCase())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('answers 404 for an unknown user', async () => {
      onTable('profiles', { data: null, error: null });

      await expect(service.block(ME, OTHER)).rejects.toThrow(NotFoundException);
    });

    it('unblocks', async () => {
      const del = onTable('user_blocks', { error: null });

      await expect(service.unblock(ME, OTHER)).resolves.toEqual({
        blocked: false,
      });
      expect(del.eq).toHaveBeenCalledWith('blocker_id', ME);
      expect(del.eq).toHaveBeenCalledWith('blocked_id', OTHER);
    });

    it('checks blocks in both directions', async () => {
      const check = onTable('user_blocks', {
        data: [{ blocker_id: OTHER }],
        error: null,
      });

      await expect(service.isBlockedEitherWay(ME, OTHER)).resolves.toBe(true);
      expect(check.or).toHaveBeenCalledWith(
        `and(blocker_id.eq.${ME},blocked_id.eq.${OTHER}),and(blocker_id.eq.${OTHER},blocked_id.eq.${ME})`,
      );
    });

    it('never builds a filter from something that is not a UUID', async () => {
      await expect(service.isBlockedEitherWay(ME, 'x),or(true')).resolves.toBe(
        false,
      );
      expect(mockAdmin.from).not.toHaveBeenCalled();
    });
  });
});
