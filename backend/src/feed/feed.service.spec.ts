import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { FeedService } from './feed.service';
import { SupabaseService } from '../config/supabase.config';
import { ModerationService } from '../moderation/moderation.service';

type Builder = Record<string, jest.Mock> & { then: unknown };

function makeBuilder(result: object): Builder {
  const self = {} as Builder;
  ['select', 'in', 'eq'].forEach((m) => {
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
    warnLog = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => warnLog.mockRestore());

  it('adds like and comment counts and liked_by_me with two queries per page', async () => {
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
    expect(mockAdmin.from).toHaveBeenCalledTimes(2);
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

  it('returns the items without counts when the counts cannot be loaded', async () => {
    rpcResults.set('get_activity_feed', { data: [item('a1')], error: null });
    onTable('activity_likes', { data: null, error: { message: 'timeout' } });
    onTable('activity_comments', { data: [], error: null });

    const result = await service.getFeed('me');

    expect(result.data).toEqual([item('a1')]);
    expect(warnLog).toHaveBeenCalled();
  });
});
