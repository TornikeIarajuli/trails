import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { FollowsService } from './follows.service';
import { SupabaseService } from '../config/supabase.config';
import { NotificationsService } from '../notifications/notifications.service';
import { ModerationService } from '../moderation/moderation.service';

type Builder = Record<string, jest.Mock> & { then: unknown };

function makeBuilder(result: object): Builder {
  const self = {} as Builder;
  ['select', 'insert', 'delete', 'eq', 'gte', 'limit'].forEach((m) => {
    self[m] = jest.fn(() => self);
  });
  self.single = jest.fn().mockResolvedValue(result);
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

const mockNotifications = {
  sendToUser: jest.fn().mockResolvedValue({ sent: 1 }),
};
const mockModeration = { isBlockedEitherWay: jest.fn() };

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('FollowsService', () => {
  let service: FollowsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FollowsService,
        {
          provide: SupabaseService,
          useValue: { getAdminClient: () => mockAdmin },
        },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: ModerationService, useValue: mockModeration },
      ],
    }).compile();

    service = module.get(FollowsService);
    jest.clearAllMocks();
    queues.clear();
    mockModeration.isBlockedEitherWay.mockResolvedValue(false);
  });

  it('refuses to follow yourself', async () => {
    await expect(service.toggle('u1', 'u1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('follows and pushes a new_follower notification', async () => {
    onTable('user_follows', { data: null, error: null });
    const insert = onTable('user_follows', { error: null });
    const recent = onTable('notifications', { data: [], error: null });
    onTable('profiles', { data: { username: 'nino' }, error: null });

    const result = await service.toggle('follower', 'target');
    await flush();

    expect(result).toEqual({ following: true });
    expect(insert.insert).toHaveBeenCalledWith({
      follower_id: 'follower',
      following_id: 'target',
    });
    expect(recent.eq).toHaveBeenCalledWith('data->>followerId', 'follower');
    expect(recent.gte).toHaveBeenCalledWith('created_at', expect.any(String));
    expect(mockNotifications.sendToUser).toHaveBeenCalledWith(
      'target',
      'New Follower',
      'nino started following you',
      { followerId: 'follower' },
      'new_follower',
    );
  });

  it('does not push again when the same person followed within 24 hours', async () => {
    onTable('user_follows', { data: null, error: null });
    onTable('user_follows', { error: null });
    onTable('notifications', { data: [{ id: 'n1' }], error: null });

    await service.toggle('follower', 'target');
    await flush();

    expect(mockNotifications.sendToUser).not.toHaveBeenCalled();
  });

  it('unfollows without notifying', async () => {
    onTable('user_follows', { data: { id: 'f1' }, error: null });
    const del = onTable('user_follows', { error: null });

    const result = await service.toggle('follower', 'target');
    await flush();

    expect(result).toEqual({ following: false });
    expect(del.delete).toHaveBeenCalled();
    expect(mockNotifications.sendToUser).not.toHaveBeenCalled();
  });

  it('refuses to follow when either user blocked the other', async () => {
    onTable('user_follows', { data: null, error: null });
    mockModeration.isBlockedEitherWay.mockResolvedValue(true);

    await expect(service.toggle('follower', 'target')).rejects.toThrow(
      ForbiddenException,
    );
    expect(mockModeration.isBlockedEitherWay).toHaveBeenCalledWith(
      'follower',
      'target',
    );
  });
});
