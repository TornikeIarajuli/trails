import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, Logger } from '@nestjs/common';
import { CheckinsService } from './checkins.service';
import { SupabaseService } from '../config/supabase.config';
import { NotificationsService } from '../notifications/notifications.service';

// Supabase mock: every query method returns the builder; awaiting it, .single() or
// .maybeSingle() resolves to the result queued for that table, in order.
type Builder = Record<string, jest.Mock> & { then: unknown };

function makeBuilder(result: object): Builder {
  const self = {} as Builder;
  ['select', 'insert', 'update', 'eq', 'in', 'order', 'limit'].forEach((m) => {
    self[m] = jest.fn(() => self);
  });
  self.single = jest.fn().mockResolvedValue(result);
  self.maybeSingle = jest.fn().mockResolvedValue(result);
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

const inHours = (h: number) =>
  new Date(Date.now() + h * 3600 * 1000).toISOString();

/** The two profile lookups behind "who is the emergency contact". */
function queueContact(contact: { id: string; username: string } | null) {
  onTable('profiles', {
    data: { emergency_contact_user_id: contact?.id ?? null },
    error: null,
  });
  if (contact) onTable('profiles', { data: contact, error: null });
}

const open = (extra: Record<string, unknown> = {}) => ({
  id: 'c1',
  trail_id: 't1',
  status: 'active',
  back_by: inHours(2),
  started_at: inHours(-3),
  reminded_at: null,
  alerted_at: null,
  last_position_at: null,
  ...extra,
});

describe('CheckinsService', () => {
  let service: CheckinsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckinsService,
        {
          provide: SupabaseService,
          useValue: { getAdminClient: () => mockAdmin },
        },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();
    service = module.get(CheckinsService);
    jest.clearAllMocks();
    queues.clear();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  describe('set', () => {
    it('refuses a time too soon or too far away', async () => {
      await expect(
        service.set('me', { trail_id: 't1', back_by: inHours(0.05) }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.set('me', { trail_id: 't1', back_by: inHours(80) }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockAdmin.from).not.toHaveBeenCalled();
    });

    it('needs an emergency contact, who is the one alerted', async () => {
      queueContact(null);
      await expect(
        service.set('me', { trail_id: 't1', back_by: inHours(4) }),
      ).rejects.toThrow('Choose an emergency contact first');
    });

    it('starts a check-in with the position the app sent', async () => {
      queueContact({ id: 'friend', username: 'gio' });
      onTable('hike_checkins', { data: null, error: null }); // nothing open
      const insert = onTable('hike_checkins', {
        data: { id: 'new' },
        error: null,
      });

      const backBy = inHours(4);
      await service.set('me', {
        trail_id: 't1',
        back_by: backBy,
        lat: 42.6,
        lng: 44.6,
      });

      expect(insert.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'me',
          trail_id: 't1',
          back_by: new Date(backBy).toISOString(),
          last_lat: 42.6,
          last_lng: 44.6,
        }),
      );
    });

    it('moves the time of the open check-in, which then gets its own reminder', async () => {
      queueContact({ id: 'friend', username: 'gio' });
      onTable('hike_checkins', {
        data: open({ reminded_at: inHours(-0.1) }),
        error: null,
      });
      const update = onTable('hike_checkins', {
        data: { id: 'c1' },
        error: null,
      });

      await service.set('me', { trail_id: 't1', back_by: inHours(5) });

      expect(update.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active',
          reminded_at: null,
          alerted_at: null,
        }),
      );
      expect(update.eq).toHaveBeenCalledWith('id', 'c1');
      expect(mockNotifications.sendToUser).not.toHaveBeenCalled();
    });

    it('closes a check-in for another trail before starting the new one', async () => {
      queueContact({ id: 'friend', username: 'gio' });
      onTable('hike_checkins', {
        data: open({ trail_id: 'other' }),
        error: null,
      });
      const close = onTable('hike_checkins', { data: null, error: null });
      const insert = onTable('hike_checkins', {
        data: { id: 'new' },
        error: null,
      });

      await service.set('me', { trail_id: 't1', back_by: inHours(3) });

      expect(close.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'finished' }),
      );
      expect(insert.insert).toHaveBeenCalledWith(
        expect.objectContaining({ trail_id: 't1' }),
      );
    });

    it('tells an alerted contact the hiker is fine when they answer with a new time', async () => {
      queueContact({ id: 'friend', username: 'gio' });
      onTable('hike_checkins', {
        data: open({ status: 'alerted', alerted_at: inHours(-0.2) }),
        error: null,
      });
      // tellContactBack: the hiker's name, then the contact
      onTable('profiles', { data: { username: 'nino' }, error: null });
      queueContact({ id: 'friend', username: 'gio' });
      onTable('hike_checkins', { data: { id: 'c1' }, error: null });

      await service.set('me', { trail_id: 't1', back_by: inHours(2) });

      expect(mockNotifications.sendToUser).toHaveBeenCalledWith(
        'friend',
        'nino checked in',
        expect.stringContaining('still on the hike'),
        { userId: 'me' },
        'checkin_back',
      );
    });
  });

  describe('finish', () => {
    it('closes the open check-in', async () => {
      onTable('hike_checkins', { data: open(), error: null });
      const close = onTable('hike_checkins', { data: null, error: null });

      expect(await service.finish('me')).toEqual({ ok: true, closed: true });
      expect(close.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'finished' }),
      );
      expect(mockNotifications.sendToUser).not.toHaveBeenCalled();
    });

    it('tells an alerted contact the hiker is back', async () => {
      onTable('hike_checkins', {
        data: open({ status: 'alerted' }),
        error: null,
      });
      onTable('hike_checkins', { data: null, error: null });
      onTable('profiles', { data: { username: 'nino' }, error: null });
      queueContact({ id: 'friend', username: 'gio' });

      await service.finish('me');

      expect(mockNotifications.sendToUser).toHaveBeenCalledWith(
        'friend',
        'nino is back',
        'nino has finished their hike and checked in.',
        { userId: 'me' },
        'checkin_back',
      );
    });

    it('leaves the check-in of another trail open (a finish that arrives late)', async () => {
      onTable('hike_checkins', { data: open({ trail_id: 't2' }), error: null });

      expect(await service.finish('me', 't1')).toEqual({
        ok: true,
        closed: false,
      });
      expect(mockAdmin.from).toHaveBeenCalledTimes(1);
    });

    it('does nothing when there is no open check-in', async () => {
      onTable('hike_checkins', { data: null, error: null });
      expect(await service.finish('me')).toEqual({ ok: true, closed: false });
    });
  });

  describe('get', () => {
    it('returns the open check-in with its trail, and the emergency contact', async () => {
      onTable('hike_checkins', { data: open(), error: null });
      queueContact({ id: 'friend', username: 'gio' });
      onTable('trails', { data: { name_en: 'Juta to Roshka' }, error: null });

      const result = await service.get('me');

      expect(result.check_in).toEqual(
        expect.objectContaining({ id: 'c1', trail_name: 'Juta to Roshka' }),
      );
      expect(result.emergency_contact).toEqual({
        id: 'friend',
        username: 'gio',
      });
    });
  });
});
