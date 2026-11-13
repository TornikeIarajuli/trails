import {
  clusterPoints,
  MIN_CLUSTER_LATITUDE_DELTA,
  regionForPoints,
} from '../../utils/mapClusters';

const GEORGIA = { latitude: 42.2, longitude: 43.5, latitudeDelta: 3.2, longitudeDelta: 6.5 };
const p = (id: string, latitude: number, longitude: number) => ({ id, latitude, longitude });

// Kazbegi area (close together) and Svaneti (far west)
const kazbegi = [p('gergeti', 42.6626, 44.6201), p('juta', 42.5809, 44.7454), p('truso', 42.6007, 44.4699)];
const svaneti = p('ushguli', 42.9159, 43.0161);

describe('clusterPoints', () => {
  it('groups pins that would overlap when the whole country is shown', () => {
    const clusters = clusterPoints([...kazbegi, svaneti], GEORGIA, 400, 300);
    const big = clusters.find((c) => c.points.length > 1);
    expect(big?.points.map((x) => x.id).sort()).toEqual(['gergeti', 'juta', 'truso']);
    expect(clusters.find((c) => c.key === 'ushguli')?.points).toHaveLength(1);
    expect(clusters).toHaveLength(2);
  });

  it('places a cluster at the average of its points', () => {
    const [cluster] = clusterPoints(kazbegi, GEORGIA, 400, 300);
    expect(cluster.latitude).toBeCloseTo((42.6626 + 42.5809 + 42.6007) / 3);
    expect(cluster.longitude).toBeCloseTo((44.6201 + 44.7454 + 44.4699) / 3);
    expect(cluster.key.startsWith('cluster:')).toBe(true);
  });

  it('separates the same pins once zoomed in', () => {
    const kazbegiView = { latitude: 42.62, longitude: 44.6, latitudeDelta: 0.4, longitudeDelta: 0.5 };
    expect(clusterPoints(kazbegi, kazbegiView, 400, 300)).toHaveLength(3);
  });

  it('never clusters when zoomed in past the threshold', () => {
    const twins = [p('a', 42.6, 44.6), p('b', 42.6, 44.6)];
    const close = { latitude: 42.6, longitude: 44.6, latitudeDelta: MIN_CLUSTER_LATITUDE_DELTA / 2, longitudeDelta: 0.03 };
    expect(clusterPoints(twins, close, 400, 300)).toHaveLength(2);
  });

  it('keeps clusters in place while panning at the same zoom', () => {
    const panned = { ...GEORGIA, longitude: GEORGIA.longitude + 0.7 };
    const keys = (r: typeof GEORGIA) => clusterPoints([...kazbegi, svaneti], r, 400, 300).map((c) => c.key).sort();
    expect(keys(panned)).toEqual(keys(GEORGIA));
  });

  it('skips points without coordinates and copes with an unmeasured map', () => {
    expect(clusterPoints([p('x', NaN, 44)], GEORGIA, 400, 300)).toEqual([]);
    expect(clusterPoints(kazbegi, GEORGIA, 0, 0)).toHaveLength(3);
  });
});

describe('regionForPoints', () => {
  it('fits all points with a margin', () => {
    const region = regionForPoints(kazbegi)!;
    expect(region.latitude).toBeCloseTo((42.6626 + 42.5809) / 2);
    expect(region.longitude).toBeCloseTo((44.7454 + 44.4699) / 2);
    expect(region.latitudeDelta).toBeCloseTo((42.6626 - 42.5809) * 1.6);
    expect(region.longitudeDelta).toBeCloseTo((44.7454 - 44.4699) * 1.6);
  });

  it('does not zoom in endlessly on points at the same spot', () => {
    const region = regionForPoints([p('a', 42.6, 44.6), p('b', 42.6, 44.6)])!;
    expect(region.latitudeDelta).toBeGreaterThan(0);
    expect(region.latitudeDelta).toBeLessThan(MIN_CLUSTER_LATITUDE_DELTA);
  });

  it('returns null without points', () => {
    expect(regionForPoints([])).toBeNull();
  });
});
