import { FEED_SEGMENTS, feedSegmentFromParam, LEADERBOARD_HREF } from '../../utils/feedSegment';

describe('feed segments', () => {
  it('has Activity first, then Leaderboard', () => {
    expect(FEED_SEGMENTS.map((s) => s.label)).toEqual(['Activity', 'Leaderboard']);
  });

  it('reads a segment from a route param', () => {
    expect(feedSegmentFromParam('leaderboard')).toBe('leaderboard');
    expect(feedSegmentFromParam('activity')).toBe('activity');
    expect(feedSegmentFromParam(['leaderboard', 'activity'])).toBe('leaderboard');
  });

  it('asks for no segment when the param is missing or unknown', () => {
    expect(feedSegmentFromParam(undefined)).toBeNull();
    expect(feedSegmentFromParam('')).toBeNull();
    expect(feedSegmentFromParam('ranks')).toBeNull();
    expect(feedSegmentFromParam([])).toBeNull();
  });

  it('sends old leaderboard links to the Feed with the Leaderboard segment', () => {
    expect(LEADERBOARD_HREF).toEqual({ pathname: '/(tabs)/feed', params: { segment: 'leaderboard' } });
  });
});
