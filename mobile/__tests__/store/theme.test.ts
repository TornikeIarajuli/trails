/**
 * The theme setting: choosing, saving, migrating from the old dark-mode switch, and
 * "Automatic" following the phone.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

type SchemeListener = (preferences: { colorScheme: 'light' | 'dark' | null | undefined }) => void;
const schemeListeners: SchemeListener[] = [];
let phoneScheme: 'light' | 'dark' | null = 'light';

jest.spyOn(Appearance, 'getColorScheme').mockImplementation(() => phoneScheme);
jest.spyOn(Appearance, 'addChangeListener').mockImplementation((listener) => {
  schemeListeners.push(listener as unknown as SchemeListener);
  return { remove: () => {} } as ReturnType<typeof Appearance.addChangeListener>;
});

// Loaded after the spies, so the store's listener is captured
const { useSettingsStore } = require('../../store/settingsStore') as typeof import('../../store/settingsStore');

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;
const store = () => useSettingsStore.getState();

/** The phone switches between light and dark. */
function phoneSwitchesTo(scheme: 'light' | 'dark') {
  phoneScheme = scheme;
  schemeListeners.forEach((listener) => listener({ colorScheme: scheme }));
}

beforeEach(() => {
  jest.clearAllMocks();
  phoneScheme = 'light';
  useSettingsStore.setState({ theme: 'slate', isDarkMode: false, _hydrated: false });
});

describe('choosing a theme', () => {
  it('starts on Slate, which is light', () => {
    expect(store().theme).toBe('slate');
    expect(store().isDarkMode).toBe(false);
  });

  it('applies and saves a light theme', () => {
    store().setTheme('kakheti');
    expect(store().theme).toBe('kakheti');
    expect(store().isDarkMode).toBe(false);
    expect(mockSetItem).toHaveBeenCalledWith('app_settings', expect.stringContaining('"theme":"kakheti"'));
  });

  it('applies a dark theme and reports dark mode to the status bar', () => {
    store().setTheme('midnight');
    expect(store().isDarkMode).toBe(true);
    expect(mockSetItem).toHaveBeenLastCalledWith('app_settings', expect.stringContaining('"isDarkMode":true'));
  });

  it('keeps the old dark-mode toggle meaningful: Slate and Night', () => {
    store().setTheme('forest');
    store().toggleDarkMode();
    expect(store().theme).toBe('night');
    store().toggleDarkMode();
    expect(store().theme).toBe('slate');
    store().setTheme('midnight');
    store().toggleDarkMode();
    expect(store().theme).toBe('slate');
  });
});

describe('restoring the theme', () => {
  it('turns the old dark-mode setting into Night or Slate', async () => {
    mockGetItem.mockResolvedValueOnce(JSON.stringify({ language: 'en', isDarkMode: true }));
    await store().hydrate();
    expect(store().theme).toBe('night');
    expect(store().isDarkMode).toBe(true);

    mockGetItem.mockResolvedValueOnce(JSON.stringify({ language: 'en', isDarkMode: false }));
    await store().hydrate();
    expect(store().theme).toBe('slate');
    expect(store().isDarkMode).toBe(false);
  });

  it('restores a saved theme, working out dark mode from it', async () => {
    mockGetItem.mockResolvedValueOnce(JSON.stringify({ theme: 'glacier', isDarkMode: true }));
    await store().hydrate();
    expect(store().theme).toBe('glacier');
    expect(store().isDarkMode).toBe(false);
  });

  it('ignores an unknown saved theme', async () => {
    mockGetItem.mockResolvedValueOnce(JSON.stringify({ theme: 'neon', isDarkMode: true }));
    await store().hydrate();
    expect(store().theme).toBe('night');
  });

  it('keeps Slate on a first launch', async () => {
    mockGetItem.mockResolvedValueOnce(null);
    await store().hydrate();
    expect(store().theme).toBe('slate');
    expect(store().isDarkMode).toBe(false);
  });
});

describe('Automatic', () => {
  it('is dark when the phone is dark', () => {
    phoneScheme = 'dark';
    store().setTheme('auto');
    expect(store().isDarkMode).toBe(true);
  });

  it('follows the phone switching between light and dark', () => {
    store().setTheme('auto');
    expect(store().isDarkMode).toBe(false);
    phoneSwitchesTo('dark');
    expect(store().isDarkMode).toBe(true);
    phoneSwitchesTo('light');
    expect(store().isDarkMode).toBe(false);
  });

  it('does not follow the phone for a picked theme', () => {
    store().setTheme('glacier');
    phoneSwitchesTo('dark');
    expect(store().isDarkMode).toBe(false);
    store().setTheme('night');
    phoneSwitchesTo('light');
    expect(store().isDarkMode).toBe(true);
  });

  it('is restored as Automatic, not as the theme it showed', async () => {
    phoneScheme = 'dark';
    mockGetItem.mockResolvedValueOnce(JSON.stringify({ theme: 'auto', isDarkMode: false }));
    await store().hydrate();
    expect(store().theme).toBe('auto');
    expect(store().isDarkMode).toBe(true);
  });
});
