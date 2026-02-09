import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../../config/supabase.config';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);

    const {
      data: { user },
      error,
    } = await this.supabaseService.getAdminClient().auth.getUser(token);

    if (error || !user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (user.user_metadata?.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }

    request.user = user;
    request.accessToken = token;
    return true;
  }
}
