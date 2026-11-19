import {
  directionsChoices,
  directionsUrl,
  formatCoordinates,
  placeUrl,
  shareLocationMessage,
} from '../../utils/directions';

const juta = { latitude: 42.5786, longitude: 44.74494, label: 'Start of Juta to Roshka' };

describe('directionsUrl', () => {
  it('opens driving directions to the start in Google Maps and Waze', () => {
    expect(directionsUrl('google', juta)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=42.578600,44.744940&travelmode=driving',
    );
    expect(directionsUrl('waze', juta)).toBe('https://waze.com/ul?ll=42.578600,44.744940&navigate=yes');
    expect(directionsUrl('apple', juta)).toBe('https://maps.apple.com/?daddr=42.578600,44.744940&dirflg=d');
  });

  it('asks Android for any maps app with a named pin', () => {
    expect(directionsUrl('other', juta)).toBe(
      'geo:42.578600,44.744940?q=42.578600,44.744940(Start%20of%20Juta%20to%20Roshka)',
    );
    expect(directionsUrl('other', { latitude: 42.5, longitude: 44.7 })).toBe('geo:42.500000,44.700000?q=42.500000,44.700000');
  });
});

describe('directionsChoices', () => {
  it('offers Google Maps, Waze and any other maps app on Android', () => {
    expect(directionsChoices('android').map((c) => c.label)).toEqual(['Google Maps', 'Waze', 'Another maps app']);
  });

  it('puts Apple Maps first on iPhone', () => {
    expect(directionsChoices('ios').map((c) => c.key)).toEqual(['apple', 'google', 'waze']);
  });
});

describe('the start as text', () => {
  it('writes coordinates with hemispheres, to about a metre', () => {
    expect(formatCoordinates(juta)).toBe('42.57860° N, 44.74494° E');
    expect(formatCoordinates({ latitude: -33.9, longitude: -70.25 })).toBe('33.90000° S, 70.25000° W');
  });

  it('shares the trail, the coordinates and a link that opens on any phone', () => {
    expect(placeUrl(juta)).toBe('https://www.google.com/maps/search/?api=1&query=42.578600,44.744940');
    expect(shareLocationMessage('Juta to Roshka', juta)).toBe(
      'Start of Juta to Roshka: 42.57860° N, 44.74494° E\nhttps://www.google.com/maps/search/?api=1&query=42.578600,44.744940',
    );
  });

  it('names a place as it is, not as a trail start', () => {
    expect(shareLocationMessage('Abudelauri Lakes', juta, false)).toBe(
      'Abudelauri Lakes: 42.57860° N, 44.74494° E\nhttps://www.google.com/maps/search/?api=1&query=42.578600,44.744940',
    );
  });
});
