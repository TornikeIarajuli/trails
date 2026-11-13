// queryClient subscribes to NetInfo when it is loaded; use the library's own Jest mock
jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock'),
);

import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { shouldRetryQuery } from '../../utils/queryClient';

const status = (code: number) => ({ response: { status: code } });

afterEach(() => {
  onlineManager.setOnline(true);
});

describe('online state', () => {
  it('follows NetInfo connectivity', () => {
    expect(NetInfo.addEventListener).toHaveBeenCalled();
    const listener = (NetInfo.addEventListener as jest.Mock).mock.calls[0][0];
    listener({ isConnected: false });
    expect(onlineManager.isOnline()).toBe(false);
    listener({ isConnected: true });
    expect(onlineManager.isOnline()).toBe(true);
  });
});

describe('shouldRetryQuery', () => {
  it('retries server errors and network failures up to twice', () => {
    expect(shouldRetryQuery(0, status(503))).toBe(true);
    expect(shouldRetryQuery(1, new Error('Network Error'))).toBe(true);
    expect(shouldRetryQuery(2, status(503))).toBe(false);
  });

  it('does not retry client errors (404, 403, 429…)', () => {
    expect(shouldRetryQuery(0, status(404))).toBe(false);
    expect(shouldRetryQuery(0, status(429))).toBe(false);
  });

  it('does not retry while offline', () => {
    onlineManager.setOnline(false);
    expect(shouldRetryQuery(0, status(503))).toBe(false);
  });
});
