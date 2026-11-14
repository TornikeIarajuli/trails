import { cardDate, cardStats, routeDrawing, titleFontSize, wrapTitle } from '../../utils/shareCard';

const BOX = { x: 100, y: 200, size: 800 };

describe('routeDrawing', () => {
  it('draws north up and keeps the shape, centred in the box', () => {
    // A route going straight north: a vertical line through the middle of the box
    const drawing = routeDrawing(
      [
        { lat: 42.0, lng: 44.0 },
        { lat: 42.01, lng: 44.0 },
      ],
      BOX,
    )!;
    expect(drawing.start).toEqual({ x: 500, y: 1000 }); // south end at the bottom
    expect(drawing.end).toEqual({ x: 500, y: 200 }); // north end at the top
    expect(drawing.d).toBe('M500 1000 L500 200');
  });

  it('measures east-west in metres, not degrees', () => {
    // 0.01° of longitude at 42°N is about 0.74 of 0.01° of latitude
    const drawing = routeDrawing(
      [
        { lat: 42.0, lng: 44.0 },
        { lat: 42.01, lng: 44.01 },
      ],
      BOX,
    )!;
    const width = drawing.end.x - drawing.start.x;
    const height = drawing.start.y - drawing.end.y;
    expect(width / height).toBeCloseTo(Math.cos((42.005 * Math.PI) / 180), 1);
  });

  it('keeps long tracks light, with their first and last points', () => {
    const points = Array.from({ length: 5000 }, (_, i) => ({ lat: 42 + i / 100000, lng: 44 + Math.sin(i / 50) / 1000 }));
    const drawing = routeDrawing(points, BOX, 300)!;
    expect(drawing.d.split(' L').length).toBe(300);
  });

  it('draws nothing without at least two points', () => {
    expect(routeDrawing([], BOX)).toBeNull();
    expect(routeDrawing([{ lat: 42, lng: 44 }], BOX)).toBeNull();
    expect(routeDrawing([{ lat: 42, lng: 44 }, { lat: 42, lng: 44 }], BOX)).toBeNull();
  });
});

describe('title', () => {
  it('wraps a long trail name evenly over two lines and cuts what does not fit', () => {
    expect(wrapTitle('Juta to Roshka via Chaukhi Pass', 21, 2)).toEqual(['Juta to Roshka', 'via Chaukhi Pass']);
    expect(wrapTitle('Mestia to Ushguli trek through the four villages of Upper Svaneti', 21, 2)).toEqual([
      'Mestia to Ushguli',
      'trek through the four…',
    ]);
    expect(wrapTitle('Gergeti', 18, 2)).toEqual(['Gergeti']);
  });

  it('gets smaller for longer names', () => {
    expect(titleFontSize('Gergeti Trinity')).toBeGreaterThan(titleFontSize('Juta to Roshka via Chaukhi'));
    expect(titleFontSize('Juta to Roshka via Chaukhi')).toBeGreaterThan(titleFontSize('Mestia to Ushguli through the villages'));
  });
});

describe('cardStats', () => {
  it('shows distance, ascent and a real time', () => {
    expect(cardStats({ distanceKm: 12.4, ascentM: 1210, elapsedSeconds: 5 * 3600 + 20 * 60, timeIsReal: true })).toEqual([
      { value: '12 km', label: 'Distance' },
      { value: '1,210 m', label: 'Ascent' },
      { value: '5h 20m', label: 'Time' },
    ]);
    expect(cardStats({ distanceKm: 8.6, ascentM: null, elapsedSeconds: null, timeIsReal: false })).toEqual([
      { value: '8.6 km', label: 'Distance' },
    ]);
  });

  it('leaves out a time that is not real (testing, a recording that stopped early)', () => {
    const stats = cardStats({ distanceKm: 19.8, ascentM: 1223, elapsedSeconds: 38, timeIsReal: false });
    expect(stats.map((s) => s.label)).toEqual(['Distance', 'Ascent']);
  });
});

describe('cardDate', () => {
  it('reads like a date, or a year for a hike before the app', () => {
    expect(cardDate('2026-11-14T08:00:00Z')).toMatch(/^1[34] November 2026$/);
    expect(cardDate('2019-01-01T12:00:00Z', true)).toBe('2019');
    expect(cardDate(null)).toBe('');
  });
});
