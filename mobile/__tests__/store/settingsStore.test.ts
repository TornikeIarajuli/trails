/**
 * settingsStore unit tests
 *
 * AsyncStorage is auto-mocked via the moduleNameMapper in jest.config.js,
 * so no real storage I/O occurs.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettingsStore } from '../../store/settingsStore';

const STORAGE_KEY = 'app_settings';

// Typed references to the mock
const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;

// Reset store data fields before each test
const INITIAL = {
  language: 'en' as const,
  isDarkMode: false,
  hasSeenOnboarding: false,
  _hydrated: false,
};

const store = () => useSettingsStore.getState();

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState(INITIAL);
});

// ---------------------------------------------------------------------------
// setLanguage
// ---------------------------------------------------------------------------
describe('setLanguage', () => {
  it('updates language in the store', () => {
    store().setLanguage('ka');
    expect(store().language).toBe('ka');
  });

  it('persists the new language to AsyncStorage', () => {
    store().setLanguage('ka');
    expect(mockSetItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      expect.stringContaining('"language":"ka"'),
    );
  });

  it('can switch back to English', () => {
    store().setLanguage('ka');
    store().setLanguage('en');
    expect(store().language).toBe('en');
  });
});

// ---------------------------------------------------------------------------
// toggleDarkMode
// ---------------------------------------------------------------------------
describe('toggleDarkMode', () => {
  it('flips isDarkMode from false to true', () => {
    store().toggleDarkMode();
    expect(store().isDarkMode).toBe(true);
  });

  it('flips isDarkMode from true back to false', () => {
    useSettingsStore.setState({ isDarkMode: true });
    store().toggleDarkMode();
    expect(store().isDarkMode).toBe(false);
  });

  it('persists the toggled value to AsyncStorage', () => {
    store().toggleDarkMode();
    expect(mockSetItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      expect.stringContaining('"isDarkMode":true'),
    );
  });
});

// ---------------------------------------------------------------------------
// setHasSeenOnboarding
// ---------------------------------------------------------------------------
describe('setHasSeenOnboarding', () => {
  it('sets hasSeenOnboarding to true', () => {
    store().setHasSeenOnboarding();
    expect(store().hasSeenOnboarding).toBe(true);
  });

  it('persists to AsyncStorage', () => {
    store().setHasSeenOnboarding();
    expect(mockSetItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      expect.stringContaining('"hasSeenOnboarding":true'),
    );
  });
});

// ---------------------------------------------------------------------------
// hydrate
// ---------------------------------------------------------------------------
describe('hydrate', () => {
  it('loads saved settings from AsyncStorage', async () => {
    mockGetItem.mockResolvedValueOnce(
      JSON.stringify({ language: 'ka', isDarkMode: true, hasSeenOnboarding: true }),
    );
    await store().hydrate();
    expect(store().language).toBe('ka');
    expect(store().isDarkMode).toBe(true);
    expect(store().hasSeenOnboarding).toBe(true);
  });

  it('sets _hydrated to true after loading saved data', async () => {
    mockGetItem.mockResolvedValueOnce(
      JSON.stringify({ language: 'en', isDarkMode: false, hasSeenOnboarding: false }),
    );
    await store().hydrate();
    expect(store()._hydrated).toBe(true);
  });

  it('sets _hydrated to true when AsyncStorage returns null (first launch)', async () => {
    mockGetItem.mockResolvedValueOnce(null);
    await store().hydrate();
    expect(store()._hydrated).toBe(true);
  });

  it('keeps default values when AsyncStorage returns null', async () => {
    mockGetItem.mockResolvedValueOnce(null);
    await store().hydrate();
    expect(store().language).toBe('en');
    expect(store().isDarkMode).toBe(false);
    expect(store().hasSeenOnboarding).toBe(false);
  });

  it('sets _hydrated to true even when AsyncStorage throws', async () => {
    mockGetItem.mockRejectedValueOnce(new Error('Storage error'));
    await store().hydrate();
    expect(store()._hydrated).toBe(true);
  });

  it('applies defaults for missing fields in partial stored data', async () => {
    mockGetItem.mockResolvedValueOnce(JSON.stringify({ language: 'ka' }));
    await store().hydrate();
    expect(store().language).toBe('ka');
    expect(store().isDarkMode).toBe(false);
    expect(store().hasSeenOnboarding).toBe(false);
  });
});
