import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../common/current-user';
import { SupabaseAuthGuard } from './supabase-auth/supabase-auth.guard';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signUp(
    @Body()
    body: {
      fullName: string;
      email: string;
      password: string;
    },
  ) {
    return this.authService.signUp(body);
  }

  @Post('login')
  async signIn(@Body() body: { email: string; password: string }) {
    return this.authService.signIn(body);
  }

  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }

  @Post('password/forgot')
  async forgotPassword(@Body('email') email: string) {
    return this.authService.forgotPassword(email);
  }

  @Post('password/reset')
  async resetPassword(
    @Req() request: Request,
    @Body()
    body: {
      newPassword: string;
      confirmPassword: string;
      resetToken?: string;
    },
  ) {
    return this.authService.resetPassword(request, body);
  }

  @Post('oauth/google')
  signInWithGoogle(@Body() body: { idToken: string; nonce?: string }) {
    return this.authService.signInWithGoogle(body);
  }

  @Post('logout')
  async logout(@Req() request: Request) {
    return this.authService.logout(request);
  }

  @Get('session')
  @UseGuards(SupabaseAuthGuard)
  getSession(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getSessionUser(user);
  }
}
