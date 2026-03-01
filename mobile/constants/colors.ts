import { useSettingsStore } from '../store/settingsStore';

const shared = {
  accent: '#66BB6A',       // nature green — CTAs, badges, success highlights
  accentLight: '#81C784',

  textOnPrimary: '#FFFFFF',

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
} as const;

export const LightColors = {
  ...shared,
  primary: '#37474F',        // slate charcoal
  primaryLight: '#546E7A',   // blue-grey
  primaryDark: '#263238',    // deep slate

  background: '#F5F7F8',     // cool off-white
  surface: '#FFFFFF',
  card: '#FFFFFF',

  text: '#1C2B33',
  textSecondary: '#5C7A8A',
  textLight: '#90A4AE',

  border: '#D8E4EA',
  borderLight: '#EBF2F5',
} as const;

export const DarkColors = {
  ...shared,
  primary: '#78909C',
  primaryLight: '#90A4AE',
  primaryDark: '#546E7A',

  background: '#0F1719',
  surface: '#192428',
  card: '#1E2F35',

  text: '#E8F0F3',
  textSecondary: '#78909C',
  textLight: '#546E7A',

  border: '#2A3D45',
  borderLight: '#1E2F35',
} as const;

export type ColorPalette = typeof LightColors;

// Static reference for non-component code
export const Colors = LightColors;

// Hook for components — returns the active palette based on theme
export function useColors(): ColorPalette {
  const isDarkMode = useSettingsStore((s) => s.isDarkMode);
  return isDarkMode ? DarkColors : LightColors;
}
