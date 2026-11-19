/** Day routes: a region's best sights close together, in the order that drives least. */
import {
  MAX_STOPS,
  TBILISI,
  formatMinutes,
  orderStops,
  planDayRoutes,
  routeDirectionsUrl,
  routeSummary,
} from '../../utils/routePlanner';
import type { PlaceKind, PlaceSummary } from '../../services/places';

let n = 0;
function place(kind: PlaceKind, latitude: number, longitude: number, notability = 3, extra: Partial<PlaceSummary> = {}): PlaceSummary {
  n += 1;
  return {
    id: `p${n}`,
    kind,
    name_en: `${kind} ${n}`,
    name_ka: null,
    latitude,
    longitude,
    elevation_m: 500,
    region: 'Imereti',
    notability,
    ...extra,
  };
}

describe('orderStops', () => {
  it('drives through the stops in a line, starting from the end nearer to Tbilisi', () => {
    // Four stops on a west–east line, given out of order; Tbilisi is far to the east
    const a = place('waterfall', 42.3, 42.4);
    const b = place('canyon', 42.3, 42.5);
    const c = place('cave', 42.3, 42.6);
    const d = place('lake', 42.3, 42.7);
    expect(orderStops([c, a, d, b]).map((p) => p.id)).toEqual([d.id, c.id, b.id, a.id]);
  });

  it('starts from the other end when coming from the west', () => {
    const a = place('waterfall', 42.3, 42.4);
    const b = place('canyon', 42.3, 42.5);
    expect(orderStops([b, a], { latitude: 42.3, longitude: 41.6 }).map((p) => p.id)).toEqual([a.id, b.id]);
  });
});

describe('planDayRoutes', () => {
  it('builds a route around the best-known sight, at most two of a kind, ordered', () => {
    const anchor = place('canyon', 42.46, 42.37, 9, { name_en: 'Martvili Canyon' });
    const places = [
      anchor,
      place('waterfall', 42.48, 42.4, 6),
      place('waterfall', 42.44, 42.33, 5),
      place('waterfall', 42.45, 42.35, 4), // a third waterfall: left out
      place('cave', 42.38, 42.6, 5),
      place('monastery', 42.5, 42.3, 2),
    ];
    const [route] = planDayRoutes(places, { maxRoutes: 1 });
    expect(route.title).toBe('Martvili Canyon');
    expect(route.stops).toHaveLength(MAX_STOPS);
    expect(route.stops.filter((s) => s.kind === 'waterfall')).toHaveLength(2);
    expect(route.stops.map((s) => s.id)).toContain(anchor.id);
    expect(route.driveKm).toBeGreaterThan(0);
    expect(route.driveMinutes).toBe(Math.round((route.driveKm / 40) * 60));
    expect(route.visitMinutes).toBeGreaterThan(0);
  });

  it('leaves out peaks, huts and high places: they are hikes, not stops on a drive', () => {
    const places = [
      place('peak', 42.7, 44.5, 10),
      place('hut', 42.7, 44.51, 9),
      place('lake', 42.71, 44.52, 9, { elevation_m: 2900 }),
      place('monastery', 42.66, 44.62, 8),
      place('viewpoint', 42.6, 44.6, 4),
      place('castle', 42.5, 44.7, 4),
    ];
    const [route] = planDayRoutes(places);
    expect(route.stops.map((s) => s.kind).sort()).toEqual(['castle', 'monastery', 'viewpoint']);
  });

  it('makes no route from fewer than three sights close together', () => {
    const places = [place('waterfall', 42.0, 42.0, 9), place('lake', 42.01, 42.01, 5), place('cave', 43.0, 46.0, 5)];
    expect(planDayRoutes(places)).toEqual([]);
  });

  it('does not reuse a stop in a second route', () => {
    const west = [place('canyon', 42.4, 42.3, 9), place('waterfall', 42.42, 42.32, 5), place('cave', 42.38, 42.35, 5)];
    const east = [place('castle', 41.9, 45.5, 8), place('monastery', 41.92, 45.52, 4), place('tower', 41.88, 45.55, 4)];
    const routes = planDayRoutes([...west, ...east]);
    expect(routes).toHaveLength(2);
    const ids = routes.flatMap((r) => r.stops.map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('routeSummary', () => {
  it('counts the kinds in words', () => {
    expect(routeSummary([{ kind: 'waterfall' }, { kind: 'canyon' }, { kind: 'waterfall' }, { kind: 'monastery' }])).toBe(
      'Two waterfalls, a canyon and a monastery',
    );
    expect(routeSummary([{ kind: 'cave' }])).toBe('A cave');
    expect(routeSummary([{ kind: 'cave' }, { kind: 'canyon' }, { kind: 'waterfall' }, { kind: 'canyon' }])).toBe(
      'Two canyons, a cave and a waterfall',
    );
  });
});

describe('routeDirectionsUrl', () => {
  it('opens Google Maps with every stop on the way, from where the phone is', () => {
    const url = routeDirectionsUrl([
      { latitude: 42.1, longitude: 42.2 },
      { latitude: 42.3, longitude: 42.4 },
      { latitude: 42.5, longitude: 42.6 },
    ]);
    expect(url).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=42.500000,42.600000&waypoints=42.100000%2C42.200000%7C42.300000%2C42.400000&travelmode=driving',
    );
  });

  it('can start from a given point', () => {
    expect(routeDirectionsUrl([{ latitude: 42.5, longitude: 42.6 }], TBILISI)).toBe(
      'https://www.google.com/maps/dir/?api=1&origin=41.715100,44.827100&destination=42.500000,42.600000&travelmode=driving',
    );
  });
});

describe('formatMinutes', () => {
  it('rounds to five minutes', () => {
    expect(formatMinutes(44)).toBe('45 min');
    expect(formatMinutes(60)).toBe('1 h');
    expect(formatMinutes(131)).toBe('2 h 10 min');
    expect(formatMinutes(1)).toBe('5 min');
  });
});
