import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { GuidesService, tbilisiToday } from './guides.service';
import { SupabaseService } from '../config/supabase.config';
import { NotificationsService } from '../notifications/notifications.service';

type Builder = Record<string, jest.Mock> & { then: unknown };

function makeBuilder(result: object): Builder {
  const self = {} as Builder;
  [
    'select',
    'eq',
    'in',
    'or',
    'contains',
    'order',
    'limit',
    'insert',
    'update',
    'upsert',
    'single',
    'maybeSingle',
  ].forEach((m) => {
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
const flush = () => new Promise((resolve) => setImmediate(resolve));

const inDays = (n: number) => {
  const d = new Date(`${tbilisiToday()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

describe('GuidesService', () => {
  let service: GuidesService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        GuidesService,
        {
          provide: SupabaseService,
          useValue: { getAdminClient: () => mockAdmin },
        },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();
    service = module.get(GuidesService);
    jest.clearAllMocks();
    queues.clear();
  });

  describe('list', () => {
    it('names the foreign key of every join (the database refuses an ambiguous one)', async () => {
      const guides = onTable('guides', { data: [], error: null });
      await service.list({});
      expect(String(guides.select.mock.calls[0][0])).toContain(
        'profiles!guides_user_id_fkey (',
      );

      const asHiker = onTable('guide_bookings', { data: [], error: null });
      const asGuide = onTable('guide_bookings', { data: [], error: null });
      await service.listBookings('me');
      expect(String(asHiker.select.mock.calls[0][0])).toContain(
        'guide:guides!guide_bookings_guide_id_fkey (headline, profiles!guides_user_id_fkey (',
      );
      expect(String(asGuide.select.mock.calls[0][0])).toContain(
        'hiker:profiles!guide_bookings_hiker_id_fkey (',
      );
    });

    it('lists verified guides for a trail: listed on it, or guiding in its region', async () => {
      onTable('trails', { data: { region: 'Svaneti' }, error: null });
      const guides = onTable('guides', {
        data: [{ user_id: 'g1' }],
        error: null,
      });

      await expect(service.list({ trail_id: 't1' })).resolves.toEqual([
        { user_id: 'g1' },
      ]);
      expect(guides.eq).toHaveBeenCalledWith('status', 'verified');
      expect(guides.or).toHaveBeenCalledWith(
        'trail_ids.cs.{t1},regions.cs.{"Svaneti"}',
      );
      // Never the phone or messengers in a list
      expect(String(guides.select.mock.calls[0][0])).not.toContain('contact');
    });

    it('filters by region', async () => {
      const guides = onTable('guides', { data: [], error: null });
      await service.list({ region: 'Kazbegi' });
      expect(guides.contains).toHaveBeenCalledWith('regions', ['Kazbegi']);
    });
  });

  describe('applying', () => {
    const profile = {
      headline: 'Mountain guide in Svaneti',
      bio: 'Ten years of guiding in Svaneti and Racha, first aid certified.',
      regions: ['Svaneti'],
      languages: ['Georgian', 'English'],
    };

    it('starts a new application as pending', async () => {
      onTable('guides', { data: null, error: null });
      const save = onTable('guides', { error: null });
      onTable('guides', {
        data: { user_id: 'me', status: 'pending', trail_ids: [] },
        error: null,
      });

      const result = await service.saveMine('me', profile);
      expect(save.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'me',
          status: 'pending',
          headline: 'Mountain guide in Svaneti',
        }),
        { onConflict: 'user_id' },
      );
      expect(result).toEqual(
        expect.objectContaining({ status: 'pending', trails: [] }),
      );
    });

    it('sends a rejected application back for review, and pauses or resumes a verified one', async () => {
      onTable('guides', {
        data: { status: 'rejected', verified_at: null },
        error: null,
      });
      const resubmit = onTable('guides', { error: null });
      onTable('guides', {
        data: { user_id: 'me', trail_ids: [] },
        error: null,
      });
      await service.saveMine('me', profile);
      expect(resubmit.upsert.mock.calls[0][0]).toEqual(
        expect.objectContaining({ status: 'pending', admin_note: null }),
      );

      onTable('guides', {
        data: { status: 'verified', verified_at: '2026-11-01' },
        error: null,
      });
      const pause = onTable('guides', { error: null });
      onTable('guides', {
        data: { user_id: 'me', trail_ids: [] },
        error: null,
      });
      await service.saveMine('me', { ...profile, active: false });
      expect(pause.upsert.mock.calls[0][0]).toEqual(
        expect.objectContaining({ status: 'paused' }),
      );
      expect(pause.upsert.mock.calls[0][0]).not.toHaveProperty('active');

      onTable('guides', {
        data: { status: 'paused', verified_at: '2026-11-01' },
        error: null,
      });
      const resume = onTable('guides', { error: null });
      onTable('guides', {
        data: { user_id: 'me', trail_ids: [] },
        error: null,
      });
      await service.saveMine('me', { ...profile, active: true });
      expect(resume.upsert.mock.calls[0][0]).toEqual(
        expect.objectContaining({ status: 'verified' }),
      );
    });

    it('refuses trails that do not exist', async () => {
      onTable('trails', { data: [{ id: 't1' }], error: null });
      await expect(
        service.saveMine('me', { ...profile, trail_ids: ['t1', 't2'] }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('contact', () => {
    const guide = {
      user_id: 'g1',
      status: 'verified',
      verified_at: '2026-11-01',
      contact_phone: '+995 599 12-34-56',
      contact_whatsapp: true,
      contact_telegram: 'nino_guide',
      trail_ids: [],
    };

    it('is shared with a hiker whose request the guide accepted, with WhatsApp and Telegram links', async () => {
      onTable('guides', { data: guide, error: null });
      onTable('guide_bookings', { data: [{ id: 'b1' }], error: null });
      await expect(service.getContact('hiker', 'g1')).resolves.toEqual({
        phone: '+995 599 12-34-56',
        whatsapp_url: 'https://wa.me/995599123456',
        telegram: 'nino_guide',
        telegram_url: 'https://t.me/nino_guide',
      });
    });

    it('is not shared before the guide accepts', async () => {
      onTable('guides', { data: guide, error: null });
      onTable('guide_bookings', { data: [], error: null });
      await expect(service.getContact('stranger', 'g1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('bookings', () => {
    const request = {
      guide_id: 'g1',
      start_date: inDays(10),
      days: 2,
      group_size: 3,
      message: 'Ushguli?',
    };

    it('sends a request to a verified guide, who is told', async () => {
      onTable('guides', {
        data: { user_id: 'g1', status: 'verified' },
        error: null,
      });
      onTable('guide_bookings', { count: 0, error: null });
      const insert = onTable('guide_bookings', {
        data: { id: 'b1' },
        error: null,
      });
      onTable('profiles', { data: { username: 'nino' }, error: null });

      await service.createBooking('hiker', request);
      await flush();

      expect(insert.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          guide_id: 'g1',
          hiker_id: 'hiker',
          days: 2,
          group_size: 3,
          trail_id: null,
        }),
      );
      expect(mockNotifications.sendToUser).toHaveBeenCalledWith(
        'g1',
        'New booking request',
        expect.stringMatching(
          /^nino would like to hike with you on \d+ \w{3} \(3 people\)$/,
        ),
        { bookingId: 'b1', role: 'guide' },
        'booking',
      );
    });

    it('refuses yourself, a past date, a guide not verified, and too many open requests', async () => {
      await expect(service.createBooking('g1', request)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(
        service.createBooking('hiker', { ...request, start_date: inDays(-1) }),
      ).rejects.toBeInstanceOf(BadRequestException);

      onTable('guides', {
        data: { user_id: 'g1', status: 'pending' },
        error: null,
      });
      await expect(
        service.createBooking('hiker', request),
      ).rejects.toBeInstanceOf(NotFoundException);

      onTable('guides', {
        data: { user_id: 'g1', status: 'verified' },
        error: null,
      });
      onTable('guide_bookings', { count: 3, error: null });
      await expect(service.createBooking('hiker', request)).rejects.toThrow(
        'Wait for the guide',
      );
    });

    const booking = {
      id: 'b1',
      guide_id: 'g1',
      hiker_id: 'hiker',
      trail_id: null,
      start_date: '2026-12-12',
      group_size: 3,
    };

    it('lets the guide accept a request, with a reply, and tells the hiker', async () => {
      onTable('guide_bookings', {
        data: { ...booking, status: 'requested' },
        error: null,
      });
      const update = onTable('guide_bookings', {
        data: { id: 'b1', status: 'accepted' },
        error: null,
      });
      onTable('profiles', { data: { username: 'giorgi' }, error: null });

      await service.answerBooking(
        'g1',
        'b1',
        'accepted',
        'See you at 7 in Mestia',
      );
      await flush();

      expect(update.update.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          status: 'accepted',
          guide_reply: 'See you at 7 in Mestia',
        }),
      );
      expect(mockNotifications.sendToUser).toHaveBeenCalledWith(
        'hiker',
        'Booking accepted',
        'giorgi accepted your hike on 12 Dec. Their contact is in My bookings.',
        { bookingId: 'b1', role: 'hiker' },
        'booking',
      );
    });

    it('lets only the guide answer, once, and only the hiker cancel', async () => {
      onTable('guide_bookings', {
        data: { ...booking, status: 'requested' },
        error: null,
      });
      await expect(
        service.answerBooking('hiker', 'b1', 'accepted'),
      ).rejects.toBeInstanceOf(ForbiddenException);

      onTable('guide_bookings', {
        data: { ...booking, status: 'declined' },
        error: null,
      });
      await expect(
        service.answerBooking('g1', 'b1', 'accepted'),
      ).rejects.toThrow('already been answered');

      onTable('guide_bookings', {
        data: { ...booking, status: 'accepted' },
        error: null,
      });
      await expect(
        service.answerBooking('g1', 'b1', 'cancelled'),
      ).rejects.toBeInstanceOf(ForbiddenException);

      onTable('guide_bookings', {
        data: { ...booking, status: 'requested' },
        error: null,
      });
      await expect(
        service.answerBooking('someone', 'b1', 'cancelled'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lets the hiker cancel an accepted booking, and tells the guide', async () => {
      onTable('guide_bookings', {
        data: { ...booking, status: 'accepted' },
        error: null,
      });
      onTable('guide_bookings', {
        data: { id: 'b1', status: 'cancelled' },
        error: null,
      });
      onTable('profiles', { data: { username: 'nino' }, error: null });

      await service.answerBooking('hiker', 'b1', 'cancelled');
      await flush();
      expect(mockNotifications.sendToUser).toHaveBeenCalledWith(
        'g1',
        'Booking cancelled',
        'nino cancelled the hike on 12 Dec',
        { bookingId: 'b1', role: 'guide' },
        'booking',
      );
    });
  });
});

describe('tbilisiToday', () => {
  it('turns the date over at midnight in Georgia', () => {
    expect(tbilisiToday(new Date('2026-11-30T19:59:00Z'))).toBe('2026-11-30');
    expect(tbilisiToday(new Date('2026-11-30T20:00:00Z'))).toBe('2026-12-01');
  });
});
