import { PlannerService } from './planner.service';

describe('PlannerService', () => {
  const authUser = {
    sub: 'supabase-user-1',
    email: 'user@example.com',
  } as const;

  it('dispatches planner commands through the command bus', async () => {
    const commandBus = {
      execute: jest.fn().mockResolvedValue({ id: 'plan-1' }),
    };
    const queryBus = {
      execute: jest.fn(),
    };
    const service = new PlannerService(commandBus as never, queryBus as never);

    await service.generateCurrent(authUser);
    await service.createRevision(authUser, 'plan-1', 'Make lunches lighter.');
    await service.acceptRevision(authUser, 'plan-1', 'revision-2');

    expect(commandBus.execute).toHaveBeenCalledTimes(3);
  });

  it('dispatches planner queries through the query bus', async () => {
    const commandBus = {
      execute: jest.fn(),
    };
    const queryBus = {
      execute: jest.fn().mockResolvedValue({ id: 'plan-1' }),
    };
    const service = new PlannerService(commandBus as never, queryBus as never);

    await service.getCurrentPlan(authUser);
    await service.getRevisions(authUser, 'plan-1');
    await service.getLatestRevision(authUser, 'plan-1');
    await service.getGroceryPreview(authUser, 'plan-1');

    expect(queryBus.execute).toHaveBeenCalledTimes(4);
  });
});
