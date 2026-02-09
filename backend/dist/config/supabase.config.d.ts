import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
export declare class SupabaseService {
    private configService;
    private client;
    private adminClient;
    constructor(configService: ConfigService);
    getClient(): SupabaseClient;
    getAdminClient(): SupabaseClient;
    getClientWithAuth(accessToken: string): SupabaseClient;
}
