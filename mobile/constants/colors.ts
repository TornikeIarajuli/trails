import { useColorScheme } from 'react-native';
import { useSettingsStore } from '../store/settingsStore';
import { ColorPalette, THEMES, ThemeId, resolveThemeId } from './themes';

export type { ColorPalette, ThemeChoice, ThemeDefinition, ThemeId } from './themes';
export { AUTO_THEMES, THEMES, THEME_ORDER, resolveThemeId } from './themes';

export const LightColors: ColorPalette = THEMES.slate.colors;
export const DarkColors: ColorPalette = THEMES.night.colors;

// Static reference for non-component code
export const Colors: ColorPalette = LightColors;

/** The theme on screen: the one picked in Settings, or for "Automatic" the phone's light/dark one. */
export function useThemeId(): ThemeId {
  const choice = useSettingsStore((s) => s.theme);
  const systemScheme = useColorScheme();
  return resolveThemeId(choice, systemScheme);
}

// Hook for components — returns the active palette based on theme
export function useColors(): ColorPalette {
  return THEMES[useThemeId()].colors;
}

/** Whether the theme on screen is a dark one. */
export function useIsDarkTheme(): boolean {
  return THEMES[useThemeId()].dark;
}
