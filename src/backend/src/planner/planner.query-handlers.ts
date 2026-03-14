import { Injectable } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
  GetCurrentWeeklyPlanQuery,
  GetLatestWeeklyPlanRevisionQuery,
  GetWeeklyPlanGroceryPreviewQuery,
  GetWeeklyPlanRevisionsQuery,
} from './planner.queries';
import { PlannerReadService } from './planner-read.service';

@Injectable()
@QueryHandler(GetCurrentWeeklyPlanQuery)
export class GetCurrentWeeklyPlanHandler
  implements IQueryHandler<GetCurrentWeeklyPlanQuery>
{
  constructor(private readonly plannerReadService: PlannerReadService) {}

  execute(query: GetCurrentWeeklyPlanQuery) {
    return this.plannerReadService.getCurrentPlanResponse(query.authUser);
  }
}

@Injectable()
@QueryHandler(GetWeeklyPlanRevisionsQuery)
export class GetWeeklyPlanRevisionsHandler
  implements IQueryHandler<GetWeeklyPlanRevisionsQuery>
{
  constructor(private readonly plannerReadService: PlannerReadService) {}

  execute(query: GetWeeklyPlanRevisionsQuery) {
    return this.plannerReadService.getRevisionsResponse(
      query.authUser,
      query.weeklyPlanId,
    );
  }
}

@Injectable()
@QueryHandler(GetLatestWeeklyPlanRevisionQuery)
export class GetLatestWeeklyPlanRevisionHandler
  implements IQueryHandler<GetLatestWeeklyPlanRevisionQuery>
{
  constructor(private readonly plannerReadService: PlannerReadService) {}

  execute(query: GetLatestWeeklyPlanRevisionQuery) {
    return this.plannerReadService.getLatestRevisionResponse(
      query.authUser,
      query.weeklyPlanId,
    );
  }
}

@Injectable()
@QueryHandler(GetWeeklyPlanGroceryPreviewQuery)
export class GetWeeklyPlanGroceryPreviewHandler
  implements IQueryHandler<GetWeeklyPlanGroceryPreviewQuery>
{
  constructor(private readonly plannerReadService: PlannerReadService) {}

  execute(query: GetWeeklyPlanGroceryPreviewQuery) {
    return this.plannerReadService.getGroceryPreviewResponse(
      query.authUser,
      query.weeklyPlanId,
    );
  }
}
