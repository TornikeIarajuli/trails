import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CompletionsService } from './completions.service';
import { SupabaseService } from '../config/supabase.config';
import { NotificationsService } from '../notifications/notifications.service';

// ---------------------------------------------------------------------------
// Chainable query builder helper
// ---------------------------------------------------------------------------
const chain = (result: object) => {
  const c: Record<string, jest.Mock> = {};
  c.select = jest.fn().mockReturnValue(c);
  c.eq = jest.fn().mockReturnValue(c);
  c.insert = jest.fn().mockReturnValue(c);
  c.upsert = jest.fn().mockReturnValue(c);
  c.delete = jest.fn().mockReturnValue(c);
  c.update = jest.fn().mockReturnValue(c);
  c.not = jest.fn().mockReturnValue(c);
  c.order = jest.fn().mockReturnValue(c);
  c.single = jest.fn().mockResolvedValue(result);
  return c;
};

const headChain = (count: number) => {
  const c: Record<string, jest.Mock> = {};
  c.select = jest.fn().mockReturnValue(c);
  c.eq = jest.fn().mockReturnValue(c);
  c.single = jest.fn().mockResolvedValue({ count, error: null });
  return c;
};

const mockAdmin: Record<string, any> = {
  from: jest.fn(),
  rpc: jest.fn(),
};

const mockSupabase = {
  getAdminClient: jest.fn(() => mockAdmin),
};

const mockNotifications = {
  sendToUser: jest.fn().mockResolvedValue({ sent: 1 }),
};

describe('CompletionsService', () => {
  let service: CompletionsService;

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
    mockSupabase.getAdminClient.mockReturnValue(mockAdmin);
  });

  // -------------------------------------------------------------------------
  // submit
  // -------------------------------------------------------------------------
  describe('submit', () => {
    const dto = {
      trail_id: 'trail-1',
      proof_photo_url: 'https://example.com/proof.jpg',
      photo_lat: 41.7,
      photo_lng: 44.8,
    };

    it('throws ConflictException if trail already completed', async () => {
      mockAdmin.from.mockReturnValue(
        chain({ data: { id: 'existing' }, error: null }),
      );

      await expect(service.submit('user-1', dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws NotFoundException if trail does not exist', async () => {
      // First call: no existing completion
      const noExisting = chain({ data: null, error: null });
      // Second call: trail not found
      const noTrail = chain({ data: null, error: null });

      mockAdmin.from
        .mockReturnValueOnce(noExisting) // trail_completions check
        .mockReturnValueOnce(noTrail); // trails lookup

      await expect(service.submit('user-1', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('auto-approves when GPS is within threshold', async () => {
      const noExisting = chain({ data: null, error: null });
      const trailData = chain({
        data: { id: 'trail-1', end_point: 'POINT(44.8 41.7)', name_en: 'Test Trail' },
        error: null,
      });
      const insertResult = chain({
        data: { id: 'comp-1', status: 'approved' },
        error: null,
      });

      mockAdmin.from
        .mockReturnValueOnce(noExisting)
        .mockReturnValueOnce(trailData)
        .mockReturnValueOnce(insertResult);

      // distance_to_trail_endpoint returns 100m (within 500m threshold)
      mockAdmin.rpc
        .mockResolvedValueOnce({ data: 100, error: null }) // distance
        .mockResolvedValueOnce({ data: null, error: null }) // increment
        .mockResolvedValueOnce({ data: [], error: null }); // check_and_award_badges

      const result = await service.submit('user-1', dto);

      expect(result.auto_approved).toBe(true);
      expect(result.message).toContain('GPS verified');
    });

    it('sets status to pending when GPS is too far from endpoint', async () => {
      const noExisting = chain({ data: null, error: null });
      const trailData = chain({
        data: { id: 'trail-1', end_point: 'POINT(44.8 41.7)', name_en: 'Test' },
        error: null,
      });
      const insertResult = chain({
        data: { id: 'comp-1', status: 'pending' },
        error: null,
      });

      mockAdmin.from
        .mockReturnValueOnce(noExisting)
        .mockReturnValueOnce(trailData)
        .mockReturnValueOnce(insertResult);

      // distance_to_trail_endpoint returns 1000m (beyond 500m threshold)
      mockAdmin.rpc.mockResolvedValueOnce({ data: 1000, error: null });

      const result = await service.submit('user-1', dto);

      expect(result.auto_approved).toBe(false);
      expect(result.message).toContain('Pending manual review');
    });
  });

  // -------------------------------------------------------------------------
  // recordHike
  // -------------------------------------------------------------------------
  describe('recordHike', () => {
    it('returns existing completion if already completed', async () => {
      mockAdmin.from.mockReturnValue(
        chain({ data: { id: 'existing-comp' }, error: null }),
      );

      const result = await service.recordHike('user-1', 'trail-1');

      expect(result.already_existed).toBe(true);
      expect(result.id).toBe('existing-comp');
    });

    it('throws NotFoundException when trail does not exist', async () => {
      const noExisting = chain({ data: null, error: null });
      const noTrail = chain({ data: null, error: null });

      mockAdmin.from
        .mockReturnValueOnce(noExisting)
        .mockReturnValueOnce(noTrail);

      await expect(service.recordHike('user-1', 'bad-trail')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('creates completion, awards badges, and sends notification', async () => {
      const noExisting = chain({ data: null, error: null });
      const trailExists = chain({ data: { id: 'trail-1' }, error: null });
      const inserted = chain({
        data: { id: 'comp-1', trail_id: 'trail-1', user_id: 'user-1' },
        error: null,
      });
      // For fetching badge names
      const badgeNames = chain({
        data: [{ name_en: 'First Steps' }],
        error: null,
      });
      // Override .in() on the badge query
      badgeNames.in = jest.fn().mockReturnValue(badgeNames);

      mockAdmin.from
        .mockReturnValueOnce(noExisting)
        .mockReturnValueOnce(trailExists)
        .mockReturnValueOnce(inserted)
        .mockReturnValueOnce(badgeNames);

      mockAdmin.rpc
        .mockResolvedValueOnce({ data: null, error: null }) // increment_trail_count
        .mockResolvedValueOnce({ data: ['badge-1'], error: null }); // check_and_award_badges

      const result = await service.recordHike('user-1', 'trail-1', 3600);

      expect(result.new_badge_ids).toEqual(['badge-1']);
      expect(mockNotifications.sendToUser).toHaveBeenCalledWith(
        'user-1',
        'Badge Earned!',
        expect.any(String),
        expect.any(Object),
      );
    });

    it('passes elapsedSeconds to the insert', async () => {
      const noExisting = chain({ data: null, error: null });
      const trailExists = chain({ data: { id: 'trail-1' }, error: null });
      const inserted = chain({
        data: { id: 'comp-1' },
        error: null,
      });

      mockAdmin.from
        .mockReturnValueOnce(noExisting)
        .mockReturnValueOnce(trailExists)
        .mockReturnValueOnce(inserted);

      mockAdmin.rpc
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: [], error: null });

      await service.recordHike('user-1', 'trail-1', 7200);

      // The insert call is the 3rd .from() call
      const insertCall = mockAdmin.from.mock.results[2].value.insert;
      expect(insertCall).toHaveBeenCalledWith(
        expect.objectContaining({ elapsed_seconds: 7200 }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // deleteCompletion
  // -------------------------------------------------------------------------
  describe('deleteCompletion', () => {
    it('throws NotFoundException when completion does not exist', async () => {
      mockAdmin.from.mockReturnValue(
        chain({ data: null, error: null }),
      );

      await expect(
        service.deleteCompletion('user-1', 'bad-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when user does not own the completion', async () => {
      mockAdmin.from.mockReturnValue(
        chain({
          data: { id: 'comp-1', user_id: 'other-user', status: 'approved' },
          error: null,
        }),
      );

      await expect(
        service.deleteCompletion('user-1', 'comp-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('decrements count when deleting an approved completion', async () => {
      const selectChain = chain({
        data: { id: 'comp-1', user_id: 'user-1', status: 'approved' },
        error: null,
      });
      const deleteChain = chain({ data: null, error: null });

      mockAdmin.from
        .mockReturnValueOnce(selectChain)
        .mockReturnValueOnce(deleteChain);
      mockAdmin.rpc.mockResolvedValueOnce({ data: null, error: null });

      const result = await service.deleteCompletion('user-1', 'comp-1');

      expect(result.deleted).toBe(true);
      expect(mockAdmin.rpc).toHaveBeenCalledWith('decrement_trail_count', {
        p_user_id: 'user-1',
      });
    });

    it('does not decrement count when deleting a pending completion', async () => {
      const selectChain = chain({
        data: { id: 'comp-1', user_id: 'user-1', status: 'pending' },
        error: null,
      });
      const deleteChain = chain({ data: null, error: null });

      mockAdmin.from
        .mockReturnValueOnce(selectChain)
        .mockReturnValueOnce(deleteChain);

      await service.deleteCompletion('user-1', 'comp-1');

      expect(mockAdmin.rpc).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // reviewCompletion
  // -------------------------------------------------------------------------
  describe('reviewCompletion', () => {
    it('throws NotFoundException when completion does not exist', async () => {
      mockAdmin.from.mockReturnValue(chain({ data: null, error: null }));

      await expect(
        service.reviewCompletion('bad-id', 'approved'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when completion is already reviewed', async () => {
      mockAdmin.from.mockReturnValue(
        chain({ data: { id: 'c1', status: 'approved', user_id: 'u1' }, error: null }),
      );

      await expect(
        service.reviewCompletion('c1', 'approved'),
      ).rejects.toThrow(BadRequestException);
    });

    it('approves pending completion and awards badges', async () => {
      const selectChain = chain({
        data: { id: 'c1', status: 'pending', user_id: 'user-1' },
        error: null,
      });
      const updateChain = chain({
        data: { id: 'c1', status: 'approved' },
        error: null,
      });

      mockAdmin.from
        .mockReturnValueOnce(selectChain)
        .mockReturnValueOnce(updateChain);

      mockAdmin.rpc
        .mockResolvedValueOnce({ data: null, error: null }) // increment
        .mockResolvedValueOnce({ data: [], error: null }); // badges

      const result = await service.reviewCompletion('c1', 'approved');
      expect(result.status).toBe('approved');
      expect(mockAdmin.rpc).toHaveBeenCalledWith('increment_trail_count', {
        p_user_id: 'user-1',
      });
    });
  });

  // -------------------------------------------------------------------------
  // markHikeActive / markHikeInactive / getActiveCount
  // -------------------------------------------------------------------------
  describe('active hikes', () => {
    it('markHikeActive upserts and returns active: true', async () => {
      mockAdmin.from.mockReturnValue(
        chain({ error: null }),
      );
      // Override the upsert result since chain ends at upsert, not single
      const upsertChain: Record<string, jest.Mock> = {};
      upsertChain.upsert = jest.fn().mockResolvedValue({ error: null });
      mockAdmin.from.mockReturnValue(upsertChain);

      const result = await service.markHikeActive('user-1', 'trail-1');
      expect(result.active).toBe(true);
    });

    it('markHikeInactive deletes and returns active: false', async () => {
      const deleteChain: Record<string, jest.Mock> = {};
      deleteChain.delete = jest.fn().mockReturnValue(deleteChain);
      deleteChain.eq = jest.fn().mockImplementation(() => {
        // second .eq() resolves
        return { eq: jest.fn().mockResolvedValue({ error: null }) };
      });
      mockAdmin.from.mockReturnValue(deleteChain);

      const result = await service.markHikeInactive('user-1', 'trail-1');
      expect(result.active).toBe(false);
    });

    it('getActiveCount returns count from Supabase', async () => {
      const countChain: Record<string, jest.Mock> = {};
      countChain.select = jest.fn().mockReturnValue(countChain);
      countChain.eq = jest.fn().mockResolvedValue({ count: 5, error: null });
      mockAdmin.from.mockReturnValue(countChain);

      const result = await service.getActiveCount('trail-1');
      expect(result.count).toBe(5);
    });
  });
});
