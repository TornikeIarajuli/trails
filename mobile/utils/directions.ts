/**
 * Directions to a trail's start in the maps app the hiker uses, and the start's location as text
 * to send to friends. Pure functions; the trail screen opens the links.
 */

export type DirectionsApp = 'google' | 'waze' | 'apple' | 'other';

export interface Destination {
  latitude: number;
  longitude: number;
  /** Shown on the pin by apps that read it ("Start of Juta to Roshka"). */
  label?: string;
}

const ll = ({ latitude, longitude }: Destination) => `${latitude.toFixed(6)},${longitude.toFixed(6)}`;

/** The link that opens driving directions to the destination in each app. */
export function directionsUrl(app: DirectionsApp, destination: Destination): string {
  const point = ll(destination);
  switch (app) {
    case 'google':
      return `https://www.google.com/maps/dir/?api=1&destination=${point}&travelmode=driving`;
    case 'waze':
      return `https://waze.com/ul?ll=${point}&navigate=yes`;
    case 'apple':
      return `https://maps.apple.com/?daddr=${point}&dirflg=d`;
    case 'other': {
      // Android shows every maps app that can open a place (Yandex, Maps.me, OsmAnd...)
      const label = destination.label ? `(${encodeURIComponent(destination.label)})` : '';
      return `geo:${point}?q=${point}${label}`;
    }
  }
}

/** A plain web link to the place, which opens on any phone. */
export function placeUrl(destination: Destination): string {
  return `https://www.google.com/maps/search/?api=1&query=${ll(destination)}`;
}

export interface DirectionsChoice {
  key: DirectionsApp;
  label: string;
}

/** The maps apps offered on each platform, the phone's own first on iPhone. */
export function directionsChoices(os: string): DirectionsChoice[] {
  if (os === 'ios') {
    return [
      { key: 'apple', label: 'Apple Maps' },
      { key: 'google', label: 'Google Maps' },
      { key: 'waze', label: 'Waze' },
    ];
  }
  return [
    { key: 'google', label: 'Google Maps' },
    { key: 'waze', label: 'Waze' },
    { key: 'other', label: 'Another maps app' },
  ];
}

/** "42.65732° N, 44.62011° E": five decimals is about a metre. */
export function formatCoordinates({ latitude, longitude }: Destination): string {
  const lat = `${Math.abs(latitude).toFixed(5)}° ${latitude >= 0 ? 'N' : 'S'}`;
  const lng = `${Math.abs(longitude).toFixed(5)}° ${longitude >= 0 ? 'E' : 'W'}`;
  return `${lat}, ${lng}`;
}

/** What "Share the location" sends: the trail's start (or a place), the coordinates and a link that opens anywhere. */
export function shareLocationMessage(name: string, destination: Destination, isStart = true): string {
  return `${isStart ? `Start of ${name}` : name}: ${formatCoordinates(destination)}\n${placeUrl(destination)}`;
}
