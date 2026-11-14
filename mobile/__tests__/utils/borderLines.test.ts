/**
 * The occupation line and state border check: distances on a synthetic map, the warning levels
 * with their hysteresis, the alert rules, and the bundled OpenStreetMap lines at places whose
 * answer is known.
 */
import {
  BORDER_WARN_M,
  IDLE_WATCH,
  LineCheck,
  LineData,
  OCCUPATION_CLOSE_M,
  OCCUPATION_WARN_M,
  REPEAT_AFTER_MS,
  aboutDistance,
  checkLines,
  describeLevel,
  nextLevel,
  ringFrom,
  watchStep,
} from '../../utils/borderLines';

// About 111 m per 0.001° of latitude; 0.001° of longitude is about 82 m at 42°N
const M_PER_DEG_LAT = 110540;

/** A synthetic map: an occupied square north of 42.1°N and a state border at 41.9°N. */
const square = (south: number, north: number, west: number, east: number): [number, number][] => [
  [west, south],
  [east, south],
  [east, north],
  [west, north],
  [west, south],
];
const MAP: LineData = {
  occupied: [{ name_en: 'Tskhinvali region', name_ka: 'ცხინვალის რეგიონი', rings: [ringFrom(square(42.1, 42.5, 43.5, 44.5))] }],
  border: [ringFrom(square(41.9, 43.5, 40, 47))],
};

/** A point due south of the occupied square, `m` metres from its southern edge. */
const southOfLine = (m: number) => 42.1 - m / M_PER_DEG_LAT;

describe('checkLines', () => {
  it('measures the distance to the occupation line', () => {
    const check = checkLines(southOfLine(800), 44.0, MAP);
    expect(check.occupation?.name_en).toBe('Tskhinvali region');
    expect(check.occupation?.inside).toBe(false);
    expect(check.occupation?.distanceM).toBeGreaterThan(780);
    expect(check.occupation?.distanceM).toBeLessThan(820);
  });

  it('knows when the point is past the line', () => {
    const check = checkLines(42.2, 44.0, MAP);
    expect(check.occupation).toEqual(expect.objectContaining({ inside: true, distanceM: 0 }));
  });

  it('measures the distance to the state border', () => {
    const check = checkLines(41.9 + 300 / M_PER_DEG_LAT, 45.5, MAP);
    expect(check.occupation).toBeNull();
    expect(check.borderM).toBeGreaterThan(280);
    expect(check.borderM).toBeLessThan(320);
  });

  it('reports nothing far from both', () => {
    expect(checkLines(42.0, 45.5, MAP)).toEqual({ occupation: null, borderM: null });
  });
});

const occupationAt = (distanceM: number, inside = false): LineCheck => ({
  occupation: { name_en: 'Tskhinvali region', name_ka: null, distanceM, inside },
  borderM: null,
});
const borderAt = (distanceM: number): LineCheck => ({ occupation: null, borderM: distanceM });
const nothing: LineCheck = { occupation: null, borderM: null };

describe('nextLevel', () => {
  it('starts each warning at its distance', () => {
    expect(nextLevel(occupationAt(OCCUPATION_WARN_M + 10), 'none')).toBe('none');
    expect(nextLevel(occupationAt(OCCUPATION_WARN_M - 10), 'none')).toBe('occupation');
    expect(nextLevel(occupationAt(OCCUPATION_CLOSE_M - 10), 'none')).toBe('occupation_close');
    expect(nextLevel(occupationAt(0, true), 'none')).toBe('occupation_close');
    expect(nextLevel(borderAt(BORDER_WARN_M - 10), 'none')).toBe('border');
    expect(nextLevel(borderAt(BORDER_WARN_M + 10), 'none')).toBe('none');
  });

  it('holds a warning until the hiker is half as far again, so GPS jitter does not flicker it', () => {
    expect(nextLevel(occupationAt(OCCUPATION_WARN_M + 200), 'occupation')).toBe('occupation');
    expect(nextLevel(occupationAt(OCCUPATION_WARN_M * 1.5 + 10), 'occupation')).toBe('none');
    expect(nextLevel(occupationAt(OCCUPATION_CLOSE_M + 100), 'occupation_close')).toBe('occupation_close');
    expect(nextLevel(occupationAt(800), 'occupation_close')).toBe('occupation');
  });

  it('puts the occupation line before the state border', () => {
    const both: LineCheck = { occupation: occupationAt(900).occupation, borderM: 100 };
    expect(nextLevel(both, 'none')).toBe('occupation');
  });
});

describe('watchStep', () => {
  it('alerts when the hiker gets closer, not while staying at the same level', () => {
    let step = watchStep(IDLE_WATCH, occupationAt(900), 0);
    expect(step).toEqual(expect.objectContaining({ alert: true }));
    expect(step.state.level).toBe('occupation');

    step = watchStep(step.state, occupationAt(850), 1000);
    expect(step.alert).toBe(false);

    step = watchStep(step.state, occupationAt(250), 2000);
    expect(step.alert).toBe(true);
    expect(step.state.level).toBe('occupation_close');
  });

  it('does not repeat a warning soon after leaving and coming back', () => {
    let step = watchStep(IDLE_WATCH, occupationAt(900), 0);
    step = watchStep(step.state, nothing, 60_000);
    expect(step.state.level).toBe('none');

    step = watchStep(step.state, occupationAt(900), 120_000);
    expect(step.alert).toBe(false);
    expect(step.state.level).toBe('occupation');

    step = watchStep(step.state, nothing, 180_000);
    step = watchStep(step.state, occupationAt(900), 180_000 + REPEAT_AFTER_MS);
    expect(step.alert).toBe(true);
  });
});

describe('describeLevel', () => {
  it('says how far and what to do', () => {
    expect(describeLevel('occupation', occupationAt(640))).toEqual({
      level: 'occupation',
      title: 'Occupation line about 650 m away',
      body: "Don't go further toward Tskhinvali region. The line is often not marked.",
    });
    expect(describeLevel('occupation_close', occupationAt(380))?.title).toBe('Occupation line about 400 m away');
    expect(describeLevel('occupation_close', occupationAt(0, true))?.title).toBe('You may have crossed the occupation line');
    expect(describeLevel('border', borderAt(410))?.title).toBe('State border about 400 m away');
    expect(describeLevel('none', nothing)).toBeNull();
  });

  it('rounds distances to 50 m and never says 0 m', () => {
    expect(aboutDistance(12)).toBe('about 50 m');
    expect(aboutDistance(1024)).toBe('about 1000 m');
  });
});

describe('the bundled lines', () => {
  it('know the occupied cities, and leave Tbilisi and Stepantsminda alone', () => {
    expect(checkLines(43.0015, 41.0234).occupation).toEqual(expect.objectContaining({ name_en: 'Abkhazia', inside: true })); // Sukhumi
    expect(checkLines(42.2256, 43.97).occupation).toEqual(expect.objectContaining({ name_en: 'Tskhinvali region', inside: true })); // Tskhinvali
    expect(nextLevel(checkLines(41.6934, 44.8015), 'none')).toBe('none'); // Tbilisi, Freedom Square
    expect(nextLevel(checkLines(42.6575, 44.6417), 'none')).toBe('none'); // Stepantsminda
  });
});
