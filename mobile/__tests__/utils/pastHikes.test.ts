import {
  MIN_PAST_HIKE_YEAR,
  completionDateLabel,
  completionSource,
  isPastHike,
  pastHikeErrorMessage,
  pastHikeToCompletion,
  pastHikeYear,
  pastHikeYearOptions,
  recordKeptPastMark,
  selectTrailCompletionStatus,
  upsertCompletion,
} from '../../utils/pastHikes';
import { PastHikeResponse, TrailCompletion } from '../../types/completion';

// How the server stores a past hike: 1 January of the chosen year, 12:00 UTC
const pastDate = (year: number) => `${year}-01-01T12:00:00.000Z`;

const completion = (overrides: Partial<TrailCompletion> = {}): TrailCompletion => ({
  id: 'c-1',
  user_id: 'user-1',
  trail_id: 'trail-1',
  proof_photo_url: null,
  photo_lat: null,
  photo_lng: null,
  status: 'approved',
  elapsed_seconds: 5400,
  reviewer_note: null,
  completed_at: '2026-11-13T08:30:00.000Z',
  created_at: '2026-11-13T08:30:00.000Z',
  ...overrides,
});

describe('completionSource', () => {
  it('reads the source the server sends', () => {
    expect(completionSource({ source: 'past' })).toBe('past');
    expect(completionSource({ source: 'photo' })).toBe('photo');
    expect(completionSource({ source: 'hike' })).toBe('hike');
  });

  it('treats a missing or unknown source (older server) as a recorded hike', () => {
    expect(completionSource({})).toBe('hike');
    expect(completionSource({ source: null })).toBe('hike');
    expect(completionSource({ source: 'something-new' })).toBe('hike');
  });

  it('isPastHike is true only for past hikes', () => {
    expect(isPastHike({ source: 'past' })).toBe(true);
    expect(isPastHike({ source: 'hike' })).toBe(false);
    expect(isPastHike({})).toBe(false);
    expect(isPastHike(null)).toBe(false);
  });
});

describe('pastHikeYear', () => {
  it('reads the year of the stored date', () => {
    expect(pastHikeYear({ completed_at: pastDate(2019) })).toBe(2019);
    expect(pastHikeYear({ completed_at: pastDate(1950) })).toBe(1950);
  });

  it('reads the date format the server sends (Postgres, with an offset)', () => {
    expect(pastHikeYear({ completed_at: '2019-01-01T12:00:00+00:00' })).toBe(2019);
  });

  it('is not moved into another year by the time zone', () => {
    // 12:00 UTC on 1 January is still that year everywhere from UTC-12 to UTC+11
    expect(pastHikeYear({ completed_at: '2019-01-01T12:00:00Z' })).toBe(2019);
  });

  it('is null for a date that cannot be read', () => {
    expect(pastHikeYear({ completed_at: 'not a date' })).toBeNull();
  });
});

describe('completionDateLabel', () => {
  it('shows only the year for a past hike', () => {
    expect(completionDateLabel({ source: 'past', completed_at: pastDate(2019) })).toBe(
      'Hiked in 2019 · before the app',
    );
  });

  it('never shows a date for a past hike, even an unreadable one', () => {
    expect(completionDateLabel({ source: 'past', completed_at: 'garbage' })).toBe('Hiked before the app');
  });

  it('shows the date for a recorded hike, also when the server sends no source', () => {
    expect(completionDateLabel({ source: 'hike', completed_at: '2026-11-13T08:30:00.000Z' })).toBe('Nov 13, 2026');
    expect(completionDateLabel({ completed_at: '2026-11-13T08:30:00.000Z' })).toBe('Nov 13, 2026');
  });
});

describe('pastHikeYearOptions', () => {
  it('offers this year and the six before it as chips, then every year down to 1950', () => {
    const { recent, earlier } = pastHikeYearOptions(new Date('2026-11-14T10:00:00Z'));

    expect(recent).toEqual([2026, 2025, 2024, 2023, 2022, 2021, 2020]);
    expect(earlier[0]).toBe(2019);
    expect(earlier[earlier.length - 1]).toBe(MIN_PAST_HIKE_YEAR);
    expect(earlier).toHaveLength(2019 - 1950 + 1);
  });

  it('lists every year once, newest first', () => {
    const { recent, earlier } = pastHikeYearOptions(new Date('2026-06-01T00:00:00Z'));
    const all = [...recent, ...earlier];
    expect(new Set(all).size).toBe(all.length);
    expect(all).toEqual([...all].sort((a, b) => b - a));
  });

  it('follows the server’s calendar (UTC) around New Year', () => {
    // Already 2027 in Tbilisi (UTC+4) but still 2026 for the server
    expect(pastHikeYearOptions(new Date('2026-12-31T22:00:00Z')).recent[0]).toBe(2026);
    expect(pastHikeYearOptions(new Date('2027-01-01T00:30:00Z')).recent[0]).toBe(2027);
  });
});

describe('selectTrailCompletionStatus', () => {
  it('is none without completions for the trail', () => {
    expect(selectTrailCompletionStatus([], 'trail-1')).toEqual({ kind: 'none' });
    expect(selectTrailCompletionStatus(undefined, 'trail-1')).toEqual({ kind: 'none' });
    expect(selectTrailCompletionStatus([completion({ trail_id: 'other' })], 'trail-1')).toEqual({ kind: 'none' });
  });

  it('is completed for an approved recorded hike', () => {
    const recorded = completion({ source: 'hike' });
    expect(selectTrailCompletionStatus([recorded], 'trail-1')).toEqual({ kind: 'completed', completion: recorded });
  });

  it('treats an approved completion without a source (older server) as recorded', () => {
    const legacy = completion();
    expect(selectTrailCompletionStatus([legacy], 'trail-1').kind).toBe('completed');
  });

  it('counts a photo completion as completed', () => {
    expect(selectTrailCompletionStatus([completion({ source: 'photo' })], 'trail-1').kind).toBe('completed');
  });

  it('is past, with the year, for a past hike', () => {
    const past = completion({ source: 'past', completed_at: pastDate(2019), elapsed_seconds: null });
    expect(selectTrailCompletionStatus([past], 'trail-1')).toEqual({
      kind: 'past',
      completion: past,
      year: 2019,
      reviewing: false,
    });
  });

  it('stays past (done) while a hike recorded later waits for review', () => {
    const past = completion({
      source: 'past',
      completed_at: '2019-01-01T12:00:00+00:00',
      pending_hike_id: 'hike-7',
    });
    expect(selectTrailCompletionStatus([past], 'trail-1')).toMatchObject({ kind: 'past', year: 2019, reviewing: true });
  });

  it('prefers a recorded hike over a past one (a verified hike upgrades the mark)', () => {
    const past = completion({ id: 'past', source: 'past', completed_at: pastDate(2019) });
    const recorded = completion({ id: 'recorded', source: 'hike' });
    expect(selectTrailCompletionStatus([past, recorded], 'trail-1')).toMatchObject({
      kind: 'completed',
      completion: { id: 'recorded' },
    });
  });

  it('keeps the past mark while a later recorded hike waits for review', () => {
    const past = completion({ id: 'past', source: 'past', completed_at: pastDate(2019) });
    const pending = completion({ id: 'pending', source: 'hike', status: 'pending' });
    expect(selectTrailCompletionStatus([pending, past], 'trail-1')).toMatchObject({ kind: 'past' });
  });

  it('is pending for a recorded hike waiting for review', () => {
    const pending = completion({ status: 'pending' });
    expect(selectTrailCompletionStatus([pending], 'trail-1')).toEqual({ kind: 'pending', completion: pending });
  });

  it('treats a rejected completion as none', () => {
    expect(selectTrailCompletionStatus([completion({ status: 'rejected' })], 'trail-1')).toEqual({ kind: 'none' });
  });

  it('shows the newest of several recorded completions', () => {
    const older = completion({ id: 'older', completed_at: '2025-05-01T10:00:00Z' });
    const newer = completion({ id: 'newer', completed_at: '2026-05-01T10:00:00Z' });
    expect(selectTrailCompletionStatus([older, newer], 'trail-1')).toMatchObject({ completion: { id: 'newer' } });
  });
});

describe('pastHikeToCompletion', () => {
  const result: PastHikeResponse = {
    id: 'c-9',
    user_id: 'user-1',
    trail_id: 'trail-1',
    status: 'approved',
    source: 'past',
    completed_at: pastDate(2018),
    new_badge_ids: [],
    already_existed: false,
  };

  it('builds a list entry with no time, track or proof of its own', () => {
    const entry = pastHikeToCompletion(result, null, new Date('2026-11-14T10:00:00Z'));
    expect(entry).toMatchObject({
      id: 'c-9',
      trail_id: 'trail-1',
      status: 'approved',
      source: 'past',
      completed_at: pastDate(2018),
      elapsed_seconds: null,
      proof_photo_url: null,
      created_at: '2026-11-14T10:00:00.000Z',
    });
    expect(entry.trails).toBeUndefined();
  });

  it('takes the trail details from the cached trail when there is one', () => {
    const trail = {
      id: 'trail-1',
      name_en: 'Gergeti Trinity',
      name_ka: null,
      difficulty: 'medium',
      region: 'Kazbegi',
      cover_image_url: 'https://example.com/c.jpg',
      distance_km: 6.1,
      elevation_gain_m: 400,
      estimated_hours: 2.5,
    };
    expect(pastHikeToCompletion(result, { ...trail, description_en: 'not needed' } as typeof trail).trails).toEqual(trail);
  });

  it('assumes a past, approved hike when the server leaves fields out', () => {
    const entry = pastHikeToCompletion({ ...result, source: undefined, status: undefined as never });
    expect(entry.source).toBe('past');
    expect(entry.status).toBe('approved');
  });
});

describe('upsertCompletion', () => {
  it('puts a new entry first', () => {
    const list = [completion({ id: 'a' })];
    expect(upsertCompletion(list, completion({ id: 'b' }))?.map((c) => c.id)).toEqual(['b', 'a']);
  });

  it('merges into the entry with the same id', () => {
    const list = [completion({ id: 'a', elapsed_seconds: 100 }), completion({ id: 'b' })];
    const next = upsertCompletion(list, { ...completion({ id: 'a' }), status: 'pending' });
    expect(next?.map((c) => c.id)).toEqual(['a', 'b']);
    expect(next?.[0].status).toBe('pending');
    expect(list[0].status).toBe('approved');
  });

  it('leaves an empty cache alone, so the next fetch fills it', () => {
    expect(upsertCompletion(undefined, completion())).toBeUndefined();
  });
});

describe('recordKeptPastMark', () => {
  it('recognises a recorded hike that was saved for review under a past mark', () => {
    expect(
      recordKeptPastMark({ source: 'past' }),
    ).toBe(true);
  });

  it('is false for a normal recorded completion, also from an older server', () => {
    expect(recordKeptPastMark({ source: 'hike' })).toBe(false);
    expect(recordKeptPastMark({})).toBe(false);
    expect(recordKeptPastMark(null)).toBe(false);
  });
});

describe('pastHikeErrorMessage', () => {
  const httpError = (status: number, message?: string) => ({
    isAxiosError: true,
    response: { status, data: { message } },
  });

  it('passes on what the server says', () => {
    expect(pastHikeErrorMessage(httpError(409, 'Your hike on this trail is waiting for review.'))).toBe(
      'Your hike on this trail is waiting for review.',
    );
    expect(pastHikeErrorMessage(httpError(404, 'Trail not found'))).toBe('Trail not found');
  });

  it('explains a server that does not have past hikes yet', () => {
    expect(pastHikeErrorMessage(httpError(404, 'Cannot POST /api/completions/past'))).toBe(
      'Marking past hikes is not available yet. Please try again later.',
    );
  });

  it('explains a failed connection', () => {
    expect(
      pastHikeErrorMessage({ isAxiosError: true, code: 'ERR_NETWORK', message: 'Network Error' }),
    ).toMatch(/Could not reach the server/);
  });

  it('asks to try again later when the server has trouble (also before the feature is switched on)', () => {
    const retry = 'Could not mark this trail as done right now. Please try again in a little while.';
    expect(pastHikeErrorMessage(httpError(503, 'Service Unavailable'))).toBe(retry);
    expect(pastHikeErrorMessage(httpError(500))).toBe(retry);
  });

  it('falls back to a plain message', () => {
    expect(pastHikeErrorMessage(new Error(''))).toBe('Could not mark this trail as done. Please try again.');
  });
});
