/** Tonight's sky (dark hours, moon, cloud) and the forecast card's hour-by-hour strip. */
import { hourInstant, hourlyCells, nightSky, placeNoon, SKY_LABEL } from '../../utils/sky';
import type { HourForecast } from '../../services/forecast';

const GEORGIA = 4 * 3600;
const PLACE = { latitude: 42.5, longitude: 44.7 };

/** Hourly forecast from local midnight of `start`, `days` long. */
function hoursFrom(start: string, days: number, extra: Partial<HourForecast> = {}): HourForecast[] {
  const t0 = Date.parse(`${start}T00:00:00Z`);
  return Array.from({ length: days * 24 }, (_, i) => ({
    time: new Date(t0 + i * 3_600_000).toISOString().slice(0, 16),
    tempC: 5,
    feelsC: 3,
    precipMm: 0,
    precipProbability: 0,
    snowCm: 0,
    weathercode: 0,
    visibilityM: 30000,
    windKmh: 5,
    gustKmh: 10,
    freezingLevelM: 3000,
    cloudCover: 0,
    pressureHpa: 800,
    ...extra,
  }));
}

describe('time at the place', () => {
  it('turns local dates and hours into instants', () => {
    expect(placeNoon('2026-11-20', GEORGIA).toISOString()).toBe('2026-11-20T08:00:00.000Z');
    expect(hourInstant('2026-11-20T21:00', GEORGIA).toISOString()).toBe('2026-11-20T17:00:00.000Z');
  });
});

describe('nightSky', () => {
  it('rates a clear, moonless night as great for stars', () => {
    // New moon: 8 April 2024
    const sky = nightSky('2024-04-08', hoursFrom('2024-04-08', 2), PLACE.latitude, PLACE.longitude, GEORGIA)!;
    expect(sky.rating).toBe('excellent');
    expect(sky.reason).toBe('Clear sky, no moon');
    expect(sky.moonPhase).toBe('New moon');
    expect(sky.moonPercent).toBe(0);
    expect(sky.cloudPercent).toBe(0);
    expect(sky.darkFrom).toMatch(/^2[01]:\d{2}$/);
    expect(sky.darkUntil).toMatch(/^0[45]:\d{2}$/);
  });

  it('marks a full moon up all night down, even with a clear sky', () => {
    const sky = nightSky('2024-04-23', hoursFrom('2024-04-23', 2), PLACE.latitude, PLACE.longitude, GEORGIA)!;
    expect(sky.moonPhase).toBe('Full moon');
    expect(sky.moonPercent).toBeGreaterThanOrEqual(99);
    expect(sky.reason).toMatch(/^Clear sky, 100% moon (all|part of the) night$/);
    expect(sky.rating).not.toBe('excellent');
    expect(sky.score).toBeLessThanOrEqual(45);
  });

  it('says overcast is poor, whatever the moon', () => {
    const sky = nightSky('2024-04-08', hoursFrom('2024-04-08', 2, { cloudCover: 100 }), PLACE.latitude, PLACE.longitude, GEORGIA)!;
    expect(sky.rating).toBe('poor');
    expect(sky.reason).toBe('Overcast, no moon');
    expect(SKY_LABEL[sky.rating]).toBe('Poor night for stars');
  });

  it('says when the forecast has no cloud cover', () => {
    const sky = nightSky('2024-04-08', hoursFrom('2024-04-08', 2, { cloudCover: undefined }), PLACE.latitude, PLACE.longitude, GEORGIA)!;
    expect(sky.cloudPercent).toBeNull();
    expect(sky.reason).toBe('Cloud unknown, no moon');
  });

  it('gives nothing for a night the forecast does not reach', () => {
    expect(nightSky('2024-04-10', hoursFrom('2024-04-08', 2), PLACE.latitude, PLACE.longitude, GEORGIA)).toBeNull();
  });
});

describe('hourlyCells', () => {
  const hours = hoursFrom('2026-11-20', 3);

  it('shows the next 24 hours today, from the hour we are in', () => {
    const now = Date.parse('2026-11-20T06:30:00Z'); // 10:30 at the place
    const cells = hourlyCells(hours, '2026-11-20', true, GEORGIA, now);
    expect(cells).toHaveLength(24);
    expect(cells[0].hour).toBe('10');
    expect(cells[23].time).toBe('2026-11-21T09:00');
  });

  it('shows 06:00 to 21:00 for another day', () => {
    const cells = hourlyCells(hours, '2026-11-21', false, GEORGIA);
    expect(cells.map((c) => c.hour)).toEqual(['06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21']);
    expect(cells[0]).toEqual({ hour: '06', time: '2026-11-21T06:00', tempC: 5, weathercode: 0, precipProbability: 0, gustKmh: 10 });
  });
});
