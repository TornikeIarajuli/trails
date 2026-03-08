import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { SupabaseService } from '../config/supabase.config';
import { NotificationsService } from '../notifications/notifications.service';

// ---------------------------------------------------------------------------
// Chainable query builder
// ---------------------------------------------------------------------------
const chain = (result: object) => {
  const c: Record<string, jest.Mock> = {};
  c.select = jest.fn().mockReturnValue(c);
  c.eq = jest.fn().mockReturnValue(c);
  c.gte = jest.fn().mockReturnValue(c);
  c.order = jest.fn().mockReturnValue(c);
  c.insert = jest.fn().mockReturnValue(c);
  c.upsert = jest.fn().mockReturnValue(c);
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

const mockNotifications = {
  sendToUser: jest.fn().mockResolvedValue({ sent: 1 }),
};

describe('EventsService', () => {
  let service: EventsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
    jest.clearAllMocks();
    mockSupabase.getAdminClient.mockReturnValue(mockAdmin);
  });

  // -------------------------------------------------------------------------
  // findAll
  // -------------------------------------------------------------------------
  describe('findAll', () => {
    it('returns upcoming events', async () => {
      const events = [{ id: 'e1', title: 'Morning Hike' }];
      const listChain: Record<string, jest.Mock> = {};
      listChain.select = jest.fn().mockReturnValue(listChain);
      listChain.gte = jest.fn().mockReturnValue(listChain);
      listChain.order = jest.fn().mockResolvedValue({ data: events, error: null });
      mockAdmin.from.mockReturnValue(listChain);

      const result = await service.findAll();
      expect(result).toEqual(events);
    });

    it('filters by trail_id when provided', async () => {
      const listChain: Record<string, jest.Mock> = {};
      listChain.select = jest.fn().mockReturnValue(listChain);
      listChain.gte = jest.fn().mockReturnValue(listChain);
      listChain.order = jest.fn().mockReturnValue(listChain);
      listChain.eq = jest.fn().mockResolvedValue({ data: [], error: null });
      mockAdmin.from.mockReturnValue(listChain);

      await service.findAll('trail-1');
      expect(listChain.eq).toHaveBeenCalledWith('trail_id', 'trail-1');
    });
  });

  // -------------------------------------------------------------------------
  // findOne
  // -------------------------------------------------------------------------
  describe('findOne', () => {
    it('throws NotFoundException when event does not exist', async () => {
      mockAdmin.from.mockReturnValue(
        chain({ data: null, error: { code: 'PGRST116' } }),
      );

      await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('returns event with participants', async () => {
      const event = {
        id: 'e1',
        title: 'Morning Hike',
        participants: [{ user_id: 'u1' }],
      };
      mockAdmin.from.mockReturnValue(chain({ data: event, error: null }));

      const result = await service.findOne('e1');
      expect(result.title).toBe('Morning Hike');
    });
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------
  describe('create', () => {
    it('creates event and auto-joins the organizer', async () => {
      const insertChain = chain({
        data: { id: 'e1', title: 'New Event' },
        error: null,
      });
      const joinChain = chain({ data: {}, error: null });

      mockAdmin.from
        .mockReturnValueOnce(insertChain)
        .mockReturnValueOnce(joinChain);

      const result = await service.create('org-1', {
        trail_id: 'trail-1',
        title: 'New Event',
        scheduled_at: '2026-04-01T10:00:00Z',
      });

      expect(result.title).toBe('New Event');
      // Verify organizer was auto-joined
      expect(mockAdmin.from).toHaveBeenCalledWith('event_participants');
    });
  });

  // -------------------------------------------------------------------------
  // delete
  // -------------------------------------------------------------------------
  describe('delete', () => {
    it('throws NotFoundException for non-existent event', async () => {
      mockAdmin.from.mockReturnValue(chain({ data: null, error: null }));

      await expect(service.delete('user-1', 'bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when non-organizer tries to delete', async () => {
      mockAdmin.from.mockReturnValue(
        chain({ data: { organizer_id: 'other-user' }, error: null }),
      );

      await expect(service.delete('user-1', 'e1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deletes event when organizer requests it', async () => {
      const selectChain = chain({
        data: { organizer_id: 'user-1' },
        error: null,
      });
      const deleteChain: Record<string, jest.Mock> = {};
      deleteChain.delete = jest.fn().mockReturnValue(deleteChain);
      deleteChain.eq = jest.fn().mockResolvedValue({ error: null });

      mockAdmin.from
        .mockReturnValueOnce(selectChain)
        .mockReturnValueOnce(deleteChain);

      const result = await service.delete('user-1', 'e1');
      expect(result.deleted).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // join
  // -------------------------------------------------------------------------
  describe('join', () => {
    it('throws NotFoundException for non-existent event', async () => {
      mockAdmin.from.mockReturnValue(chain({ data: null, error: null }));

      await expect(service.join('user-1', 'bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when event is full', async () => {
      // Need to set up mocks for each call since they're consumed
      const setupFullEvent = () => {
        const eventChain = chain({
          data: { max_participants: 2, organizer_id: 'org-1', title: 'Hike' },
          error: null,
        });
        const countChain: Record<string, jest.Mock> = {};
        countChain.select = jest.fn().mockReturnValue(countChain);
        countChain.eq = jest.fn().mockResolvedValue({ count: 2, error: null });
        mockAdmin.from
          .mockReturnValueOnce(eventChain)
          .mockReturnValueOnce(countChain);
      };

      setupFullEvent();
      await expect(service.join('user-1', 'e1')).rejects.toThrow(
        BadRequestException,
      );

      setupFullEvent();
      await expect(service.join('user-1', 'e1')).rejects.toThrow('Event is full');
    });

    it('allows joining when under capacity', async () => {
      const eventChain = chain({
        data: { max_participants: 10, organizer_id: 'org-1', title: 'Hike' },
        error: null,
      });
      const countChain: Record<string, jest.Mock> = {};
      countChain.select = jest.fn().mockReturnValue(countChain);
      countChain.eq = jest.fn().mockResolvedValue({ count: 3, error: null });
      const upsertChain: Record<string, jest.Mock> = {};
      upsertChain.upsert = jest.fn().mockResolvedValue({ error: null });
      const profileChain = chain({
        data: { username: 'newuser' },
        error: null,
      });

      mockAdmin.from
        .mockReturnValueOnce(eventChain)
        .mockReturnValueOnce(countChain)
        .mockReturnValueOnce(upsertChain)
        .mockReturnValueOnce(profileChain);

      const result = await service.join('user-1', 'e1');
      expect(result.joined).toBe(true);
    });

    it('allows joining when no max_participants limit', async () => {
      const eventChain = chain({
        data: { max_participants: null, organizer_id: 'org-1', title: 'Open Hike' },
        error: null,
      });
      const upsertChain: Record<string, jest.Mock> = {};
      upsertChain.upsert = jest.fn().mockResolvedValue({ error: null });
      const profileChain = chain({
        data: { username: 'joiner' },
        error: null,
      });

      mockAdmin.from
        .mockReturnValueOnce(eventChain)
        .mockReturnValueOnce(upsertChain)
        .mockReturnValueOnce(profileChain);

      const result = await service.join('user-1', 'e1');
      expect(result.joined).toBe(true);
    });

    it('notifies the organizer when someone else joins', async () => {
      const eventChain = chain({
        data: { max_participants: null, organizer_id: 'org-1', title: 'Hike' },
        error: null,
      });
      const upsertChain: Record<string, jest.Mock> = {};
      upsertChain.upsert = jest.fn().mockResolvedValue({ error: null });
      const profileChain = chain({
        data: { username: 'joiner' },
        error: null,
      });

      mockAdmin.from
        .mockReturnValueOnce(eventChain)
        .mockReturnValueOnce(upsertChain)
        .mockReturnValueOnce(profileChain);

      await service.join('user-1', 'e1');

      expect(mockNotifications.sendToUser).toHaveBeenCalledWith(
        'org-1',
        'New Participant',
        expect.stringContaining('joiner'),
        expect.objectContaining({ eventId: 'e1' }),
        'event_invite',
      );
    });

    it('does not notify when organizer joins their own event', async () => {
      const eventChain = chain({
        data: { max_participants: null, organizer_id: 'org-1', title: 'Hike' },
        error: null,
      });
      const upsertChain: Record<string, jest.Mock> = {};
      upsertChain.upsert = jest.fn().mockResolvedValue({ error: null });

      mockAdmin.from
        .mockReturnValueOnce(eventChain)
        .mockReturnValueOnce(upsertChain);

      await service.join('org-1', 'e1');

      expect(mockNotifications.sendToUser).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // leave
  // -------------------------------------------------------------------------
  describe('leave', () => {
    it('removes participant and returns left: true', async () => {
      const deleteChain: Record<string, jest.Mock> = {};
      deleteChain.delete = jest.fn().mockReturnValue(deleteChain);
      deleteChain.eq = jest.fn().mockImplementation(() => ({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }));
      mockAdmin.from.mockReturnValue(deleteChain);

      const result = await service.leave('user-1', 'e1');
      expect(result.left).toBe(true);
    });
  });
});
