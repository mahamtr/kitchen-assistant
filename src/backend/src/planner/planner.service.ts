import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
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

@Injectable()
export class PlannerService {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  getCurrentPlan(authUser: AuthenticatedUser) {
    return this.queryBus.execute(new GetCurrentWeeklyPlanQuery(authUser));
  }

  generateCurrent(authUser: AuthenticatedUser) {
    return this.commandBus.execute(
      new GenerateCurrentWeeklyPlanCommand(authUser),
    );
  }

  getRevisions(authUser: AuthenticatedUser, weeklyPlanId: string) {
    return this.queryBus.execute(
      new GetWeeklyPlanRevisionsQuery(authUser, weeklyPlanId),
    );
  }

  getLatestRevision(authUser: AuthenticatedUser, weeklyPlanId: string) {
    return this.queryBus.execute(
      new GetLatestWeeklyPlanRevisionQuery(authUser, weeklyPlanId),
    );
  }

  createRevision(
    authUser: AuthenticatedUser,
    weeklyPlanId: string,
    userMessage: string,
  ) {
    return this.commandBus.execute(
      new CreateWeeklyPlanRevisionCommand(
        authUser,
        weeklyPlanId,
        userMessage,
      ),
    );
  }

  acceptRevision(
    authUser: AuthenticatedUser,
    weeklyPlanId: string,
    revisionId: string,
  ) {
    return this.commandBus.execute(
      new AcceptWeeklyPlanRevisionCommand(authUser, weeklyPlanId, revisionId),
    );
  }

  getGroceryPreview(authUser: AuthenticatedUser, weeklyPlanId: string) {
    return this.queryBus.execute(
      new GetWeeklyPlanGroceryPreviewQuery(authUser, weeklyPlanId),
    );
  }
}
