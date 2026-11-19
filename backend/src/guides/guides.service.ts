import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';
import { NotificationsService } from '../notifications/notifications.service';
import { throwIfError } from '../common/supabase-error';
import {
  BookingAnswer,
  CreateBookingDto,
  GuideProfileDto,
  GuidesQueryDto,
} from './dto/guide.dto';

/** What anyone may see of a verified guide: everything but their phone and messengers. */
const PUBLIC_COLUMNS =
  'user_id, headline, bio, regions, languages, certifications, price_gel, price_note, trail_ids, verified_at, profiles:user_id (username, full_name, avatar_url)';

/** A hiker may have this many unanswered requests with one guide. */
const MAX_OPEN_REQUESTS = 3;

/** Today in Georgia (UTC+4), YYYY-MM-DD. */
export function tbilisiToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 4 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

/** "12 Dec" from YYYY-MM-DD. */
function shortDate(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${d} ${months[m - 1]}`;
}

interface GuideRow {
  user_id: string;
  status: string;
  verified_at: string | null;
  contact_phone: string | null;
  contact_whatsapp: boolean;
  contact_telegram: string | null;
  trail_ids: string[] | null;
}

interface BookingRow {
  id: string;
  guide_id: string;
  hiker_id: string;
  trail_id: string | null;
  start_date: string;
  group_size: number;
  status: string;
}

/**
 * Local guides: applications, the verified list, contact details for hikers a guide accepted,
 * and booking requests. No payments: hiker and guide settle directly.
 */
@Injectable()
export class GuidesService {
  constructor(
    private supabaseService: SupabaseService,
    private notificationsService: NotificationsService,
  ) {}

  private get admin() {
    return this.supabaseService.getAdminClient();
  }

  /** Verified guides, by region or for a trail (listed on it, or guiding in its region). */
  async list(query: GuidesQueryDto) {
    let request = this.admin
      .from('guides')
      .select(PUBLIC_COLUMNS)
      .eq('status', 'verified')
      .order('verified_at', { ascending: true });

    if (query.trail_id) {
      const { data: trail, error } = await this.admin
        .from('trails')
        .select('region')
        .eq('id', query.trail_id)
        .maybeSingle();
      throwIfError(error);
      const region = (trail as { region?: string } | null)?.region;
      request = request.or(
        region
          ? `trail_ids.cs.{${query.trail_id}},regions.cs.{"${region.replace(/"/g, '')}"}`
          : `trail_ids.cs.{${query.trail_id}}`,
      );
    } else if (query.region) {
      request = request.contains('regions', [query.region]);
    }

    const { data, error } = await request;
    throwIfError(error);
    return data ?? [];
  }

  /** A verified guide's public profile, with the names of the trails they guide. */
  async getPublic(userId: string) {
    const { data, error } = await this.admin
      .from('guides')
      .select(PUBLIC_COLUMNS)
      .eq('user_id', userId)
      .eq('status', 'verified')
      .maybeSingle();
    throwIfError(error);
    if (!data) throw new NotFoundException('Guide not found');
    const guide = data as { trail_ids?: string[] | null };
    return { ...data, trails: await this.trailNames(guide.trail_ids ?? []) };
  }

  private async trailNames(ids: string[]) {
    if (ids.length === 0) return [];
    const { data, error } = await this.admin
      .from('trails')
      .select('id, name_en, region, difficulty')
      .in('id', ids);
    throwIfError(error);
    return data ?? [];
  }

  /** Your own guide profile, whatever its status, or null when you never applied. */
  async getMine(userId: string) {
    const { data, error } = await this.admin
      .from('guides')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    throwIfError(error);
    if (!data) return null;
    const guide = data as { trail_ids?: string[] | null };
    return { ...data, trails: await this.trailNames(guide.trail_ids ?? []) };
  }

  /**
   * Applies, or updates your profile. A new or rejected application waits for the team
   * (pending); `active: false` takes a verified listing down for now, `active: true` puts
   * it back.
   */
  async saveMine(userId: string, dto: GuideProfileDto) {
    const { active, ...fields } = dto;
    if (fields.trail_ids?.length) {
      const unique = [...new Set(fields.trail_ids)];
      const { data, error } = await this.admin
        .from('trails')
        .select('id')
        .in('id', unique);
      throwIfError(error);
      if ((data ?? []).length !== unique.length) {
        throw new BadRequestException('Trail not found');
      }
      fields.trail_ids = unique;
    }

    const { data: existing, error } = await this.admin
      .from('guides')
      .select('status, verified_at')
      .eq('user_id', userId)
      .maybeSingle();
    throwIfError(error);
    const current = existing as {
      status: string;
      verified_at: string | null;
    } | null;

    let status = current?.status ?? 'pending';
    if (!current || status === 'rejected') status = 'pending';
    if (active === false && status === 'verified') status = 'paused';
    if (active === true && status === 'paused')
      status = current?.verified_at ? 'verified' : 'pending';

    const row = {
      ...fields,
      user_id: userId,
      status,
      ...(current && current.status === 'rejected' ? { admin_note: null } : {}),
      updated_at: new Date().toISOString(),
    };
    const { error: saveError } = await this.admin
      .from('guides')
      .upsert(row, { onConflict: 'user_id' });
    throwIfError(saveError);
    return this.getMine(userId);
  }

  /**
   * A guide's phone and messengers: for the guide, and for hikers whose request they
   * accepted. Links open WhatsApp and Telegram.
   */
  async getContact(requesterId: string, guideId: string) {
    const { data, error } = await this.admin
      .from('guides')
      .select(
        'user_id, status, verified_at, contact_phone, contact_whatsapp, contact_telegram, trail_ids',
      )
      .eq('user_id', guideId)
      .maybeSingle();
    throwIfError(error);
    const guide = data as GuideRow | null;
    if (!guide) throw new NotFoundException('Guide not found');

    if (requesterId !== guideId) {
      const { data: accepted, error: bookingError } = await this.admin
        .from('guide_bookings')
        .select('id')
        .eq('guide_id', guideId)
        .eq('hiker_id', requesterId)
        .eq('status', 'accepted')
        .limit(1);
      throwIfError(bookingError);
      if (!accepted || accepted.length === 0) {
        throw new ForbiddenException(
          'The guide shares their contact once they accept your request',
        );
      }
    }

    const digits = guide.contact_phone?.replace(/[^0-9]/g, '') ?? '';
    return {
      phone: guide.contact_phone,
      whatsapp_url:
        guide.contact_whatsapp && digits ? `https://wa.me/${digits}` : null,
      telegram: guide.contact_telegram,
      telegram_url: guide.contact_telegram
        ? `https://t.me/${guide.contact_telegram}`
        : null,
    };
  }

  // -------------------------------------------------------------------------
  // Bookings
  // -------------------------------------------------------------------------

  /** A hiker asks a verified guide for a hike; the guide gets a notification. */
  async createBooking(hikerId: string, dto: CreateBookingDto) {
    if (dto.guide_id === hikerId)
      throw new BadRequestException('You cannot book yourself');
    if (dto.start_date < tbilisiToday()) {
      throw new BadRequestException('start_date must be today or later');
    }

    const { data: guide, error } = await this.admin
      .from('guides')
      .select('user_id, status')
      .eq('user_id', dto.guide_id)
      .maybeSingle();
    throwIfError(error);
    if (!guide || (guide as { status: string }).status !== 'verified') {
      throw new NotFoundException('Guide not found');
    }

    let trailName: string | null = null;
    if (dto.trail_id) {
      const { data: trail, error: trailError } = await this.admin
        .from('trails')
        .select('name_en')
        .eq('id', dto.trail_id)
        .maybeSingle();
      throwIfError(trailError);
      if (!trail) throw new BadRequestException('Trail not found');
      trailName = (trail as { name_en: string }).name_en;
    }

    const { count, error: countError } = await this.admin
      .from('guide_bookings')
      .select('id', { count: 'exact', head: true })
      .eq('guide_id', dto.guide_id)
      .eq('hiker_id', hikerId)
      .eq('status', 'requested');
    throwIfError(countError);
    if ((count ?? 0) >= MAX_OPEN_REQUESTS) {
      throw new BadRequestException(
        'Wait for the guide to answer your earlier requests',
      );
    }

    const { data, error: insertError } = await this.admin
      .from('guide_bookings')
      .insert({
        guide_id: dto.guide_id,
        hiker_id: hikerId,
        trail_id: dto.trail_id ?? null,
        start_date: dto.start_date,
        days: dto.days,
        group_size: dto.group_size,
        message: dto.message,
      })
      .select()
      .single();
    throwIfError(insertError);

    const hikerName = await this.username(hikerId);
    const people = `${dto.group_size} ${dto.group_size === 1 ? 'person' : 'people'}`;
    this.notificationsService
      .sendToUser(
        dto.guide_id,
        'New booking request',
        `${hikerName} would like to hike ${trailName ?? 'with you'} on ${shortDate(dto.start_date)} (${people})`,
        { bookingId: (data as { id: string }).id, role: 'guide' },
        'booking',
      )
      .catch(() => {});
    return data;
  }

  /** Your requests as a hiker, and the requests to you as a guide, newest first. */
  async listBookings(userId: string) {
    const [asHiker, asGuide] = await Promise.all([
      this.admin
        .from('guide_bookings')
        .select(
          '*, trails:trail_id (id, name_en), guide:guide_id (headline, profiles:user_id (username, avatar_url))',
        )
        .eq('hiker_id', userId)
        .order('created_at', { ascending: false })
        .limit(100),
      this.admin
        .from('guide_bookings')
        .select(
          '*, trails:trail_id (id, name_en), hiker:hiker_id (username, avatar_url)',
        )
        .eq('guide_id', userId)
        .order('created_at', { ascending: false })
        .limit(100),
    ]);
    throwIfError(asHiker.error);
    throwIfError(asGuide.error);
    return { as_hiker: asHiker.data ?? [], as_guide: asGuide.data ?? [] };
  }

  /**
   * The guide accepts or declines a request (with an optional reply); the hiker cancels a
   * request or an accepted booking. The other one is told.
   */
  async answerBooking(
    userId: string,
    bookingId: string,
    status: BookingAnswer,
    reply?: string | null,
  ) {
    const { data, error } = await this.admin
      .from('guide_bookings')
      .select(
        'id, guide_id, hiker_id, trail_id, start_date, group_size, status',
      )
      .eq('id', bookingId)
      .maybeSingle();
    throwIfError(error);
    const booking = data as BookingRow | null;
    if (
      !booking ||
      (booking.guide_id !== userId && booking.hiker_id !== userId)
    ) {
      throw new NotFoundException('Booking not found');
    }

    if (status === 'cancelled') {
      if (booking.hiker_id !== userId)
        throw new ForbiddenException('Only the hiker can cancel');
      if (!['requested', 'accepted'].includes(booking.status)) {
        throw new BadRequestException(
          'This booking can no longer be cancelled',
        );
      }
    } else {
      if (booking.guide_id !== userId)
        throw new ForbiddenException('Only the guide can answer');
      if (booking.status !== 'requested') {
        throw new BadRequestException('This request has already been answered');
      }
    }

    const changes: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (status !== 'cancelled' && reply !== undefined)
      changes.guide_reply = reply;
    const { data: updated, error: updateError } = await this.admin
      .from('guide_bookings')
      .update(changes)
      .eq('id', bookingId)
      .select()
      .single();
    throwIfError(updateError);

    const date = shortDate(booking.start_date);
    if (status === 'cancelled') {
      const hiker = await this.username(booking.hiker_id);
      this.notify(
        booking.guide_id,
        'Booking cancelled',
        `${hiker} cancelled the hike on ${date}`,
        booking.id,
        'guide',
      );
    } else {
      const guide = await this.username(booking.guide_id);
      this.notify(
        booking.hiker_id,
        status === 'accepted' ? 'Booking accepted' : 'Booking declined',
        status === 'accepted'
          ? `${guide} accepted your hike on ${date}. Their contact is in My bookings.`
          : `${guide} can't take your hike on ${date}.`,
        booking.id,
        'hiker',
      );
    }
    return updated;
  }

  private notify(
    userId: string,
    title: string,
    body: string,
    bookingId: string,
    role: 'guide' | 'hiker',
  ) {
    this.notificationsService
      .sendToUser(userId, title, body, { bookingId, role }, 'booking')
      .catch(() => {});
  }

  private async username(userId: string): Promise<string> {
    const { data } = await this.admin
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single();
    return (data as { username?: string } | null)?.username ?? 'Someone';
  }
}
