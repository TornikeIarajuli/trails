import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';
import {
  AUTH_UNAVAILABLE_MESSAGE as UNAVAILABLE,
  AuthErrorLike,
  classifyAuthError,
} from '../common/auth-error';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

const PASSWORD_RESET_REDIRECT = 'mikiri-trails://reset-password';
const AUTH_TIMEOUT_MS = 10_000;

const RATE_LIMITED = 'Too many attempts. Please try again later.';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private supabaseService: SupabaseService) {}

  async signup(dto: SignupDto) {
    const admin = this.supabaseService.getAdminClient();

    // Check if username is taken
    const { data: existing } = await admin
      .from('profiles')
      .select('id')
      .eq('username', dto.username)
      .single();

    if (existing) {
      throw new BadRequestException('Username already taken');
    }

    const { data, error } = await this.attempt(() =>
      this.supabaseService.createAuthClient().auth.signUp({
        email: dto.email,
        password: dto.password,
        options: {
          data: {
            username: dto.username,
            full_name: dto.full_name || '',
          },
        },
      }),
    );

    if (error) {
      this.throwIfUpstreamTrouble(error);
      // The profile trigger failed, which in practice means the username was taken
      // between the check above and the insert.
      if (/database error saving new user/i.test(error.message ?? '')) {
        throw new BadRequestException(
          'Could not create the account. Please try a different username.',
        );
      }
      throw new BadRequestException(error.message);
    }

    return {
      user: data?.user ?? null,
      session: data?.session ?? null,
    };
  }

  async login(dto: LoginDto) {
    const { data, error } = await this.attempt(() =>
      this.supabaseService.createAuthClient().auth.signInWithPassword({
        email: dto.email,
        password: dto.password,
      }),
    );

    if (error) {
      this.throwIfUpstreamTrouble(error);
      if (classifyAuthError(error) === 'unconfirmed') {
        throw new ForbiddenException({
          statusCode: HttpStatus.FORBIDDEN,
          message: 'Email not confirmed',
          code: 'EMAIL_NOT_CONFIRMED',
          error: 'Forbidden',
        });
      }
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!data?.session) {
      this.logger.warn('Supabase Auth returned no session for a login');
      throw new ServiceUnavailableException(UNAVAILABLE);
    }

    return {
      user: data.user,
      session: data.session,
    };
  }

  async resendVerification(email: string) {
    const { error } = await this.attempt(() =>
      this.supabaseService.createAuthClient().auth.resend({
        type: 'signup',
        email,
      }),
    );

    if (error) {
      this.throwIfUpstreamTrouble(error);
      throw new BadRequestException(error.message);
    }

    return { message: 'Verification email resent.' };
  }

  async forgotPassword(email: string) {
    const { error } = await this.attempt(() =>
      this.supabaseService
        .createAuthClient()
        .auth.resetPasswordForEmail(email, {
          redirectTo: PASSWORD_RESET_REDIRECT,
        }),
    );

    if (error) {
      // Never tell the caller: any difference in the answer reveals which addresses
      // have an account.
      this.logger.warn(
        `Password reset email was not sent: ${error.message ?? 'unknown error'}`,
      );
    }

    return { message: 'If that email exists, a reset link has been sent.' };
  }

  async refreshToken(refreshToken: string) {
    const { data, error } = await this.attempt(() =>
      this.supabaseService.createAuthClient().auth.refreshSession({
        refresh_token: refreshToken,
      }),
    );

    if (error) {
      // Only a token Supabase actually rejected may sign the user out. A rate limit or an
      // outage says nothing about the token, so the client must keep it and retry.
      const failure = classifyAuthError(error);
      if (failure === 'rate_limited' || failure === 'unavailable') {
        this.logger.warn(`Token refresh failed upstream: ${error.message}`);
        throw new ServiceUnavailableException(UNAVAILABLE);
      }
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!data?.session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return {
      user: data.user,
      session: data.session,
    };
  }

  /** Revokes the session the access token belongs to. Best effort: never fails. */
  async logout(accessToken: string): Promise<void> {
    try {
      const { error } = await this.supabaseService
        .getAdminClient()
        .auth.admin.signOut(accessToken, 'local');
      if (error) {
        this.logger.warn(`Session was not revoked: ${error.message}`);
      }
    } catch (err) {
      this.logger.warn(
        `Session was not revoked: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Sets a new password for the owner of `accessToken`, which may belong to the
   * short-lived session a password-reset link creates.
   *
   * The request is made to Supabase Auth as that user. Changing the password through the
   * admin API instead would revoke every session of the user, including the one making
   * this request.
   */
  async updatePassword(accessToken: string, password: string) {
    const { url, anonKey } = this.supabaseService.getAuthApi();

    let response: Response;
    try {
      response = await fetch(`${url}/user`, {
        method: 'PUT',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
        signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
      });
    } catch (err) {
      this.logger.warn(
        `Password update failed upstream: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new ServiceUnavailableException(UNAVAILABLE);
    }

    if (response.ok) {
      return { message: 'Password updated.' };
    }

    const body = (await response.json().catch(() => null)) as {
      msg?: string;
      message?: string;
      error_description?: string;
    } | null;
    const upstreamMessage =
      body?.msg ?? body?.message ?? body?.error_description;

    if (response.status === 401 || response.status === 403) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (response.status === 429) {
      throw new HttpException(RATE_LIMITED, HttpStatus.TOO_MANY_REQUESTS);
    }
    if (response.status >= 500) {
      this.logger.warn(
        `Password update failed upstream: ${response.status} ${upstreamMessage ?? ''}`,
      );
      throw new ServiceUnavailableException(UNAVAILABLE);
    }
    // 400 / 422: weak password, same password as before, ...
    throw new BadRequestException(
      upstreamMessage ?? 'Could not update the password',
    );
  }

  /**
   * Runs one auth call. supabase-js returns most failures as `{ error }` but throws
   * unexpected ones; both come back as `{ error }` here so callers handle one shape.
   */
  private async attempt<
    R extends { data: unknown; error: AuthErrorLike | null },
  >(
    call: () => Promise<R>,
  ): Promise<{ data: R['data'] | null; error: AuthErrorLike | null }> {
    try {
      return await call();
    } catch (err) {
      return {
        data: null,
        error: {
          name: 'AuthUnknownError',
          message: err instanceof Error ? err.message : String(err),
        },
      };
    }
  }

  /** Throws 429 / 503 when the error is Supabase's problem rather than the caller's. */
  private throwIfUpstreamTrouble(error: AuthErrorLike): void {
    const failure = classifyAuthError(error);
    if (failure === 'rate_limited') {
      throw new HttpException(
        error.message || RATE_LIMITED,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (failure === 'unavailable') {
      this.logger.warn(`Supabase Auth call failed: ${error.message}`);
      throw new ServiceUnavailableException(UNAVAILABLE);
    }
  }
}
