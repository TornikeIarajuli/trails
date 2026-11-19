/** Sun and moon from first principles: checked against known times and phases. */
import {
  localClock,
  moonIllumination,
  moonPhaseName,
  moonTimes,
  sunAltitude,
  sunTimes,
} from '../../utils/astronomy';

const CHAUKHI = { latitude: 42.517, longitude: 44.683 };
const GEORGIA = 4 * 3600;
const minutesOf = (clock: string | null) => {
  const [h, m] = clock!.split(':').map(Number);
  return h * 60 + m;
};

describe('sunTimes', () => {
  // Local noon at Chaukhi, 20 November 2026
  const noon = new Date('2026-11-20T08:00:00Z');
  const sun = sunTimes(noon, CHAUKHI.latitude, CHAUKHI.longitude);

  it('puts sunrise near 08:00 and sunset near 17:35 at Chaukhi in late November', () => {
    expect(Math.abs(minutesOf(localClock(sun.sunrise, GEORGIA)) - (7 * 60 + 59))).toBeLessThanOrEqual(5);
    expect(Math.abs(minutesOf(localClock(sun.sunset, GEORGIA)) - (17 * 60 + 35))).toBeLessThanOrEqual(5);
  });

  it('has the sun at its highest at solar noon, about 12:47 local', () => {
    expect(Math.abs(minutesOf(localClock(sun.solarNoon, GEORGIA)) - (12 * 60 + 47))).toBeLessThanOrEqual(3);
    const top = sunAltitude(sun.solarNoon, CHAUKHI.latitude, CHAUKHI.longitude);
    const hourEarlier = sunAltitude(new Date(sun.solarNoon.getTime() - 3_600_000), CHAUKHI.latitude, CHAUKHI.longitude);
    expect(top).toBeGreaterThan(hourEarlier);
    // 90° - latitude + declination (about -20° in late November)
    expect(top).toBeGreaterThan(26);
    expect(top).toBeLessThan(29);
  });

  it('orders the day: dark, dawn, sunrise, golden hour, noon, golden hour, sunset, dusk, dark', () => {
    const order = [
      sun.nightEnd,
      sun.civilDawn,
      sun.sunrise,
      sun.goldenMorningEnd,
      sun.solarNoon,
      sun.goldenEveningStart,
      sun.sunset,
      sun.civilDusk,
      sun.nightStart,
    ].map((d) => d!.getTime());
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('has the sun just below the horizon at sunrise (refraction and the disc)', () => {
    // Within a couple of minutes: the sun climbs about 0.17° a minute here
    expect(Math.abs(sunAltitude(sun.sunrise!, CHAUKHI.latitude, CHAUKHI.longitude) + 0.833)).toBeLessThan(0.4);
  });

  it('gives no sunset where the sun never sets (midsummer, far north)', () => {
    const polar = sunTimes(new Date('2026-06-21T12:00:00Z'), 78.2, 15.6);
    expect(polar.sunrise).toBeNull();
    expect(polar.sunset).toBeNull();
  });
});

describe('the moon', () => {
  it('is new at the solar eclipse of 8 April 2024', () => {
    const moon = moonIllumination(new Date('2024-04-08T18:21:00Z'));
    expect(moon.fraction).toBeLessThan(0.01);
    expect(moon.name).toBe('New moon');
  });

  it('is full on 23 April 2024', () => {
    const moon = moonIllumination(new Date('2024-04-23T23:49:00Z'));
    expect(moon.fraction).toBeGreaterThan(0.99);
    expect(moon.name).toBe('Full moon');
  });

  it('names the phases around the cycle', () => {
    expect(moonPhaseName(0)).toBe('New moon');
    expect(moonPhaseName(0.1)).toBe('Waxing crescent');
    expect(moonPhaseName(0.25)).toBe('First quarter');
    expect(moonPhaseName(0.4)).toBe('Waxing gibbous');
    expect(moonPhaseName(0.5)).toBe('Full moon');
    expect(moonPhaseName(0.6)).toBe('Waning gibbous');
    expect(moonPhaseName(0.75)).toBe('Last quarter');
    expect(moonPhaseName(0.9)).toBe('Waning crescent');
    expect(moonPhaseName(0.99)).toBe('New moon');
  });

  it('rises around sunset and sets around sunrise when full', () => {
    const times = moonTimes(new Date('2024-04-23T20:00:00Z'), CHAUKHI.latitude, CHAUKHI.longitude);
    expect(times.alwaysUp || times.alwaysDown).toBe(false);
    // Full moon on 23 April: it sets the next morning, local time
    const set = minutesOf(localClock(times.set, GEORGIA));
    expect(set).toBeGreaterThan(5 * 60);
    expect(set).toBeLessThan(8 * 60 + 30);
  });
});

describe('localClock', () => {
  it('shows an instant on the place\'s clock', () => {
    expect(localClock(new Date('2026-11-20T03:57:00Z'), GEORGIA)).toBe('07:57');
    expect(localClock(new Date('2026-11-20T21:30:00Z'), GEORGIA)).toBe('01:30');
    expect(localClock(null, GEORGIA)).toBeNull();
  });
});
