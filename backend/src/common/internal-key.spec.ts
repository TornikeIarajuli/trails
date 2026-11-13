import { isAuthorizedInternalCall, safeEqual } from './internal-key';

describe('safeEqual', () => {
  it('compares strings of any length', () => {
    expect(safeEqual('secret', 'secret')).toBe(true);
    expect(safeEqual('secret', 'secreT')).toBe(false);
    expect(safeEqual('short', 'a much longer value')).toBe(false);
    expect(safeEqual('', 'x')).toBe(false);
  });
});

describe('isAuthorizedInternalCall', () => {
  const env = {
    INTERNAL_API_KEY: 'test-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-456',
  } as NodeJS.ProcessEnv;

  it('accepts x-internal-key matching INTERNAL_API_KEY', () => {
    expect(
      isAuthorizedInternalCall({ 'x-internal-key': 'test-key' }, env),
    ).toBe(true);
  });

  it('still accepts the legacy x-service-key', () => {
    expect(
      isAuthorizedInternalCall(
        { 'x-service-key': 'service-role-key-456' },
        env,
      ),
    ).toBe(true);
  });

  it('rejects wrong or missing keys', () => {
    expect(isAuthorizedInternalCall({}, env)).toBe(false);
    expect(isAuthorizedInternalCall({ 'x-internal-key': 'nope' }, env)).toBe(
      false,
    );
    expect(isAuthorizedInternalCall({ 'x-service-key': 'nope' }, env)).toBe(
      false,
    );
    expect(isAuthorizedInternalCall({ 'x-internal-key': '' }, env)).toBe(false);
  });

  it('does not accept one key in the other header', () => {
    expect(
      isAuthorizedInternalCall(
        { 'x-internal-key': 'service-role-key-456' },
        env,
      ),
    ).toBe(false);
    expect(isAuthorizedInternalCall({ 'x-service-key': 'test-key' }, env)).toBe(
      false,
    );
  });

  it('ignores x-internal-key while INTERNAL_API_KEY is not configured', () => {
    const legacyOnly = {
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-456',
    } as NodeJS.ProcessEnv;
    expect(isAuthorizedInternalCall({ 'x-internal-key': '' }, legacyOnly)).toBe(
      false,
    );
    expect(
      isAuthorizedInternalCall({ 'x-internal-key': 'anything' }, legacyOnly),
    ).toBe(false);
    expect(
      isAuthorizedInternalCall(
        { 'x-service-key': 'service-role-key-456' },
        legacyOnly,
      ),
    ).toBe(true);
  });

  it('never matches an empty configuration', () => {
    expect(
      isAuthorizedInternalCall(
        { 'x-internal-key': '', 'x-service-key': '' },
        {} as NodeJS.ProcessEnv,
      ),
    ).toBe(false);
  });

  it('rejects repeated headers', () => {
    expect(
      isAuthorizedInternalCall({ 'x-internal-key': ['test-key', 'x'] }, env),
    ).toBe(false);
  });
});
