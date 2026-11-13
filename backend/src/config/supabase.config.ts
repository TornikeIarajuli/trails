import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly supabaseUrl: string;
  private readonly anonKey: string;
  private readonly adminClient: SupabaseClient;

  constructor(configService: ConfigService) {
    this.supabaseUrl = configService.getOrThrow<string>('SUPABASE_URL');
    this.anonKey = configService.getOrThrow<string>('SUPABASE_ANON_KEY');
    const serviceRoleKey = configService.getOrThrow<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    this.adminClient = createClient(this.supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      // supabase-js sends a session's access token instead of the key once a client holds
      // a session. Pinning the header keeps every database and storage call on the service
      // role even if a session-creating auth method is called on this client by mistake.
      global: { headers: { Authorization: `Bearer ${serviceRoleKey}` } },
    });
  }

  /**
   * The shared service-role client, for database, storage and auth *admin* calls.
   * Never call signUp / signInWithPassword / refreshSession / setSession on it - those
   * keep the returned session in the client. Use createAuthClient() for them.
   */
  getAdminClient(): SupabaseClient {
    return this.adminClient;
  }

  /**
   * A new anon-key client for a single auth call made on behalf of one end user.
   * It keeps no session and runs no refresh timer, so it can simply be dropped afterwards
   * and one user's session can never leak into another request.
   */
  createAuthClient(): SupabaseClient {
    return createClient(this.supabaseUrl, this.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  /**
   * Base URL of the auth REST API and the public key it expects, for the rare call that
   * has to be made with a user's own access token rather than through a client.
   */
  getAuthApi(): { url: string; anonKey: string } {
    const base = this.supabaseUrl.endsWith('/')
      ? this.supabaseUrl
      : `${this.supabaseUrl}/`;
    return { url: new URL('auth/v1', base).href, anonKey: this.anonKey };
  }
}
