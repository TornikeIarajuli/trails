import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { SupabaseService } from '../config/supabase.config';
import { NotificationsService } from '../notifications/notifications.service';
import { TrailsService } from '../trails/trails.service';
import type { RegionSummary } from '../trails/region-stats';

// ---------------------------------------------------------------------------
// Chainable query builder
// ---------------------------------------------------------------------------
const chain = (result: object) => {
  const c: Record<string, jest.Mock> = {};
  c.select = jest.fn().mockReturnValue(c);
  c.eq = jest.fn().mockReturnValue(c);
  c.gt = jest.fn().mockReturnValue(c);
  c.or = jest.fn().mockReturnValue(c);
  c.not = jest.fn().mockReturnValue(c);
  c.is = jest.fn().mockReturnValue(c);
  c.in = jest.fn().mockReturnValue(c);
  c.order = jest.fn().mockReturnValue(c);
  c.limit = jest.fn().mockResolvedValue(result);
  c.update = jest.fn().mockReturnValue(c);
  c.delete = jest.fn().mockReturnValue(c);
  c.single = jest.fn().mockResolvedValue(result);
  return c;
};

const mockAdmin: Record<string, any> = {
  from: jest.fn(),
  rpc: jest.fn(),
  auth: { admin: { deleteUser: jest.fn() } },
  storage: {
    from: jest.fn().mockReturnValue({
      remove: jest.fn().mockResolvedValue({ error: null }),
      list: jest.fn().mockResolvedValue({ data: [], error: null }),
    }),
  },
};

const mockSupabase = {
  getAdminClient: jest.fn(() => mockAdmin),
};

const mockNotifications = {
  sendToUser: jest.fn().mockResolvedValue({ sent: 1 }),
};

const mockTrails = {
  getRegionSummaries: jest.fn(),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: TrailsService, useValue: mockTrails },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
    mockSupabase.getAdminClient.mockReturnValue(mockAdmin);
    mockAdmin.auth.admin.deleteUser.mockResolvedValue({ error: null });
    mockAdmin.storage.from.mockReturnValue({
      remove: jest.fn().mockResolvedValue({ error: null }),
      list: jest.fn().mockResolvedValue({ data: [], error: null }),
    });
  });

  // -------------------------------------------------------------------------
  // getProfile
  // -------------------------------------------------------------------------
  describe('getProfile', () => {
    it('throws NotFoundException when profile does not exist', async () => {
      mockAdmin.from.mockReturnValue(
        chain({ data: null, error: { message: 'not found' } }),
      );

      await expect(service.getProfile('bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns profile with difficulty stats', async () => {
      const profileChain = chain({
        data: { id: 'u1', username: 'hiker', total_trails_completed: 3 },
        error: null,
      });

      const completionsData = [
        { trail_id: 't1', status: 'approved', trails: { difficulty: 'easy' } },
        { trail_id: 't2', status: 'approved', trails: { difficulty: 'hard' } },
        { trail_id: 't3', status: 'approved', trails: { difficulty: 'hard' } },
      ];
      // completions: .from().select().eq('user_id').eq('status') — 2 chained .eq()
      const completionsChain: Record<string, jest.Mock> = {};
      completionsChain.select = jest.fn().mockReturnValue(completionsChain);
      completionsChain.eq = jest
        .fn()
        .mockReturnValueOnce(completionsChain) // first .eq('user_id')
        .mockResolvedValueOnce({ data: completionsData, error: null }); // second .eq('status')

      mockAdmin.from
        .mockReturnValueOnce(profileChain)
        .mockReturnValueOnce(completionsChain);

      const result = await service.getProfile('u1');

      expect(result.username).toBe('hiker');
      expect(result.stats.total).toBe(3);
      expect(result.stats.easy).toBe(1);
      expect(result.stats.hard).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // updateProfile
  // -------------------------------------------------------------------------
  describe('updateProfile', () => {
    it('throws NotFoundException when user does not exist', async () => {
      mockAdmin.from.mockReturnValue(chain({ data: null, error: null }));

      await expect(
        service.updateProfile('bad-id', { full_name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns updated profile on success', async () => {
      mockAdmin.from.mockReturnValue(
        chain({ data: { id: 'u1', full_name: 'Updated' }, error: null }),
      );

      const result = await service.updateProfile('u1', {
        full_name: 'Updated',
      });
      expect(result.full_name).toBe('Updated');
    });
  });

  // -------------------------------------------------------------------------
  // deleteAccount
  // -------------------------------------------------------------------------
  describe('deleteAccount', () => {
    it('deletes storage files and then the auth user', async () => {
      // trail_photos: .from().select().eq() — resolves at last .eq()
      const photosChain: Record<string, jest.Mock> = {};
      photosChain.select = jest.fn().mockReturnValue(photosChain);
      photosChain.eq = jest.fn().mockResolvedValue({ data: [], error: null });

      // trail_completions: .from().select().eq().not() — resolves at .not()
      const completionsChain: Record<string, jest.Mock> = {};
      completionsChain.select = jest.fn().mockReturnValue(completionsChain);
      completionsChain.eq = jest.fn().mockReturnValue(completionsChain);
      completionsChain.not = jest
        .fn()
        .mockResolvedValue({ data: [], error: null });

      mockAdmin.from
        .mockReturnValueOnce(photosChain)
        .mockReturnValueOnce(completionsChain);

      await service.deleteAccount('user-1');

      expect(mockAdmin.auth.admin.deleteUser).toHaveBeenCalledWith('user-1');
    });

    it('throws when Supabase deleteUser fails', async () => {
      const photosChain: Record<string, jest.Mock> = {};
      photosChain.select = jest.fn().mockReturnValue(photosChain);
      photosChain.eq = jest.fn().mockResolvedValue({ data: [], error: null });

      const completionsChain: Record<string, jest.Mock> = {};
      completionsChain.select = jest.fn().mockReturnValue(completionsChain);
      completionsChain.eq = jest.fn().mockReturnValue(completionsChain);
      completionsChain.not = jest
        .fn()
        .mockResolvedValue({ data: [], error: null });

      mockAdmin.from
        .mockReturnValueOnce(photosChain)
        .mockReturnValueOnce(completionsChain);

      mockAdmin.auth.admin.deleteUser.mockResolvedValue({
        error: new Error('User not found'),
      });
      const errorLog = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);

      await expect(service.deleteAccount('bad-user')).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(String(errorLog.mock.calls[0][0])).toContain('User not found');
      errorLog.mockRestore();
    });

    it('removes hike photo storage files when they exist', async () => {
      const url =
        'https://supabase.co/storage/v1/object/public/trail-media/photos/pic.jpg';
      const photosChain: Record<string, jest.Mock> = {};
      photosChain.select = jest.fn().mockReturnValue(photosChain);
      photosChain.eq = jest
        .fn()
        .mockResolvedValue({ data: [{ url }], error: null });

      const completionsChain: Record<string, jest.Mock> = {};
      completionsChain.select = jest.fn().mockReturnValue(completionsChain);
      completionsChain.eq = jest.fn().mockReturnValue(completionsChain);
      completionsChain.not = jest
        .fn()
        .mockResolvedValue({ data: [], error: null });

      const removeFn = jest.fn().mockResolvedValue({ error: null });
      mockAdmin.storage.from.mockReturnValue({
        remove: removeFn,
        list: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      mockAdmin.from
        .mockReturnValueOnce(photosChain)
        .mockReturnValueOnce(completionsChain);

      await service.deleteAccount('user-1');

      expect(removeFn).toHaveBeenCalledWith(['photos/pic.jpg']);
    });
  });

  // -------------------------------------------------------------------------
  // getLeaderboard
  // -------------------------------------------------------------------------
  describe('getLeaderboard', () => {
    const leaderChain = (result: object) => {
      const c: Record<string, jest.Mock> = {};
      c.select = jest.fn().mockReturnValue(c);
      c.gt = jest.fn().mockReturnValue(c);
      c.order = jest.fn().mockReturnValue(c);
      c.limit = jest.fn().mockResolvedValue(result);
      return c;
    };

    it('ranks by trails hiked with the app, not past hikes', async () => {
      const c = leaderChain({
        data: [
          { id: 'u1', username: 'first', ranked_trails_completed: 10 },
          { id: 'u2', username: 'second', ranked_trails_completed: 5 },
        ],
        error: null,
      });
      mockAdmin.from.mockReturnValue(c);

      const result = (await service.getLeaderboard(20)) as any[];

      expect(c.select).toHaveBeenCalledWith(
        'id, username, full_name, avatar_url, ranked_trails_completed',
      );
      expect(c.gt).toHaveBeenCalledWith('ranked_trails_completed', 0);
      expect(c.order).toHaveBeenCalledWith('ranked_trails_completed', {
        ascending: false,
      });
      // total_trails_completed carries the ranked count for released app builds
      expect(result).toEqual([
        {
          rank: 1,
          id: 'u1',
          username: 'first',
          total_trails_completed: 10,
          ranked_trails_completed: 10,
        },
        {
          rank: 2,
          id: 'u2',
          username: 'second',
          total_trails_completed: 5,
          ranked_trails_completed: 5,
        },
      ]);
    });

    it('ranks by the total before migration 054', async () => {
      const missing = leaderChain({
        data: null,
        error: { code: '42703', message: 'column does not exist' },
      });
      const fallback = leaderChain({
        data: [{ id: 'u1', username: 'first', total_trails_completed: 7 }],
        error: null,
      });
      mockAdmin.from.mockReturnValueOnce(missing).mockReturnValueOnce(fallback);
      const warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);

      const result = (await service.getLeaderboard(20)) as any[];

      expect(fallback.order).toHaveBeenCalledWith('total_trails_completed', {
        ascending: false,
      });
      expect(result).toEqual([
        {
          rank: 1,
          id: 'u1',
          username: 'first',
          total_trails_completed: 7,
          ranked_trails_completed: 7,
        },
      ]);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('054'));
      warn.mockRestore();
    });

    it('uses cache on second call', async () => {
      const leaderChain: Record<string, jest.Mock> = {};
      leaderChain.select = jest.fn().mockReturnValue(leaderChain);
      leaderChain.gt = jest.fn().mockReturnValue(leaderChain);
      leaderChain.order = jest.fn().mockReturnValue(leaderChain);
      leaderChain.limit = jest
        .fn()
        .mockResolvedValue({ data: [], error: null });
      mockAdmin.from.mockReturnValue(leaderChain);

      await service.getLeaderboard(20);
      await service.getLeaderboard(20);

      // from() should only be called once thanks to cache
      expect(mockAdmin.from).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // triggerSos
  // -------------------------------------------------------------------------
  describe('triggerSos', () => {
    it('throws NotFoundException when user not found', async () => {
      mockAdmin.from.mockReturnValue(chain({ data: null, error: null }));

      await expect(service.triggerSos('bad', 41.7, 44.8)).rejects.toThrow(
        NotFoundException,
      );
    });

    const withContact = () =>
      mockAdmin.from.mockReturnValue(
        chain({
          data: { username: 'hiker', emergency_contact_user_id: 'contact-1' },
          error: null,
        }),
      );

    it('sends notification to emergency contact', async () => {
      withContact();
      mockNotifications.sendToUser.mockResolvedValueOnce({ sent: 2 });

      const result = await service.triggerSos('user-1', 41.7, 44.8);

      expect(result).toEqual({ sent: true, reason: 'ok', devices: 2 });
      expect(mockNotifications.sendToUser).toHaveBeenCalledWith(
        'contact-1',
        expect.stringContaining('SOS'),
        expect.stringContaining('hiker'),
        { userId: 'user-1', lat: 41.7, lng: 44.8 },
        'sos',
      );
    });

    it('puts a maps link built from the coordinates into the alert', async () => {
      withContact();

      await service.triggerSos('user-1', 42.66551234567, 44.61459876543);

      const body = mockNotifications.sendToUser.mock.calls[0][2] as string;
      expect(body).toContain('https://maps.google.com/?q=42.665512,44.614599');
    });

    it('returns no_contact when no emergency contact is set', async () => {
      mockAdmin.from.mockReturnValue(
        chain({
          data: { username: 'hiker', emergency_contact_user_id: null },
          error: null,
        }),
      );

      const result = await service.triggerSos('user-1', 41.7, 44.8);

      expect(result).toEqual({ sent: false, reason: 'no_contact', devices: 0 });
      expect(mockNotifications.sendToUser).not.toHaveBeenCalled();
    });

    it.each([
      ['has no registered device', { sent: 0 }],
      ['rejected every push', { sent: 0, error: 'DeviceNotRegistered' }],
      ['push call failed', { sent: 0, error: 'socket hang up' }],
    ])(
      'reports contact_unreachable when the contact %s',
      async (_label, push) => {
        withContact();
        mockNotifications.sendToUser.mockResolvedValueOnce(push);

        const result = await service.triggerSos('user-1', 41.7, 44.8);

        expect(result).toEqual({
          sent: false,
          reason: 'contact_unreachable',
          devices: 0,
        });
      },
    );

    it.each([
      [NaN, 44.8],
      [41.7, Infinity],
      [91, 44.8],
      [41.7, -181],
      ['41.7); DROP TABLE' as unknown as number, 44.8],
    ])(
      'rejects coordinates that are not valid numbers (%p, %p)',
      async (lat, lng) => {
        await expect(service.triggerSos('user-1', lat, lng)).rejects.toThrow(
          BadRequestException,
        );
        expect(mockAdmin.from).not.toHaveBeenCalled();
        expect(mockNotifications.sendToUser).not.toHaveBeenCalled();
      },
    );
  });

  // -------------------------------------------------------------------------
  // setEmergencyContact
  // -------------------------------------------------------------------------
  describe('setEmergencyContact', () => {
    const updateChain = () => {
      const c: Record<string, jest.Mock> = {};
      c.update = jest.fn().mockReturnValue(c);
      c.eq = jest.fn().mockResolvedValue({ error: null });
      return c;
    };

    it('updates profile and notifies the contact', async () => {
      const setter = chain({
        data: { username: 'hiker', emergency_contact_user_id: null },
        error: null,
      });
      const contact = chain({ data: { id: 'contact-1' }, error: null });
      const update = updateChain();
      mockAdmin.from
        .mockReturnValueOnce(setter)
        .mockReturnValueOnce(contact)
        .mockReturnValueOnce(update);

      const result = await service.setEmergencyContact('user-1', 'contact-1');

      expect(result.ok).toBe(true);
      expect(update.update).toHaveBeenCalledWith({
        emergency_contact_user_id: 'contact-1',
      });
      expect(mockNotifications.sendToUser).toHaveBeenCalledWith(
        'contact-1',
        'Emergency Contact',
        expect.stringContaining('hiker'),
        { setterId: 'user-1' },
        'emergency_contact',
      );
    });

    it('rejects choosing yourself, whatever the letter case of the id', async () => {
      mockAdmin.from.mockReturnValue(
        chain({
          data: { username: 'hiker', emergency_contact_user_id: null },
          error: null,
        }),
      );

      await expect(
        service.setEmergencyContact('ab-cd', 'AB-CD'),
      ).rejects.toThrow(BadRequestException);
      expect(mockNotifications.sendToUser).not.toHaveBeenCalled();
      // only the caller's profile was read; nothing was written
      expect(mockAdmin.from).toHaveBeenCalledTimes(1);
    });

    it('answers 404 when the chosen user does not exist', async () => {
      mockAdmin.from
        .mockReturnValueOnce(
          chain({
            data: { username: 'hiker', emergency_contact_user_id: null },
            error: null,
          }),
        )
        .mockReturnValueOnce(
          chain({ data: null, error: { code: 'PGRST116' } }),
        );

      await expect(
        service.setEmergencyContact('user-1', 'ghost'),
      ).rejects.toThrow(NotFoundException);
      expect(mockAdmin.from).toHaveBeenCalledTimes(2);
      expect(mockNotifications.sendToUser).not.toHaveBeenCalled();
    });

    it('clears the contact with null and notifies nobody', async () => {
      const update = updateChain();
      mockAdmin.from
        .mockReturnValueOnce(
          chain({
            data: { username: 'hiker', emergency_contact_user_id: 'contact-1' },
            error: null,
          }),
        )
        .mockReturnValueOnce(update);

      const result = await service.setEmergencyContact('user-1', null);

      expect(result.ok).toBe(true);
      expect(update.update).toHaveBeenCalledWith({
        emergency_contact_user_id: null,
      });
      expect(mockNotifications.sendToUser).not.toHaveBeenCalled();
    });

    it('does not notify again when the same contact is saved twice', async () => {
      mockAdmin.from
        .mockReturnValueOnce(
          chain({
            data: { username: 'hiker', emergency_contact_user_id: 'contact-1' },
            error: null,
          }),
        )
        .mockReturnValueOnce(chain({ data: { id: 'contact-1' }, error: null }))
        .mockReturnValueOnce(updateChain());

      await service.setEmergencyContact('user-1', 'contact-1');

      expect(mockNotifications.sendToUser).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // searchUsers
  // -------------------------------------------------------------------------
  describe('getSuggestedHikers', () => {
    it('asks for hikers the caller does not follow yet, and counts mutual follows as numbers', async () => {
      mockAdmin.rpc.mockResolvedValueOnce({
        data: [
          {
            id: 'u2',
            username: 'gio',
            followed_by: 'nino',
            mutual_count: '2',
            total_trails_completed: 9,
          },
        ],
        error: null,
      });

      const result = await service.getSuggestedHikers('me', 5);

      expect(mockAdmin.rpc).toHaveBeenCalledWith('get_suggested_hikers', {
        p_user_id: 'me',
        p_limit: 5,
      });
      expect(result).toEqual([
        expect.objectContaining({
          id: 'u2',
          followed_by: 'nino',
          mutual_count: 2,
        }),
      ]);
    });

    it('keeps the list short', async () => {
      mockAdmin.rpc.mockResolvedValueOnce({ data: [], error: null });

      await service.getSuggestedHikers('me', 500);

      expect(mockAdmin.rpc).toHaveBeenCalledWith('get_suggested_hikers', {
        p_user_id: 'me',
        p_limit: 20,
      });
    });
  });

  describe('searchUsers', () => {
    const searchChain = (rows: object[] = []) => {
      const c = chain({ data: rows, error: null });
      mockAdmin.from.mockReturnValue(c);
      return c;
    };

    it.each(['', ' ', 'a', ' a ', '%', '_', '..', '*a', 'a,'])(
      'returns nothing for %p without querying',
      async (query) => {
        expect(await service.searchUsers(query)).toEqual([]);
        expect(mockAdmin.from).not.toHaveBeenCalled();
      },
    );

    it('searches username and full name for terms of two or more characters', async () => {
      const c = searchChain([{ id: 'u1', username: 'anna' }]);

      const result = await service.searchUsers('an');

      expect(result).toHaveLength(1);
      expect(c.or).toHaveBeenCalledWith(
        'username.ilike.%an%,full_name.ilike.%an%',
      );
    });

    it('escapes LIKE wildcards so they match literally', async () => {
      const c = searchChain();

      await service.searchUsers('a_b%c');

      expect(c.or).toHaveBeenCalledWith(
        'username.ilike.%a\\_b\\%c%,full_name.ilike.%a\\_b\\%c%',
      );
    });

    it('strips PostgREST filter syntax and the * wildcard', async () => {
      const c = searchChain();

      await service.searchUsers('ab*),id.neq.(x"\'\\');

      expect(c.or).toHaveBeenCalledWith(
        'username.ilike.%abidneqx%,full_name.ilike.%abidneqx%',
      );
    });
  });

  // -------------------------------------------------------------------------
  // getRegionProgress
  // -------------------------------------------------------------------------
  describe('getRegionProgress', () => {
    const summaries: RegionSummary[] = [
      {
        region: 'Khevsureti',
        total: 14,
        center: [45.1, 42.6],
        trailIds: Array.from({ length: 14 }, (_, i) => `k${i}`),
      },
      { region: 'Racha', total: 2, center: null, trailIds: ['r0', 'r1'] },
    ];

    const completionsChain = (result: object) => {
      const c: Record<string, jest.Mock> = {};
      c.select = jest.fn().mockReturnValue(c);
      c.eq = jest.fn().mockReturnValueOnce(c).mockResolvedValueOnce(result);
      return c;
    };

    it('combines the cached region totals with one query for approved completions', async () => {
      mockTrails.getRegionSummaries.mockResolvedValue(summaries);
      const c = completionsChain({
        data: [{ trail_id: 'k0' }, { trail_id: 'k5' }, { trail_id: 'k9' }],
        error: null,
      });
      mockAdmin.from.mockReturnValue(c);

      const result = await service.getRegionProgress('user-1');

      expect(mockAdmin.from).toHaveBeenCalledTimes(1);
      expect(mockAdmin.from).toHaveBeenCalledWith('trail_completions');
      expect(c.select).toHaveBeenCalledWith('trail_id');
      expect(c.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(c.eq).toHaveBeenCalledWith('status', 'approved');
      expect(result.regions[0]).toEqual({
        region: 'Khevsureti',
        total: 14,
        completed: 3,
        center: [45.1, 42.6],
        completed_trail_ids: ['k0', 'k5', 'k9'],
      });
      expect(result.totals).toEqual({
        regions_total: 2,
        regions_started: 1,
        regions_completed: 0,
        trails_total: 16,
        trails_completed: 3,
      });
    });

    it('fails when the completions cannot be read', async () => {
      mockTrails.getRegionSummaries.mockResolvedValue(summaries);
      mockAdmin.from.mockReturnValue(
        completionsChain({
          data: null,
          error: { code: 'XX000', message: 'boom' },
        }),
      );
      const errorLog = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);

      await expect(service.getRegionProgress('user-1')).rejects.toThrow(
        InternalServerErrorException,
      );
      errorLog.mockRestore();
    });
  });

  // -------------------------------------------------------------------------
  // getPublicProfile
  // -------------------------------------------------------------------------
  describe('getPublicProfile', () => {
    const profile = {
      id: 'u1',
      username: 'hiker',
      total_trails_completed: 2,
    };
    const completionsChain = (result: object) => {
      const c: Record<string, jest.Mock> = {};
      c.select = jest.fn().mockReturnValue(c);
      c.eq = jest.fn().mockReturnValue(c);
      c.order = jest.fn().mockResolvedValue(result);
      return c;
    };

    it('lists completions with their source, past hikes included', async () => {
      const list = completionsChain({
        data: [
          { id: 'c1', source: 'hike', trails: { difficulty: 'hard' } },
          { id: 'c2', source: 'past', trails: { difficulty: 'easy' } },
        ],
        error: null,
      });
      mockAdmin.from
        .mockReturnValueOnce(chain({ data: profile, error: null }))
        .mockReturnValueOnce(list);

      const result = await service.getPublicProfile('u1');

      expect(String(list.select.mock.calls[0][0])).toContain('source');
      expect(result.completions.map((c) => c.source)).toEqual(['hike', 'past']);
      expect(result.stats).toMatchObject({ total: 2, hard: 1, easy: 1 });
      expect(result.total_trails_completed).toBe(2);
    });

    it('reads completions without source before migration 054', async () => {
      const missing = completionsChain({
        data: null,
        error: { code: '42703', message: 'column source does not exist' },
      });
      const retry = completionsChain({
        data: [{ id: 'c1', trails: { difficulty: 'medium' } }],
        error: null,
      });
      mockAdmin.from
        .mockReturnValueOnce(chain({ data: profile, error: null }))
        .mockReturnValueOnce(missing)
        .mockReturnValueOnce(retry);
      const warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);

      const result = await service.getPublicProfile('u1');

      expect(String(retry.select.mock.calls[0][0])).not.toContain('source');
      expect(result.completions).toEqual([
        { id: 'c1', trails: { difficulty: 'medium' }, source: 'hike' },
      ]);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('054'));
      warn.mockRestore();
    });
  });
});
