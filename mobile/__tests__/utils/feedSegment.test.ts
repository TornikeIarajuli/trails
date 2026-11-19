import { FEED_SEGMENTS, feedSegmentFromParam, LEADERBOARD_HREF } from '../../utils/feedSegment';

describe('feed segments', () => {
  it('has Following first, then Discover, Good days and Ranks', () => {
    expect(FEED_SEGMENTS.map((s) => s.label)).toEqual(['Following', 'Discover', 'Good days', 'Ranks']);
    expect(FEED_SEGMENTS.map((s) => s.key)).toEqual(['activity', 'discover', 'gooddays', 'leaderboard']);
  });

  it('reads a segment from a route param', () => {
    expect(feedSegmentFromParam('leaderboard')).toBe('leaderboard');
    expect(feedSegmentFromParam('activity')).toBe('activity');
    expect(feedSegmentFromParam('discover')).toBe('discover');
    expect(feedSegmentFromParam('gooddays')).toBe('gooddays');
    expect(feedSegmentFromParam(['leaderboard', 'activity'])).toBe('leaderboard');
  });

  it('asks for no segment when the param is missing or unknown', () => {
    expect(feedSegmentFromParam(undefined)).toBeNull();
    expect(feedSegmentFromParam('')).toBeNull();
    expect(feedSegmentFromParam('ranks')).toBeNull();
    expect(feedSegmentFromParam('good days')).toBeNull();
    expect(feedSegmentFromParam('toString')).toBeNull();
    expect(feedSegmentFromParam([])).toBeNull();
  });

  it('sends old leaderboard links to the Feed with the leaderboard segment', () => {
    expect(LEADERBOARD_HREF).toEqual({ pathname: '/(tabs)/feed', params: { segment: 'leaderboard' } });
  });
});
