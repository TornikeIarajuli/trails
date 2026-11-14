import {
  AUTO_THEMES,
  DEFAULT_THEME,
  THEMES,
  THEME_ORDER,
  ThemeId,
  isThemeChoice,
  resolveThemeId,
} from '../../constants/themes';
import { DARK_TINT_ALPHA, STATUS_TONES, statusTone } from '../../constants/statusTones';
import { blend, contrastRatio } from '../../utils/contrast';

const AA = 4.5;
const ids = Object.keys(THEMES) as ThemeId[];
const lightIds = ids.filter((id) => !THEMES[id].dark);
const darkIds = ids.filter((id) => THEMES[id].dark);

describe('theme set', () => {
  it('offers the six themes, light ones first, each once', () => {
    expect(THEME_ORDER).toEqual(['slate', 'forest', 'glacier', 'kakheti', 'night', 'midnight']);
    expect([...THEME_ORDER].sort()).toEqual([...ids].sort());
    expect(lightIds).toEqual(['slate', 'forest', 'glacier', 'kakheti']);
    expect(darkIds).toEqual(['night', 'midnight']);
  });

  it('gives every theme the same palette keys, all six-digit hex colours', () => {
    const keysOf = (o: object): string[] =>
      Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? keysOf(v).map((s) => `${k}.${s}`) : [k])).sort();
    const reference = keysOf(THEMES.slate.colors);
    for (const id of ids) {
      expect(keysOf(THEMES[id].colors)).toEqual(reference);
      const values = JSON.stringify(THEMES[id].colors).match(/"#[^"]*"/g) ?? [];
      expect(values.length).toBe(reference.length);
      for (const v of values) expect(v).toMatch(/^"#[0-9A-F]{6}"$/);
    }
  });

  it('keeps the meaningful colours (difficulty, places, warnings) the same in every theme', () => {
    for (const id of ids) {
      const c = THEMES[id].colors;
      const s = THEMES.slate.colors;
      expect([c.accent, c.accentLight, c.error, c.success, c.warning]).toEqual([
        s.accent,
        s.accentLight,
        s.error,
        s.success,
        s.warning,
      ]);
      expect(c.difficulty).toEqual(s.difficulty);
      expect(c.checkpoint).toEqual(s.checkpoint);
    }
  });

  it('keeps Slate as it was, apart from a more readable light text', () => {
    const s = THEMES.slate.colors;
    expect([s.primary, s.background, s.surface, s.text, s.textSecondary]).toEqual([
      '#37474F',
      '#F5F7F8',
      '#FFFFFF',
      '#1C2B33',
      '#4A6572',
    ]);
  });
});

describe.each(ids)('%s contrast', (id) => {
  const c = THEMES[id].colors;

  it.each([
    ['text', 'background'],
    ['text', 'surface'],
    ['text', 'card'],
    ['textSecondary', 'background'],
    ['textSecondary', 'surface'],
    ['textSecondary', 'card'],
    ['textLight', 'background'],
    ['textLight', 'surface'],
    ['textLight', 'card'],
    ['primary', 'surface'],
    ['primary', 'background'],
    ['primary', 'card'],
    ['textOnPrimary', 'primary'],
  ] as const)('%s on %s is at least 4.5:1', (fg, bg) => {
    expect(contrastRatio(c[fg], c[bg])).toBeGreaterThanOrEqual(AA);
  });
});

describe('text on primary', () => {
  it.each(lightIds)('%s puts white text on its primary colour', (id) => {
    expect(THEMES[id].colors.textOnPrimary).toBe('#FFFFFF');
    expect(contrastRatio('#FFFFFF', THEMES[id].colors.primary)).toBeGreaterThanOrEqual(AA);
  });

  it.each(darkIds)('%s puts dark text on its light primary colour', (id) => {
    const c = THEMES[id].colors;
    // A primary dark enough for white text could not be read as text on these dark surfaces
    expect(contrastRatio(c.textOnPrimary, c.background)).toBeLessThan(1.2);
    expect(contrastRatio(c.textOnPrimary, c.primary)).toBeGreaterThanOrEqual(AA);
  });
});

describe('status banners', () => {
  const statuses = Object.keys(STATUS_TONES);

  it.each(lightIds)('read on %s: dark tone and the theme’s secondary text on the pale panel', (id) => {
    for (const status of statuses) {
      const { backgroundColor, color } = statusTone(status, false);
      expect(contrastRatio(color, backgroundColor)).toBeGreaterThanOrEqual(AA);
      expect(contrastRatio(THEMES[id].colors.textSecondary, backgroundColor)).toBeGreaterThanOrEqual(AA);
    }
  });

  it.each(darkIds)('read on %s: light tone and the theme’s secondary text on the tinted panel', (id) => {
    const alpha = parseInt(DARK_TINT_ALPHA, 16) / 255;
    for (const status of statuses) {
      const { color } = statusTone(status, true);
      const panel = blend(color, THEMES[id].colors.background, alpha);
      expect(contrastRatio(color, panel)).toBeGreaterThanOrEqual(AA);
      expect(contrastRatio(THEMES[id].colors.textSecondary, panel)).toBeGreaterThanOrEqual(AA);
    }
  });

  it('falls back to the maintenance tone for an unknown status', () => {
    expect(statusTone('flooded', false)).toEqual(statusTone('maintenance', false));
  });
});

describe('resolveThemeId', () => {
  it('follows the phone for Automatic: Slate when light, Night when dark', () => {
    expect(AUTO_THEMES).toEqual({ light: 'slate', dark: 'night' });
    expect(resolveThemeId('auto', 'light')).toBe('slate');
    expect(resolveThemeId('auto', 'dark')).toBe('night');
    expect(resolveThemeId('auto', null)).toBe('slate');
    expect(resolveThemeId('auto', undefined)).toBe('slate');
  });

  it('uses a picked theme whatever the phone says', () => {
    expect(resolveThemeId('kakheti', 'dark')).toBe('kakheti');
    expect(resolveThemeId('midnight', 'light')).toBe('midnight');
  });

  it('falls back to Slate for anything unknown', () => {
    expect(DEFAULT_THEME).toBe('slate');
    expect(resolveThemeId('neon' as never, 'light')).toBe('slate');
    expect(isThemeChoice('auto')).toBe(true);
    expect(isThemeChoice('glacier')).toBe(true);
    expect(isThemeChoice('neon')).toBe(false);
    expect(isThemeChoice('toString')).toBe(false);
    expect(isThemeChoice(undefined)).toBe(false);
  });
});
