import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth/supabase-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../common/current-user';
import { OnboardingService } from './onboarding.service';

@Controller('onboarding')
@UseGuards(SupabaseAuthGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('questions')
  async getQuestions(@CurrentUser() user: AuthenticatedUser) {
    const state = await this.onboardingService.getState(user);
    return state.questions;
  }

  @Get('state')
  async getState(@CurrentUser() user: AuthenticatedUser) {
    return this.onboardingService.getState(user);
  }

  @Patch('draft')
  async saveDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Body('key') key: string,
    @Body('value') value: string | string[],
  ) {
    return this.onboardingService.saveAnswer(user, key as never, value);
  }

  @Post('complete')
  async complete(@CurrentUser() user: AuthenticatedUser) {
    return this.onboardingService.complete(user);
  }
}
