import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import {
  GoDay,
  OutlookRow,
  OutlookService,
  addDays,
  alertBody,
  dayTitle,
  earliestGoodDays,
  georgianToday,
  outlookPoint,
  pickAlerts,
  profileTop,
} from './outlook.service';
import { SupabaseService } from '../config/supabase.config';
import { NotificationsService } from '../notifications/notifications.service';

// ---------------------------------------------------------------------------
// Supabase mock: every query method returns the builder, and awaiting the builder resolves
// to the result queued for that table.
// ---------------------------------------------------------------------------
type Builder = Record<string, jest.Mock> & { then: unknown };

function makeBuilder(result: object): Builder {
  const self = {} as Builder;
  [
    'select',
    'eq',
    'gte',
    'lte',
    'lt',
    'in',
    'order',
    'range',
    'insert',
    'update',
    'upsert',
    'delete',
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
const mockFetch = jest.fn();
global.fetch = mockFetch;

// 14:00 in Tbilisi on Friday 20 November
const NOW = new Date('2026-11-20T10:00:00Z');
const TODAY = '2026-11-20';

/** A week of Open-Meteo hours for one point: calm and clear unless `change` says otherwise. */
function openMeteo(
  change: (
    date: string,
    hour: number,
  ) => Record<string, number> | undefined = () => undefined,
) {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(TODAY, i));
  const hourly: Record<string, unknown[]> = {
    time: [],
    temperature_2m: [],
    apparent_temperature: [],
    precipitation: [],
    precipitation_probability: [],
    snowfall: [],
    weather_code: [],
    visibility: [],
    wind_gusts_10m: [],
    freezing_level_height: [],
  };
  for (const date of dates) {
    for (let h = 0; h < 24; h++) {
      hourly.time.push(`${date}T${String(h).padStart(2, '0')}:00`);
      const values: Record<string, number> = {
        temperature_2m: 8,
        apparent_temperature: 6,
        precipitation: 0,
        precipitation_probability: 5,
        snowfall: 0,
        weather_code: 1,
        visibility: 30000,
        wind_gusts_10m: 20,
        freezing_level_height: 3600,
        ...change(date, h),
      };
      for (const [key, value] of Object.entries(values)) {
        hourly[key].push(value);
      }
    }
  }
  return {
    latitude: 42,
    longitude: 44,
    elevation: 2400,
    utc_offset_seconds: 14400,
    hourly,
    daily: {
      time: dates,
      sunrise: dates.map((d) => `${d}T07:00`),
      sunset: dates.map((d) => `${d}T18:00`),
      uv_index_max: dates.map(() => 3),
    },
  };
}

const response = (body: unknown, status = 200) => ({
  ok: status < 400,
  status,
  json: () => Promise.resolve(body),
});

const trailA = {
  id: 'trail-a',
  name_en: 'Abudelauri Lakes',
  start_point: { type: 'Point', coordinates: [45.0, 42.5] },
  elevation_profile: [
    [0, 1800],
    [5000, 2600],
    [9000, 2000],
  ],
  estimated_hours: 6,
  distance_km: 9,
  elevation_gain_m: 800,
};
const trailB = {
  id: 'trail-b',
  name_en: 'Bakhmaro Ridge',
  start_point: { type: 'Point', coordinates: [42.3, 41.85] },
  elevation_profile: [
    [0, 1900],
    [4000, 2400],
  ],
  estimated_hours: '4.0',
  distance_km: '7.50',
  elevation_gain_m: 500,
};
const noStart = { id: 'trail-c', name_en: 'Somewhere', start_point: null };

describe('OutlookService', () => {
  let service: OutlookService;
  let logSpies: jest.SpyInstance[];

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OutlookService,
        {
          provide: SupabaseService,
          useValue: { getAdminClient: () => mockAdmin },
        },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();
    service = module.get(OutlookService);
    jest.clearAllMocks();
    queues.clear();
    // log, warn, error
    logSpies = [
      jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined),
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined),
    ];
  });

  afterEach(() => {
    logSpies.forEach((spy) => spy.mockRestore());
  });

  describe('run', () => {
    it('judges every published trail, keeps the week, and tells each hiker about one good day', async () => {
      onTable('outlook_runs', { data: null, error: null });
      const start = onTable('outlook_runs', { error: null });
      const finish = onTable('outlook_runs', { error: null });
      const trails = onTable('trails', {
        data: [trailA, trailB, noStart],
        error: null,
      });
      // Storms all day tomorrow at the first trail; the second is fine all week
      mockFetch.mockResolvedValueOnce(
        response([
          openMeteo((date) =>
            date === '2026-11-21' ? { weather_code: 95 } : undefined,
          ),
          openMeteo(),
        ]),
      );
      const save = onTable('trail_outlook', { error: null });
      const clean = onTable('trail_outlook', { error: null });
      onTable('trail_bookmarks', {
        data: [
          { user_id: 'u1', trail_id: 'trail-a' },
          { user_id: 'u1', trail_id: 'trail-b' },
          { user_id: 'u2', trail_id: 'trail-a' },
          { user_id: 'u3', trail_id: 'trail-b' },
          { user_id: 'u4', trail_id: 'trail-b' },
        ],
        error: null,
      });
      onTable('weather_alerts_sent', {
        data: [
          // Told yesterday about Saturday on the ridge
          {
            user_id: 'u3',
            trail_id: 'trail-b',
            day: '2026-11-21',
            sent_at: '2026-11-19T13:30:12.5+00:00',
          },
          // Already told something today
          {
            user_id: 'u4',
            trail_id: 'trail-b',
            day: '2026-11-23',
            sent_at: '2026-11-20T09:00:00+00:00',
          },
        ],
        error: null,
      });
      const claims = ['u1', 'u2', 'u3'].map((id) =>
        onTable('weather_alerts_sent', {
          data: [{ user_id: id }],
          error: null,
        }),
      );

      const result = await service.run({ now: NOW });

      expect(result).toEqual({
        trails: 2,
        goodDays: 13,
        alerts: 3,
        failedRequests: 0,
      });
      expect(start.upsert).toHaveBeenCalledWith(
        { day: TODAY, started_at: NOW.toISOString(), finished_at: null },
        { onConflict: 'day' },
      );
      expect(trails.eq).toHaveBeenCalledWith('is_published', true);
      expect(trails.range).toHaveBeenCalledWith(0, 999);

      // One request for both points: their starts, at the height of their highest points
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const url = String(mockFetch.mock.calls[0][0]);
      expect(url).toContain('latitude=42.50000,41.85000');
      expect(url).toContain('longitude=45.00000,42.30000');
      expect(url).toContain('elevation=2600,2400');

      const rows = save.upsert.mock.calls[0][0] as Record<string, unknown>[];
      expect(save.upsert.mock.calls[0][1]).toEqual({
        onConflict: 'trail_id,day',
      });
      expect(rows).toHaveLength(14);
      expect(rows).toContainEqual(
        expect.objectContaining({
          trail_id: 'trail-a',
          day: '2026-11-21',
          verdict: 'skip',
          label: 'Skip',
          headline: 'Thunderstorms likely all day',
        }),
      );
      expect(rows).toContainEqual(
        expect.objectContaining({
          trail_id: 'trail-b',
          day: '2026-11-26',
          verdict: 'go',
          label: 'Go',
          headline: 'Dry and calm',
          temp_min_c: 8,
          temp_max_c: 8,
        }),
      );
      expect(clean.delete).toHaveBeenCalled();
      expect(clean.lt).toHaveBeenCalledWith('day', TODAY);

      // u1: the ridge on Saturday beats the lakes on Sunday; u3 already heard about Saturday
      expect(mockNotifications.sendToUser.mock.calls).toEqual([
        [
          'u1',
          'Good hiking weather',
          'Bakhmaro Ridge on Saturday 21 Nov: Dry and calm',
          { trailId: 'trail-b', date: '2026-11-21' },
          'good_weather',
        ],
        [
          'u2',
          'Good hiking weather',
          'Abudelauri Lakes on Sunday 22 Nov: Dry and calm',
          { trailId: 'trail-a', date: '2026-11-22' },
          'good_weather',
        ],
        [
          'u3',
          'Good hiking weather',
          'Bakhmaro Ridge on Sunday 22 Nov: Dry and calm',
          { trailId: 'trail-b', date: '2026-11-22' },
          'good_weather',
        ],
      ]);
      expect(claims[0].upsert).toHaveBeenCalledWith(
        { user_id: 'u1', trail_id: 'trail-b', day: '2026-11-21' },
        { onConflict: 'user_id,trail_id,day', ignoreDuplicates: true },
      );
      expect(finish.update).toHaveBeenCalledWith({
        finished_at: expect.any(String),
        trails: 2,
        alerts: 3,
      });
      expect(finish.eq).toHaveBeenCalledWith('day', TODAY);
    });

    it('sends nothing when another run already recorded the alert', async () => {
      onTable('outlook_runs', { data: null, error: null });
      onTable('outlook_runs', { error: null });
      onTable('outlook_runs', { error: null });
      onTable('trails', { data: [trailB], error: null });
      mockFetch.mockResolvedValueOnce(response(openMeteo()));
      onTable('trail_outlook', { error: null });
      onTable('trail_outlook', { error: null });
      onTable('trail_bookmarks', {
        data: [{ user_id: 'u1', trail_id: 'trail-b' }],
        error: null,
      });
      onTable('weather_alerts_sent', { data: [], error: null });
      onTable('weather_alerts_sent', { data: [], error: null });

      const result = await service.run({ now: NOW });

      expect(result.alerts).toBe(0);
      expect(mockNotifications.sendToUser).not.toHaveBeenCalled();
    });

    it('does not count a push the hiker turned off', async () => {
      mockNotifications.sendToUser.mockResolvedValueOnce({
        sent: 0,
        skipped: 'user_preference',
      });
      onTable('outlook_runs', { data: null, error: null });
      onTable('outlook_runs', { error: null });
      const finish = onTable('outlook_runs', { error: null });
      onTable('trails', { data: [trailB], error: null });
      mockFetch.mockResolvedValueOnce(response(openMeteo()));
      onTable('trail_outlook', { error: null });
      onTable('trail_outlook', { error: null });
      onTable('trail_bookmarks', {
        data: [{ user_id: 'u1', trail_id: 'trail-b' }],
        error: null,
      });
      onTable('weather_alerts_sent', { data: [], error: null });
      onTable('weather_alerts_sent', {
        data: [{ user_id: 'u1' }],
        error: null,
      });

      const result = await service.run({ now: NOW });

      expect(mockNotifications.sendToUser).toHaveBeenCalledTimes(1);
      expect(result.alerts).toBe(0);
      expect(finish.update).toHaveBeenCalledWith(
        expect.objectContaining({ alerts: 0 }),
      );
    });

    it("does nothing once today's run has finished", async () => {
      onTable('outlook_runs', {
        data: { finished_at: '2026-11-20T09:31:00+00:00' },
        error: null,
      });

      await expect(service.run({ now: NOW })).resolves.toEqual({
        skipped: 'done',
      });
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockAdmin.from).toHaveBeenCalledTimes(1);
    });

    it('runs again when forced', async () => {
      onTable('outlook_runs', {
        data: { finished_at: '2026-11-20T09:31:00+00:00' },
        error: null,
      });
      onTable('outlook_runs', { error: null });
      onTable('outlook_runs', { error: null });
      onTable('trails', { data: [], error: null });
      const clean = onTable('trail_outlook', { error: null });

      await expect(service.run({ force: true, now: NOW })).resolves.toEqual({
        trails: 0,
        goodDays: 0,
        alerts: 0,
        failedRequests: 0,
      });
      expect(clean.lt).toHaveBeenCalledWith('day', TODAY);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('leaves the day open for the retry when a forecast request failed', async () => {
      onTable('outlook_runs', { data: null, error: null });
      onTable('outlook_runs', { error: null });
      const finish = onTable('outlook_runs', { error: null });
      onTable('trails', { data: [trailA], error: null });
      mockFetch.mockResolvedValueOnce(response({ error: true }, 502));
      onTable('trail_outlook', { error: null });

      const result = await service.run({ now: NOW });

      expect(result).toEqual(
        expect.objectContaining({ trails: 0, alerts: 0, failedRequests: 1 }),
      );
      expect(finish.update).toHaveBeenCalledWith({ trails: 0, alerts: 0 });
    });

    it('runs one at a time', async () => {
      let release: (value: unknown) => void = () => undefined;
      mockFetch.mockReturnValueOnce(
        new Promise((resolve) => {
          release = resolve;
        }),
      );
      onTable('outlook_runs', { data: null, error: null });
      onTable('outlook_runs', { error: null });
      onTable('outlook_runs', { error: null });
      onTable('trails', { data: [trailA], error: null });
      onTable('trail_outlook', { error: null });

      const first = service.run({ now: NOW });
      for (let i = 0; i < 5; i++) await new Promise(setImmediate);
      await expect(service.run({ now: NOW })).resolves.toEqual({
        skipped: 'running',
      });

      release(response({}, 500));
      await expect(first).resolves.toEqual(
        expect.objectContaining({ failedRequests: 1 }),
      );
    });

    it('does nothing before migration 069', async () => {
      onTable('outlook_runs', {
        data: null,
        error: { code: '42P01', message: 'relation does not exist' },
      });

      await expect(service.run({ now: NOW })).resolves.toEqual({
        skipped: 'not_set_up',
      });
      expect(logSpies[1]).toHaveBeenCalled();
    });

    it('never throws: a failure is logged and returned', async () => {
      onTable('outlook_runs', {
        data: null,
        error: { code: 'XX000', message: 'connection reset' },
      });

      const result = await service.run({ now: NOW });

      expect(result.error).toBeTruthy();
      expect(logSpies[2]).toHaveBeenCalled();
    });
  });

  describe('list', () => {
    const trail = (id: string, name: string, published = true) => ({
      id,
      name_en: name,
      name_ka: null,
      region: 'Kazbegi',
      difficulty: 'medium',
      cover_image_url: null,
      distance_km: 8,
      elevation_gain_m: 600,
      is_published: published,
    });
    const row = (
      trailId: string,
      day: string,
      name: string,
      published = true,
    ): OutlookRow => ({
      trail_id: trailId,
      day,
      verdict: 'go',
      label: 'Go',
      headline: 'Dry and calm',
      temp_min_c: -2,
      temp_max_c: 6,
      trail: trail(trailId, name, published),
    });

    it("lists each trail's first good day, by day then name", async () => {
      const query = onTable('trail_outlook', {
        data: [
          row('t-juta', '2026-11-20', 'Juta'),
          row('t-gergeti', '2026-11-21', 'Gergeti'),
          row('t-juta', '2026-11-21', 'Juta'),
          row('t-arsha', '2026-11-21', 'Arsha'),
          row('t-hidden', '2026-11-20', 'Hidden', false),
        ],
        error: null,
      });

      const result = await service.list(3, 30, NOW);

      expect(result.data.map((d) => [d.trail.name_en, d.day])).toEqual([
        ['Juta', '2026-11-20'],
        ['Arsha', '2026-11-21'],
        ['Gergeti', '2026-11-21'],
      ]);
      expect(result.data[0]).toEqual({
        trail_id: 't-juta',
        day: '2026-11-20',
        verdict: 'go',
        label: 'Go',
        headline: 'Dry and calm',
        temp_min_c: -2,
        temp_max_c: 6,
        trail: {
          id: 't-juta',
          name_en: 'Juta',
          name_ka: null,
          region: 'Kazbegi',
          difficulty: 'medium',
          cover_image_url: null,
          distance_km: 8,
          elevation_gain_m: 600,
        },
      });
      expect(query.eq).toHaveBeenCalledWith('verdict', 'go');
      expect(query.gte).toHaveBeenCalledWith('day', TODAY);
      expect(query.lte).toHaveBeenCalledWith('day', '2026-11-22');
    });

    it('keeps to the limit, and caches the answer', async () => {
      onTable('trail_outlook', {
        data: [
          row('t1', '2026-11-20', 'A'),
          row('t2', '2026-11-20', 'B'),
          row('t3', '2026-11-20', 'C'),
        ],
        error: null,
      });

      const first = await service.list(1, 2, NOW);
      const second = await service.list(1, 2, NOW);

      expect(first.data).toHaveLength(2);
      expect(second).toBe(first);
      expect(mockAdmin.from).toHaveBeenCalledTimes(1);
    });

    it('is empty before migration 069', async () => {
      onTable('trail_outlook', {
        data: null,
        error: { code: 'PGRST205', message: 'Could not find the table' },
      });

      await expect(service.list(3, 30, NOW)).resolves.toEqual({ data: [] });
      expect(logSpies[1]).toHaveBeenCalled();
    });
  });

  describe('cronToken', () => {
    it('reads the token pg_cron sends', async () => {
      const query = onTable('cron_tokens', {
        data: { token: 'abc123' },
        error: null,
      });
      await expect(service.cronToken()).resolves.toBe('abc123');
      expect(query.eq).toHaveBeenCalledWith('name', 'outlook');
    });

    it('has none without a token, or before migration 069', async () => {
      onTable('cron_tokens', { data: null, error: null });
      await expect(service.cronToken()).resolves.toBeNull();

      onTable('cron_tokens', {
        data: null,
        error: { code: '42P01', message: 'relation does not exist' },
      });
      await expect(service.cronToken()).resolves.toBeNull();
      expect(logSpies[1]).toHaveBeenCalled();
    });
  });
});

describe('outlook helpers', () => {
  it('counts days in Georgian time', () => {
    expect(georgianToday(new Date('2026-11-20T19:59:00Z'))).toBe('2026-11-20');
    expect(georgianToday(new Date('2026-11-20T20:00:00Z'))).toBe('2026-11-21');
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-11-20', 6)).toBe('2026-11-26');
  });

  it('names a day like "Saturday 21 Nov"', () => {
    expect(dayTitle('2026-11-21')).toBe('Saturday 21 Nov');
    expect(dayTitle('2027-01-04')).toBe('Monday 4 Jan');
  });

  it('says when to go on a day that is good for part of it only', () => {
    const goDay: GoDay = {
      trailId: 't1',
      trailName: 'Juta',
      day: '2026-11-21',
      label: 'Go',
      headline: 'Dry and calm',
    };
    expect(alertBody(goDay)).toBe('Juta on Saturday 21 Nov: Dry and calm');
    expect(
      alertBody({
        ...goDay,
        label: 'Go early',
        headline: 'Thunderstorms likely from 14:00',
      }),
    ).toBe(
      'Juta on Saturday 21 Nov: Go early, thunderstorms likely from 14:00',
    );
  });

  it("asks at a trail's start, at the height of its highest point", () => {
    expect(
      outlookPoint({
        id: 't1',
        name_en: 'Juta',
        start_point: '{"type":"Point","coordinates":[44.75,42.58]}',
        elevation_profile: [
          [0, 2150],
          [3000, 3012.6],
          [6000, 2800],
        ],
      }),
    ).toEqual({ latitude: 42.58, longitude: 44.75, elevationM: 3013 });
    expect(
      outlookPoint({
        id: 't1',
        name_en: 'Juta',
        start_point: { type: 'Point', coordinates: [44.75, 42.58] },
        elevation_profile: null,
      }),
    ).toEqual({ latitude: 42.58, longitude: 44.75, elevationM: null });
    expect(
      outlookPoint({ id: 't1', name_en: 'Juta', start_point: null }),
    ).toBeNull();
  });

  it('takes the highest point of a profile, skipping broken pairs', () => {
    expect(profileTop([[0, 1500], [800, 2350.6], ['x', 9000], [1000]])).toBe(
      2351,
    );
    expect(profileTop([])).toBeNull();
    expect(profileTop('nope')).toBeNull();
  });

  describe('pickAlerts', () => {
    const since = Date.parse('2026-11-20T00:00:00+04:00');
    const go = (trailId: string, trailName: string, day: string): GoDay => ({
      trailId,
      trailName,
      day,
      label: 'Go',
      headline: 'Dry and calm',
    });

    it('picks one good day per hiker: the earliest, then the trail first by name', () => {
      const picks = pickAlerts(
        [
          go('t-z', 'Zekari Pass', '2026-11-22'),
          go('t-m', 'Mestia Loop', '2026-11-22'),
          go('t-a', 'Abano Lake', '2026-11-23'),
        ],
        [
          { user_id: 'u1', trail_id: 't-a' },
          { user_id: 'u1', trail_id: 't-z' },
          { user_id: 'u1', trail_id: 't-m' },
          { user_id: 'u2', trail_id: 't-x' },
        ],
        [],
        since,
      );
      expect(picks).toEqual([
        { userId: 'u1', goDay: go('t-m', 'Mestia Loop', '2026-11-22') },
      ]);
    });

    it('skips days already announced, and hikers told something today', () => {
      const picks = pickAlerts(
        [go('t1', 'Juta', '2026-11-21'), go('t1', 'Juta', '2026-11-22')],
        [
          { user_id: 'u1', trail_id: 't1' },
          { user_id: 'u2', trail_id: 't1' },
        ],
        [
          {
            user_id: 'u1',
            trail_id: 't1',
            day: '2026-11-21',
            sent_at: '2026-11-19T13:30:00Z',
          },
          {
            user_id: 'u2',
            trail_id: 't9',
            day: '2026-11-23',
            sent_at: '2026-11-20T13:30:00Z',
          },
        ],
        since,
      );
      expect(picks).toEqual([
        { userId: 'u1', goDay: go('t1', 'Juta', '2026-11-22') },
      ]);
    });
  });

  it('leaves out rows without a trail', () => {
    const rows = [
      {
        trail_id: 't1',
        day: '2026-11-20',
        verdict: 'go',
        label: 'Go',
        headline: 'Dry and calm',
        temp_min_c: null,
        temp_max_c: null,
        trail: null,
      },
    ] as OutlookRow[];
    expect(earliestGoodDays(rows, 30)).toEqual([]);
  });
});
