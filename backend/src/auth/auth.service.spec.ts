import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SupabaseService } from '../config/supabase.config';

// ---------------------------------------------------------------------------
// Mock Supabase clients
// ---------------------------------------------------------------------------

// Auth methods of the throw-away anon clients (shared so tests can stub them up front)
const authCalls = {
  signUp: jest.fn(),
  signInWithPassword: jest.fn(),
  refreshSession: jest.fn(),
  resend: jest.fn(),
  resetPasswordForEmail: jest.fn(),
};

// The service-role client must never run a session-creating auth method
const mockAdminAuth = {
  signUp: jest.fn(),
  signInWithPassword: jest.fn(),
  refreshSession: jest.fn(),
  resend: jest.fn(),
  resetPasswordForEmail: jest.fn(),
  admin: { signOut: jest.fn() },
};

// Chainable builder for the admin .from() queries
const buildFrom = (result: object) => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue(result),
});

const mockAdmin = {
  from: jest.fn(),
  auth: mockAdminAuth,
};

const mockSupabaseService = {
  getAdminClient: jest.fn(() => mockAdmin),
  createAuthClient: jest.fn(() => ({ auth: authCalls })),
  getAuthApi: jest.fn(() => ({
    url: 'https://example.supabase.co/auth/v1',
    anonKey: 'anon-key',
  })),
};

const mockFetch = jest.fn();
global.fetch = mockFetch;

const statusOf = async (promise: Promise<unknown>): Promise<number> => {
  try {
    await promise;
  } catch (e) {
    return (e as HttpException).getStatus();
  }
  throw new Error('expected the call to fail');
};

// ---------------------------------------------------------------------------
// Module setup
// ---------------------------------------------------------------------------
describe('AuthService', () => {
  let service: AuthService;
  let warnLog: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
    warnLog = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnLog.mockRestore();
  });

  const expectNoSessionCallOnAdminClient = () => {
    expect(mockAdminAuth.signUp).not.toHaveBeenCalled();
    expect(mockAdminAuth.signInWithPassword).not.toHaveBeenCalled();
    expect(mockAdminAuth.refreshSession).not.toHaveBeenCalled();
    expect(mockAdminAuth.resend).not.toHaveBeenCalled();
    expect(mockAdminAuth.resetPasswordForEmail).not.toHaveBeenCalled();
  };

  // -------------------------------------------------------------------------
  // client isolation
  // -------------------------------------------------------------------------
  describe('client isolation', () => {
    it('uses a new anon client for every session-creating call', async () => {
      mockAdmin.from.mockReturnValue(buildFrom({ data: null, error: null }));
      const ok = { data: { user: {}, session: {} }, error: null };
      authCalls.signUp.mockResolvedValue(ok);
      authCalls.signInWithPassword.mockResolvedValue(ok);
      authCalls.refreshSession.mockResolvedValue(ok);
      authCalls.resend.mockResolvedValue({ data: {}, error: null });
      authCalls.resetPasswordForEmail.mockResolvedValue({
        data: {},
        error: null,
      });

      await service.signup({
        email: 'a@example.com',
        password: 'Secure123',
        username: 'someone',
      });
      await service.login({ email: 'a@example.com', password: 'Secure123' });
      await service.login({ email: 'b@example.com', password: 'Secure123' });
      await service.refreshToken('rt');
      await service.resendVerification('a@example.com');
      await service.forgotPassword('a@example.com');

      expect(mockSupabaseService.createAuthClient).toHaveBeenCalledTimes(6);
      const clients = mockSupabaseService.createAuthClient.mock.results.map(
        (r) => r.value as object,
      );
      expect(new Set(clients).size).toBe(6);
      expectNoSessionCallOnAdminClient();
    });
  });

  // -------------------------------------------------------------------------
  // signup
  // -------------------------------------------------------------------------
  describe('signup', () => {
    const dto = {
      email: 'user@example.com',
      password: 'secure123',
      username: 'trailblazer',
      full_name: 'Trail Blazer',
    };

    it('throws BadRequestException when the username is already taken', async () => {
      mockAdmin.from.mockReturnValue(
        buildFrom({ data: { id: 'existing-user' }, error: null }),
      );

      await expect(service.signup(dto)).rejects.toThrow(BadRequestException);
      await expect(service.signup(dto)).rejects.toThrow(
        'Username already taken',
      );
      expect(authCalls.signUp).not.toHaveBeenCalled();
    });

    it('calls Supabase auth.signUp with email, password, and metadata', async () => {
      mockAdmin.from.mockReturnValue(buildFrom({ data: null, error: null }));
      authCalls.signUp.mockResolvedValue({
        data: { user: { id: 'u1' }, session: {} },
        error: null,
      });

      await service.signup(dto);

      expect(authCalls.signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: dto.email,
          password: dto.password,
          options: {
            data: { username: dto.username, full_name: dto.full_name },
          },
        }),
      );
      expectNoSessionCallOnAdminClient();
    });

    it('returns { user, session } on successful registration', async () => {
      mockAdmin.from.mockReturnValue(buildFrom({ data: null, error: null }));
      const fakeUser = { id: 'u1', email: dto.email };
      const fakeSession = { access_token: 'at', refresh_token: 'rt' };
      authCalls.signUp.mockResolvedValue({
        data: { user: fakeUser, session: fakeSession },
        error: null,
      });

      const result = await service.signup(dto);

      expect(result.user).toEqual(fakeUser);
      expect(result.session).toEqual(fakeSession);
    });

    it('returns a null session when the email still has to be confirmed', async () => {
      mockAdmin.from.mockReturnValue(buildFrom({ data: null, error: null }));
      authCalls.signUp.mockResolvedValue({
        data: { user: { id: 'u1' }, session: null },
        error: null,
      });

      const result = await service.signup(dto);

      expect(result.session).toBeNull();
    });

    it('throws BadRequestException when Supabase signup returns an error', async () => {
      mockAdmin.from.mockReturnValue(buildFrom({ data: null, error: null }));
      authCalls.signUp.mockResolvedValue({
        data: {},
        error: { message: 'Email address is already registered', status: 422 },
      });

      await expect(service.signup(dto)).rejects.toThrow(BadRequestException);
    });

    it('answers 503, not 400, when Supabase Auth is unreachable', async () => {
      mockAdmin.from.mockReturnValue(buildFrom({ data: null, error: null }));
      authCalls.signUp.mockResolvedValue({
        data: {},
        error: { name: 'AuthRetryableFetchError', message: 'fetch failed' },
      });

      expect(await statusOf(service.signup(dto))).toBe(503);
    });

    it('uses an empty string for full_name when not supplied', async () => {
      mockAdmin.from.mockReturnValue(buildFrom({ data: null, error: null }));
      authCalls.signUp.mockResolvedValue({
        data: { user: {}, session: {} },
        error: null,
      });

      const { full_name: _fn, ...dtoWithoutName } = dto;
      await service.signup(dtoWithoutName as any);

      expect(authCalls.signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          options: { data: expect.objectContaining({ full_name: '' }) },
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // login
  // -------------------------------------------------------------------------
  describe('login', () => {
    const dto = { email: 'user@example.com', password: 'secure123' };

    it('returns { user, session } on valid credentials', async () => {
      const fakeUser = { id: 'u1', email: dto.email };
      const fakeSession = { access_token: 'at', refresh_token: 'rt' };
      authCalls.signInWithPassword.mockResolvedValue({
        data: { user: fakeUser, session: fakeSession },
        error: null,
      });

      const result = await service.login(dto);

      expect(result.user).toEqual(fakeUser);
      expect(result.session).toEqual(fakeSession);
    });

    it('calls Supabase with the correct email and password', async () => {
      authCalls.signInWithPassword.mockResolvedValue({
        data: { user: {}, session: {} },
        error: null,
      });

      await service.login(dto);

      expect(authCalls.signInWithPassword).toHaveBeenCalledWith({
        email: dto.email,
        password: dto.password,
      });
      expectNoSessionCallOnAdminClient();
    });

    it('throws UnauthorizedException for invalid credentials', async () => {
      authCalls.signInWithPassword.mockResolvedValue({
        data: {},
        error: {
          name: 'AuthApiError',
          message: 'Invalid login credentials',
          status: 400,
          code: 'invalid_credentials',
        },
      });

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('throws with the message "Invalid email or password"', async () => {
      authCalls.signInWithPassword.mockResolvedValue({
        data: {},
        error: { message: 'any' },
      });

      await expect(service.login(dto)).rejects.toThrow(
        'Invalid email or password',
      );
    });

    it('answers 403 with code EMAIL_NOT_CONFIRMED for an unconfirmed address', async () => {
      authCalls.signInWithPassword.mockResolvedValue({
        data: {},
        error: {
          name: 'AuthApiError',
          message: 'Email not confirmed',
          status: 400,
          code: 'email_not_confirmed',
        },
      });

      const error = await service.login(dto).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getStatus()).toBe(403);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        message: 'Email not confirmed',
        code: 'EMAIL_NOT_CONFIRMED',
      });
    });

    it('recognises the unconfirmed-email error by its message too', async () => {
      authCalls.signInWithPassword.mockResolvedValue({
        data: {},
        error: { message: 'Email not confirmed', status: 400 },
      });

      expect(await statusOf(service.login(dto))).toBe(403);
    });

    it.each([
      ['a network failure', { name: 'AuthRetryableFetchError', status: 0 }],
      ['a 503 from Supabase', { name: 'AuthRetryableFetchError', status: 503 }],
      ['a 500 from Supabase', { name: 'AuthApiError', status: 500 }],
    ])('answers 503, not 401, on %s', async (_label, error) => {
      authCalls.signInWithPassword.mockResolvedValue({
        data: {},
        error: { message: 'upstream', ...error },
      });

      expect(await statusOf(service.login(dto))).toBe(503);
    });

    it('answers 429 when Supabase rate-limits the login', async () => {
      authCalls.signInWithPassword.mockResolvedValue({
        data: {},
        error: { name: 'AuthApiError', message: 'Too many', status: 429 },
      });

      expect(await statusOf(service.login(dto))).toBe(429);
    });

    it('answers 503 when the client throws unexpectedly', async () => {
      authCalls.signInWithPassword.mockRejectedValue(new Error('boom'));

      expect(await statusOf(service.login(dto))).toBe(503);
    });
  });

  // -------------------------------------------------------------------------
  // resendVerification
  // -------------------------------------------------------------------------
  describe('resendVerification', () => {
    it('asks Supabase to resend the signup email', async () => {
      authCalls.resend.mockResolvedValue({ data: {}, error: null });

      const result = await service.resendVerification('user@example.com');

      expect(authCalls.resend).toHaveBeenCalledWith({
        type: 'signup',
        email: 'user@example.com',
      });
      expect(result.message).toContain('resent');
      expectNoSessionCallOnAdminClient();
    });

    it('answers 429 while Supabase rate-limits emails', async () => {
      authCalls.resend.mockResolvedValue({
        data: {},
        error: {
          name: 'AuthApiError',
          status: 429,
          code: 'over_email_send_rate_limit',
          message: 'You can only request this after 42 seconds.',
        },
      });

      const error = await service
        .resendVerification('user@example.com')
        .catch((e: unknown) => e);

      expect((error as HttpException).getStatus()).toBe(429);
      expect((error as HttpException).message).toContain('42 seconds');
    });
  });

  // -------------------------------------------------------------------------
  // forgotPassword
  // -------------------------------------------------------------------------
  describe('forgotPassword', () => {
    it('returns a generic success message regardless of whether the email exists', async () => {
      authCalls.resetPasswordForEmail.mockResolvedValue({ error: null });

      const result = await service.forgotPassword('unknown@example.com');

      expect(result.message).toContain('If that email exists');
    });

    it('sends the reset request with the correct redirect URL', async () => {
      authCalls.resetPasswordForEmail.mockResolvedValue({ error: null });

      await service.forgotPassword('user@example.com');

      expect(authCalls.resetPasswordForEmail).toHaveBeenCalledWith(
        'user@example.com',
        { redirectTo: 'mikiri-trails://reset-password' },
      );
      expectNoSessionCallOnAdminClient();
    });

    it('returns the same generic message when Supabase returns an error', async () => {
      authCalls.resetPasswordForEmail.mockResolvedValue({ error: null });
      const success = await service.forgotPassword('x@y.com');

      authCalls.resetPasswordForEmail.mockResolvedValue({
        error: { message: 'Rate limit exceeded', status: 429 },
      });
      const failure = await service.forgotPassword('x@y.com');

      expect(failure).toEqual(success);
    });

    it('logs the failure without the email address', async () => {
      authCalls.resetPasswordForEmail.mockResolvedValue({
        error: { message: 'Rate limit exceeded', status: 429 },
      });

      await service.forgotPassword('private@example.com');

      expect(warnLog).toHaveBeenCalledTimes(1);
      const logged = String(warnLog.mock.calls[0][0]);
      expect(logged).toContain('Rate limit exceeded');
      expect(logged).not.toContain('private@example.com');
    });

    it('returns the generic message even when the client throws', async () => {
      authCalls.resetPasswordForEmail.mockRejectedValue(new Error('offline'));

      const result = await service.forgotPassword('x@y.com');

      expect(result.message).toContain('If that email exists');
    });
  });

  // -------------------------------------------------------------------------
  // refreshToken
  // -------------------------------------------------------------------------
  describe('refreshToken', () => {
    it('returns { user, session } on a valid refresh token', async () => {
      const fakeUser = { id: 'u1' };
      const fakeSession = { access_token: 'new-at', refresh_token: 'new-rt' };
      authCalls.refreshSession.mockResolvedValue({
        data: { user: fakeUser, session: fakeSession },
        error: null,
      });

      const result = await service.refreshToken('valid-rt');

      expect(result.user).toEqual(fakeUser);
      expect(result.session).toEqual(fakeSession);
    });

    it('passes the refresh_token to Supabase refreshSession', async () => {
      authCalls.refreshSession.mockResolvedValue({
        data: { user: {}, session: {} },
        error: null,
      });

      await service.refreshToken('my-rt-token');

      expect(authCalls.refreshSession).toHaveBeenCalledWith({
        refresh_token: 'my-rt-token',
      });
      expectNoSessionCallOnAdminClient();
    });

    it('throws UnauthorizedException for an invalid / expired refresh token', async () => {
      authCalls.refreshSession.mockResolvedValue({
        data: {},
        error: { message: 'JWT expired' },
      });

      await expect(service.refreshToken('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws with the message "Invalid refresh token"', async () => {
      authCalls.refreshSession.mockResolvedValue({
        data: {},
        error: { message: 'any' },
      });

      await expect(service.refreshToken('bad')).rejects.toThrow(
        'Invalid refresh token',
      );
    });

    it.each([
      ['refresh_token_not_found', 400],
      ['refresh_token_already_used', 400],
      ['session_not_found', 400],
      ['user_banned', 400],
    ])(
      'answers 401 when Supabase rejects the token (%s)',
      async (code, status) => {
        authCalls.refreshSession.mockResolvedValue({
          data: { user: null, session: null },
          error: { name: 'AuthApiError', message: code, status, code },
        });

        expect(await statusOf(service.refreshToken('rt'))).toBe(401);
      },
    );

    it('answers 401 when Supabase returns no session and no error', async () => {
      authCalls.refreshSession.mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      });

      expect(await statusOf(service.refreshToken('rt'))).toBe(401);
    });

    it.each([
      ['a network failure', { name: 'AuthRetryableFetchError', status: 0 }],
      ['a 502/503/504', { name: 'AuthRetryableFetchError', status: 503 }],
      ['a 500', { name: 'AuthApiError', status: 500 }],
      ['a rate limit', { name: 'AuthApiError', status: 429 }],
      ['an unparseable answer', { name: 'AuthUnknownError' }],
    ])(
      'answers 503, never 401, on %s so the app keeps its session',
      async (_label, error) => {
        authCalls.refreshSession.mockResolvedValue({
          data: { user: null, session: null },
          error: { message: 'upstream trouble', ...error },
        });

        const failure = await service
          .refreshToken('rt')
          .catch((e: unknown) => e);

        expect(failure).toBeInstanceOf(ServiceUnavailableException);
        expect((failure as HttpException).getStatus()).toBe(503);
      },
    );

    it('answers 503 when the client throws unexpectedly', async () => {
      authCalls.refreshSession.mockRejectedValue(new TypeError('fetch failed'));

      expect(await statusOf(service.refreshToken('rt'))).toBe(503);
    });
  });

  // -------------------------------------------------------------------------
  // logout
  // -------------------------------------------------------------------------
  describe('logout', () => {
    it('revokes only the session of the given access token', async () => {
      mockAdminAuth.admin.signOut.mockResolvedValue({
        data: null,
        error: null,
      });

      await service.logout('access-token');

      expect(mockAdminAuth.admin.signOut).toHaveBeenCalledWith(
        'access-token',
        'local',
      );
    });

    it('does not fail when Supabase rejects the revocation', async () => {
      mockAdminAuth.admin.signOut.mockResolvedValue({
        data: null,
        error: { message: 'session not found', status: 404 },
      });

      await expect(service.logout('access-token')).resolves.toBeUndefined();
    });

    it('does not fail when the call throws', async () => {
      mockAdminAuth.admin.signOut.mockRejectedValue(new Error('offline'));

      await expect(service.logout('access-token')).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // updatePassword
  // -------------------------------------------------------------------------
  describe('updatePassword', () => {
    const upstream = (status: number, body: unknown = {}) => ({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    });

    it('updates the password as the user, with their own token', async () => {
      mockFetch.mockResolvedValue(upstream(200, { id: 'u1' }));

      const result = await service.updatePassword('user-jwt', 'NewPass123');

      expect(result).toEqual({ message: 'Password updated.' });
      const [url, init] = mockFetch.mock.calls[0] as [
        string,
        { method: string; headers: Record<string, string>; body: string },
      ];
      expect(url).toBe('https://example.supabase.co/auth/v1/user');
      expect(init.method).toBe('PUT');
      expect(init.headers.Authorization).toBe('Bearer user-jwt');
      expect(init.headers.apikey).toBe('anon-key');
      expect(JSON.parse(init.body)).toEqual({ password: 'NewPass123' });
    });

    it('forwards the reason when Supabase refuses the new password', async () => {
      mockFetch.mockResolvedValue(
        upstream(422, {
          code: 422,
          error_code: 'same_password',
          msg: 'New password should be different from the old password.',
        }),
      );

      const error = await service
        .updatePassword('user-jwt', 'NewPass123')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as HttpException).message).toContain('different');
    });

    it.each([401, 403])(
      'answers 401 when Supabase answers %i',
      async (status) => {
        mockFetch.mockResolvedValue(upstream(status, { msg: 'invalid JWT' }));

        expect(
          await statusOf(service.updatePassword('bad', 'NewPass123')),
        ).toBe(401);
      },
    );

    it('answers 429 when Supabase rate-limits the request', async () => {
      mockFetch.mockResolvedValue(upstream(429, { msg: 'slow down' }));

      expect(await statusOf(service.updatePassword('jwt', 'NewPass123'))).toBe(
        429,
      );
    });

    it('answers 503 on a Supabase failure', async () => {
      mockFetch.mockResolvedValue(upstream(500, { msg: 'oops' }));

      expect(await statusOf(service.updatePassword('jwt', 'NewPass123'))).toBe(
        503,
      );
    });

    it('answers 503 when Supabase cannot be reached', async () => {
      mockFetch.mockRejectedValue(new TypeError('fetch failed'));

      expect(await statusOf(service.updatePassword('jwt', 'NewPass123'))).toBe(
        503,
      );
    });

    it('copes with an error answer that is not JSON', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.reject(new SyntaxError('Unexpected token <')),
      });

      const error = await service
        .updatePassword('jwt', 'NewPass123')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as HttpException).message).toBe(
        'Could not update the password',
      );
    });
  });
});
