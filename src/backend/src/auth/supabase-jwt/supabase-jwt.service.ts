import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { JWTPayload } from 'jose';
import { createRemoteJWKSet, jwtVerify } from 'jose';

@Injectable()
export class SupabaseJwtService {
  private jwks: ReturnType<typeof createRemoteJWKSet>;
  private issuer: string;
  private audience: string;

  constructor() {
    const ref = process.env.SUPABASE_PROJECT_REF;
    if (!ref) {
      throw new Error('Missing SUPABASE_PROJECT_REF');
    }

    this.issuer = `https://${ref}.supabase.co/auth/v1`;
    this.audience = process.env.SUPABASE_JWT_AUDIENCE ?? 'authenticated';

    this.jwks = createRemoteJWKSet(
      new URL(`https://${ref}.supabase.co/auth/v1/.well-known/jwks.json`),
    );
  }

  async verify(token: string): Promise<JWTPayload> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
      });

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired Supabase token');
    }
  }
}
