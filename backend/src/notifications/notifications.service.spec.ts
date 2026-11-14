import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { SupabaseService } from '../config/supabase.config';

// ---------------------------------------------------------------------------
// Supabase mock: every query method returns the builder, and awaiting the builder
// (or calling .single()) resolves to the result queued for that table.
// ---------------------------------------------------------------------------
type Builder = Record<string, jest.Mock> & { then: unknown };

function makeBuilder(result: object): Builder {
  const self = {} as Builder;
  [
    'select',
    'insert',
    'upsert',
    'update',
    'delete',
    'eq',
    'neq',
    'in',
    'is',
    'order',
    'range',
    'limit',
  ].forEach((m) => {
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
};

const mockSupabase = {
  getAdminClient: jest.fn(() => mockAdmin),
};

// Mock global fetch for push notification tests
const mockFetch = jest.fn();
global.fetch = mockFetch;

const expoResponse = (body: unknown) => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(body),
});

const sentMessages = (call = 0): Array<Record<string, any>> =>
  JSON.parse(mockFetch.mock.calls[call][1].body as string);

describe('NotificationsService', () => {
  let service: NotificationsService;
  let logSpies: jest.SpyInstance[];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: SupabaseService, useValue: mockSupabase },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
    queues.clear();
    logSpies = [
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined),
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
    ];
  });

  afterEach(() => {
    logSpies.forEach((spy) => spy.mockRestore());
  });

  // -------------------------------------------------------------------------
  // registerToken
  // -------------------------------------------------------------------------
  describe('registerToken', () => {
    it('takes the token away from other users, then upserts it for this user', async () => {
      const release = onTable('push_tokens', { error: null });
      const upsert = onTable('push_tokens', { error: null });

      const result = await service.registerToken(
        'user-1',
        'ExponentPushToken[xxx]',
      );

      expect(result.registered).toBe(true);
      expect(release.delete).toHaveBeenCalled();
      expect(release.eq).toHaveBeenCalledWith(
        'token',
        'ExponentPushToken[xxx]',
      );
      expect(release.neq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(upsert.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          token: 'ExponentPushToken[xxx]',
          platform: 'expo',
        }),
        { onConflict: 'user_id,token' },
      );
      // the release must complete before the upsert starts
      expect(release.delete.mock.invocationCallOrder[0]).toBeLessThan(
        upsert.upsert.mock.invocationCallOrder[0],
      );
    });

    it("never deletes the user's other devices", async () => {
      const release = onTable('push_tokens', { error: null });
      onTable('push_tokens', { error: null });

      await service.registerToken('user-1', 'ExponentPushToken[new-phone]');

      expect(release.eq).not.toHaveBeenCalledWith('user_id', 'user-1');
      expect(release.neq).not.toHaveBeenCalledWith(
        'token',
        'ExponentPushToken[new-phone]',
      );
      expect(mockAdmin.from).toHaveBeenCalledTimes(2);
    });

    it('fails when the token could not be released', async () => {
      onTable('push_tokens', { error: { code: 'XX000', message: 'boom' } });

      await expect(
        service.registerToken('user-1', 'ExponentPushToken[xxx]'),
      ).rejects.toThrow('Internal server error');
      expect(mockAdmin.from).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // removeToken
  // -------------------------------------------------------------------------
  describe('removeToken', () => {
    it('deletes the token for the user', async () => {
      const del = onTable('push_tokens', { error: null });

      const result = await service.removeToken('user-1', 'token-abc');

      expect(result.removed).toBe(true);
      expect(del.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(del.eq).toHaveBeenCalledWith('token', 'token-abc');
    });
  });

  // -------------------------------------------------------------------------
  // sendToUser
  // -------------------------------------------------------------------------
  describe('sendToUser', () => {
    it('skips push when user has disabled the notification type', async () => {
      onTable('notification_preferences', {
        data: { user_id: 'u1', badge_earned: false },
        error: null,
      });

      const result = await service.sendToUser(
        'u1',
        'Badge!',
        'You earned a badge',
        {},
        'badge_earned',
      );

      expect(result.skipped).toBe('user_preference');
      expect(result.sent).toBe(0);
      expect(mockFetch).not.toHaveBeenCalled();
      // nothing is stored either
      expect(mockAdmin.from).toHaveBeenCalledTimes(1);
    });

    it.each(['new_like', 'new_comment'])(
      'skips %s notifications for someone who turned them off',
      async (type) => {
        onTable('notification_preferences', {
          data: { user_id: 'u1', [type]: false },
          error: null,
        });

        const result = await service.sendToUser(
          'u1',
          'New',
          'nino liked your hike',
          {},
          type,
        );

        expect(result.skipped).toBe('user_preference');
        expect(mockFetch).not.toHaveBeenCalled();
      },
    );

    it('sends push notification via Expo when preferences allow', async () => {
      onTable('notification_preferences', {
        data: { user_id: 'u1', badge_earned: true },
        error: null,
      });
      const history = onTable('notifications', { error: null });
      onTable('push_tokens', {
        data: [{ token: 'ExponentPushToken[abc]' }],
        error: null,
      });
      mockFetch.mockResolvedValue(expoResponse({ data: [{ status: 'ok' }] }));

      const result = await service.sendToUser(
        'u1',
        'Badge!',
        'You earned a badge',
        { badgeIds: ['b1'] },
        'badge_earned',
      );

      expect(result.sent).toBe(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://exp.host/--/api/v2/push/send',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(history.insert).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'u1', type: 'badge_earned' }),
      );
    });

    it('always puts the notification type into the push data and the stored row', async () => {
      onTable('notification_preferences', { data: null, error: null });
      const history = onTable('notifications', { error: null });
      onTable('push_tokens', {
        data: [{ token: 'ExponentPushToken[abc]' }],
        error: null,
      });
      mockFetch.mockResolvedValue(expoResponse({ data: [{ status: 'ok' }] }));

      await service.sendToUser(
        'u1',
        'New Follower',
        'x started following you',
        { followerId: 'f1', type: 'something-else' },
        'new_follower',
      );

      expect(sentMessages()[0].data).toEqual({
        followerId: 'f1',
        type: 'new_follower',
      });
      expect(history.insert.mock.calls[0][0].data).toEqual({
        followerId: 'f1',
        type: 'new_follower',
      });
    });

    it('adds the type even when the caller passes no data', async () => {
      onTable('notification_preferences', { data: null, error: null });
      onTable('notifications', { error: null });
      onTable('push_tokens', {
        data: [{ token: 'ExponentPushToken[abc]' }],
        error: null,
      });
      mockFetch.mockResolvedValue(expoResponse({ data: [{ status: 'ok' }] }));

      await service.sendToUser('u1', 'Hi', 'Body');

      expect(sentMessages()[0].data).toEqual({ type: 'general' });
    });

    it('returns sent: 0 when user has no tokens', async () => {
      onTable('notification_preferences', { data: null, error: null });
      onTable('notifications', { error: null });
      onTable('push_tokens', { data: [], error: null });

      const result = await service.sendToUser('u1', 'Hi', 'Body');

      expect(result.sent).toBe(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('counts only the tickets Expo accepted', async () => {
      onTable('notification_preferences', { data: null, error: null });
      onTable('notifications', { error: null });
      onTable('push_tokens', {
        data: [
          { token: 'ExponentPushToken[a]' },
          { token: 'ExponentPushToken[b]' },
          { token: 'ExponentPushToken[c]' },
        ],
        error: null,
      });
      mockFetch.mockResolvedValue(
        expoResponse({
          data: [
            { status: 'ok' },
            { status: 'error', details: { error: 'MessageRateExceeded' } },
            { status: 'ok' },
          ],
        }),
      );

      const result = await service.sendToUser('u1', 'Hi', 'Body');

      expect(result.sent).toBe(2);
      expect(result.error).toBeUndefined();
    });

    it('removes DeviceNotRegistered tokens and does not count them', async () => {
      onTable('notification_preferences', { data: null, error: null });
      onTable('notifications', { error: null });
      onTable('push_tokens', {
        data: [
          { token: 'ExponentPushToken[alive]' },
          { token: 'ExponentPushToken[dead]' },
        ],
        error: null,
      });
      const cleanup = onTable('push_tokens', { error: null });
      mockFetch.mockResolvedValue(
        expoResponse({
          data: [
            { status: 'ok' },
            { status: 'error', details: { error: 'DeviceNotRegistered' } },
          ],
        }),
      );

      const result = await service.sendToUser('u1', 'Hi', 'Body');

      expect(result.sent).toBe(1);
      expect(cleanup.delete).toHaveBeenCalled();
      expect(cleanup.in).toHaveBeenCalledWith('token', [
        'ExponentPushToken[dead]',
      ]);
    });

    it('reports sent: 0 with an error when Expo rejects the whole request', async () => {
      onTable('notification_preferences', { data: null, error: null });
      onTable('notifications', { error: null });
      onTable('push_tokens', {
        data: [{ token: 'ExponentPushToken[abc]' }],
        error: null,
      });
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({ errors: [{ message: 'Bad push payload' }] }),
      });

      const result = await service.sendToUser('u1', 'Hi', 'Body');

      expect(result).toEqual({ sent: 0, error: 'Bad push payload' });
    });

    it('never throws when the network call fails', async () => {
      onTable('notification_preferences', { data: null, error: null });
      onTable('notifications', { error: null });
      onTable('push_tokens', {
        data: [{ token: 'ExponentPushToken[abc]' }],
        error: null,
      });
      mockFetch.mockRejectedValue(new Error('socket hang up'));

      const result = await service.sendToUser('u1', 'Hi', 'Body');

      expect(result).toEqual({ sent: 0, error: 'socket hang up' });
    });

    it('never throws when the database is unreachable', async () => {
      mockAdmin.from.mockImplementationOnce(() => {
        throw new Error('db down');
      });

      const result = await service.sendToUser('u1', 'Hi', 'Body');

      expect(result).toEqual({ sent: 0, error: 'db down' });
    });

    it('still pushes when the history row cannot be stored', async () => {
      onTable('notification_preferences', { data: null, error: null });
      onTable('notifications', { error: { message: 'insert failed' } });
      onTable('push_tokens', {
        data: [{ token: 'ExponentPushToken[abc]' }],
        error: null,
      });
      mockFetch.mockResolvedValue(expoResponse({ data: [{ status: 'ok' }] }));

      const result = await service.sendToUser('u1', 'Hi', 'Body');

      expect(result.sent).toBe(1);
    });

    it('sends SOS pushes at high priority', async () => {
      onTable('notification_preferences', { data: null, error: null });
      onTable('notifications', { error: null });
      onTable('push_tokens', {
        data: [{ token: 'ExponentPushToken[abc]' }],
        error: null,
      });
      mockFetch.mockResolvedValue(expoResponse({ data: [{ status: 'ok' }] }));

      await service.sendToUser('u1', 'SOS', 'Help', { userId: 'u2' }, 'sos');

      expect(sentMessages()[0].priority).toBe('high');
    });

    it('splits more than 100 devices into several Expo requests', async () => {
      onTable('notification_preferences', { data: null, error: null });
      onTable('notifications', { error: null });
      onTable('push_tokens', {
        data: Array.from({ length: 100 }, (_, i) => ({
          token: `ExponentPushToken[${i}]`,
        })).concat(
          Array.from({ length: 30 }, (_, i) => ({
            token: `ExponentPushToken[extra-${i}]`,
          })),
        ),
        error: null,
      });
      mockFetch.mockImplementation((_url: string, init: { body: string }) => {
        const count = (JSON.parse(init.body) as unknown[]).length;
        return Promise.resolve(
          expoResponse({
            data: Array.from({ length: count }, () => ({ status: 'ok' })),
          }),
        );
      });

      const result = await service.sendToUser('u1', 'Hi', 'Body');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(sentMessages(0)).toHaveLength(100);
      expect(sentMessages(1)).toHaveLength(30);
      expect(result.sent).toBe(130);
    });
  });

  // -------------------------------------------------------------------------
  // getNotifications
  // -------------------------------------------------------------------------
  describe('getNotifications', () => {
    it('returns a page with the total unread count across all pages', async () => {
      const notifications = [
        { id: 'n1', read_at: null, title: 'New badge' },
        { id: 'n2', read_at: '2026-01-01', title: 'Welcome' },
      ];
      const list = onTable('notifications', {
        data: notifications,
        error: null,
        count: 10,
      });
      const unread = onTable('notifications', { count: 7, error: null });

      const result = await service.getNotifications('user-1', 1, 20);

      expect(result.data).toHaveLength(2);
      expect(result.unreadCount).toBe(7);
      expect(result.total).toBe(10);
      expect(list.range).toHaveBeenCalledWith(0, 19);
      expect(unread.is).toHaveBeenCalledWith('read_at', null);
      expect(unread.select).toHaveBeenCalledWith('id', {
        count: 'exact',
        head: true,
      });
    });

    it('applies page and limit', async () => {
      const list = onTable('notifications', {
        data: [],
        error: null,
        count: 0,
      });
      onTable('notifications', { count: 0, error: null });

      await service.getNotifications('user-1', 3, 10);

      expect(list.range).toHaveBeenCalledWith(20, 29);
    });

    it('adds the person, trail and badge each notification is about', async () => {
      onTable('notifications', {
        data: [
          { id: 'n1', type: 'new_follower', data: { followerId: 'u-nino' } },
          {
            id: 'n2',
            type: 'new_comment',
            data: { commenterId: 'u-gio', trailId: 't-juta', activityId: 'a1' },
          },
          {
            id: 'n3',
            type: 'badge_earned',
            data: { badgeIds: ['b-first', 'b-other'] },
          },
          {
            id: 'n4',
            type: 'sos',
            data: { userId: 'u-nino', lat: 42, lng: 44 },
          },
          {
            id: 'n5',
            type: 'completion_approved',
            data: { userId: 'u-should-not-be-actor', trailId: 't-juta' },
          },
        ],
        error: null,
        count: 5,
      });
      onTable('notifications', { count: 2, error: null });
      const profiles = onTable('profiles', {
        data: [
          { id: 'u-nino', username: 'nino', avatar_url: 'https://x/nino.jpg' },
          { id: 'u-gio', username: 'gio', avatar_url: null },
        ],
        error: null,
      });
      const trails = onTable('trails', {
        data: [
          {
            id: 't-juta',
            name_en: 'Juta to Roshka',
            cover_image_url: 'https://x/juta.webp',
          },
        ],
        error: null,
      });
      const badges = onTable('badges', {
        data: [
          {
            id: 'b-first',
            name_en: 'First Steps',
            icon: 'footsteps',
            category: 'completions',
          },
        ],
        error: null,
      });

      const result = await service.getNotifications('user-1');
      const byId = Object.fromEntries(result.data.map((n) => [n.id, n]));

      expect(profiles.in).toHaveBeenCalledWith('id', ['u-nino', 'u-gio']);
      expect(trails.in).toHaveBeenCalledWith('id', ['t-juta']);
      expect(badges.in).toHaveBeenCalledWith('id', ['b-first']);
      expect(byId.n1).toMatchObject({
        actor: { username: 'nino' },
        trail: null,
        badge: null,
      });
      expect(byId.n2).toMatchObject({
        actor: { username: 'gio' },
        trail: { name_en: 'Juta to Roshka' },
      });
      expect(byId.n3).toMatchObject({
        actor: null,
        badge: { name_en: 'First Steps' },
      });
      expect(byId.n4).toMatchObject({ actor: { username: 'nino' } });
      // userId names the person only on SOS alerts
      expect(byId.n5).toMatchObject({ actor: null, trail: { id: 't-juta' } });
    });

    it('still returns the list when a lookup fails', async () => {
      onTable('notifications', {
        data: [
          { id: 'n1', type: 'new_follower', data: { followerId: 'u-nino' } },
        ],
        error: null,
        count: 1,
      });
      onTable('notifications', { count: 1, error: null });
      onTable('profiles', { data: null, error: { message: 'timeout' } });

      const result = await service.getNotifications('user-1');

      expect(result.data).toEqual([
        expect.objectContaining({
          id: 'n1',
          actor: null,
          trail: null,
          badge: null,
        }),
      ]);
    });

    it('defaults to the first page of 20', async () => {
      const list = onTable('notifications', {
        data: [],
        error: null,
        count: 0,
      });
      onTable('notifications', { count: 0, error: null });

      const result = await service.getNotifications('user-1');

      expect(list.range).toHaveBeenCalledWith(0, 19);
      expect(result).toEqual({ data: [], unreadCount: 0, total: 0 });
    });
  });

  // -------------------------------------------------------------------------
  // markRead / markAllRead
  // -------------------------------------------------------------------------
  describe('markRead', () => {
    it('marks a single notification as read', async () => {
      const update = onTable('notifications', { error: null });

      const result = await service.markRead('user-1', 'notif-1');

      expect(result.ok).toBe(true);
      expect(update.eq).toHaveBeenCalledWith('id', 'notif-1');
      expect(update.eq).toHaveBeenCalledWith('user_id', 'user-1');
    });
  });

  describe('markAllRead', () => {
    it('marks all unread notifications as read', async () => {
      const update = onTable('notifications', { error: null });

      const result = await service.markAllRead('user-1');

      expect(result.ok).toBe(true);
      expect(update.is).toHaveBeenCalledWith('read_at', null);
    });
  });

  // -------------------------------------------------------------------------
  // getPreferences / updatePreferences
  // -------------------------------------------------------------------------
  describe('getPreferences', () => {
    it('returns defaults when no preferences row exists', async () => {
      onTable('notification_preferences', { data: null, error: null });

      const result = await service.getPreferences('user-1');

      expect(result.new_follower).toBe(true);
      expect(result.badge_earned).toBe(true);
      expect(result.trail_condition).toBe(true);
    });

    it('returns stored preferences when they exist', async () => {
      onTable('notification_preferences', {
        data: {
          user_id: 'u1',
          new_follower: false,
          badge_earned: true,
          completion_approved: true,
          event_invite: false,
          trail_condition: true,
        },
        error: null,
      });

      const result = await service.getPreferences('u1');
      expect(result.new_follower).toBe(false);
      expect(result.event_invite).toBe(false);
    });
  });

  describe('updatePreferences', () => {
    it('upserts preferences and returns updated data', async () => {
      onTable('notification_preferences', {
        data: { user_id: 'u1', new_follower: false },
        error: null,
      });

      const result = await service.updatePreferences('u1', {
        new_follower: false,
      });
      expect(result.new_follower).toBe(false);
    });
  });
});
