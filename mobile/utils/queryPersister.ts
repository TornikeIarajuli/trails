import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'REACT_QUERY_OFFLINE_CACHE',
  // Serialising the cache runs on the JS thread; saving at most every 3 s (instead of every
  // second) keeps scrolling and navigation from hitching while data streams in.
  throttleTime: 3000,
});
