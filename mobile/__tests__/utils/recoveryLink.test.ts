const mockGetLinkingURL = jest.fn<string | null, []>(() => null);

jest.mock('expo-linking', () => ({
  getLinkingURL: () => mockGetLinkingURL(),
}));

import {
  getPendingRecoveryUrl,
  isRecoveryLinkUsed,
  isResetPasswordUrl,
  markRecoveryLinkSeen,
  markRecoveryLinkUsed,
  parseRecoveryLink,
} from '../../utils/recoveryLink';

const RECOVERY =
  'mikiri-trails://reset-password#access_token=eyJhbGciOi.abc.def&expires_in=3600&refresh_token=r3fr3sh&token_type=bearer&type=recovery';

describe('isResetPasswordUrl', () => {
  it('recognises the reset link whatever delivered it', () => {
    expect(isResetPasswordUrl('mikiri-trails://reset-password')).toBe(true);
    expect(isResetPasswordUrl(RECOVERY)).toBe(true);
    expect(isResetPasswordUrl('mikiri-trails:///reset-password?x=1')).toBe(true);
    expect(isResetPasswordUrl('mikiri-trails://reset-password/')).toBe(true);
    expect(isResetPasswordUrl('exp://192.168.1.5:8081/--/reset-password#access_token=a')).toBe(true);
  });

  it('rejects every other link', () => {
    expect(isResetPasswordUrl('mikiri-trails://trail/abc')).toBe(false);
    expect(isResetPasswordUrl('mikiri-trails://')).toBe(false);
    expect(isResetPasswordUrl('mikiri-trails://reset-password-now')).toBe(false);
    expect(isResetPasswordUrl('mikiri-trails://trail/reset-password/hike')).toBe(false);
    expect(isResetPasswordUrl('')).toBe(false);
    expect(isResetPasswordUrl(null)).toBe(false);
    expect(isResetPasswordUrl(undefined)).toBe(false);
  });
});

describe('parseRecoveryLink', () => {
  it('reads the recovery session from the fragment', () => {
    expect(parseRecoveryLink(RECOVERY)).toEqual({
      kind: 'recovery',
      accessToken: 'eyJhbGciOi.abc.def',
      refreshToken: 'r3fr3sh',
    });
  });

  it('accepts a link without a refresh token', () => {
    expect(parseRecoveryLink('mikiri-trails://reset-password#access_token=tok&type=recovery')).toEqual({
      kind: 'recovery',
      accessToken: 'tok',
      refreshToken: null,
    });
  });

  it('reads an expired-link error from the fragment', () => {
    expect(
      parseRecoveryLink(
        'mikiri-trails://reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
      ),
    ).toEqual({
      kind: 'error',
      code: 'otp_expired',
      description: 'Email link is invalid or has expired',
    });
  });

  it('reads an error that only arrives in the query string', () => {
    expect(
      parseRecoveryLink('mikiri-trails://reset-password?error=access_denied&error_description=Link%20expired'),
    ).toEqual({ kind: 'error', code: 'access_denied', description: 'Link expired' });
  });

  it('treats a link with both a token and an error as an error', () => {
    expect(parseRecoveryLink('mikiri-trails://reset-password#access_token=tok&error=access_denied')?.kind).toBe('error');
  });

  it('returns null when the link carries nothing usable', () => {
    expect(parseRecoveryLink('mikiri-trails://reset-password')).toBeNull();
    expect(parseRecoveryLink('mikiri-trails://reset-password#')).toBeNull();
    expect(parseRecoveryLink('mikiri-trails://reset-password#type=recovery')).toBeNull();
    expect(parseRecoveryLink(null)).toBeNull();
  });

  it('ignores tokens on a link to another screen', () => {
    expect(parseRecoveryLink('mikiri-trails://trail/abc#access_token=tok&type=recovery')).toBeNull();
  });

  it('survives a badly encoded value', () => {
    expect(parseRecoveryLink('mikiri-trails://reset-password#error=bad%ZZvalue')).toEqual({
      kind: 'error',
      code: 'bad%ZZvalue',
      description: null,
    });
  });
});

describe('getPendingRecoveryUrl', () => {
  it('is the reset link the app was opened with', () => {
    mockGetLinkingURL.mockReturnValue(RECOVERY);
    expect(getPendingRecoveryUrl()).toBe(RECOVERY);
  });

  it('is null when the app was opened normally or by another link', () => {
    mockGetLinkingURL.mockReturnValue(null);
    expect(getPendingRecoveryUrl()).toBeNull();
    mockGetLinkingURL.mockReturnValue('mikiri-trails://trail/abc');
    expect(getPendingRecoveryUrl()).toBeNull();
  });

  it('is null once the reset screen has shown that link, but not for a newer one', () => {
    const first = `${RECOVERY}&n=1`;
    const second = `${RECOVERY}&n=2`;
    mockGetLinkingURL.mockReturnValue(first);
    expect(getPendingRecoveryUrl()).toBe(first);

    markRecoveryLinkSeen(first);

    expect(getPendingRecoveryUrl()).toBeNull();
    mockGetLinkingURL.mockReturnValue(second);
    expect(getPendingRecoveryUrl()).toBe(second);
  });

  it('is null when the linking module is unavailable', () => {
    mockGetLinkingURL.mockImplementation(() => {
      throw new Error('native module missing');
    });
    expect(getPendingRecoveryUrl()).toBeNull();
  });
});

describe('used links', () => {
  it('remembers a link that changed the password or was refused, and only that one', () => {
    const used = `${RECOVERY}&n=used`;
    const fresh = `${RECOVERY}&n=fresh`;
    expect(isRecoveryLinkUsed(used)).toBe(false);

    markRecoveryLinkUsed(used);

    expect(isRecoveryLinkUsed(used)).toBe(true);
    expect(isRecoveryLinkUsed(fresh)).toBe(false);
    expect(isRecoveryLinkUsed(null)).toBe(false);
  });

  it('showing a link does not use it up', () => {
    const shown = `${RECOVERY}&n=shown`;
    markRecoveryLinkSeen(shown);
    expect(isRecoveryLinkUsed(shown)).toBe(false);
  });
});
