import { Controller, Post, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post('login')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('resend-verification')
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  resendVerification(@Body('email') email: string) {
    return this.authService.resendVerification(email);
  }

  @Post('forgot-password')
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  forgotPassword(@Body('email') email: string) {
    return this.authService.forgotPassword(email);
  }

  @Post('refresh')
  refresh(@Body('refresh_token') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }
}
