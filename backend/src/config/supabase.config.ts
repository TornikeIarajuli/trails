import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private client: SupabaseClient;
  private adminClient: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.getOrThrow<string>('SUPABASE_URL');
    const anonKey = this.configService.getOrThrow<string>('SUPABASE_ANON_KEY');
    const serviceRoleKey = this.configService.getOrThrow<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    this.client = createClient(supabaseUrl, anonKey);

    this.adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  getAdminClient(): SupabaseClient {
    return this.adminClient;
  }

  getClientWithAuth(accessToken: string): SupabaseClient {
    const supabaseUrl = this.configService.getOrThrow<string>('SUPABASE_URL');
    const anonKey = this.configService.getOrThrow<string>('SUPABASE_ANON_KEY');

    return createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
  }
}
