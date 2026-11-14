import { create } from 'zustand';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_THEME, THEMES, ThemeChoice, isThemeChoice, resolveThemeId } from '../constants/themes';

type Language = 'en' | 'ka';
export type GpsAccuracy = 'low' | 'balanced' | 'high';
/** The base map on every map screen: the platform map, or OpenTopoMap's topographic tiles. */
export type MapStyle = 'standard' | 'topo';

const STORAGE_KEY = 'app_settings';

interface SettingsState {
  language: Language;
  /** The colour theme picked in Settings; 'auto' follows the phone's light/dark setting. */
  theme: ThemeChoice;
  /** Whether the theme on screen is dark. Follows `theme` (and the phone, for 'auto'). */
  isDarkMode: boolean;
  hasSeenOnboarding: boolean;
  gpsAccuracy: GpsAccuracy;
  mapStyle: MapStyle;
  _hydrated: boolean;
  setLanguage: (lang: Language) => void;
  setTheme: (theme: ThemeChoice) => void;
  /** Switches between the default light and dark themes (Slate and Night). */
  toggleDarkMode: () => void;
  setHasSeenOnboarding: () => void;
  setGpsAccuracy: (accuracy: GpsAccuracy) => void;
  setMapStyle: (style: MapStyle) => void;
  hydrate: () => Promise<void>;
}

function phoneScheme(): string | null | undefined {
  try {
    return Appearance.getColorScheme();
  } catch {
    return null; // No appearance information: treat the phone as light
  }
}

/** Whether a theme choice shows a dark theme; for 'auto', per the phone's setting. */
function choiceIsDark(theme: ThemeChoice, scheme: string | null | undefined = phoneScheme()): boolean {
  return THEMES[resolveThemeId(theme, scheme)].dark;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  language: 'en',
  theme: DEFAULT_THEME,
  isDarkMode: false,
  hasSeenOnboarding: false,
  gpsAccuracy: 'balanced',
  mapStyle: 'standard',
  _hydrated: false,

  setLanguage: (language) => {
    set({ language });
    persist(get());
  },

  setTheme: (theme) => {
    set({ theme, isDarkMode: choiceIsDark(theme) });
    persist(get());
  },

  toggleDarkMode: () => {
    get().setTheme(get().isDarkMode ? 'slate' : 'night');
  },

  setHasSeenOnboarding: () => {
    set({ hasSeenOnboarding: true });
    persist(get());
  },

  setGpsAccuracy: (gpsAccuracy) => {
    set({ gpsAccuracy });
    persist(get());
  },

  setMapStyle: (mapStyle) => {
    set({ mapStyle });
    persist(get());
  },

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        // Settings saved before themes existed only know dark mode on or off
        const theme: ThemeChoice = isThemeChoice(data.theme)
          ? data.theme
          : data.isDarkMode
            ? 'night'
            : DEFAULT_THEME;
        set({
          language: data.language ?? 'en',
          theme,
          isDarkMode: choiceIsDark(theme),
          hasSeenOnboarding: data.hasSeenOnboarding ?? false,
          gpsAccuracy: data.gpsAccuracy ?? 'balanced',
          mapStyle: data.mapStyle === 'topo' ? 'topo' : 'standard',
          _hydrated: true,
        });
      } else {
        set({ _hydrated: true });
      }
    } catch {
      set({ _hydrated: true });
    }
  },
}));

// "Automatic" follows the phone: keep isDarkMode (the status bar, date pickers) in step with it
try {
  Appearance.addChangeListener(({ colorScheme }) => {
    const { theme, isDarkMode } = useSettingsStore.getState();
    const dark = choiceIsDark(theme, colorScheme);
    if (dark !== isDarkMode) useSettingsStore.setState({ isDarkMode: dark });
  });
} catch {
  // No appearance events here (tests): nothing to follow
}

function persist(state: SettingsState) {
  const { language, theme, isDarkMode, hasSeenOnboarding, gpsAccuracy, mapStyle } = state;
  AsyncStorage.setItem(
    STORAGE_KEY,
    // isDarkMode is still written so that an older version of the app reads a sensible value
    JSON.stringify({ language, theme, isDarkMode, hasSeenOnboarding, gpsAccuracy, mapStyle }),
  ).catch(() => {});
}
