import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseJwtService } from '../supabase-jwt/supabase-jwt.service';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly jwtService: SupabaseJwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const user = await this.jwtService.verify(token);

    // Attach user to request for controllers
    request.user = user;
    return true;
  }
}