import { MMKV } from 'react-native-mmkv';
import { createSyncStoragePersister } from '@tanstack/react-query-persist-client';

const mmkv = new MMKV({ id: 'query-cache' });

export const queryPersister = createSyncStoragePersister({
  storage: {
    setItem: (key, value) => mmkv.set(key, value),
    getItem: (key) => mmkv.getString(key) ?? null,
    removeItem: (key) => mmkv.delete(key),
  },
});
