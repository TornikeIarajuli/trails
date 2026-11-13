export type NotificationTarget =
  | { kind: 'route'; href: string }
  | { kind: 'sos'; lat: number | null; lng: number | null; userId: string | null }
  | { kind: 'none' };

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function coordinate(value: unknown, limit: number): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

// The event screen reads only the event id; the trail segment is just part of the path.
function eventHref(trailId: string | null, eventId: string): string {
  return `/trail/${trailId ?? 'event'}/event/${eventId}`;
}

/**
 * Where tapping a notification should take the user, from its type and payload
 * (see the push payload contract). Unknown or incomplete payloads go nowhere.
 */
export function getNotificationTarget(
  type: string | null | undefined,
  data: Record<string, unknown> | null | undefined,
): NotificationTarget {
  const d = data ?? {};

  switch (type ?? text(d.type)) {
    case 'new_follower': {
      const followerId = text(d.followerId);
      return followerId ? { kind: 'route', href: `/trail/user/${followerId}` } : { kind: 'none' };
    }
    case 'badge_earned':
      return { kind: 'route', href: '/(tabs)/profile/badges' };
    case 'new_comment': {
      const activityId = text(d.activityId);
      const trailId = text(d.trailId);
      if (activityId && d.activityType === 'event') return { kind: 'route', href: eventHref(trailId, activityId) };
      if (activityId && d.activityType === 'completion') {
        return { kind: 'route', href: `/trail/completion/${activityId}` };
      }
      return { kind: 'route', href: trailId ? `/trail/${trailId}` : '/(tabs)/feed' };
    }
    case 'event_invite':
    case 'event_update': {
      const eventId = text(d.eventId);
      const trailId = text(d.trailId);
      // A cancelled group hike no longer has a page of its own
      const cancelled = d.cancelled === true || d.cancelled === 'true';
      if (eventId && !cancelled) return { kind: 'route', href: eventHref(trailId, eventId) };
      return trailId ? { kind: 'route', href: `/trail/${trailId}` } : { kind: 'none' };
    }
    case 'completion_approved': {
      const completionId = text(d.completionId);
      if (completionId) return { kind: 'route', href: `/trail/completion/${completionId}` };
      const trailId = text(d.trailId);
      return trailId ? { kind: 'route', href: `/trail/${trailId}` } : { kind: 'none' };
    }
    case 'emergency_contact': {
      const setterId = text(d.setterId);
      return setterId ? { kind: 'route', href: `/trail/user/${setterId}` } : { kind: 'none' };
    }
    case 'sos':
      return {
        kind: 'sos',
        lat: coordinate(d.lat, 90),
        lng: coordinate(d.lng, 180),
        userId: text(d.userId),
      };
    default:
      return { kind: 'none' };
  }
}

/** Map links for a coordinate: the platform's own maps app first, then a web fallback. */
export function mapLinks(lat: number, lng: number, platform: string): string[] {
  const web = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  if (platform === 'ios') return [`http://maps.apple.com/?ll=${lat},${lng}&q=${lat},${lng}`, web];
  if (platform === 'android') return [`geo:${lat},${lng}?q=${lat},${lng}`, web];
  return [web];
}
