import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { JWTPayload } from 'jose';
import { SupabaseJwtService } from '../supabase-jwt/supabase-jwt.service';

type AuthenticatedRequest = Request & {
  user?: JWTPayload;
};

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly jwtService: SupabaseJwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rawRequest: unknown = context.switchToHttp().getRequest();
    const request = rawRequest as AuthenticatedRequest;

    const authHeader = request.headers.authorization;
    const bearerToken =
      typeof authHeader === 'string'
        ? authHeader
        : Array.isArray(authHeader)
          ? authHeader[0]
          : undefined;

    if (!bearerToken?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    const token = bearerToken.replace('Bearer ', '').trim();
    const user = await this.jwtService.verify(token);

    // Attach user to request for controllers
    request.user = user;
    return true;
  }
}
