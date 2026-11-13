import { Alert } from 'react-native';
import { getErrorMessage, getErrorStatus, isNetworkError, showError } from '../../utils/showError';

const httpError = (status: number, message?: unknown) => ({
  isAxiosError: true,
  message: `Request failed with status code ${status}`,
  response: { status, data: message === undefined ? {} : { message } },
});

describe('getErrorMessage', () => {
  it('returns the server message when it is a string', () => {
    expect(getErrorMessage(httpError(400, 'Event is full'))).toBe('Event is full');
  });

  it('joins NestJS validation messages sent as an array', () => {
    const err = httpError(400, ['title must be shorter', 'max_participants must not be less than 2']);
    expect(getErrorMessage(err)).toBe('title must be shorter\nmax_participants must not be less than 2');
  });

  it('ignores non-string entries in a message array', () => {
    expect(getErrorMessage(httpError(400, [null, 'only this', 3]))).toBe('only this');
  });

  it('falls back when the message array is empty', () => {
    expect(getErrorMessage(httpError(400, []), 'Fallback')).toBe('Fallback');
  });

  it('explains rate limiting instead of echoing the server text', () => {
    expect(getErrorMessage(httpError(429, 'ThrottlerException: Too Many Requests'))).toMatch(/too many requests/i);
  });

  it('describes a request that got no response as a connection problem', () => {
    const err = { isAxiosError: true, code: 'ERR_NETWORK', message: 'Network Error' };
    expect(getErrorMessage(err)).toMatch(/connection/i);
  });

  it('does not show axios' + "'" + ' generic status text to users', () => {
    expect(getErrorMessage(httpError(500), 'Fallback')).toBe('Fallback');
  });

  it('uses the message of a plain Error', () => {
    expect(getErrorMessage(new Error('Location unavailable'))).toBe('Location unavailable');
  });

  it('handles null and undefined', () => {
    expect(getErrorMessage(null, 'Fallback')).toBe('Fallback');
    expect(getErrorMessage(undefined, 'Fallback')).toBe('Fallback');
  });
});

describe('isNetworkError / getErrorStatus', () => {
  it('treats a timeout as a network error', () => {
    expect(isNetworkError({ code: 'ECONNABORTED', message: 'timeout of 15000ms exceeded' })).toBe(true);
  });

  it('does not treat an HTTP error response as a network error', () => {
    expect(isNetworkError(httpError(503))).toBe(false);
  });

  it('reads the HTTP status', () => {
    expect(getErrorStatus(httpError(404))).toBe(404);
    expect(getErrorStatus(new Error('x'))).toBeUndefined();
  });
});

describe('showError', () => {
  it('always passes a string to Alert.alert (an array would crash Android)', () => {
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    showError(httpError(400, ['a', 'b']));
    expect(spy).toHaveBeenCalledWith('Error', 'a\nb');
    spy.mockRestore();
  });
});
