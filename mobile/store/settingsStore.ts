import { create } from 'zustand';

type Language = 'en' | 'ka';

interface SettingsState {
  language: Language;
  isDarkMode: boolean;
  setLanguage: (lang: Language) => void;
  toggleDarkMode: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  language: 'en',
  isDarkMode: false,
  setLanguage: (language) => set({ language }),
  toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
}));
