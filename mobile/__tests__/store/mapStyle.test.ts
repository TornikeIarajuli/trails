import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettingsStore } from '../../store/settingsStore';

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;
const store = () => useSettingsStore.getState();

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState({ mapStyle: 'standard', _hydrated: false });
});

describe('map style setting', () => {
  it('starts on the standard map', () => {
    expect(store().mapStyle).toBe('standard');
  });

  it('switches to topo and saves the choice with the other settings', () => {
    store().setMapStyle('topo');
    expect(store().mapStyle).toBe('topo');
    expect(mockSetItem).toHaveBeenCalledWith('app_settings', expect.stringContaining('"mapStyle":"topo"'));
  });

  it('keeps the map style when another setting is saved', () => {
    store().setMapStyle('topo');
    store().toggleDarkMode();
    expect(mockSetItem).toHaveBeenLastCalledWith('app_settings', expect.stringContaining('"mapStyle":"topo"'));
  });

  it('restores a saved topo choice', async () => {
    mockGetItem.mockResolvedValueOnce(JSON.stringify({ language: 'en', mapStyle: 'topo' }));
    await store().hydrate();
    expect(store().mapStyle).toBe('topo');
  });

  it('falls back to the standard map for settings saved before the option existed, or unknown values', async () => {
    useSettingsStore.setState({ mapStyle: 'topo' });
    mockGetItem.mockResolvedValueOnce(JSON.stringify({ language: 'ka' }));
    await store().hydrate();
    expect(store().mapStyle).toBe('standard');

    mockGetItem.mockResolvedValueOnce(JSON.stringify({ mapStyle: 'satellite' }));
    await store().hydrate();
    expect(store().mapStyle).toBe('standard');
  });
});
