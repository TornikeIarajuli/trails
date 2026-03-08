import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { SupabaseService } from '../config/supabase.config';

// ---------------------------------------------------------------------------
// Chainable query builder
// ---------------------------------------------------------------------------
const chain = (result: object) => {
  const c: Record<string, jest.Mock> = {};
  c.select = jest.fn().mockReturnValue(c);
  c.eq = jest.fn().mockReturnValue(c);
  c.is = jest.fn().mockReturnValue(c);
  c.neq = jest.fn().mockReturnValue(c);
  c.in = jest.fn().mockReturnValue(c);
  c.not = jest.fn().mockReturnValue(c);
  c.order = jest.fn().mockReturnValue(c);
  c.range = jest.fn().mockResolvedValue(result);
  c.insert = jest.fn().mockResolvedValue({ error: null });
  c.upsert = jest.fn().mockResolvedValue({ error: null });
  c.update = jest.fn().mockReturnValue(c);
  c.delete = jest.fn().mockReturnValue(c);
  c.single = jest.fn().mockResolvedValue(result);
  return c;
};

const mockAdmin: Record<string, any> = {
  from: jest.fn(),
};

const mockSupabase = {
  getAdminClient: jest.fn(() => mockAdmin),
};

// Mock global fetch for push notification tests
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: SupabaseService, useValue: mockSupabase },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
    mockSupabase.getAdminClient.mockReturnValue(mockAdmin);
  });

  // -------------------------------------------------------------------------
  // registerToken
  // -------------------------------------------------------------------------
  describe('registerToken', () => {
    it('deletes stale tokens and upserts the new one', async () => {
      const deleteChain: Record<string, jest.Mock> = {};
      deleteChain.delete = jest.fn().mockReturnValue(deleteChain);
      deleteChain.eq = jest.fn().mockReturnValue(deleteChain);
      deleteChain.neq = jest.fn().mockResolvedValue({ error: null });

      const upsertChain: Record<string, jest.Mock> = {};
      upsertChain.upsert = jest.fn().mockResolvedValue({ error: null });

      mockAdmin.from
        .mockReturnValueOnce(deleteChain)
        .mockReturnValueOnce(upsertChain);

      const result = await service.registerToken('user-1', 'ExponentPushToken[xxx]');
      expect(result.registered).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // removeToken
  // -------------------------------------------------------------------------
  describe('removeToken', () => {
    it('deletes the token for the user', async () => {
      const deleteChain: Record<string, jest.Mock> = {};
      deleteChain.delete = jest.fn().mockReturnValue(deleteChain);
      deleteChain.eq = jest.fn().mockImplementation(() => ({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }));
      mockAdmin.from.mockReturnValue(deleteChain);

      const result = await service.removeToken('user-1', 'token-abc');
      expect(result.removed).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // sendToUser
  // -------------------------------------------------------------------------
  describe('sendToUser', () => {
    it('skips push when user has disabled the notification type', async () => {
      // Preferences: badge_earned is disabled
      const prefsChain = chain({
        data: { user_id: 'u1', badge_earned: false },
        error: null,
      });
      mockAdmin.from.mockReturnValue(prefsChain);

      const result = await service.sendToUser(
        'u1', 'Badge!', 'You earned a badge', {}, 'badge_earned',
      );

      expect(result.skipped).toBe('user_preference');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('sends push notification via Expo when preferences allow', async () => {
      // Prefs: all enabled
      const prefsChain = chain({
        data: { user_id: 'u1', badge_earned: true },
        error: null,
      });
      // Insert notification
      const insertChain: Record<string, jest.Mock> = {};
      insertChain.insert = jest.fn().mockResolvedValue({ error: null });
      // Get tokens
      const tokensChain: Record<string, jest.Mock> = {};
      tokensChain.select = jest.fn().mockReturnValue(tokensChain);
      tokensChain.eq = jest.fn().mockResolvedValue({
        data: [{ token: 'ExponentPushToken[abc]' }],
        error: null,
      });

      mockAdmin.from
        .mockReturnValueOnce(prefsChain) // notification_preferences
        .mockReturnValueOnce(insertChain) // notifications insert
        .mockReturnValueOnce(tokensChain); // push_tokens

      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ data: [{ status: 'ok' }] }),
      });

      const result = await service.sendToUser(
        'u1', 'Badge!', 'You earned a badge', {}, 'badge_earned',
      );

      expect(result.sent).toBe(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://exp.host/--/api/v2/push/send',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('returns sent: 0 when user has no tokens', async () => {
      const prefsChain = chain({ data: null, error: null });
      const insertChain: Record<string, jest.Mock> = {};
      insertChain.insert = jest.fn().mockResolvedValue({ error: null });
      const tokensChain: Record<string, jest.Mock> = {};
      tokensChain.select = jest.fn().mockReturnValue(tokensChain);
      tokensChain.eq = jest.fn().mockResolvedValue({ data: [], error: null });

      mockAdmin.from
        .mockReturnValueOnce(prefsChain)
        .mockReturnValueOnce(insertChain)
        .mockReturnValueOnce(tokensChain);

      const result = await service.sendToUser('u1', 'Hi', 'Body');
      expect(result.sent).toBe(0);
    });

    it('cleans up DeviceNotRegistered tokens', async () => {
      const prefsChain = chain({ data: null, error: null });
      const insertChain: Record<string, jest.Mock> = {};
      insertChain.insert = jest.fn().mockResolvedValue({ error: null });
      const tokensChain: Record<string, jest.Mock> = {};
      tokensChain.select = jest.fn().mockReturnValue(tokensChain);
      tokensChain.eq = jest.fn().mockResolvedValue({
        data: [{ token: 'dead-token' }],
        error: null,
      });

      // Delete chain for dead tokens
      const deadDeleteChain: Record<string, jest.Mock> = {};
      deadDeleteChain.delete = jest.fn().mockReturnValue(deadDeleteChain);
      deadDeleteChain.in = jest.fn().mockResolvedValue({ error: null });

      mockAdmin.from
        .mockReturnValueOnce(prefsChain)
        .mockReturnValueOnce(insertChain)
        .mockReturnValueOnce(tokensChain)
        .mockReturnValueOnce(deadDeleteChain);

      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({
          data: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }],
        }),
      });

      await service.sendToUser('u1', 'Hi', 'Body');

      // Verify dead token cleanup was attempted
      expect(mockAdmin.from).toHaveBeenCalledWith('push_tokens');
    });
  });

  // -------------------------------------------------------------------------
  // getNotifications
  // -------------------------------------------------------------------------
  describe('getNotifications', () => {
    it('returns paginated notifications with unread count', async () => {
      const notifications = [
        { id: 'n1', read_at: null, title: 'New badge' },
        { id: 'n2', read_at: '2026-01-01', title: 'Welcome' },
      ];
      const listChain = chain({
        data: notifications,
        error: null,
        count: 10,
      });
      listChain.range = jest.fn().mockResolvedValue({
        data: notifications,
        error: null,
        count: 10,
      });
      mockAdmin.from.mockReturnValue(listChain);

      const result = await service.getNotifications('user-1', 1, 20);

      expect(result.data).toHaveLength(2);
      expect(result.unreadCount).toBe(1);
      expect(result.total).toBe(10);
    });
  });

  // -------------------------------------------------------------------------
  // markRead / markAllRead
  // -------------------------------------------------------------------------
  describe('markRead', () => {
    it('marks a single notification as read', async () => {
      const updateChain: Record<string, jest.Mock> = {};
      updateChain.update = jest.fn().mockReturnValue(updateChain);
      updateChain.eq = jest.fn().mockImplementation(() => ({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }));
      mockAdmin.from.mockReturnValue(updateChain);

      const result = await service.markRead('user-1', 'notif-1');
      expect(result.ok).toBe(true);
    });
  });

  describe('markAllRead', () => {
    it('marks all unread notifications as read', async () => {
      const updateChain: Record<string, jest.Mock> = {};
      updateChain.update = jest.fn().mockReturnValue(updateChain);
      updateChain.eq = jest.fn().mockReturnValue(updateChain);
      updateChain.is = jest.fn().mockResolvedValue({ error: null });
      mockAdmin.from.mockReturnValue(updateChain);

      const result = await service.markAllRead('user-1');
      expect(result.ok).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // getPreferences / updatePreferences
  // -------------------------------------------------------------------------
  describe('getPreferences', () => {
    it('returns defaults when no preferences row exists', async () => {
      mockAdmin.from.mockReturnValue(
        chain({ data: null, error: null }),
      );

      const result = await service.getPreferences('user-1');

      expect(result.new_follower).toBe(true);
      expect(result.badge_earned).toBe(true);
      expect(result.trail_condition).toBe(true);
    });

    it('returns stored preferences when they exist', async () => {
      mockAdmin.from.mockReturnValue(
        chain({
          data: {
            user_id: 'u1',
            new_follower: false,
            badge_earned: true,
            completion_approved: true,
            event_invite: false,
            trail_condition: true,
          },
          error: null,
        }),
      );

      const result = await service.getPreferences('u1');
      expect(result.new_follower).toBe(false);
      expect(result.event_invite).toBe(false);
    });
  });

  describe('updatePreferences', () => {
    it('upserts preferences and returns updated data', async () => {
      const upsertChain: Record<string, jest.Mock> = {};
      upsertChain.upsert = jest.fn().mockReturnValue(upsertChain);
      upsertChain.select = jest.fn().mockReturnValue(upsertChain);
      upsertChain.single = jest.fn().mockResolvedValue({
        data: { user_id: 'u1', new_follower: false },
        error: null,
      });
      mockAdmin.from.mockReturnValue(upsertChain);

      const result = await service.updatePreferences('u1', { new_follower: false });
      expect(result.new_follower).toBe(false);
    });
  });
});
