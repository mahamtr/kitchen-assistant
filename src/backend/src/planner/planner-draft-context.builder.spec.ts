import { Types } from 'mongoose';
import { DefaultDataFactory } from '../data/default-data.factory';
import type { WeeklyPlanRevisionRecord } from '../data/schemas';
import { PlannerDraftContextBuilder } from './planner-draft-context.builder';

describe('PlannerDraftContextBuilder', () => {
  const factory = new DefaultDataFactory();

  it('buildRevisionContext always passes an empty chat array', () => {
    const builder = new PlannerDraftContextBuilder();
    const userId = new Types.ObjectId();
    const seed = factory.createSeedData(
      userId,
      factory.createDefaultProfile(),
      new Date('2026-03-09T00:00:00.000Z'),
    );

    const context = builder.buildRevisionContext({
      week: factory.createWeekScaffold(new Date('2026-03-09T00:00:00.000Z')),
      preferences: factory.createDefaultProfile(),
      allowedRecipes: [],
      plan: seed.plan,
      latestRevision: seed.revision as WeeklyPlanRevisionRecord,
      userMessage: 'Make lunches lighter',
    });

    expect(context.chat).toEqual([]);
  });

  it('buildRevisionContext uses accepted plan days when latest revision is accepted', () => {
    const builder = new PlannerDraftContextBuilder();
    const userId = new Types.ObjectId();
    const seed = factory.createSeedData(
      userId,
      factory.createDefaultProfile(),
      new Date('2026-03-09T00:00:00.000Z'),
    );

    seed.plan.acceptedRevisionId = seed.revision._id;

    const context = builder.buildRevisionContext({
      week: factory.createWeekScaffold(new Date('2026-03-09T00:00:00.000Z')),
      preferences: factory.createDefaultProfile(),
      allowedRecipes: [],
      plan: seed.plan,
      latestRevision: seed.revision as WeeklyPlanRevisionRecord,
      userMessage: 'Update dinners only',
    });

    expect(context.currentDraft.days).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dayKey: seed.plan.days[0].dayKey,
          meals: expect.arrayContaining([
            expect.objectContaining({
              source: 'existing',
            }),
          ]),
        }),
      ]),
    );
  });
});
