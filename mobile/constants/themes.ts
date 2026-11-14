/**
 * The app's colour themes. Every theme is a full palette with the same keys, so screens read
 * colours through useColors() and never need to know which theme is on. Colours are always
 * six-digit hex: screens add two-digit alpha suffixes (`Colors.primary + '15'`).
 *
 * Contrast (checked by __tests__/constants/themes.test.ts): text, textSecondary and textLight
 * reach 4.5:1 on background, surface and card; primary reaches 4.5:1 as text on those; and
 * textOnPrimary reaches 4.5:1 on primary. Light themes put white text on primary buttons.
 * Dark themes use a light primary with dark text on it: a primary dark enough for white text
 * could not also be read as text on a dark surface.
 */

export interface ColorPalette {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  background: string;
  surface: string;
  card: string;
  text: string;
  textSecondary: string;
  textLight: string;
  border: string;
  borderLight: string;
  /** Text and icons on a primary-coloured fill. */
  textOnPrimary: string;
  accent: string;
  accentLight: string;
  error: string;
  success: string;
  warning: string;
  difficulty: {
    easy: string;
    medium: string;
    hard: string;
    ultra: string;
  };
  checkpoint: {
    viewpoint: string;
    water_source: string;
    campsite: string;
    landmark: string;
    summit: string;
    shelter: string;
    bridge: string;
    pass: string;
    lake: string;
    waterfall: string;
    ruins: string;
    church: string;
    tower: string;
  };
}

/** The same in every theme: they carry meaning (difficulty, danger, kinds of places). */
const shared = {
  accent: '#66BB6A', // nature green: badges, success highlights
  accentLight: '#81C784',

  error: '#D32F2F',
  success: '#388E3C',
  warning: '#F57C00',

  difficulty: {
    easy: '#4CAF50',
    medium: '#FF9800',
    hard: '#F44336',
    ultra: '#9C27B0',
  },

  checkpoint: {
    viewpoint: '#2196F3',
    water_source: '#00BCD4',
    campsite: '#795548',
    landmark: '#FF9800',
    summit: '#F44336',
    shelter: '#607D8B',
    bridge: '#9E9E9E',
    pass: '#9C27B0',
    lake: '#03A9F4',
    waterfall: '#00BCD4',
    ruins: '#795548',
    church: '#FF5722',
    tower: '#607D8B',
  },
};

type ThemeColors = Omit<ColorPalette, keyof typeof shared>;

const palette = (colors: ThemeColors): ColorPalette => ({ ...shared, ...colors });

export type ThemeId = 'slate' | 'night' | 'forest' | 'glacier' | 'kakheti' | 'midnight';
/** What the user picks: a theme, or 'auto' to follow the phone's light/dark setting. */
export type ThemeChoice = ThemeId | 'auto';

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  /** Dark themes get light status-bar content and dark text on primary fills. */
  dark: boolean;
  colors: ColorPalette;
}

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  slate: {
    id: 'slate',
    name: 'Slate',
    dark: false,
    colors: palette({
      primary: '#37474F', // slate charcoal
      primaryLight: '#546E7A',
      primaryDark: '#263238',
      background: '#F5F7F8', // cool off-white
      surface: '#FFFFFF',
      card: '#FFFFFF',
      text: '#1C2B33',
      textSecondary: '#4A6572',
      textLight: '#56707D', // was #607D8B: 4.1:1 on the background, now 4.9:1
      border: '#D8E4EA',
      borderLight: '#EBF2F5',
      textOnPrimary: '#FFFFFF',
    }),
  },
  forest: {
    id: 'forest',
    name: 'Forest',
    dark: false,
    colors: palette({
      primary: '#2E6B3F', // deep pine green
      primaryLight: '#4E8A5C',
      primaryDark: '#1E4A2A',
      background: '#F3F6F1', // moss-tinted off-white
      surface: '#FFFFFF',
      card: '#FFFFFF',
      text: '#1A2A1E',
      textSecondary: '#4A5F50',
      textLight: '#5A6E5F',
      border: '#D5E2D4',
      borderLight: '#E7EFE6',
      textOnPrimary: '#FFFFFF',
    }),
  },
  glacier: {
    id: 'glacier',
    name: 'Glacier',
    dark: false,
    colors: palette({
      primary: '#1F5F8B', // alpine blue
      primaryLight: '#4A86B0',
      primaryDark: '#154566',
      background: '#F1F6FA', // icy white
      surface: '#FFFFFF',
      card: '#FFFFFF',
      text: '#16293A',
      textSecondary: '#455E77',
      textLight: '#55708A',
      border: '#D2E0EC',
      borderLight: '#E6EEF5',
      textOnPrimary: '#FFFFFF',
    }),
  },
  kakheti: {
    id: 'kakheti',
    name: 'Kakheti',
    dark: false,
    colors: palette({
      primary: '#7B2D3B', // Saperavi wine
      primaryLight: '#A24D5C',
      primaryDark: '#571C27',
      background: '#F6F1EB', // warm stone
      surface: '#FFFDF9',
      card: '#FFFDF9',
      text: '#2D2220',
      textSecondary: '#665650',
      textLight: '#776660',
      border: '#E6DBCF',
      borderLight: '#F0E8DE',
      textOnPrimary: '#FFFFFF',
    }),
  },
  night: {
    id: 'night',
    name: 'Night',
    dark: true,
    colors: palette({
      primary: '#8FB0C0', // was #78909C: brighter, so dark text on it reads and it reads as text
      primaryLight: '#A9C4D1',
      primaryDark: '#6F8F9F',
      background: '#0F1719',
      surface: '#192428',
      card: '#1E2F35',
      text: '#E8F0F3',
      textSecondary: '#A7BAC4', // was #78909C: 4.1:1 on cards, now 6.9:1
      textLight: '#8EA3AE',
      border: '#2A3D45',
      borderLight: '#1E2F35',
      textOnPrimary: '#0F1719',
    }),
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    dark: true,
    colors: palette({
      primary: '#4FD1C5', // glacier-lake teal
      primaryLight: '#7FE0D6',
      primaryDark: '#2BA89D',
      background: '#0B1420', // deep navy
      surface: '#132033',
      card: '#1A2B42',
      text: '#E6EEF7',
      textSecondary: '#A3B6CB',
      textLight: '#8EA3BA',
      border: '#24364F',
      borderLight: '#1A2B42',
      textOnPrimary: '#0B1420',
    }),
  },
};

/** The order themes are offered in: light ones first. */
export const THEME_ORDER: ThemeId[] = ['slate', 'forest', 'glacier', 'kakheti', 'night', 'midnight'];

/** What "Automatic" shows for the phone's light and dark setting. */
export const AUTO_THEMES: { light: ThemeId; dark: ThemeId } = { light: 'slate', dark: 'night' };

export const DEFAULT_THEME: ThemeId = 'slate';

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === 'auto' || (typeof value === 'string' && Object.prototype.hasOwnProperty.call(THEMES, value));
}

/** The theme actually shown for a choice, given the phone's colour scheme. */
export function resolveThemeId(choice: ThemeChoice, systemScheme: string | null | undefined): ThemeId {
  if (choice === 'auto') return systemScheme === 'dark' ? AUTO_THEMES.dark : AUTO_THEMES.light;
  return isThemeChoice(choice) ? choice : DEFAULT_THEME;
}
