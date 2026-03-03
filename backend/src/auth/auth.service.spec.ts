import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SupabaseService } from '../config/supabase.config';

// ---------------------------------------------------------------------------
// Mock Supabase clients
// ---------------------------------------------------------------------------
const mockAdminAuth = {
  signUp: jest.fn(),
  resetPasswordForEmail: jest.fn(),
};

const mockClientAuth = {
  signInWithPassword: jest.fn(),
  refreshSession: jest.fn(),
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

const mockClient = {
  auth: mockClientAuth,
};

const mockSupabaseService = {
  getAdminClient: jest.fn(() => mockAdmin),
  getClient: jest.fn(() => mockClient),
};

// ---------------------------------------------------------------------------
// Module setup
// ---------------------------------------------------------------------------
describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
    // restore default implementations after each clear
    mockSupabaseService.getAdminClient.mockReturnValue(mockAdmin);
    mockSupabaseService.getClient.mockReturnValue(mockClient);
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
    });

    it('calls Supabase auth.signUp with email, password, and metadata', async () => {
      mockAdmin.from.mockReturnValue(buildFrom({ data: null, error: null }));
      mockAdminAuth.signUp.mockResolvedValue({
        data: { user: { id: 'u1' }, session: {} },
        error: null,
      });

      await service.signup(dto);

      expect(mockAdminAuth.signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: dto.email,
          password: dto.password,
          options: {
            data: { username: dto.username, full_name: dto.full_name },
          },
        }),
      );
    });

    it('returns { user, session } on successful registration', async () => {
      mockAdmin.from.mockReturnValue(buildFrom({ data: null, error: null }));
      const fakeUser = { id: 'u1', email: dto.email };
      const fakeSession = { access_token: 'at', refresh_token: 'rt' };
      mockAdminAuth.signUp.mockResolvedValue({
        data: { user: fakeUser, session: fakeSession },
        error: null,
      });

      const result = await service.signup(dto);

      expect(result.user).toEqual(fakeUser);
      expect(result.session).toEqual(fakeSession);
    });

    it('throws BadRequestException when Supabase signup returns an error', async () => {
      mockAdmin.from.mockReturnValue(buildFrom({ data: null, error: null }));
      mockAdminAuth.signUp.mockResolvedValue({
        data: {},
        error: { message: 'Email address is already registered' },
      });

      await expect(service.signup(dto)).rejects.toThrow(BadRequestException);
    });

    it('uses an empty string for full_name when not supplied', async () => {
      mockAdmin.from.mockReturnValue(buildFrom({ data: null, error: null }));
      mockAdminAuth.signUp.mockResolvedValue({
        data: { user: {}, session: {} },
        error: null,
      });

      const { full_name: _fn, ...dtoWithoutName } = dto;
      await service.signup(dtoWithoutName as any);

      expect(mockAdminAuth.signUp).toHaveBeenCalledWith(
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
      mockClientAuth.signInWithPassword.mockResolvedValue({
        data: { user: fakeUser, session: fakeSession },
        error: null,
      });

      const result = await service.login(dto);

      expect(result.user).toEqual(fakeUser);
      expect(result.session).toEqual(fakeSession);
    });

    it('calls Supabase with the correct email and password', async () => {
      mockClientAuth.signInWithPassword.mockResolvedValue({
        data: { user: {}, session: {} },
        error: null,
      });

      await service.login(dto);

      expect(mockClientAuth.signInWithPassword).toHaveBeenCalledWith({
        email: dto.email,
        password: dto.password,
      });
    });

    it('throws UnauthorizedException for invalid credentials', async () => {
      mockClientAuth.signInWithPassword.mockResolvedValue({
        data: {},
        error: { message: 'Invalid login credentials' },
      });

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('throws with the message "Invalid email or password"', async () => {
      mockClientAuth.signInWithPassword.mockResolvedValue({
        data: {},
        error: { message: 'any' },
      });

      await expect(service.login(dto)).rejects.toThrow(
        'Invalid email or password',
      );
    });
  });

  // -------------------------------------------------------------------------
  // forgotPassword
  // -------------------------------------------------------------------------
  describe('forgotPassword', () => {
    it('returns a generic success message regardless of whether the email exists', async () => {
      mockAdminAuth.resetPasswordForEmail.mockResolvedValue({ error: null });

      const result = await service.forgotPassword('unknown@example.com');

      expect(result.message).toContain('If that email exists');
    });

    it('sends the reset request with the correct redirect URL', async () => {
      mockAdminAuth.resetPasswordForEmail.mockResolvedValue({ error: null });

      await service.forgotPassword('user@example.com');

      expect(mockAdminAuth.resetPasswordForEmail).toHaveBeenCalledWith(
        'user@example.com',
        { redirectTo: 'mikiri-trails://reset-password' },
      );
    });

    it('throws BadRequestException when Supabase returns an error', async () => {
      mockAdminAuth.resetPasswordForEmail.mockResolvedValue({
        error: { message: 'Rate limit exceeded' },
      });

      await expect(service.forgotPassword('x@y.com')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // refreshToken
  // -------------------------------------------------------------------------
  describe('refreshToken', () => {
    it('returns { user, session } on a valid refresh token', async () => {
      const fakeUser = { id: 'u1' };
      const fakeSession = { access_token: 'new-at', refresh_token: 'new-rt' };
      mockClientAuth.refreshSession.mockResolvedValue({
        data: { user: fakeUser, session: fakeSession },
        error: null,
      });

      const result = await service.refreshToken('valid-rt');

      expect(result.user).toEqual(fakeUser);
      expect(result.session).toEqual(fakeSession);
    });

    it('passes the refresh_token to Supabase refreshSession', async () => {
      mockClientAuth.refreshSession.mockResolvedValue({
        data: { user: {}, session: {} },
        error: null,
      });

      await service.refreshToken('my-rt-token');

      expect(mockClientAuth.refreshSession).toHaveBeenCalledWith({
        refresh_token: 'my-rt-token',
      });
    });

    it('throws UnauthorizedException for an invalid / expired refresh token', async () => {
      mockClientAuth.refreshSession.mockResolvedValue({
        data: {},
        error: { message: 'JWT expired' },
      });

      await expect(service.refreshToken('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws with the message "Invalid refresh token"', async () => {
      mockClientAuth.refreshSession.mockResolvedValue({
        data: {},
        error: { message: 'any' },
      });

      await expect(service.refreshToken('bad')).rejects.toThrow(
        'Invalid refresh token',
      );
    });
  });
});
