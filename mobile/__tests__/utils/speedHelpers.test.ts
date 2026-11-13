import { QueryClient } from '@tanstack/react-query';
import { shouldPersistQuery } from '../../utils/queryPersistence';
import { trailDetailFromLists } from '../../utils/trailPlaceholder';

const q = (queryKey: unknown[], status: 'success' | 'error' | 'pending' = 'success') =>
  ({ queryKey, state: { status } }) as never;

describe('shouldPersistQuery', () => {
  it('keeps what a hiker needs offline', () => {
    expect(shouldPersistQuery(q(['trails', { page: 1 }]))).toBe(true);
    expect(shouldPersistQuery(q(['trail', 'a0000000-0000-0000-0000-000000000001']))).toBe(true);
    expect(shouldPersistQuery(q(['profile', 'me']))).toBe(true);
    expect(shouldPersistQuery(q(['bookmarks', 'list', 'all']))).toBe(true);
  });

  it('drops social and fast-changing data, and anything not successful', () => {
    expect(shouldPersistQuery(q(['feed']))).toBe(false);
    expect(shouldPersistQuery(q(['comments', 'x']))).toBe(false);
    expect(shouldPersistQuery(q(['notifications', 'list', 1]))).toBe(false);
    expect(shouldPersistQuery(q(['leaderboard', 50]))).toBe(false);
    expect(shouldPersistQuery(q(['trail', 'x'], 'error'))).toBe(false);
  });
});

describe('trailDetailFromLists', () => {
  const trail = {
    id: 't1',
    name_en: 'Mokoland',
    difficulty: 'easy',
    region: 'Tbilisi',
    distance_km: 3.6,
    elevation_gain_m: 94,
    estimated_hours: 1,
    cover_image_url: 'https://example.org/c.webp',
  };

  it('finds a trail in a paged list and fills the fields lists do not carry', () => {
    const client = new QueryClient();
    client.setQueryData(['trails', { page: 1 }], {
      pages: [{ data: [{ id: 'other' }, trail], pagination: {} }],
      pageParams: [1],
    });

    const detail = trailDetailFromLists(client, 't1');
    expect(detail?.name_en).toBe('Mokoland');
    expect(detail?.cover_image_url).toBe('https://example.org/c.webp');
    expect(detail?.media).toEqual([]);
    expect(detail?.checkpoints).toEqual([]);
    expect(detail?.route).toBeNull();
  });

  it('also looks in plain arrays (nearby, recommendations) and returns nothing when absent', () => {
    const client = new QueryClient();
    client.setQueryData(['nearbyTrails', 42, 44, 15], [trail]);
    expect(trailDetailFromLists(client, 't1')?.region).toBe('Tbilisi');
    expect(trailDetailFromLists(client, 'missing')).toBeUndefined();
  });
});
