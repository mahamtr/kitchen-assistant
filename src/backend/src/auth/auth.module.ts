import { Module } from '@nestjs/common';
import { SupabaseJwtService } from './supabase-jwt/supabase-jwt.service';
import { SupabaseAuthGuard } from './supabase-auth/supabase-auth.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  controllers: [AuthController],
  providers: [SupabaseJwtService, SupabaseAuthGuard, AuthService],
  exports: [SupabaseJwtService, SupabaseAuthGuard, AuthService],
})
export class AuthModule {}
