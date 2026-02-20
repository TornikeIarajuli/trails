import { useSettingsStore } from '../store/settingsStore';

const shared = {
  accent: '#D4A017',
  accentLight: '#E6B422',

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
  primary: '#A0522D',
  primaryLight: '#C4825A',
  primaryDark: '#6B3A1F',

  background: '#FAF6F1',
  surface: '#FFFFFF',
  card: '#FFFFFF',

  text: '#2C1A0E',
  textSecondary: '#7A6555',
  textLight: '#A89585',

  border: '#E6DDD4',
  borderLight: '#F2EDE8',
} as const;

export const DarkColors = {
  ...shared,
  primary: '#C4825A',
  primaryLight: '#D9A882',
  primaryDark: '#A0522D',

  background: '#1A1410',
  surface: '#252018',
  card: '#302920',

  text: '#E8DDD0',
  textSecondary: '#B0A090',
  textLight: '#807060',

  border: '#3D3428',
  borderLight: '#332C22',
} as const;

export type ColorPalette = typeof LightColors;

// Static reference for non-component code
export const Colors = LightColors;

// Hook for components — returns the active palette based on theme
export function useColors(): ColorPalette {
  const isDarkMode = useSettingsStore((s) => s.isDarkMode);
  return isDarkMode ? DarkColors : LightColors;
}
