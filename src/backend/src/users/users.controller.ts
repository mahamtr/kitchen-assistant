import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../common/current-user';
import { SupabaseAuthGuard } from '../auth/supabase-auth/supabase-auth.guard';
import { UsersService } from './users.service';

@Controller('users/me')
@UseGuards(SupabaseAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('bootstrap')
  async bootstrap(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getMe(user);
  }

  @Get()
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getMe(user);
  }

  @Get('preferences')
  async getPreferences(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getCompletedPreference(user);
  }

  @Put('preferences')
  async replacePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body('profile') profile: Record<string, unknown>,
  ) {
    return this.usersService.replacePreferences(user, profile as never);
  }

  @Patch('preferences')
  async patchPreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body('profile') profile: Record<string, unknown>,
  ) {
    return this.usersService.patchPreferences(user, profile as never);
  }

  @Get('bootstrap-summary')
  async getBootstrapSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getBootstrapSummary(user);
  }
}
