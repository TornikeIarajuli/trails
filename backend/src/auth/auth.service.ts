import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
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

    const { data, error } = await admin.auth.signUp({
      email: dto.email,
      password: dto.password,
      options: {
        data: {
          username: dto.username,
          full_name: dto.full_name || '',
        },
      },
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    return {
      user: data.user,
      session: data.session,
    };
  }

  async login(dto: LoginDto) {
    const client = this.supabaseService.getClient();

    const { data, error } = await client.auth.signInWithPassword({
      email: dto.email,
      password: dto.password,
    });

    if (error) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return {
      user: data.user,
      session: data.session,
    };
  }

  async refreshToken(refreshToken: string) {
    const client = this.supabaseService.getClient();

    const { data, error } = await client.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return {
      session: data.session,
    };
  }
}
