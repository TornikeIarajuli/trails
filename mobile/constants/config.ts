import { Platform } from 'react-native';

const DEV_MACHINE_IP = '192.168.100.12';

const getApiBaseUrl = () => {
  if (__DEV__) {
    return `http://${DEV_MACHINE_IP}:3000/api`;
  }
  // Replace with your actual Render URL after deploying
  return 'https://trails-en04.onrender.com/api';
};

export const Config = {
  API_BASE_URL: getApiBaseUrl(),
  GPS_CHECKPOINT_RADIUS_M: 200,
  GPS_TRAIL_RADIUS_M: 500,
  DEFAULT_MAP_REGION: {
    latitude: 42.3154,
    longitude: 43.3569,
    latitudeDelta: 3.0,
    longitudeDelta: 3.0,
  },
} as const;
