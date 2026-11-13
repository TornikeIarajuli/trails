import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { SupabaseService } from '../config/supabase.config';
import { NotificationsService } from '../notifications/notifications.service';

// ---------------------------------------------------------------------------
// Supabase mock: every query method returns the builder, and awaiting the builder
// (or calling .single()) resolves to the result queued for that table.
// ---------------------------------------------------------------------------
type Builder = Record<string, jest.Mock> & { then: unknown };

function makeBuilder(result: object): Builder {
  const self = {} as Builder;
  ['select', 'insert', 'delete', 'eq', 'order', 'range'].forEach((m) => {
    self[m] = jest.fn(() => self);
  });
  self.single = jest.fn().mockResolvedValue(result);
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

const mockAdmin = {
  from: jest.fn((table: string) => {
    const next = queues.get(table)?.shift();
    if (!next) throw new Error(`Unexpected query on ${table}`);
    return next;
  }),
  rpc: jest.fn(),
};

const mockSupabase = {
  getAdminClient: jest.fn(() => mockAdmin),
};

const mockNotifications = {
  sendToUser: jest.fn().mockResolvedValue({ sent: 1 }),
};

/** Lets the fire-and-forget owner notification finish. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

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
    queues.clear();
  });

  // -------------------------------------------------------------------------
  // getComments
  // -------------------------------------------------------------------------
  describe('getComments', () => {
    it('returns paginated comments with correct structure', async () => {
      const comments = [
        { id: 'c1', comment: 'Great trail!', created_at: '2026-01-01' },
      ];
      onTable('activity_comments', { data: comments, error: null, count: 1 });

      const result = await service.getComments('activity-1');

      expect(result.data).toHaveLength(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(50);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('uses correct offset for page 2', async () => {
      const list = onTable('activity_comments', {
        data: [],
        error: null,
        count: 0,
      });

      await service.getComments('activity-1', 2, 10);

      // page 2, limit 10 → offset 10, range(10, 19)
      expect(list.range).toHaveBeenCalledWith(10, 19);
    });

    it('throws a generic error when Supabase returns an error', async () => {
      const errorLog = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      onTable('activity_comments', {
        data: null,
        error: { message: 'DB error: relation "x" is broken' },
        count: 0,
      });

      const error = await service
        .getComments('activity-1')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(InternalServerErrorException);
      expect((error as Error).message).toBe('Internal server error');
      errorLog.mockRestore();
    });
  });

  // -------------------------------------------------------------------------
  // createComment
  // -------------------------------------------------------------------------
  describe('createComment', () => {
    const inserted = (activityType: string) => ({
      id: 'c1',
      activity_id: 'a1',
      activity_type: activityType,
      user_id: 'user-1',
      comment: 'Nice!',
      profiles: { username: 'hiker' },
    });

    it('inserts a comment and returns it', async () => {
      onTable('activity_comments', {
        data: inserted('completion'),
        error: null,
      });
      onTable('trail_completions', { data: null, error: null });

      const result = await service.createComment('user-1', {
        activity_id: 'a1',
        activity_type: 'completion' as const,
        comment: 'Nice!',
      });

      expect(result?.comment).toBe('Nice!');
    });

    it.each([
      ['completion', 'trail_completions', 'user_id'],
      ['photo', 'trail_photos', 'user_id'],
      ['condition', 'trail_conditions', 'user_id'],
      ['review', 'trail_reviews', 'user_id'],
      ['event', 'events', 'organizer_id'],
    ] as const)(
      'notifies the owner of a %s (looked up in %s)',
      async (activityType, table, ownerColumn) => {
        onTable('activity_comments', {
          data: inserted(activityType),
          error: null,
        });
        const lookup = onTable(table, {
          data: { [ownerColumn]: 'owner-1', trail_id: 'trail-9' },
          error: null,
        });

        await service.createComment('user-1', {
          activity_id: 'a1',
          activity_type: activityType,
          comment: 'Nice!',
        });
        await flush();

        expect(lookup.select).toHaveBeenCalledWith(`${ownerColumn}, trail_id`);
        expect(lookup.eq).toHaveBeenCalledWith('id', 'a1');
        expect(mockNotifications.sendToUser).toHaveBeenCalledWith(
          'owner-1',
          'New Comment',
          'hiker commented on your activity',
          {
            activityId: 'a1',
            activityType,
            commenterId: 'user-1',
            trailId: 'trail-9',
          },
          'new_comment',
        );
      },
    );

    it('never queries the non-existent "completions" table', async () => {
      onTable('activity_comments', {
        data: inserted('completion'),
        error: null,
      });
      onTable('trail_completions', {
        data: { user_id: 'owner-1', trail_id: 'trail-9' },
        error: null,
      });

      await service.createComment('user-1', {
        activity_id: 'a1',
        activity_type: 'completion',
        comment: 'Nice!',
      });
      await flush();

      const tables = mockAdmin.from.mock.calls.map(([table]) => table);
      expect(tables).toEqual(['activity_comments', 'trail_completions']);
    });

    it('does not notify people commenting on their own activity', async () => {
      onTable('activity_comments', { data: inserted('photo'), error: null });
      onTable('trail_photos', {
        data: { user_id: 'user-1', trail_id: 'trail-9' },
        error: null,
      });

      await service.createComment('user-1', {
        activity_id: 'a1',
        activity_type: 'photo',
        comment: 'Nice!',
      });
      await flush();

      expect(mockNotifications.sendToUser).not.toHaveBeenCalled();
    });

    it('does not notify when the activity no longer exists', async () => {
      onTable('activity_comments', { data: inserted('review'), error: null });
      onTable('trail_reviews', {
        data: null,
        error: { code: 'PGRST116', message: 'no rows' },
      });

      await service.createComment('user-1', {
        activity_id: 'a1',
        activity_type: 'review',
        comment: 'Nice!',
      });
      await flush();

      expect(mockNotifications.sendToUser).not.toHaveBeenCalled();
    });

    it('still returns the comment when the notification lookup fails', async () => {
      onTable('activity_comments', {
        data: inserted('completion'),
        error: null,
      });
      // no trail_completions result queued: the lookup throws

      const result = await service.createComment('user-1', {
        activity_id: 'a1',
        activity_type: 'completion',
        comment: 'Nice!',
      });
      await flush();

      expect(result?.id).toBe('c1');
    });
  });

  // -------------------------------------------------------------------------
  // deleteComment
  // -------------------------------------------------------------------------
  describe('deleteComment', () => {
    it('throws NotFoundException when comment does not exist', async () => {
      onTable('activity_comments', { data: null, error: null });

      await expect(service.deleteComment('user-1', 'bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws ForbiddenException when deleting another user's comment", async () => {
      onTable('activity_comments', {
        data: { user_id: 'other-user' },
        error: null,
      });

      await expect(service.deleteComment('user-1', 'c1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('deletes the comment when user owns it', async () => {
      onTable('activity_comments', {
        data: { user_id: 'user-1' },
        error: null,
      });
      const del = onTable('activity_comments', { error: null });

      const result = await service.deleteComment('user-1', 'c1');

      expect(result.message).toBe('Deleted');
      expect(del.delete).toHaveBeenCalled();
      expect(del.eq).toHaveBeenCalledWith('id', 'c1');
    });
  });

  // -------------------------------------------------------------------------
  // getLikes
  // -------------------------------------------------------------------------
  describe('getLikes', () => {
    it('returns likes for an activity', async () => {
      const likes = [{ id: 'l1', user_id: 'u1', created_at: '2026-01-01' }];
      onTable('activity_likes', { data: likes, error: null });

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

      const result = await service.toggleLike(
        'user-1',
        'activity-1',
        'completion',
      );

      expect(mockAdmin.rpc).toHaveBeenCalledWith('toggle_activity_like_full', {
        p_activity_id: 'activity-1',
        p_activity_type: 'completion',
        p_user_id: 'user-1',
      });
      expect(result).toEqual({ liked: true, count: 5 });
    });
  });
});
