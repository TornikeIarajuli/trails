import { useSettingsStore } from '../store/settingsStore';

const shared = {
  accent: '#FF6F00',
  accentLight: '#FFA726',

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
  primary: '#1B5E20',
  primaryLight: '#4CAF50',
  primaryDark: '#0D3B13',

  background: '#F5F5F5',
  surface: '#FFFFFF',
  card: '#FFFFFF',

  text: '#1A1A1A',
  textSecondary: '#666666',
  textLight: '#999999',

  border: '#E0E0E0',
  borderLight: '#F0F0F0',
} as const;

export const DarkColors = {
  ...shared,
  primary: '#2E7D32',
  primaryLight: '#66BB6A',
  primaryDark: '#1B5E20',

  background: '#121212',
  surface: '#1E1E1E',
  card: '#252525',

  text: '#E0E0E0',
  textSecondary: '#A0A0A0',
  textLight: '#757575',

  border: '#333333',
  borderLight: '#2A2A2A',
} as const;

export type ColorPalette = typeof LightColors;

// Static reference for non-component code
export const Colors = LightColors;

// Hook for components — returns the active palette based on theme
export function useColors(): ColorPalette {
  const isDarkMode = useSettingsStore((s) => s.isDarkMode);
  return isDarkMode ? DarkColors : LightColors;
}
