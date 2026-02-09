import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    signup(dto: SignupDto): Promise<{
        user: import("@supabase/auth-js").User | null;
        session: import("@supabase/auth-js").Session | null;
    }>;
    login(dto: LoginDto): Promise<{
        user: import("@supabase/auth-js").User;
        session: import("@supabase/auth-js").Session;
    }>;
    refresh(refreshToken: string): Promise<{
        session: import("@supabase/auth-js").Session | null;
    }>;
}
