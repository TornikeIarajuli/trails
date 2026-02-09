import { SupabaseService } from '../config/supabase.config';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
export declare class AuthService {
    private supabaseService;
    constructor(supabaseService: SupabaseService);
    signup(dto: SignupDto): Promise<{
        user: import("@supabase/auth-js").User | null;
        session: import("@supabase/auth-js").Session | null;
    }>;
    login(dto: LoginDto): Promise<{
        user: import("@supabase/auth-js").User;
        session: import("@supabase/auth-js").Session;
    }>;
    refreshToken(refreshToken: string): Promise<{
        session: import("@supabase/auth-js").Session | null;
    }>;
}
