import type { AuthenticatedUser } from '../common/current-user';

export class GenerateCurrentWeeklyPlanCommand {
  constructor(public readonly authUser: AuthenticatedUser) {}
}

export class CreateWeeklyPlanRevisionCommand {
  constructor(
    public readonly authUser: AuthenticatedUser,
    public readonly weeklyPlanId: string,
    public readonly userMessage: string,
  ) {}
}

export class AcceptWeeklyPlanRevisionCommand {
  constructor(
    public readonly authUser: AuthenticatedUser,
    public readonly weeklyPlanId: string,
    public readonly revisionId: string,
  ) {}
}
