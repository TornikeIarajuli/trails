import { Test, TestingModule } from '@nestjs/testing';
import { Logger, NotFoundException } from '@nestjs/common';
import { FeedService } from './feed.service';
import { SupabaseService } from '../config/supabase.config';
import { ModerationService } from '../moderation/moderation.service';

type Builder = Record<string, jest.Mock> & { then: unknown };

function makeBuilder(result: object): Builder {
  const self = {} as Builder;
  ['select', 'in', 'eq', 'upsert', 'delete'].forEach((m) => {
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

const rpcResults = new Map<string, object>();
const mockAdmin = {
  from: jest.fn((table: string) => {
    const next = queues.get(table)?.shift();
    // Nothing saved, unless a test says otherwise
    if (!next && table === 'saved_posts') return makeBuilder({ data: [], error: null });
    if (!next) throw new Error(`Unexpected query on ${table}`);
    return next;
  }),
  rpc: jest.fn((name: string) => Promise.resolve(rpcResults.get(name))),
};

const mockModeration = { getBlockedUserIds: jest.fn() };

const item = (id: string, userId = 'friend') => ({
  activity_id: id,
  activity_type: 'completion',
  user_id: userId,
  trail_id: 'trail-1',
});

describe('FeedService', () => {
  let service: FeedService;
  let warnLog: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedService,
        {
          provide: SupabaseService,
          useValue: { getAdminClient: () => mockAdmin },
        },
        { provide: ModerationService, useValue: mockModeration },
      ],
    }).compile();

    service = module.get(FeedService);
    jest.clearAllMocks();
    queues.clear();
    rpcResults.clear();
    mockModeration.getBlockedUserIds.mockResolvedValue([]);
    rpcResults.set('get_activity_feed_count', { data: 3, error: null });
    rpcResults.set('get_latest_comments', { data: [], error: null });
    warnLog = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => warnLog.mockRestore());

  it('adds like and comment counts, liked_by_me and saved_by_me with three queries per page', async () => {
    rpcResults.set('get_activity_feed', {
      data: [item('a1'), item('a2'), item('a3')],
      error: null,
    });
    const likes = onTable('activity_likes', {
      data: [
        { activity_id: 'a1', user_id: 'me' },
        { activity_id: 'a1', user_id: 'other' },
        { activity_id: 'a2', user_id: 'other' },
      ],
      error: null,
    });
    const comments = onTable('activity_comments', {
      data: [
        { activity_id: 'a2' },
        { activity_id: 'a2' },
        { activity_id: 'a3' },
      ],
      error: null,
    });

    const result = await service.getFeed('me', 1, 20);

    expect(likes.in).toHaveBeenCalledWith('activity_id', ['a1', 'a2', 'a3']);
    expect(comments.in).toHaveBeenCalledWith('activity_id', ['a1', 'a2', 'a3']);
    expect(mockAdmin.from).toHaveBeenCalledTimes(3);
    expect(result.data).toEqual([
      expect.objectContaining({
        activity_id: 'a1',
        like_count: 2,
        comment_count: 0,
        liked_by_me: true,
      }),
      expect.objectContaining({
        activity_id: 'a2',
        like_count: 1,
        comment_count: 2,
        liked_by_me: false,
      }),
      expect.objectContaining({
        activity_id: 'a3',
        like_count: 0,
        comment_count: 1,
        liked_by_me: false,
      }),
    ]);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 3,
      totalPages: 1,
    });
  });

  it('keeps the trail’s distance and ascent and the hike’s time from the feed function', async () => {
    const completion = {
      ...item('a1'),
      trail_distance_km: 12.4,
      trail_elevation_gain_m: 860,
      elapsed_seconds: 15600,
    };
    rpcResults.set('get_activity_feed', { data: [completion], error: null });
    onTable('activity_likes', { data: [], error: null });
    onTable('activity_comments', { data: [], error: null });

    const result = await service.getFeed('me');

    expect(result.data).toEqual([
      {
        ...completion,
        like_count: 0,
        comment_count: 0,
        liked_by_me: false,
        latest_comment: null,
        saved_by_me: false,
      },
    ]);
  });

  it('adds the newest comment of each post, leaving out people the caller blocked', async () => {
    rpcResults.set('get_activity_feed', {
      data: [item('a1'), item('a2')],
      error: null,
    });
    rpcResults.set('get_latest_comments', {
      data: [
        {
          activity_id: 'a2',
          comment_id: 'k9',
          user_id: 'u5',
          username: 'gio',
          comment: 'Beautiful!',
          created_at: '2026-11-14T08:00:00Z',
        },
      ],
      error: null,
    });
    mockModeration.getBlockedUserIds.mockResolvedValue(['blocked-user']);
    onTable('activity_likes', { data: [], error: null });
    onTable('activity_comments', {
      data: [{ activity_id: 'a2' }, { activity_id: 'a2' }],
      error: null,
    });

    const result = await service.getFeed('me');

    expect(mockAdmin.rpc).toHaveBeenCalledWith('get_latest_comments', {
      p_activity_ids: ['a1', 'a2'],
      p_hidden_user_ids: ['blocked-user'],
    });
    expect(result.data).toEqual([
      expect.objectContaining({ activity_id: 'a1', latest_comment: null }),
      expect.objectContaining({
        activity_id: 'a2',
        comment_count: 2,
        latest_comment: {
          id: 'k9',
          user_id: 'u5',
          username: 'gio',
          comment: 'Beautiful!',
        },
      }),
    ]);
  });

  it('still shows the posts and their counts when the latest comments cannot be loaded', async () => {
    rpcResults.set('get_activity_feed', { data: [item('a1')], error: null });
    rpcResults.set('get_latest_comments', {
      data: null,
      error: { message: 'timeout' },
    });
    onTable('activity_likes', {
      data: [{ activity_id: 'a1', user_id: 'x' }],
      error: null,
    });
    onTable('activity_comments', { data: [], error: null });

    const result = await service.getFeed('me');

    expect(result.data).toEqual([
      expect.objectContaining({
        activity_id: 'a1',
        like_count: 1,
        latest_comment: null,
      }),
    ]);
    expect(warnLog).toHaveBeenCalled();
  });

  it('passes page and limit to the feed function', async () => {
    rpcResults.set('get_activity_feed', { data: [], error: null });

    await service.getFeed('me', 3, 10);

    expect(mockAdmin.rpc).toHaveBeenCalledWith('get_activity_feed', {
      p_user_id: 'me',
      p_limit: 10,
      p_offset: 20,
    });
    // nothing to count on an empty page
    expect(mockAdmin.from).not.toHaveBeenCalled();
  });

  it('leaves out items posted by users the caller blocked', async () => {
    rpcResults.set('get_activity_feed', {
      data: [item('a1', 'friend'), item('a2', 'blocked-user')],
      error: null,
    });
    mockModeration.getBlockedUserIds.mockResolvedValue(['blocked-user']);
    onTable('activity_likes', { data: [], error: null });
    onTable('activity_comments', { data: [], error: null });

    const result = await service.getFeed('me');

    expect(result.data.map((i) => i.activity_id)).toEqual(['a1']);
    expect(mockModeration.getBlockedUserIds).toHaveBeenCalledWith('me');
  });

  describe('getDiscover (posts from everyone, best first)', () => {
    it('pages through the ranked posts and adds likes and comments', async () => {
      rpcResults.set('get_discover_feed', {
        data: [
          { ...item('d1', 'stranger'), total_count: 41 },
          { ...item('d2', 'other'), total_count: 41 },
        ],
        error: null,
      });
      onTable('activity_likes', {
        data: [{ activity_id: 'd2', user_id: 'me' }],
        error: null,
      });
      onTable('activity_comments', { data: [], error: null });

      const result = await service.getDiscover('me', 2, 20);

      expect(mockAdmin.rpc).toHaveBeenCalledWith('get_discover_feed', {
        p_user_id: 'me',
        p_limit: 20,
        p_offset: 20,
      });
      expect(result.pagination).toEqual({
        page: 2,
        limit: 20,
        total: 41,
        totalPages: 3,
      });
      expect(result.data).toEqual([
        expect.objectContaining({ activity_id: 'd1', like_count: 0 }),
        expect.objectContaining({
          activity_id: 'd2',
          like_count: 1,
          liked_by_me: true,
        }),
      ]);
      // The paging count is not part of a post
      expect(result.data[0]).not.toHaveProperty('total_count');
    });

    it('ends after the last page', async () => {
      rpcResults.set('get_discover_feed', { data: [], error: null });

      const result = await service.getDiscover('me', 3, 20);

      expect(result.data).toEqual([]);
      expect(result.pagination.totalPages).toBe(2);
    });

    it('is empty, not an error, when nobody has posted yet', async () => {
      rpcResults.set('get_discover_feed', { data: [], error: null });

      const result = await service.getDiscover('me');

      expect(result.data).toEqual([]);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      });
    });
  });

  describe('getActivity (one post, for notification taps)', () => {
    it('returns the post with its likes and comments', async () => {
      rpcResults.set('get_activity_item', {
        data: [{ ...item('a1'), trail_distance_km: 12.4 }],
        error: null,
      });
      onTable('activity_likes', {
        data: [{ activity_id: 'a1', user_id: 'me' }],
        error: null,
      });
      onTable('activity_comments', {
        data: [{ activity_id: 'a1' }, { activity_id: 'a1' }],
        error: null,
      });

      const post = await service.getActivity('me', 'a1');

      expect(mockAdmin.rpc).toHaveBeenCalledWith('get_activity_item', {
        p_activity_id: 'a1',
      });
      expect(post).toEqual({
        ...item('a1'),
        trail_distance_km: 12.4,
        like_count: 1,
        comment_count: 2,
        liked_by_me: true,
        latest_comment: null,
        saved_by_me: false,
      });
    });

    it('is not found when the post no longer exists', async () => {
      rpcResults.set('get_activity_item', { data: [], error: null });

      await expect(service.getActivity('me', 'gone')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('is not found when the caller blocked its author', async () => {
      rpcResults.set('get_activity_item', {
        data: [item('a1', 'blocked-user')],
        error: null,
      });
      mockModeration.getBlockedUserIds.mockResolvedValue(['blocked-user']);

      await expect(service.getActivity('me', 'a1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(mockAdmin.from).not.toHaveBeenCalled();
    });
  });

  it('returns the items without counts when the counts cannot be loaded', async () => {
    rpcResults.set('get_activity_feed', { data: [item('a1')], error: null });
    onTable('activity_likes', { data: null, error: { message: 'timeout' } });
    onTable('activity_comments', { data: [], error: null });

    const result = await service.getFeed('me');

    expect(result.data).toEqual([item('a1')]);
    expect(warnLog).toHaveBeenCalled();
  });
  describe('saved posts', () => {
    it('marks the posts the caller saved', async () => {
      rpcResults.set('get_activity_feed', { data: [item('a1'), item('a2')], error: null });
      onTable('activity_likes', { data: [], error: null });
      onTable('activity_comments', { data: [], error: null });
      const saved = onTable('saved_posts', { data: [{ activity_id: 'a2' }], error: null });

      const result = await service.getFeed('me', 1, 20);

      expect(saved.eq).toHaveBeenCalledWith('user_id', 'me');
      expect(saved.in).toHaveBeenCalledWith('activity_id', ['a1', 'a2']);
      expect(result.data.map((p) => (p as { saved_by_me?: boolean }).saved_by_me)).toEqual([false, true]);
    });

    it('leaves saved_by_me out when the saved posts cannot be loaded', async () => {
      rpcResults.set('get_activity_feed', { data: [item('a1')], error: null });
      onTable('activity_likes', { data: [], error: null });
      onTable('activity_comments', { data: [], error: null });
      onTable('saved_posts', { data: null, error: { message: 'relation does not exist' } });

      const result = await service.getFeed('me', 1, 20);

      expect(result.data[0]).toEqual(expect.objectContaining({ activity_id: 'a1', like_count: 0 }));
      expect(result.data[0]).not.toHaveProperty('saved_by_me');
    });

    it('lists them most recently saved first, with the feed fields, without blocked authors', async () => {
      mockModeration.getBlockedUserIds.mockResolvedValue(['troll']);
      rpcResults.set('get_saved_posts', {
        data: [
          { ...item('s1'), saved_at: '2026-11-19T10:00:00Z', total_count: 3 },
          { ...item('s2', 'troll'), saved_at: '2026-11-18T10:00:00Z', total_count: 3 },
          { ...item('s3'), saved_at: '2026-11-17T10:00:00Z', total_count: 3 },
        ],
        error: null,
      });
      onTable('activity_likes', { data: [], error: null });
      onTable('activity_comments', { data: [], error: null });
      onTable('saved_posts', { data: [{ activity_id: 's1' }, { activity_id: 's3' }], error: null });

      const result = await service.getSaved('me', 1, 20);

      expect(mockAdmin.rpc).toHaveBeenCalledWith('get_saved_posts', { p_user_id: 'me', p_limit: 20, p_offset: 0 });
      expect(result.data.map((p) => p.activity_id)).toEqual(['s1', 's3']);
      expect(result.data[0]).not.toHaveProperty('total_count');
      expect(result.data[0]).toEqual(expect.objectContaining({ saved_by_me: true, saved_at: '2026-11-19T10:00:00Z' }));
      expect(result.pagination).toEqual({ page: 1, limit: 20, total: 3, totalPages: 1 });
    });

    it('saves a post that exists, once, with its type', async () => {
      rpcResults.set('get_activity_item', { data: [{ ...item('a1'), activity_type: 'photo' }], error: null });
      const saved = onTable('saved_posts', { error: null });

      await expect(service.savePost('me', 'a1')).resolves.toEqual({ saved: true });
      expect(saved.upsert).toHaveBeenCalledWith(
        { user_id: 'me', activity_id: 'a1', activity_type: 'photo' },
        { onConflict: 'user_id,activity_id', ignoreDuplicates: true },
      );
    });

    it('does not save a post that is gone, or by someone the caller blocked', async () => {
      rpcResults.set('get_activity_item', { data: [], error: null });
      await expect(service.savePost('me', 'gone')).rejects.toBeInstanceOf(NotFoundException);

      mockModeration.getBlockedUserIds.mockResolvedValue(['troll']);
      rpcResults.set('get_activity_item', { data: [item('a9', 'troll')], error: null });
      await expect(service.savePost('me', 'a9')).rejects.toBeInstanceOf(NotFoundException);
    });

    it("unsaves only the caller's own row", async () => {
      const saved = onTable('saved_posts', { error: null });
      await expect(service.unsavePost('me', 'a1')).resolves.toEqual({ saved: false });
      expect(saved.delete).toHaveBeenCalled();
      expect(saved.eq).toHaveBeenCalledWith('user_id', 'me');
      expect(saved.eq).toHaveBeenCalledWith('activity_id', 'a1');
    });
  });
});
