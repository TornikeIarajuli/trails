/** Places beyond trails: what each kind is called, its icon, and the weather that matters there. */
import type { IconName } from '../components/ui/Icon';
import type { PlaceKind, PlaceSummary } from '../services/places';
import type { Activity } from './activities';

export interface PlaceKindMeta {
  key: PlaceKind;
  label: string;
  plural: string;
  icon: IconName;
}

export const PLACE_KINDS: PlaceKindMeta[] = [
  { key: 'lake', label: 'Lake', plural: 'Lakes', icon: 'water-outline' },
  { key: 'waterfall', label: 'Waterfall', plural: 'Waterfalls', icon: 'droplets' },
  { key: 'peak', label: 'Peak', plural: 'Peaks', icon: 'mountain' },
  { key: 'viewpoint', label: 'Viewpoint', plural: 'Viewpoints', icon: 'binoculars-outline' },
  { key: 'canyon', label: 'Canyon', plural: 'Canyons', icon: 'route' },
  { key: 'campsite', label: 'Campsite', plural: 'Campsites', icon: 'tent' },
  { key: 'hut', label: 'Hut', plural: 'Huts', icon: 'house' },
  { key: 'castle', label: 'Fortress', plural: 'Fortresses', icon: 'castle' },
  { key: 'tower', label: 'Tower', plural: 'Towers', icon: 'svaneti-tower' },
  { key: 'monastery', label: 'Monastery', plural: 'Monasteries', icon: 'church' },
  { key: 'cave', label: 'Cave', plural: 'Caves', icon: 'flashlight-outline' },
  { key: 'glacier', label: 'Glacier', plural: 'Glaciers', icon: 'snow-outline' },
  { key: 'pass', label: 'Pass', plural: 'Passes', icon: 'signpost' },
  { key: 'hot_spring', label: 'Hot spring', plural: 'Hot springs', icon: 'thermometer' },
  { key: 'fishing', label: 'Fishing spot', plural: 'Fishing', icon: 'fish-outline' },
];

const BY_KIND = new Map(PLACE_KINDS.map((k) => [k.key, k]));

export function kindMeta(kind: PlaceKind): PlaceKindMeta {
  return BY_KIND.get(kind) ?? { key: kind, label: 'Place', plural: 'Places', icon: 'location-outline' };
}

/** Climbing weather from this height: freezing level, gales and new snow decide the day. */
const ALPINE_FROM_M = 3000;
/** Lakes this high are hiked to; lower ones are mostly fished. */
const HIKED_LAKE_FROM_M = 1500;

/** The activity a place's forecast opens on. */
export function defaultActivity(place: Pick<PlaceSummary, 'kind' | 'elevation_m'>): Activity {
  const high = (m: number) => place.elevation_m != null && place.elevation_m >= m;
  switch (place.kind) {
    case 'peak':
      return high(ALPINE_FROM_M) ? 'alpinism' : 'hiking';
    case 'glacier':
      return 'alpinism';
    case 'lake':
      return high(HIKED_LAKE_FROM_M) ? 'hiking' : 'fishing';
    case 'fishing':
      return 'fishing';
    case 'campsite':
    case 'hut':
      return 'camping';
    case 'waterfall':
    case 'viewpoint':
    case 'castle':
    case 'tower':
    case 'monastery':
      return 'photography';
    default:
      return 'hiking';
  }
}

/** The activities offered for a place, its own first. */
export function activitiesFor(place: Pick<PlaceSummary, 'kind' | 'elevation_m'>): Activity[] {
  const first = defaultActivity(place);
  const all: Activity[] = ['hiking', 'camping', 'photography', 'stargazing', 'fishing', 'offroad', 'running', 'alpinism'];
  const offered = all.filter((a) => {
    if (a === 'alpinism') return place.elevation_m != null && place.elevation_m >= 2500;
    if (a === 'fishing') return place.kind === 'lake' || place.kind === 'fishing';
    return true;
  });
  return [first, ...offered.filter((a) => a !== first)];
}

/** "Lake · Kazbegi · 2,350 m". */
export function placeSubtitle(place: Pick<PlaceSummary, 'kind' | 'region' | 'elevation_m'>): string {
  return [
    kindMeta(place.kind).label,
    place.region,
    place.elevation_m != null ? `${Math.round(place.elevation_m).toLocaleString('en-US')} m` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** "800 m", "4.2 km", "35 km". */
export function formatKm(km: number): string {
  if (km < 1) return `${Math.max(100, Math.round((km * 1000) / 100) * 100)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

/** A Wikipedia link from OSM's "en:Title" (or "ka:Title"). */
export function wikipediaUrl(tag: string | null | undefined): string | null {
  if (!tag) return null;
  const match = /^([a-z]{2,3}):(.+)$/.exec(tag.trim());
  if (!match) return null;
  return `https://${match[1]}.wikipedia.org/wiki/${encodeURIComponent(match[2].replace(/ /g, '_'))}`;
}

/** The place on OpenStreetMap, for "Edit or check on OpenStreetMap". */
export function osmUrl(osmType: string, osmId: number): string {
  return `https://www.openstreetmap.org/${osmType}/${osmId}`;
}

/** What OSM says about visiting, in words: an entry fee, opening hours, water, beds. */
export function visitFacts(tags: Record<string, string> | null | undefined): { label: string; value: string }[] {
  if (!tags) return [];
  const facts: { label: string; value: string }[] = [];
  if (tags.fee === 'yes') facts.push({ label: 'Entry', value: tags.charge ? `Paid (${tags.charge})` : 'Paid' });
  else if (tags.fee === 'no') facts.push({ label: 'Entry', value: 'Free' });
  if (tags.opening_hours) facts.push({ label: 'Open', value: tags.opening_hours });
  if (tags.drinking_water === 'yes') facts.push({ label: 'Drinking water', value: 'Yes' });
  else if (tags.drinking_water === 'no') facts.push({ label: 'Drinking water', value: 'No' });
  if (tags.capacity && /^\d+$/.test(tags.capacity)) facts.push({ label: 'Places to sleep', value: tags.capacity });
  if (tags.access === 'private' || tags.access === 'no') facts.push({ label: 'Access', value: 'Private' });
  return facts;
}
