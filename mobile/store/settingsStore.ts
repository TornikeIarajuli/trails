import { create } from 'zustand';

type Language = 'en' | 'ka';

interface SettingsState {
  language: Language;
  setLanguage: (lang: Language) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  language: 'en',
  setLanguage: (language) => set({ language }),
}));
