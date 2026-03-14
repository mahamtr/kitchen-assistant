import { Controller, Get, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth/supabase-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../common/current-user';
import { HomeService } from './home.service';

@Controller('home')
@UseGuards(SupabaseAuthGuard)
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  @Get('today')
  async getToday(@CurrentUser() user: AuthenticatedUser) {
    return this.homeService.getToday(user);
  }
}
