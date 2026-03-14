import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { SupabaseAuthGuard } from '../auth/supabase-auth/supabase-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../common/current-user';
import {
  AcceptWeeklyPlanRevisionCommand,
  CreateWeeklyPlanRevisionCommand,
  GenerateCurrentWeeklyPlanCommand,
} from './planner.commands';
import {
  GetCurrentWeeklyPlanQuery,
  GetLatestWeeklyPlanRevisionQuery,
  GetWeeklyPlanGroceryPreviewQuery,
  GetWeeklyPlanRevisionsQuery,
} from './planner.queries';

@Controller('weekly-plans')
@UseGuards(SupabaseAuthGuard)
export class PlannerController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('current/generate')
  async generateCurrent(@CurrentUser() user: AuthenticatedUser) {
    return this.commandBus.execute(new GenerateCurrentWeeklyPlanCommand(user));
  }

  @Get('current')
  async getCurrentPlan(@CurrentUser() user: AuthenticatedUser) {
    return this.queryBus.execute(new GetCurrentWeeklyPlanQuery(user));
  }

  @Get(':weeklyPlanId/grocery-preview')
  async getGroceryPreview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('weeklyPlanId') weeklyPlanId: string,
  ) {
    return this.queryBus.execute(
      new GetWeeklyPlanGroceryPreviewQuery(user, weeklyPlanId),
    );
  }

  @Get(':weeklyPlanId/revisions')
  async getRevisions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('weeklyPlanId') weeklyPlanId: string,
  ) {
    return this.queryBus.execute(
      new GetWeeklyPlanRevisionsQuery(user, weeklyPlanId),
    );
  }

  @Get(':weeklyPlanId/revisions/latest')
  async getLatestRevision(
    @CurrentUser() user: AuthenticatedUser,
    @Param('weeklyPlanId') weeklyPlanId: string,
  ) {
    return this.queryBus.execute(
      new GetLatestWeeklyPlanRevisionQuery(user, weeklyPlanId),
    );
  }

  @Post(':weeklyPlanId/revisions')
  async createRevision(
    @CurrentUser() user: AuthenticatedUser,
    @Param('weeklyPlanId') weeklyPlanId: string,
    @Body('userMessage') userMessage: string,
  ) {
    return this.commandBus.execute(
      new CreateWeeklyPlanRevisionCommand(user, weeklyPlanId, userMessage),
    );
  }

  @Post(':weeklyPlanId/revisions/:revisionId/accept')
  async acceptRevision(
    @CurrentUser() user: AuthenticatedUser,
    @Param('weeklyPlanId') weeklyPlanId: string,
    @Param('revisionId') revisionId: string,
  ) {
    return this.commandBus.execute(
      new AcceptWeeklyPlanRevisionCommand(user, weeklyPlanId, revisionId),
    );
  }
}
