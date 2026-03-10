import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { SupabaseService } from '../config/supabase.config';
import { NotificationsService } from '../notifications/notifications.service';

// ---------------------------------------------------------------------------
// Chainable query builder
// ---------------------------------------------------------------------------
const chain = (result: object) => {
  const c: Record<string, jest.Mock> = {};
  c.select = jest.fn().mockReturnValue(c);
  c.eq = jest.fn().mockReturnValue(c);
  c.order = jest.fn().mockReturnValue(c);
  c.range = jest.fn().mockResolvedValue(result);
  c.insert = jest.fn().mockReturnValue(c);
  c.delete = jest.fn().mockReturnValue(c);
  c.single = jest.fn().mockResolvedValue(result);
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

describe('CommentsService', () => {
  let service: CommentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
    jest.clearAllMocks();
    mockSupabase.getAdminClient.mockReturnValue(mockAdmin);
  });

  // -------------------------------------------------------------------------
  // getComments
  // -------------------------------------------------------------------------
  describe('getComments', () => {
    it('returns paginated comments with correct structure', async () => {
      const comments = [
        { id: 'c1', comment: 'Great trail!', created_at: '2026-01-01' },
      ];
      const listChain = chain({
        data: comments,
        error: null,
        count: 1,
      });
      listChain.range = jest.fn().mockResolvedValue({
        data: comments,
        error: null,
        count: 1,
      });
      mockAdmin.from.mockReturnValue(listChain);

      const result = await service.getComments('activity-1');

      expect(result.data).toHaveLength(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(50);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('uses correct offset for page 2', async () => {
      const listChain = chain({ data: [], error: null, count: 0 });
      listChain.range = jest.fn().mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      });
      mockAdmin.from.mockReturnValue(listChain);

      await service.getComments('activity-1', 2, 10);

      // page 2, limit 10 → offset 10, range(10, 19)
      expect(listChain.range).toHaveBeenCalledWith(10, 19);
    });

    it('throws when Supabase returns an error', async () => {
      const errorChain = chain({ data: null, error: null, count: 0 });
      errorChain.range = jest.fn().mockResolvedValue({
        data: null,
        error: new Error('DB error'),
        count: 0,
      });
      mockAdmin.from.mockReturnValue(errorChain);

      await expect(service.getComments('activity-1')).rejects.toThrow('DB error');
    });
  });

  // -------------------------------------------------------------------------
  // createComment
  // -------------------------------------------------------------------------
  describe('createComment', () => {
    it('inserts a comment and returns it', async () => {
      const insertedComment = {
        id: 'c1',
        activity_id: 'a1',
        activity_type: 'completion',
        user_id: 'user-1',
        comment: 'Nice!',
        profiles: { username: 'hiker' },
      };
      mockAdmin.from.mockReturnValue(
        chain({ data: insertedComment, error: null }),
      );

      const result = await service.createComment('user-1', {
        activity_id: 'a1',
        activity_type: 'completion' as const,
        comment: 'Nice!',
      });

      expect(result!.comment).toBe('Nice!');
    });
  });

  // -------------------------------------------------------------------------
  // deleteComment
  // -------------------------------------------------------------------------
  describe('deleteComment', () => {
    it('throws NotFoundException when comment does not exist', async () => {
      mockAdmin.from.mockReturnValue(
        chain({ data: null, error: null }),
      );

      await expect(
        service.deleteComment('user-1', 'bad-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when deleting another user\'s comment', async () => {
      mockAdmin.from.mockReturnValue(
        chain({ data: { user_id: 'other-user' }, error: null }),
      );

      await expect(
        service.deleteComment('user-1', 'c1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('deletes the comment when user owns it', async () => {
      const selectChain = chain({
        data: { user_id: 'user-1' },
        error: null,
      });
      const deleteChain: Record<string, jest.Mock> = {};
      deleteChain.delete = jest.fn().mockReturnValue(deleteChain);
      deleteChain.eq = jest.fn().mockResolvedValue({ error: null });

      mockAdmin.from
        .mockReturnValueOnce(selectChain)
        .mockReturnValueOnce(deleteChain);

      const result = await service.deleteComment('user-1', 'c1');
      expect(result.message).toBe('Deleted');
    });
  });

  // -------------------------------------------------------------------------
  // getLikes
  // -------------------------------------------------------------------------
  describe('getLikes', () => {
    it('returns likes for an activity', async () => {
      const likes = [{ id: 'l1', user_id: 'u1', created_at: '2026-01-01' }];
      const likesChain: Record<string, jest.Mock> = {};
      likesChain.select = jest.fn().mockReturnValue(likesChain);
      likesChain.eq = jest.fn().mockResolvedValue({ data: likes, error: null });
      mockAdmin.from.mockReturnValue(likesChain);

      const result = await service.getLikes('activity-1');
      expect(result).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // toggleLike
  // -------------------------------------------------------------------------
  describe('toggleLike', () => {
    it('calls the RPC with correct parameters', async () => {
      mockAdmin.rpc.mockResolvedValue({
        data: { liked: true, count: 5 },
        error: null,
      });

      const result = await service.toggleLike('user-1', 'activity-1', 'completion');

      expect(mockAdmin.rpc).toHaveBeenCalledWith('toggle_activity_like_full', {
        p_activity_id: 'activity-1',
        p_activity_type: 'completion',
        p_user_id: 'user-1',
      });
      expect(result).toEqual({ liked: true, count: 5 });
    });
  });
});
