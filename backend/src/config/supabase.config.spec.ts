import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.config';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ auth: {} })),
}));

const mockCreateClient = createClient as jest.Mock;

const config = {
  getOrThrow: (key: string) =>
    ({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_ANON_KEY: 'anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    })[key],
} as unknown as ConfigService;

describe('SupabaseService', () => {
  beforeEach(() => mockCreateClient.mockClear());

  it('creates one service-role client that keeps no session', () => {
    const service = new SupabaseService(config);

    expect(mockCreateClient).toHaveBeenCalledTimes(1);
    const [url, key, options] = mockCreateClient.mock.calls[0];
    expect(url).toBe('https://example.supabase.co');
    expect(key).toBe('service-role-key');
    expect(options.auth).toEqual({
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    });
    // Even if a session ended up in the client, requests keep using the key
    expect(options.global.headers.Authorization).toBe(
      'Bearer service-role-key',
    );
    expect(service.getAdminClient()).toBe(service.getAdminClient());
  });

  it('creates a fresh anon client without session handling for each auth call', () => {
    const service = new SupabaseService(config);
    mockCreateClient.mockClear();

    const first = service.createAuthClient();
    const second = service.createAuthClient();

    expect(first).not.toBe(second);
    expect(first).not.toBe(service.getAdminClient());
    expect(mockCreateClient).toHaveBeenCalledTimes(2);
    for (const [, key, options] of mockCreateClient.mock.calls) {
      expect(key).toBe('anon-key');
      expect(options.auth).toEqual({
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      });
    }
  });

  it('exposes the auth API base URL', () => {
    const service = new SupabaseService(config);
    expect(service.getAuthApi()).toEqual({
      url: 'https://example.supabase.co/auth/v1',
      anonKey: 'anon-key',
    });
  });
});
