import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { SupabaseService } from '../config/supabase.config';
import { NotificationsService } from '../notifications/notifications.service';

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

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: NotificationsService, useValue: mockNotifications },
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
      completionsChain.eq = jest.fn()
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
      mockAdmin.from.mockReturnValue(
        chain({ data: null, error: null }),
      );

      await expect(
        service.updateProfile('bad-id', { full_name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns updated profile on success', async () => {
      mockAdmin.from.mockReturnValue(
        chain({ data: { id: 'u1', full_name: 'Updated' }, error: null }),
      );

      const result = await service.updateProfile('u1', { full_name: 'Updated' });
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
      completionsChain.not = jest.fn().mockResolvedValue({ data: [], error: null });

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
      completionsChain.not = jest.fn().mockResolvedValue({ data: [], error: null });

      mockAdmin.from
        .mockReturnValueOnce(photosChain)
        .mockReturnValueOnce(completionsChain);

      mockAdmin.auth.admin.deleteUser.mockResolvedValue({
        error: new Error('User not found'),
      });

      await expect(service.deleteAccount('bad-user')).rejects.toThrow('User not found');
    });

    it('removes hike photo storage files when they exist', async () => {
      const url = 'https://supabase.co/storage/v1/object/public/trail-media/photos/pic.jpg';
      const photosChain: Record<string, jest.Mock> = {};
      photosChain.select = jest.fn().mockReturnValue(photosChain);
      photosChain.eq = jest.fn().mockResolvedValue({ data: [{ url }], error: null });

      const completionsChain: Record<string, jest.Mock> = {};
      completionsChain.select = jest.fn().mockReturnValue(completionsChain);
      completionsChain.eq = jest.fn().mockReturnValue(completionsChain);
      completionsChain.not = jest.fn().mockResolvedValue({ data: [], error: null });

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
    it('returns ranked users', async () => {
      const users = [
        { id: 'u1', username: 'first', total_trails_completed: 10 },
        { id: 'u2', username: 'second', total_trails_completed: 5 },
      ];

      const leaderChain: Record<string, jest.Mock> = {};
      leaderChain.select = jest.fn().mockReturnValue(leaderChain);
      leaderChain.gt = jest.fn().mockReturnValue(leaderChain);
      leaderChain.order = jest.fn().mockReturnValue(leaderChain);
      leaderChain.limit = jest.fn().mockResolvedValue({ data: users, error: null });
      mockAdmin.from.mockReturnValue(leaderChain);

      const result = await service.getLeaderboard(20);

      expect(result).toHaveLength(2);
      expect(result![0].rank).toBe(1);
      expect(result![1].rank).toBe(2);
    });

    it('uses cache on second call', async () => {
      const leaderChain: Record<string, jest.Mock> = {};
      leaderChain.select = jest.fn().mockReturnValue(leaderChain);
      leaderChain.gt = jest.fn().mockReturnValue(leaderChain);
      leaderChain.order = jest.fn().mockReturnValue(leaderChain);
      leaderChain.limit = jest.fn().mockResolvedValue({ data: [], error: null });
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
      mockAdmin.from.mockReturnValue(
        chain({ data: null, error: null }),
      );

      await expect(service.triggerSos('bad', 41.7, 44.8)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('sends notification to emergency contact', async () => {
      mockAdmin.from.mockReturnValue(
        chain({
          data: { username: 'hiker', emergency_contact_user_id: 'contact-1' },
          error: null,
        }),
      );

      const result = await service.triggerSos('user-1', 41.7, 44.8);

      expect(result.sent).toBe(true);
      expect(mockNotifications.sendToUser).toHaveBeenCalledWith(
        'contact-1',
        expect.stringContaining('SOS'),
        expect.stringContaining('hiker'),
        expect.objectContaining({ type: 'sos', lat: 41.7, lng: 44.8 }),
        'sos',
      );
    });

    it('returns sent: false when no emergency contact is set', async () => {
      mockAdmin.from.mockReturnValue(
        chain({
          data: { username: 'hiker', emergency_contact_user_id: null },
          error: null,
        }),
      );

      const result = await service.triggerSos('user-1', 41.7, 44.8);
      expect(result.sent).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // setEmergencyContact
  // -------------------------------------------------------------------------
  describe('setEmergencyContact', () => {
    it('updates profile and notifies the contact', async () => {
      const updateChain: Record<string, jest.Mock> = {};
      updateChain.update = jest.fn().mockReturnValue(updateChain);
      updateChain.eq = jest.fn().mockResolvedValue({ error: null });

      const profileChain = chain({
        data: { username: 'hiker' },
        error: null,
      });

      mockAdmin.from
        .mockReturnValueOnce(updateChain)
        .mockReturnValueOnce(profileChain);

      const result = await service.setEmergencyContact('user-1', 'contact-1');

      expect(result.ok).toBe(true);
      expect(mockNotifications.sendToUser).toHaveBeenCalledWith(
        'contact-1',
        'Emergency Contact',
        expect.stringContaining('hiker'),
        expect.any(Object),
        'emergency_contact',
      );
    });
  });
});
