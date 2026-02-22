import { Alert } from 'react-native';

export function showError(err: unknown, fallback = 'Something went wrong. Please try again.') {
  const message =
    (err as any)?.response?.data?.message ||
    (err as Error)?.message ||
    fallback;
  Alert.alert('Error', typeof message === 'string' ? message : fallback);
}
