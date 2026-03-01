import { buildGpxString } from '../../utils/gpxExport';
import { GpsPoint } from '../../store/hikeStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const pt = (lat: number, lng: number, ts: number): GpsPoint => ({ lat, lng, timestamp: ts });

const SAMPLE_POINTS: GpsPoint[] = [
  pt(41.6941000, 44.8337000, 1_706_000_000_000),
  pt(41.7000000, 44.8400000, 1_706_000_060_000),
  pt(41.7060000, 44.8460000, 1_706_000_120_000),
];

// Count occurrences of a substring in a string
const countOccurrences = (str: string, sub: string): number =>
  (str.match(new RegExp(sub.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;

// ---------------------------------------------------------------------------
// GPX structure
// ---------------------------------------------------------------------------
describe('buildGpxString — structure', () => {
  it('begins with an XML declaration', () => {
    const gpx = buildGpxString('Test', SAMPLE_POINTS);
    expect(gpx.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });

  it('contains a GPX 1.1 root element with the correct namespace', () => {
    const gpx = buildGpxString('Test', SAMPLE_POINTS);
    expect(gpx).toContain('version="1.1"');
    expect(gpx).toContain('xmlns="http://www.topografix.com/GPX/1/1"');
  });

  it('wraps the track in <trk> … </trk>', () => {
    const gpx = buildGpxString('Test', SAMPLE_POINTS);
    expect(gpx).toContain('<trk>');
    expect(gpx).toContain('</trk>');
  });

  it('wraps track points in <trkseg> … </trkseg>', () => {
    const gpx = buildGpxString('Test', SAMPLE_POINTS);
    expect(gpx).toContain('<trkseg>');
    expect(gpx).toContain('</trkseg>');
  });

  it('includes the trail name inside <name>', () => {
    const gpx = buildGpxString('Kazbegi Summit Trek', SAMPLE_POINTS);
    expect(gpx).toContain('<name>Kazbegi Summit Trek</name>');
  });

  it('closes every opening tag', () => {
    const gpx = buildGpxString('Trail', SAMPLE_POINTS);
    expect(gpx).toContain('</gpx>');
    expect(gpx).toContain('</trk>');
    expect(gpx).toContain('</trkseg>');
  });
});

// ---------------------------------------------------------------------------
// Track points
// ---------------------------------------------------------------------------
describe('buildGpxString — track points', () => {
  it('generates exactly one <trkpt> element per GPS point', () => {
    const gpx = buildGpxString('Trail', SAMPLE_POINTS);
    expect(countOccurrences(gpx, '<trkpt')).toBe(3);
  });

  it('encodes latitude to 7 decimal places as a trkpt attribute', () => {
    const gpx = buildGpxString('Trail', SAMPLE_POINTS);
    expect(gpx).toContain('lat="41.6941000"');
  });

  it('encodes longitude to 7 decimal places as a trkpt attribute (lon, not lng)', () => {
    const gpx = buildGpxString('Trail', SAMPLE_POINTS);
    expect(gpx).toContain('lon="44.8337000"');
  });

  it('uses ISO 8601 UTC timestamps inside <time> elements', () => {
    const gpx = buildGpxString('Trail', SAMPLE_POINTS);
    // Each point must have a <time>…</time> block in ISO format
    expect(countOccurrences(gpx, '<time>')).toBe(3);
    expect(gpx).toMatch(/<time>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z<\/time>/);
  });

  it('converts the timestamp number to the correct ISO date string', () => {
    const knownTs = 1_706_000_000_000; // 2024-01-23T…
    const gpx = buildGpxString('Trail', [pt(41.0, 44.0, knownTs)]);
    const iso = new Date(knownTs).toISOString();
    expect(gpx).toContain(`<time>${iso}</time>`);
  });

  it('produces an empty <trkseg> when no GPS points are provided', () => {
    const gpx = buildGpxString('Empty Hike', []);
    expect(gpx).toContain('<trkseg>');
    expect(gpx).toContain('</trkseg>');
    expect(gpx).not.toContain('<trkpt');
  });

  it('handles a single GPS point', () => {
    const gpx = buildGpxString('Solo', [pt(42.0, 45.0, Date.now())]);
    expect(countOccurrences(gpx, '<trkpt')).toBe(1);
  });

  it('preserves point order (first point appears before last)', () => {
    const gpx = buildGpxString('Trail', SAMPLE_POINTS);
    const firstIdx = gpx.indexOf('lat="41.6941000"');
    const lastIdx = gpx.indexOf('lat="41.7060000"');
    expect(firstIdx).toBeLessThan(lastIdx);
  });
});

// ---------------------------------------------------------------------------
// XML escaping
// ---------------------------------------------------------------------------
describe('buildGpxString — XML escaping in trail name', () => {
  it('escapes & as &amp;', () => {
    const gpx = buildGpxString('Trail & Peaks', SAMPLE_POINTS);
    expect(gpx).toContain('<name>Trail &amp; Peaks</name>');
    expect(gpx).not.toContain('<name>Trail & Peaks</name>');
  });

  it('escapes < as &lt;', () => {
    const gpx = buildGpxString('Trail <Variant>', SAMPLE_POINTS);
    expect(gpx).toContain('Trail &lt;Variant&gt;');
  });

  it('escapes > as &gt;', () => {
    const gpx = buildGpxString('Grade > 5', SAMPLE_POINTS);
    expect(gpx).toContain('Grade &gt; 5');
  });

  it('escapes " as &quot;', () => {
    const gpx = buildGpxString('Trail "Alpha"', SAMPLE_POINTS);
    expect(gpx).toContain('Trail &quot;Alpha&quot;');
  });

  it("escapes ' as &apos;", () => {
    const gpx = buildGpxString("O'Brien Pass", SAMPLE_POINTS);
    expect(gpx).toContain("O&apos;Brien Pass");
  });

  it('handles a name containing multiple special characters', () => {
    const gpx = buildGpxString("Tom & Jerry's <Best> \"Trek\"", SAMPLE_POINTS);
    expect(gpx).toContain('Tom &amp; Jerry&apos;s &lt;Best&gt; &quot;Trek&quot;');
  });

  it('does not double-escape already-safe characters', () => {
    const gpx = buildGpxString('Simple Trail', SAMPLE_POINTS);
    expect(gpx).toContain('<name>Simple Trail</name>');
  });
});

// ---------------------------------------------------------------------------
// Large datasets
// ---------------------------------------------------------------------------
describe('buildGpxString — large datasets', () => {
  it('handles 500 GPS points without error', () => {
    const points = Array.from({ length: 500 }, (_, i) =>
      pt(41.0 + i * 0.001, 44.0 + i * 0.001, Date.now() + i * 5000),
    );
    const gpx = buildGpxString('Long Hike', points);
    expect(countOccurrences(gpx, '<trkpt')).toBe(500);
  });
});
