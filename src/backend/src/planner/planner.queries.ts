import type { AuthenticatedUser } from '../common/current-user';

export class GetCurrentWeeklyPlanQuery {
  constructor(public readonly authUser: AuthenticatedUser) {}
}

export class GetWeeklyPlanRevisionsQuery {
  constructor(
    public readonly authUser: AuthenticatedUser,
    public readonly weeklyPlanId: string,
  ) {}
}

export class GetLatestWeeklyPlanRevisionQuery {
  constructor(
    public readonly authUser: AuthenticatedUser,
    public readonly weeklyPlanId: string,
  ) {}
}

export class GetWeeklyPlanGroceryPreviewQuery {
  constructor(
    public readonly authUser: AuthenticatedUser,
    public readonly weeklyPlanId: string,
  ) {}
}
