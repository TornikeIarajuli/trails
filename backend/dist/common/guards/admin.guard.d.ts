import { CanActivate, ExecutionContext } from '@nestjs/common';
import { SupabaseService } from '../../config/supabase.config';
export declare class AdminGuard implements CanActivate {
    private supabaseService;
    constructor(supabaseService: SupabaseService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
