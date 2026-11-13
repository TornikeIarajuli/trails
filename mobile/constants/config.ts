const DEFAULT_API_BASE_URL = 'https://trails-en04.onrender.com/api';

// EXPO_PUBLIC_* variables are inlined at build time; an unset or empty value keeps production working.
const getApiBaseUrl = () => {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  const url = typeof fromEnv === 'string' && fromEnv.trim() ? fromEnv.trim() : DEFAULT_API_BASE_URL;
  return url.replace(/\/+$/, '');
};

export const Config = {
  API_BASE_URL: getApiBaseUrl(),
  // The API host sleeps when idle and has taken over 40 s to answer the first
  // request afterwards. Requests that are sent once and never retried (signing
  // in, recording a hike) get this long instead of the client's default.
  COLD_START_TIMEOUT_MS: 60_000,
  GPS_CHECKPOINT_RADIUS_M: 200,
  GPS_TRAIL_RADIUS_M: 500,
  DEFAULT_MAP_REGION: {
    latitude: 42.3154,
    longitude: 43.3569,
    latitudeDelta: 3.0,
    longitudeDelta: 3.0,
  },
} as const;
