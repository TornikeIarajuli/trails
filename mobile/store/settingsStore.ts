import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Language = 'en' | 'ka';
export type GpsAccuracy = 'low' | 'balanced' | 'high';

const STORAGE_KEY = 'app_settings';

interface SettingsState {
  language: Language;
  isDarkMode: boolean;
  hasSeenOnboarding: boolean;
  gpsAccuracy: GpsAccuracy;
  _hydrated: boolean;
  setLanguage: (lang: Language) => void;
  toggleDarkMode: () => void;
  setHasSeenOnboarding: () => void;
  setGpsAccuracy: (accuracy: GpsAccuracy) => void;
  hydrate: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  language: 'en',
  isDarkMode: false,
  hasSeenOnboarding: false,
  gpsAccuracy: 'balanced',
  _hydrated: false,

  setLanguage: (language) => {
    set({ language });
    persist(get());
  },

  toggleDarkMode: () => {
    set((state) => ({ isDarkMode: !state.isDarkMode }));
    persist(get());
  },

  setHasSeenOnboarding: () => {
    set({ hasSeenOnboarding: true });
    persist(get());
  },

  setGpsAccuracy: (gpsAccuracy) => {
    set({ gpsAccuracy });
    persist(get());
  },

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        set({
          language: data.language ?? 'en',
          isDarkMode: data.isDarkMode ?? false,
          hasSeenOnboarding: data.hasSeenOnboarding ?? false,
          gpsAccuracy: data.gpsAccuracy ?? 'balanced',
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

function persist(state: SettingsState) {
  const { language, isDarkMode, hasSeenOnboarding, gpsAccuracy } = state;
  AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ language, isDarkMode, hasSeenOnboarding, gpsAccuracy }),
  ).catch(() => {});
}
