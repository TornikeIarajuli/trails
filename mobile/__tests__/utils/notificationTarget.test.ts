import { getNotificationTarget, mapLinks } from '../../utils/notificationTarget';

describe('getNotificationTarget', () => {
  it('opens the follower' + "'" + 's profile', () => {
    expect(getNotificationTarget('new_follower', { followerId: 'u2' })).toEqual({ kind: 'route', href: '/trail/user/u2' });
  });

  it('opens the badges screen inside the Alerts tab', () => {
    expect(getNotificationTarget('badge_earned', { badgeIds: ['b1'] })).toEqual({
      kind: 'route',
      href: '/(tabs)/alerts/badges',
    });
  });

  it('opens the event for group-hike notifications', () => {
    expect(getNotificationTarget('event_invite', { eventId: 'e1', trailId: 't1', userId: 'u2' })).toEqual({
      kind: 'route',
      href: '/trail/t1/event/e1',
    });
    expect(getNotificationTarget('event_update', { eventId: 'e1', trailId: 't1', cancelled: false })).toEqual({
      kind: 'route',
      href: '/trail/t1/event/e1',
    });
  });

  it('opens the trail for a cancelled group hike, whose page is gone', () => {
    expect(getNotificationTarget('event_update', { eventId: 'e1', trailId: 't1', cancelled: true })).toEqual({
      kind: 'route',
      href: '/trail/t1',
    });
    expect(getNotificationTarget('event_update', { eventId: 'e1', cancelled: true })).toEqual({ kind: 'none' });
  });

  it('still opens an event from an older notification without a trail id', () => {
    expect(getNotificationTarget('event_invite', { eventId: 'e1', userId: 'u2' })).toEqual({
      kind: 'route',
      href: '/trail/event/event/e1',
    });
  });

  it('opens the completion', () => {
    expect(getNotificationTarget('completion_approved', { completionId: 'c1', trailId: 't1' })).toEqual({
      kind: 'route',
      href: '/trail/completion/c1',
    });
  });

  it('opens the commented post with its comments, whatever kind of post it is', () => {
    expect(getNotificationTarget('new_comment', { activityId: 'c1', activityType: 'completion' })).toEqual({
      kind: 'route',
      href: '/trail/post/c1?comments=1',
    });
    expect(getNotificationTarget('new_comment', { activityId: 'p1', activityType: 'photo', trailId: 't1' })).toEqual({
      kind: 'route',
      href: '/trail/post/p1?comments=1&trailId=t1',
    });
    expect(getNotificationTarget(null, { type: 'new_comment', activityId: 'r1', activityType: 'review' })).toEqual({
      kind: 'route',
      href: '/trail/post/r1?comments=1',
    });
  });

  it('opens the liked post, without opening its comments', () => {
    expect(getNotificationTarget('new_like', { activityId: 'c1', activityType: 'completion', trailId: 't1' })).toEqual({
      kind: 'route',
      href: '/trail/post/c1?trailId=t1',
    });
    expect(getNotificationTarget(null, { type: 'new_like', activityId: 'p1', activityType: 'photo', actorId: 'u2' })).toEqual({
      kind: 'route',
      href: '/trail/post/p1',
    });
  });

  it('opens the check-in for "Are you back?"', () => {
    expect(getNotificationTarget('checkin_reminder', { checkinId: 'k1', trailId: 't1' })).toEqual({
      kind: 'route',
      href: '/trail/check-in',
    });
  });

  it('treats an overdue hiker like an SOS: their last position and their profile', () => {
    expect(getNotificationTarget('overdue', { userId: 'u9', lat: 42.6575, lng: 44.6417 })).toEqual({
      kind: 'sos',
      lat: 42.6575,
      lng: 44.6417,
      userId: 'u9',
    });
    expect(getNotificationTarget('overdue', { userId: 'u9' })).toEqual({ kind: 'sos', lat: null, lng: null, userId: 'u9' });
  });

  it('opens the profile of a hiker who is back', () => {
    expect(getNotificationTarget('checkin_back', { userId: 'u9' })).toEqual({ kind: 'route', href: '/trail/user/u9' });
  });

  it('brings a line warning back to its hike', () => {
    expect(getNotificationTarget(null, { type: 'line_warning', trailId: 't1', level: 'occupation' })).toEqual({
      kind: 'route',
      href: '/trail/t1/hike',
    });
  });

  it('opens a commented group hike on its own screen', () => {
    expect(getNotificationTarget('new_comment', { activityId: 'e1', activityType: 'event', trailId: 't1' })).toEqual({
      kind: 'route',
      href: '/trail/t1/event/e1',
    });
  });

  it('falls back to the trail, or nothing, when a comment or like names no post', () => {
    expect(getNotificationTarget('new_comment', { trailId: 't1' })).toEqual({ kind: 'route', href: '/trail/t1' });
    expect(getNotificationTarget('new_like', {})).toEqual({ kind: 'none' });
  });

  it('returns the SOS location, accepting numbers or numeric strings', () => {
    expect(getNotificationTarget('sos', { userId: 'u2', lat: 42.66, lng: '44.61' })).toEqual({
      kind: 'sos',
      lat: 42.66,
      lng: 44.61,
      userId: 'u2',
    });
    expect(getNotificationTarget('sos', { userId: 'u2', lat: 'x', lng: 500 })).toEqual({
      kind: 'sos',
      lat: null,
      lng: null,
      userId: 'u2',
    });
  });

  it('falls back to the type inside the payload', () => {
    expect(getNotificationTarget(undefined, { type: 'emergency_contact', setterId: 'u3' })).toEqual({
      kind: 'route',
      href: '/trail/user/u3',
    });
  });

  it('does nothing for unknown types or incomplete payloads', () => {
    expect(getNotificationTarget('general', {})).toEqual({ kind: 'none' });
    expect(getNotificationTarget('new_follower', null)).toEqual({ kind: 'none' });
  });
});

describe('mapLinks', () => {
  it('prefers the platform maps app and keeps a web fallback', () => {
    expect(mapLinks(42.1, 44.2, 'android')[0]).toBe('geo:42.1,44.2?q=42.1,44.2');
    expect(mapLinks(42.1, 44.2, 'ios')[0]).toContain('maps.apple.com');
    expect(mapLinks(42.1, 44.2, 'web')).toEqual(['https://www.google.com/maps/search/?api=1&query=42.1,44.2']);
  });
});
