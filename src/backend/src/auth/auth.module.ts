import { Module } from '@nestjs/common';
import { SupabaseJwtService } from './supabase-jwt/supabase-jwt.service';
import { SupabaseAuthGuard } from './supabase-auth/supabase-auth.guard';

@Module({
  providers: [SupabaseJwtService, SupabaseAuthGuard],
  exports: [SupabaseJwtService, SupabaseAuthGuard],
})
export class AuthModule {}
