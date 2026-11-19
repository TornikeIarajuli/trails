import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
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

const inDays = (days: number) =>
  new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();

/** Lets fire-and-forget notifications finish. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

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
    // mockReset also drops queued mockReturnValueOnce values a failed test left behind
    mockAdmin.from.mockReset();
    jest.clearAllMocks();
    mockSupabase.getAdminClient.mockReturnValue(mockAdmin);
  });

  // -------------------------------------------------------------------------
  // findAll
  // -------------------------------------------------------------------------
  describe('findAll', () => {
    /** Every method returns the builder; awaiting it gives the result. */
    const thenable = (result: object) => {
      const c: Record<string, any> = {};
      for (const m of ['select', 'eq', 'gte', 'order', 'in']) c[m] = jest.fn().mockReturnValue(c);
      c.then = (res: (v: unknown) => unknown) => Promise.resolve(result).then(res);
      return c;
    };

    it('returns upcoming public events, with what the cards need', async () => {
      const events = [{ id: 'e1', title: 'Morning Hike' }];
      const listChain = thenable({ data: events, error: null });
      mockAdmin.from.mockReturnValue(listChain);

      const result = await service.findAll();
      expect(result).toEqual(events);
      // Private trips are only for those with the link
      expect(listChain.eq).toHaveBeenCalledWith('visibility', 'public');
      // Cards need the trail's picture and region, the app marks events the user joined, and
      // shows how many days a trip has
      const columns = String(listChain.select.mock.calls[0][0]);
      expect(columns).toContain('trails:trail_id (id, name_en, region, difficulty, cover_image_url)');
      expect(columns).toContain('participants:event_participants(user_id)');
      expect(columns).toContain('days:event_days(day_number)');
    });

    it('filters by trail_id when provided', async () => {
      const listChain = thenable({ data: [], error: null });
      mockAdmin.from.mockReturnValue(listChain);

      await service.findAll('trail-1');
      expect(listChain.eq).toHaveBeenCalledWith('trail_id', 'trail-1');
    });

    it("lists your own trips, private ones too, until a multi-day trip's last day", async () => {
      const joined = thenable({ data: [{ event_id: 'e1' }, { event_id: 'e2' }, { event_id: 'e3' }], error: null });
      const events = thenable({
        data: [
          // Started two days ago, a 4-day trip: still on
          { id: 'e1', scheduled_at: inDays(-2), days: [{ day_number: 2 }, { day_number: 3 }, { day_number: 4 }] },
          // A day hike two days ago: over
          { id: 'e2', scheduled_at: inDays(-2), days: [] },
          { id: 'e3', scheduled_at: inDays(5), visibility: 'private', days: [] },
        ],
        error: null,
      });
      mockAdmin.from.mockReturnValueOnce(joined).mockReturnValueOnce(events);

      const result = (await service.findMine('me')) as unknown as Array<{ id: string }>;
      expect(joined.eq).toHaveBeenCalledWith('user_id', 'me');
      expect(events.in).toHaveBeenCalledWith('id', ['e1', 'e2', 'e3']);
      expect(result.map((e) => e.id)).toEqual(['e1', 'e3']);
    });

    it('has none when you joined nothing', async () => {
      mockAdmin.from.mockReturnValueOnce(thenable({ data: [], error: null }));
      await expect(service.findMine('me')).resolves.toEqual([]);
      expect(mockAdmin.from).toHaveBeenCalledTimes(1);
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

      await expect(service.findOne('bad-id')).rejects.toThrow(
        NotFoundException,
      );
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
        scheduled_at: inDays(7),
      });

      expect(result.title).toBe('New Event');
      // Verify organizer was auto-joined
      expect(mockAdmin.from).toHaveBeenCalledWith('event_participants');
    });

    it('rejects a date in the past without touching the database', async () => {
      await expect(
        service.create('org-1', {
          trail_id: 'trail-1',
          title: 'Too late',
          scheduled_at: inDays(-1),
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockAdmin.from).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------
  describe('update', () => {
    const event = {
      organizer_id: 'org-1',
      trail_id: 'trail-1',
      title: 'Hike',
      scheduled_at: inDays(3),
    };
    const participants = () => {
      const c: Record<string, jest.Mock> = {};
      c.select = jest.fn().mockReturnValue(c);
      c.eq = jest.fn().mockResolvedValue({
        data: [{ user_id: 'org-1' }, { user_id: 'u2' }, { user_id: 'u3' }],
        error: null,
      });
      return c;
    };

    it('tells the participants (not the organizer) when the time changes', async () => {
      const updateChain = chain({
        data: { id: 'e1', title: 'Hike' },
        error: null,
      });
      updateChain.update = jest.fn().mockReturnValue(updateChain);
      mockAdmin.from
        .mockReturnValueOnce(chain({ data: event, error: null }))
        .mockReturnValueOnce(updateChain)
        .mockReturnValueOnce(participants());

      await service.update('org-1', 'e1', { scheduled_at: inDays(10) });
      await flush();

      expect(mockNotifications.sendToUser).toHaveBeenCalledTimes(2);
      for (const userId of ['u2', 'u3']) {
        expect(mockNotifications.sendToUser).toHaveBeenCalledWith(
          userId,
          'Group hike rescheduled',
          expect.stringContaining('Hike'),
          { eventId: 'e1', trailId: 'trail-1', cancelled: false },
          'event_update',
        );
      }
    });

    it('does not notify anyone when the time stays the same', async () => {
      const updateChain = chain({ data: { id: 'e1' }, error: null });
      updateChain.update = jest.fn().mockReturnValue(updateChain);
      mockAdmin.from
        .mockReturnValueOnce(chain({ data: event, error: null }))
        .mockReturnValueOnce(updateChain);

      await service.update('org-1', 'e1', { description: 'Bring water' });
      await flush();

      expect(mockNotifications.sendToUser).not.toHaveBeenCalled();
    });

    it('rejects moving the event into the past', async () => {
      await expect(
        service.update('org-1', 'e1', { scheduled_at: inDays(-2) }),
      ).rejects.toThrow(BadRequestException);
      expect(mockAdmin.from).not.toHaveBeenCalled();
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

    it('tells the participants of an upcoming event that it was cancelled', async () => {
      const selectChain = chain({
        data: {
          organizer_id: 'user-1',
          trail_id: 'trail-1',
          title: 'Sunrise hike',
          scheduled_at: inDays(2),
        },
        error: null,
      });
      const participantsChain: Record<string, jest.Mock> = {};
      participantsChain.select = jest.fn().mockReturnValue(participantsChain);
      participantsChain.eq = jest.fn().mockResolvedValue({
        data: [{ user_id: 'user-1' }, { user_id: 'u2' }],
        error: null,
      });
      const deleteChain: Record<string, jest.Mock> = {};
      deleteChain.delete = jest.fn().mockReturnValue(deleteChain);
      deleteChain.eq = jest.fn().mockResolvedValue({ error: null });

      mockAdmin.from
        .mockReturnValueOnce(selectChain)
        .mockReturnValueOnce(participantsChain)
        .mockReturnValueOnce(deleteChain);

      await service.delete('user-1', 'e1');

      expect(mockNotifications.sendToUser).toHaveBeenCalledTimes(1);
      expect(mockNotifications.sendToUser).toHaveBeenCalledWith(
        'u2',
        'Group hike cancelled',
        expect.stringContaining('Sunrise hike'),
        { eventId: 'e1', trailId: 'trail-1', cancelled: true },
        'event_update',
      );
    });

    it('does not notify anyone when a past event is deleted', async () => {
      const selectChain = chain({
        data: {
          organizer_id: 'user-1',
          trail_id: 'trail-1',
          title: 'Old hike',
          scheduled_at: inDays(-5),
        },
        error: null,
      });
      const deleteChain: Record<string, jest.Mock> = {};
      deleteChain.delete = jest.fn().mockReturnValue(deleteChain);
      deleteChain.eq = jest.fn().mockResolvedValue({ error: null });
      mockAdmin.from
        .mockReturnValueOnce(selectChain)
        .mockReturnValueOnce(deleteChain);

      await service.delete('user-1', 'e1');

      expect(mockNotifications.sendToUser).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // join
  // -------------------------------------------------------------------------
  describe('join', () => {
    it('rejects joining an event that has already taken place', async () => {
      mockAdmin.from.mockReturnValueOnce(
        chain({
          data: {
            max_participants: null,
            organizer_id: 'org-1',
            title: 'Old hike',
            trail_id: 'trail-1',
            scheduled_at: inDays(-1),
          },
          error: null,
        }),
      );

      await expect(service.join('user-1', 'e1')).rejects.toThrow(
        'This group hike has already taken place',
      );
      expect(mockAdmin.from).toHaveBeenCalledTimes(1);
    });

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
      await expect(service.join('user-1', 'e1')).rejects.toThrow(
        'Event is full',
      );
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
        data: {
          max_participants: null,
          organizer_id: 'org-1',
          title: 'Open Hike',
        },
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
        data: {
          max_participants: null,
          organizer_id: 'org-1',
          title: 'Hike',
          trail_id: 'trail-1',
          scheduled_at: inDays(4),
        },
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
        { eventId: 'e1', trailId: 'trail-1', userId: 'user-1' },
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

  // -------------------------------------------------------------------------
  // Trips: days and chat
  // -------------------------------------------------------------------------
  describe('trip days', () => {
    it('sorts the days of a trip', async () => {
      mockAdmin.from.mockReturnValue(
        chain({ data: { id: 'e1', days: [{ day_number: 3 }, { day_number: 2 }] }, error: null }),
      );
      const event = (await service.findOne('e1')) as { days: { day_number: number }[] };
      expect(event.days.map((d) => d.day_number)).toEqual([2, 3]);
    });

    it('stores further days as day 2 onwards, after checking their trails', async () => {
      const trails: Record<string, any> = {};
      trails.select = jest.fn().mockReturnValue(trails);
      trails.in = jest.fn().mockResolvedValue({ data: [{ id: 't2' }], error: null });
      const eventInsert = chain({ data: { id: 'e9' }, error: null });
      const participants = chain({ data: null, error: null });
      participants.select = jest.fn().mockResolvedValue({ error: null });
      const daysDelete: Record<string, any> = {};
      daysDelete.delete = jest.fn().mockReturnValue(daysDelete);
      daysDelete.eq = jest.fn().mockResolvedValue({ error: null });
      const daysInsert: Record<string, any> = {};
      daysInsert.insert = jest.fn().mockResolvedValue({ error: null });
      mockAdmin.from
        .mockReturnValueOnce(trails)
        .mockReturnValueOnce(eventInsert)
        .mockReturnValueOnce(daysDelete)
        .mockReturnValueOnce(daysInsert)
        .mockReturnValueOnce(participants);

      await service.create('me', {
        trail_id: 't1',
        title: 'Svaneti in three days',
        scheduled_at: inDays(10),
        visibility: 'private',
        days: [{ trail_id: 't2' }, { title: 'Rest day in Mestia', note: 'Museum' }],
      });

      expect(eventInsert.insert).toHaveBeenCalledWith(
        expect.objectContaining({ trail_id: 't1', visibility: 'private', organizer_id: 'me' }),
      );
      expect(eventInsert.insert.mock.calls[0][0]).not.toHaveProperty('days');
      expect(daysInsert.insert).toHaveBeenCalledWith([
        { event_id: 'e9', day_number: 2, trail_id: 't2', title: null, note: null },
        { event_id: 'e9', day_number: 3, trail_id: null, title: 'Rest day in Mestia', note: 'Museum' },
      ]);
    });

    it('refuses a day with neither a trail nor a title, and a trail that does not exist', async () => {
      await expect(
        service.create('me', { trail_id: 't1', title: 'Trip', scheduled_at: inDays(3), days: [{ note: 'hmm' }] }),
      ).rejects.toBeInstanceOf(BadRequestException);

      const trails: Record<string, any> = {};
      trails.select = jest.fn().mockReturnValue(trails);
      trails.in = jest.fn().mockResolvedValue({ data: [], error: null });
      mockAdmin.from.mockReturnValueOnce(trails);
      await expect(
        service.create('me', { trail_id: 't1', title: 'Trip', scheduled_at: inDays(3), days: [{ trail_id: 'nope' }] }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('trip chat', () => {
    const maybe = (result: object) => {
      const c: Record<string, any> = {};
      for (const m of ['select', 'eq', 'order', 'limit', 'lt', 'insert', 'delete']) c[m] = jest.fn().mockReturnValue(c);
      c.maybeSingle = jest.fn().mockResolvedValue(result);
      c.single = jest.fn().mockResolvedValue(result);
      c.then = (res: (v: unknown) => unknown) => Promise.resolve(result).then(res);
      return c;
    };
    const event = { data: { id: 'e1', title: 'Kazbegi weekend', organizer_id: 'org', trail_id: 't1' }, error: null };

    it('is closed to people who have not joined', async () => {
      mockAdmin.from.mockReturnValueOnce(maybe(event)).mockReturnValueOnce(maybe({ data: null, error: null }));
      await expect(service.listMessages('stranger', 'e1')).rejects.toThrow('Join the trip');
    });

    it('is not found when the trip is gone', async () => {
      mockAdmin.from.mockReturnValueOnce(maybe({ data: null, error: null }));
      await expect(service.listMessages('me', 'gone')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('pages back through the messages, newest first', async () => {
      const messages = maybe({ data: [{ id: 'm2' }, { id: 'm1' }], error: null });
      mockAdmin.from
        .mockReturnValueOnce(maybe(event))
        .mockReturnValueOnce(maybe({ data: { user_id: 'me' }, error: null }))
        .mockReturnValueOnce(messages);

      await expect(service.listMessages('me', 'e1', '2026-11-20T10:00:00Z', 30)).resolves.toEqual({
        data: [{ id: 'm2' }, { id: 'm1' }],
      });
      expect(messages.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(messages.lt).toHaveBeenCalledWith('created_at', '2026-11-20T10:00:00Z');
      expect(messages.limit).toHaveBeenCalledWith(30);
    });

    it('lets the others know of a new message, by push only', async () => {
      const insert = maybe({ data: { id: 'm9', body: 'Meet at 7?' }, error: null });
      const members = maybe({ data: [{ user_id: 'me' }, { user_id: 'gio' }, { user_id: 'org' }], error: null });
      const author = maybe({ data: { username: 'nino' }, error: null });
      mockAdmin.from
        .mockReturnValueOnce(maybe(event))
        .mockReturnValueOnce(maybe({ data: { user_id: 'me' }, error: null }))
        .mockReturnValueOnce(insert)
        .mockReturnValueOnce(members)
        .mockReturnValueOnce(author);

      await service.postMessage('me', 'e1', 'Meet at 7?');
      await flush();

      expect(insert.insert).toHaveBeenCalledWith({ event_id: 'e1', user_id: 'me', body: 'Meet at 7?' });
      const sent = mockNotifications.sendToUser.mock.calls;
      expect(sent.map((c: unknown[]) => c[0])).toEqual(['gio', 'org']);
      expect(sent[0].slice(1)).toEqual([
        'Kazbegi weekend',
        'nino: Meet at 7?',
        { eventId: 'e1', trailId: 't1', messageId: 'm9' },
        'group_chat',
        { history: false },
      ]);
    });

    it("lets a message be deleted by its author or the organizer, not someone else", async () => {
      mockAdmin.from
        .mockReturnValueOnce(maybe(event))
        .mockReturnValueOnce(maybe({ data: { user_id: 'gio' }, error: null }))
        .mockReturnValueOnce(maybe({ data: { id: 'm1', user_id: 'nino' }, error: null }));
      await expect(service.deleteMessage('gio', 'e1', 'm1')).rejects.toThrow('Only its author or the organizer');

      const del = maybe({ error: null });
      mockAdmin.from
        .mockReturnValueOnce(maybe(event))
        .mockReturnValueOnce(maybe({ data: { user_id: 'org' }, error: null }))
        .mockReturnValueOnce(maybe({ data: { id: 'm1', user_id: 'nino' }, error: null }))
        .mockReturnValueOnce(del);
      await expect(service.deleteMessage('org', 'e1', 'm1')).resolves.toEqual({ deleted: true });
      expect(del.eq).toHaveBeenCalledWith('id', 'm1');
    });
  });
});
