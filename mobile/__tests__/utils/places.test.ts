/** Places beyond trails: names of kinds, the activity a place's weather opens on, links. */
import {
  PLACE_KINDS,
  activitiesFor,
  defaultActivity,
  formatKm,
  kindMeta,
  osmUrl,
  placeSubtitle,
  visitFacts,
  wikipediaUrl,
} from '../../utils/places';

describe('kinds', () => {
  it('names all fifteen kinds once', () => {
    const keys = PLACE_KINDS.map((k) => k.key);
    expect(new Set(keys).size).toBe(15);
    expect(kindMeta('castle')).toEqual(expect.objectContaining({ label: 'Fortress', plural: 'Fortresses' }));
    expect(kindMeta('hot_spring').label).toBe('Hot spring');
  });
});

describe('defaultActivity', () => {
  it('opens on what people do there', () => {
    expect(defaultActivity({ kind: 'peak', elevation_m: 5047 })).toBe('alpinism');
    expect(defaultActivity({ kind: 'peak', elevation_m: 1800 })).toBe('hiking');
    expect(defaultActivity({ kind: 'glacier', elevation_m: null })).toBe('alpinism');
    expect(defaultActivity({ kind: 'lake', elevation_m: 2800 })).toBe('hiking');
    expect(defaultActivity({ kind: 'lake', elevation_m: 600 })).toBe('fishing');
    expect(defaultActivity({ kind: 'fishing', elevation_m: null })).toBe('fishing');
    expect(defaultActivity({ kind: 'campsite', elevation_m: 1200 })).toBe('camping');
    expect(defaultActivity({ kind: 'hut', elevation_m: 2600 })).toBe('camping');
    expect(defaultActivity({ kind: 'waterfall', elevation_m: 900 })).toBe('photography');
    expect(defaultActivity({ kind: 'tower', elevation_m: 1500 })).toBe('photography');
    expect(defaultActivity({ kind: 'cave', elevation_m: 300 })).toBe('hiking');
  });

  it('offers its own activity first, fishing only at water and climbing only high up', () => {
    const lake = activitiesFor({ kind: 'lake', elevation_m: 600 });
    expect(lake[0]).toBe('fishing');
    expect(lake).not.toContain('alpinism');
    const fortress = activitiesFor({ kind: 'castle', elevation_m: 900 });
    expect(fortress[0]).toBe('photography');
    expect(fortress).not.toContain('fishing');
    expect(activitiesFor({ kind: 'peak', elevation_m: 4000 })).toContain('alpinism');
    expect(new Set(fortress).size).toBe(fortress.length);
  });
});

describe('formatting', () => {
  it('describes a place in one line', () => {
    expect(placeSubtitle({ kind: 'lake', region: 'Kazbegi', elevation_m: 2350.4 })).toBe('Lake · Kazbegi · 2,350 m');
    expect(placeSubtitle({ kind: 'cave', region: null, elevation_m: null })).toBe('Cave');
  });

  it('gives distances in metres up close and kilometres further', () => {
    expect(formatKm(0.04)).toBe('100 m');
    expect(formatKm(0.76)).toBe('800 m');
    expect(formatKm(4.24)).toBe('4.2 km');
    expect(formatKm(35.4)).toBe('35 km');
  });
});

describe('links', () => {
  it('builds a Wikipedia link from the OSM tag', () => {
    expect(wikipediaUrl('en:Gergeti Trinity Church')).toBe('https://en.wikipedia.org/wiki/Gergeti_Trinity_Church');
    expect(wikipediaUrl('ka:ნარიყალა')).toBe(`https://ka.wikipedia.org/wiki/${encodeURIComponent('ნარიყალა')}`);
    expect(wikipediaUrl('no language')).toBeNull();
    expect(wikipediaUrl(null)).toBeNull();
  });

  it('links the place on OpenStreetMap', () => {
    expect(osmUrl('way', 123)).toBe('https://www.openstreetmap.org/way/123');
  });
});

describe('visitFacts', () => {
  it('puts what OSM knows about visiting into words', () => {
    expect(
      visitFacts({ fee: 'yes', charge: '20 GEL', opening_hours: 'Tu-Su 10:00-18:00', drinking_water: 'yes', capacity: '24', access: 'private' }),
    ).toEqual([
      { label: 'Entry', value: 'Paid (20 GEL)' },
      { label: 'Open', value: 'Tu-Su 10:00-18:00' },
      { label: 'Drinking water', value: 'Yes' },
      { label: 'Places to sleep', value: '24' },
      { label: 'Access', value: 'Private' },
    ]);
    expect(visitFacts({ fee: 'no', capacity: 'many' })).toEqual([{ label: 'Entry', value: 'Free' }]);
    expect(visitFacts(null)).toEqual([]);
  });
});
