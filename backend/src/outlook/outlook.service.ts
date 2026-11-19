import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';
import { NotificationsService } from '../notifications/notifications.service';
import { TtlCache } from '../common/ttl-cache';
import {
  SupabaseErrorLike,
  isMissingRelationError,
  throwIfError,
} from '../common/supabase-error';
import { parsePoint } from '../trails/region-stats';
import { ForecastPoint, fetchForecasts } from './forecast';
import { DayVerdict, Verdict, judgeDay, neededHours } from './verdict';

/** Today and the six days after it. */
const OUTLOOK_DAYS = 7;
/** A good-weather push announces a day from tomorrow to three days out. */
const ALERT_FIRST_DAY = 1;
const ALERT_LAST_DAY = 3;
const LIST_TTL = 10 * 60 * 1000;
// PostgREST returns at most this many rows per request by default
const PAGE_SIZE = 1000;
const MAX_PAGES = 50;
const UPSERT_CHUNK = 500;
/** Ids per `in` filter, so a request's URL stays short. */
const IDS_PER_QUERY = 100;
const GEORGIA_UTC_OFFSET_MS = 4 * 60 * 60 * 1000;

const TRAIL_COLUMNS =
  'id, name_en, start_point, elevation_profile, estimated_hours, distance_km, elevation_gain_m';
const GOOD_DAY_COLUMNS =
  'trail_id, day, verdict, label, headline, temp_min_c, temp_max_c, trail:trails (id, name_en, name_ka, region, difficulty, cover_image_url, distance_km, elevation_gain_m, is_published)';

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const MONTHS = [
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

export interface OutlookTrail {
  id: string;
  name_en: string;
  name_ka: string | null;
  region: string | null;
  difficulty: string | null;
  cover_image_url: string | null;
  distance_km: number | null;
  elevation_gain_m: number | null;
}

/** A trail's first good day ahead, as GET /outlook lists it. */
export interface GoodDay {
  trail_id: string;
  day: string;
  verdict: Verdict;
  label: string;
  headline: string;
  temp_min_c: number | null;
  temp_max_c: number | null;
  trail: OutlookTrail;
}

export interface OutlookRow extends Omit<GoodDay, 'trail'> {
  trail: (OutlookTrail & { is_published?: boolean | null }) | null;
}

/** A published trail as the daily run reads it. */
export interface SourceTrail {
  id: string;
  name_en: string;
  /** GeoJSON Point. */
  start_point?: unknown;
  /** [distance_m, elevation_m] pairs. */
  elevation_profile?: unknown;
  estimated_hours?: unknown;
  distance_km?: unknown;
  elevation_gain_m?: unknown;
}

export interface GoDay {
  trailId: string;
  trailName: string;
  day: string;
  label: string;
  headline: string;
}

export interface SentAlert {
  user_id: string;
  trail_id: string;
  day: string;
  sent_at: string;
}

export interface OutlookRunResult {
  skipped?: 'running' | 'done' | 'not_set_up';
  /** Trails with verdicts from this run. */
  trails?: number;
  goodDays?: number;
  alerts?: number;
  failedRequests?: number;
  error?: string;
}

/** Today in Georgia (UTC+4, no daylight saving), YYYY-MM-DD. */
export function georgianToday(now: Date = new Date()): string {
  return new Date(now.getTime() + GEORGIA_UTC_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

/** The YYYY-MM-DD date `days` after `date`. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "Saturday 22 Nov" from YYYY-MM-DD. */
export function dayTitle(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/**
 * The push: "Juta on Saturday 22 Nov: Dry and calm". A day that is good for part of it only
 * is named after what spoils the rest, so when to go comes first: "Go early, thunderstorms
 * likely from 14:00".
 */
export function alertBody(goDay: GoDay): string {
  const { trailName, day, label, headline } = goDay;
  const what =
    label === 'Go'
      ? headline
      : `${label}, ${headline.charAt(0).toLowerCase()}${headline.slice(1)}`;
  return `${trailName} on ${dayTitle(day)}: ${what}`;
}

/** A number column, which may arrive as text. */
function numeric(value: unknown): number | null {
  const n =
    typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/** The highest point of an elevation profile ([distance_m, elevation_m] pairs), in metres. */
export function profileTop(profile: unknown): number | null {
  if (!Array.isArray(profile)) return null;
  let top: number | null = null;
  for (const p of profile) {
    if (Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])) {
      top = top === null ? Number(p[1]) : Math.max(top, Number(p[1]));
    }
  }
  return top === null ? null : Math.round(top);
}

/** Where to ask for a trail's forecast: its start, at the height of its highest point. */
export function outlookPoint(trail: SourceTrail): ForecastPoint | null {
  const start = parsePoint(trail.start_point);
  if (!start) return null;
  return {
    latitude: start[1],
    longitude: start[0],
    elevationM: profileTop(trail.elevation_profile),
  };
}

/**
 * Who hears about which good day: for each hiker, the earliest good day among the trails they
 * bookmarked that they were not told about yet (ties go to the trail first by name). A hiker
 * told about one since `alertedSince` (ms) hears nothing more: one push a day at most.
 */
export function pickAlerts(
  goDays: GoDay[],
  bookmarks: { user_id: string; trail_id: string }[],
  sent: SentAlert[],
  alertedSince: number,
): { userId: string; goDay: GoDay }[] {
  const byTrail = new Map<string, GoDay[]>();
  for (const g of goDays) {
    byTrail.set(g.trailId, [...(byTrail.get(g.trailId) ?? []), g]);
  }
  byTrail.forEach((list) => list.sort((a, b) => a.day.localeCompare(b.day)));

  const told = new Set(sent.map((s) => `${s.user_id}|${s.trail_id}|${s.day}`));
  const toldToday = new Set(
    sent
      .filter((s) => Date.parse(s.sent_at) >= alertedSince)
      .map((s) => s.user_id),
  );

  const picks = new Map<string, GoDay>();
  for (const { user_id: userId, trail_id: trailId } of bookmarks) {
    if (toldToday.has(userId)) continue;
    const next = (byTrail.get(trailId) ?? []).find(
      (g) => !told.has(`${userId}|${g.trailId}|${g.day}`),
    );
    if (!next) continue;
    const current = picks.get(userId);
    if (
      !current ||
      next.day < current.day ||
      (next.day === current.day &&
        next.trailName.localeCompare(current.trailName, 'en') < 0)
    ) {
      picks.set(userId, next);
    }
  }
  return [...picks].map(([userId, goDay]) => ({ userId, goDay }));
}

/** Per trail its first good day, by day then name; trails no longer published are left out. */
export function earliestGoodDays(rows: OutlookRow[], limit: number): GoodDay[] {
  const first = new Map<string, GoodDay>();
  for (const { trail, ...row } of rows) {
    if (row.verdict !== 'go' || !trail || trail.is_published !== true) continue;
    const seen = first.get(row.trail_id);
    if (seen && seen.day <= row.day) continue;
    const { is_published: _published, ...fields } = trail;
    first.set(row.trail_id, { ...row, trail: fields });
  }
  return [...first.values()]
    .sort(
      (a, b) =>
        a.day.localeCompare(b.day) ||
        a.trail.name_en.localeCompare(b.trail.name_en, 'en'),
    )
    .slice(0, limit);
}

function chunks<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

type PageQuery = (
  from: number,
  to: number,
) => PromiseLike<{ data: unknown; error: SupabaseErrorLike | null }>;

/**
 * The daily outlook: once a day, go / wait / skip for today and the six days after it for every
 * published trail, from the forecast at its highest point; a push to hikers when a trail they
 * bookmarked gets a good day; and the good days ahead for the app's Feed.
 */
@Injectable()
export class OutlookService {
  private readonly logger = new Logger(OutlookService.name);
  // One entry per day count and limit asked for
  private cache = new TtlCache<{ data: GoodDay[] }>(100);
  private running = false;

  constructor(
    private supabaseService: SupabaseService,
    private notificationsService: NotificationsService,
  ) {}

  private get admin() {
    return this.supabaseService.getAdminClient();
  }

  /** Per trail its first good day from today to `days - 1` days out, by day then name. */
  async list(
    days = 3,
    limit = 30,
    now: Date = new Date(),
  ): Promise<{ data: GoodDay[] }> {
    const today = georgianToday(now);
    const key = `outlook:${today}:${days}:${limit}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const rows: OutlookRow[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const from = page * PAGE_SIZE;
      const { data, error } = await this.admin
        .from('trail_outlook')
        .select(GOOD_DAY_COLUMNS)
        .eq('verdict', 'go')
        .gte('day', today)
        .lte('day', addDays(today, days - 1))
        .order('day', { ascending: true })
        .order('trail_id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (isMissingRelationError(error)) {
        this.logger.warn(
          'trail_outlook does not exist yet (migration 069); no good days to list',
        );
        rows.length = 0;
        break;
      }
      throwIfError(error);
      const batch = (data ?? []) as unknown as OutlookRow[];
      rows.push(...batch);
      if (batch.length < PAGE_SIZE) break;
    }

    const result = { data: earliestGoodDays(rows, limit) };
    this.cache.set(key, result, LIST_TTL);
    return result;
  }

  /** The token the daily job sends (cron_tokens 'outlook'); null while there is none. */
  async cronToken(): Promise<string | null> {
    const { data, error } = await this.admin
      .from('cron_tokens')
      .select('token')
      .eq('name', 'outlook')
      .maybeSingle();
    if (isMissingRelationError(error)) {
      this.logger.warn(
        'cron_tokens does not exist yet (migration 069); the daily outlook does not run',
      );
      return null;
    }
    if (error) {
      this.logger.error(`Could not read the outlook token: ${error.message}`);
      return null;
    }
    const token = (data as { token?: unknown } | null)?.token;
    return typeof token === 'string' && token.length > 0 ? token : null;
  }

  /**
   * The daily run: once per Georgian date (`force` runs it again). It runs in the background,
   * so it never throws: what went wrong is logged.
   */
  async run(
    options: { force?: boolean; now?: Date } = {},
  ): Promise<OutlookRunResult> {
    if (this.running) {
      this.logger.log('The outlook is already running');
      return { skipped: 'running' };
    }
    this.running = true;
    try {
      return await this.execute(
        options.force === true,
        options.now ?? new Date(),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`The outlook run failed: ${message}`);
      return { error: message };
    } finally {
      this.running = false;
    }
  }

  private async execute(force: boolean, now: Date): Promise<OutlookRunResult> {
    const today = georgianToday(now);
    const { data: done, error } = await this.admin
      .from('outlook_runs')
      .select('finished_at')
      .eq('day', today)
      .maybeSingle();
    if (isMissingRelationError(error)) {
      this.logger.warn(
        'outlook_runs does not exist yet (migration 069); the daily outlook did not run',
      );
      return { skipped: 'not_set_up' };
    }
    throwIfError(error);
    if (
      (done as { finished_at?: string | null } | null)?.finished_at &&
      !force
    ) {
      this.logger.log(`The outlook for ${today} is already done`);
      return { skipped: 'done' };
    }

    const { error: startError } = await this.admin
      .from('outlook_runs')
      .upsert(
        { day: today, started_at: now.toISOString(), finished_at: null },
        { onConflict: 'day' },
      );
    throwIfError(startError);

    const trails = await this.publishedTrails();
    const located = trails.flatMap((trail) => {
      const point = outlookPoint(trail);
      return point ? [{ trail, point }] : [];
    });
    const fetched = await fetchForecasts(located.map((l) => l.point));
    if (fetched.failed > 0) {
      this.logger.warn(
        `${fetched.failed} of ${fetched.requests} forecast requests failed: ${fetched.errors[0]}`,
      );
    }

    const lastDay = addDays(today, OUTLOOK_DAYS - 1);
    const alertFrom = addDays(today, ALERT_FIRST_DAY);
    const alertTo = addDays(today, ALERT_LAST_DAY);
    const computedAt = new Date().toISOString();
    const rows: Record<string, unknown>[] = [];
    const goDays: GoDay[] = [];
    let judged = 0;
    let goodDays = 0;

    located.forEach(({ trail, point }, i) => {
      const forecast = fetched.forecasts[i];
      if (!forecast) return;
      const verdictTrail = {
        neededHours: neededHours({
          estimated_hours: numeric(trail.estimated_hours),
          distance_km: numeric(trail.distance_km),
          elevation_gain_m: numeric(trail.elevation_gain_m),
        }),
        topM: point.elevationM,
      };
      const verdicts = forecast.days
        .filter((d) => d.date >= today && d.date <= lastDay)
        .map((d) => judgeDay(d, forecast.hours, verdictTrail))
        .filter((v): v is DayVerdict => v !== null);
      if (verdicts.length > 0) judged++;

      for (const v of verdicts) {
        rows.push({
          trail_id: trail.id,
          day: v.date,
          verdict: v.verdict,
          label: v.label,
          headline: v.headline,
          temp_min_c: v.tempMinC,
          temp_max_c: v.tempMaxC,
          computed_at: computedAt,
        });
        if (v.verdict !== 'go') continue;
        goodDays++;
        if (v.date >= alertFrom && v.date <= alertTo) {
          goDays.push({
            trailId: trail.id,
            trailName: trail.name_en,
            day: v.date,
            label: v.label,
            headline: v.headline,
          });
        }
      }
    });

    for (const chunk of chunks(rows, UPSERT_CHUNK)) {
      const { error: saveError } = await this.admin
        .from('trail_outlook')
        .upsert(chunk, { onConflict: 'trail_id,day' });
      throwIfError(saveError);
    }
    const { error: cleanError } = await this.admin
      .from('trail_outlook')
      .delete()
      .lt('day', today);
    throwIfError(cleanError);
    this.cache.clear();

    const alerts = await this.sendAlerts(goDays, today);

    // Requests that failed leave the day open, so the retry fills the gaps
    const finished = fetched.failed === 0;
    const { error: endError } = await this.admin
      .from('outlook_runs')
      .update({
        ...(finished ? { finished_at: new Date().toISOString() } : {}),
        trails: judged,
        alerts,
      })
      .eq('day', today);
    if (endError) {
      this.logger.warn(`Could not record the outlook run: ${endError.message}`);
    }

    this.logger.log(
      `Outlook for ${today}: ${judged} of ${trails.length} trails judged, ${goodDays} good days, ${alerts} alerts sent` +
        (finished ? '' : ', left open for the retry'),
    );
    return { trails: judged, goodDays, alerts, failedRequests: fetched.failed };
  }

  /** Every row a query returns, a page at a time. */
  private async allRows<T>(query: PageQuery): Promise<T[]> {
    const rows: T[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const from = page * PAGE_SIZE;
      const { data, error } = await query(from, from + PAGE_SIZE - 1);
      throwIfError(error);
      const batch = (data ?? []) as T[];
      rows.push(...batch);
      if (batch.length < PAGE_SIZE) break;
    }
    return rows;
  }

  private publishedTrails(): Promise<SourceTrail[]> {
    return this.allRows<SourceTrail>((from, to) =>
      this.admin
        .from('trails')
        .select(TRAIL_COLUMNS)
        .eq('is_published', true)
        .order('id', { ascending: true })
        .range(from, to),
    );
  }

  /** One push per hiker at most: the first good day ahead among the trails they bookmarked. */
  private async sendAlerts(goDays: GoDay[], today: string): Promise<number> {
    if (goDays.length === 0) return 0;

    const bookmarks: { user_id: string; trail_id: string }[] = [];
    for (const ids of chunks(
      [...new Set(goDays.map((g) => g.trailId))],
      IDS_PER_QUERY,
    )) {
      bookmarks.push(
        ...(await this.allRows<{ user_id: string; trail_id: string }>(
          (from, to) =>
            this.admin
              .from('trail_bookmarks')
              .select('user_id, trail_id')
              .in('trail_id', ids)
              .order('id', { ascending: true })
              .range(from, to),
        )),
      );
    }
    if (bookmarks.length === 0) return 0;

    // Every push sent today is about tomorrow or later
    const sent: SentAlert[] = [];
    for (const ids of chunks(
      [...new Set(bookmarks.map((b) => b.user_id))],
      IDS_PER_QUERY,
    )) {
      sent.push(
        ...(await this.allRows<SentAlert>((from, to) =>
          this.admin
            .from('weather_alerts_sent')
            .select('user_id, trail_id, day, sent_at')
            .in('user_id', ids)
            .gte('day', addDays(today, ALERT_FIRST_DAY))
            .order('user_id', { ascending: true })
            .order('trail_id', { ascending: true })
            .order('day', { ascending: true })
            .range(from, to),
        )),
      );
    }

    const picks = pickAlerts(
      goDays,
      bookmarks,
      sent,
      Date.parse(`${today}T00:00:00+04:00`),
    );
    let alerts = 0;
    for (const { userId, goDay } of picks) {
      // Recorded before it is sent: a second run at the same time cannot send it again
      const { data: claimed, error } = await this.admin
        .from('weather_alerts_sent')
        .upsert(
          { user_id: userId, trail_id: goDay.trailId, day: goDay.day },
          { onConflict: 'user_id,trail_id,day', ignoreDuplicates: true },
        )
        .select('user_id');
      if (error) {
        this.logger.warn(
          `Could not record a good-weather alert: ${error.message}`,
        );
        continue;
      }
      if (!claimed || claimed.length === 0) continue;

      const result = await this.notificationsService.sendToUser(
        userId,
        'Good hiking weather',
        alertBody(goDay),
        { trailId: goDay.trailId, date: goDay.day },
        'good_weather',
      );
      if (!result.skipped) alerts++;
    }
    return alerts;
  }
}
