import { Types } from 'mongoose';
import { DefaultDataFactory } from '../data/default-data.factory';
import type {
  RecipeRecord,
  WeeklyPlanDayValue,
  WeeklyPlanRecord,
  WeeklyPlanRevisionOutputValue,
  WeeklyPlanRevisionRecord,
} from '../data/schemas';
import {
  AcceptWeeklyPlanRevisionHandler,
  CreateWeeklyPlanRevisionHandler,
  GenerateCurrentWeeklyPlanHandler,
} from './planner.command-handlers';
import {
  AcceptWeeklyPlanRevisionCommand,
  CreateWeeklyPlanRevisionCommand,
  GenerateCurrentWeeklyPlanCommand,
} from './planner.commands';

function sortedResult<T>(value: T) {
  return {
    sort: jest.fn().mockResolvedValue(value),
  };
}

describe('Planner command handlers', () => {
  const factory = new DefaultDataFactory();
  const authUser = {
    sub: 'supabase-user-1',
    email: 'user@example.com',
  } as const;

  function buildHybridOutput(recipes: RecipeRecord[]): WeeklyPlanRevisionOutputValue {
    const week = factory.createWeekScaffold(new Date('2026-03-09T00:00:00.000Z'));

    return {
      badge: 'high-protein meal-prep',
      rationale: 'Built from preferences and a new lunch draft.',
      draftRecipes: [
        {
          draftRecipeKey: 'draft-1',
          title: 'Cottage Cheese Protein Bowl',
          summary: 'Fast protein-heavy lunch.',
          metadata: {
            readyInMinutes: 8,
            calories: 420,
            highlight: 'Cold lunch',
          },
          ingredients: [
            {
              id: new Types.ObjectId(),
              name: 'Cottage cheese',
              quantity: '250 g',
              measurement: {
                value: 250,
                unit: 'g',
              },
            },
          ],
          steps: [
            {
              id: new Types.ObjectId(),
              order: 1,
              text: 'Mix and serve.',
            },
          ],
          tags: ['Lunch', 'High protein'],
        },
      ],
      days: week.map((day, index) => ({
        dayKey: day.dayKey,
        label: day.label,
        meals: [
          {
            slot: 'breakfast',
            source: 'existing',
            recipeId: recipes[index % 3]._id,
            title: recipes[index % 3].title,
            shortLabel: `Breakfast ${index + 1}`,
            calories: 380,
            tags: recipes[index % 3].tags ?? [],
          },
          index === 0
            ? {
                slot: 'lunch',
                source: 'draft',
                draftRecipeKey: 'draft-1',
                title: 'Cottage Cheese Protein Bowl',
                shortLabel: 'Protein bowl',
                calories: 420,
                tags: ['Lunch', 'High protein'],
              }
            : {
                slot: 'lunch',
                source: 'existing',
                recipeId: recipes[3 + (index % 3)]._id,
                title: recipes[3 + (index % 3)].title,
                shortLabel: `Lunch ${index + 1}`,
                calories: 480,
                tags: recipes[3 + (index % 3)].tags ?? [],
              },
          {
            slot: 'dinner',
            source: 'existing',
            recipeId: recipes[6 + (index % 3)]._id,
            title: recipes[6 + (index % 3)].title,
            shortLabel: `Dinner ${index + 1}`,
            calories: 545,
            tags: recipes[6 + (index % 3)].tags ?? [],
          },
        ],
      })) as WeeklyPlanRevisionOutputValue['days'],
    };
  }

  it('GenerateCurrentWeeklyPlanHandler persists the raw revision and accepted concrete plan', async () => {
    const userId = new Types.ObjectId();
    const planId = new Types.ObjectId();
    const revisionId = new Types.ObjectId();
    const recipes = factory.createPlannerRecipeCatalog(
      userId,
      new Date('2026-03-09T00:00:00.000Z'),
    ) as RecipeRecord[];
    const latestOutput = buildHybridOutput(recipes);
    const acceptedDays = factory.createSeedData(
      userId,
      factory.createDefaultProfile(),
      new Date('2026-03-09T00:00:00.000Z'),
    ).plan.days;
    const plan = {
      _id: planId,
      userId,
      weekStartAt: new Date('2026-03-09T00:00:00.000Z'),
      expiresAt: new Date('2026-03-15T23:59:59.000Z'),
      status: 'active',
      constraintsSnapshot: {},
      days: [] as WeeklyPlanDayValue[],
      acceptedRevisionId: null,
      save: jest.fn().mockResolvedValue(undefined),
    } as unknown as WeeklyPlanRecord & { save: jest.Mock };
    const weeklyPlanModel = {
      findOne: jest.fn().mockResolvedValue(plan),
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
    };
    const weeklyPlanRevisionModel = {
      findOne: jest.fn().mockReturnValue(sortedResult(null)),
      create: jest.fn().mockResolvedValue({ _id: revisionId }),
    };
    const plannerReadService = {
      requireUser: jest.fn().mockResolvedValue({ _id: userId }),
      requireCompletedPreferenceDocument: jest
        .fn()
        .mockResolvedValue({ profile: factory.createDefaultProfile() }),
      getWeekContext: jest
        .fn()
        .mockReturnValue(factory.createWeekScaffold(new Date('2026-03-09T00:00:00.000Z'))),
      cloneProfile: jest.fn().mockReturnValue(factory.createDefaultProfile()),
      toWeeklyPlanResponse: jest.fn().mockResolvedValue({ id: planId.toString() }),
    };
    const plannerRecipeCatalogService = {
      getOrSeedCatalog: jest.fn().mockResolvedValue(recipes),
      toAllowedRecipe: jest.fn((recipe: RecipeRecord) => ({
        recipeId: recipe._id.toString(),
        title: recipe.title,
        summary: recipe.summary ?? '',
        calories: 480,
        tags: recipe.tags ?? [],
      })),
    };
    const plannerAiService = {
      generateDraft: jest.fn().mockResolvedValue(latestOutput),
    };
    const plannerDraftContextBuilder = {
      buildGenerationContext: jest.fn().mockReturnValue({}),
    };
    const plannerDraftMaterializer = {
      materializeAcceptedOutput: jest.fn().mockResolvedValue(acceptedDays),
    };
    const plannerGroceryProjector = {
      rebuildFromAcceptedPlan: jest.fn().mockResolvedValue(undefined),
    };

    const handler = new GenerateCurrentWeeklyPlanHandler(
      weeklyPlanModel as never,
      weeklyPlanRevisionModel as never,
      plannerReadService as never,
      plannerRecipeCatalogService as never,
      plannerAiService as never,
      plannerDraftContextBuilder as never,
      plannerDraftMaterializer as never,
      plannerGroceryProjector as never,
    );

    await handler.execute(new GenerateCurrentWeeklyPlanCommand(authUser));

    expect(weeklyPlanRevisionModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        latestOutput,
      }),
    );
    expect(plannerDraftMaterializer.materializeAcceptedOutput).toHaveBeenCalled();
    expect(plan.days).toEqual(acceptedDays);
    expect(plan.acceptedRevisionId?.toString()).toBe(revisionId.toString());
    expect(plannerGroceryProjector.rebuildFromAcceptedPlan).toHaveBeenCalledWith(
      userId,
      planId,
      acceptedDays,
    );
  });

  it('CreateWeeklyPlanRevisionHandler stores the hybrid draft without materializing recipes', async () => {
    const userId = new Types.ObjectId();
    const planId = new Types.ObjectId();
    const recipes = factory.createPlannerRecipeCatalog(
      userId,
      new Date('2026-03-09T00:00:00.000Z'),
    ) as RecipeRecord[];
    const latestOutput = buildHybridOutput(recipes);
    const plan = {
      _id: planId,
      userId,
      days: factory.createSeedData(
        userId,
        factory.createDefaultProfile(),
        new Date('2026-03-09T00:00:00.000Z'),
      ).plan.days,
      acceptedRevisionId: new Types.ObjectId(),
    } as WeeklyPlanRecord;
    const latestRevision = {
      _id: new Types.ObjectId(),
      weeklyPlanId: planId,
      userId,
      revisionNumber: 1,
      chat: [
        {
          _id: new Types.ObjectId(),
          role: 'assistant',
          content: 'Original draft.',
          timestamp: new Date('2026-03-09T08:00:00.000Z'),
        },
      ],
      latestOutput,
    } as WeeklyPlanRevisionRecord;
    const weeklyPlanRevisionModel = {
      findOne: jest.fn().mockReturnValue(sortedResult(latestRevision)),
      create: jest.fn().mockResolvedValue({
        ...latestRevision,
        _id: new Types.ObjectId(),
        revisionNumber: 2,
      }),
    };
    const plannerReadService = {
      requireUser: jest.fn().mockResolvedValue({ _id: userId }),
      requireCompletedPreferenceDocument: jest
        .fn()
        .mockResolvedValue({ profile: factory.createDefaultProfile() }),
      requirePlanDocument: jest.fn().mockResolvedValue(plan),
      getWeekContextFromPlan: jest
        .fn()
        .mockReturnValue(factory.createWeekScaffold(new Date('2026-03-09T00:00:00.000Z'))),
      toRevisionResponse: jest.fn().mockReturnValue({ revisionNumber: 2 }),
    };
    const plannerRecipeCatalogService = {
      getOrSeedCatalog: jest.fn().mockResolvedValue(recipes),
      toAllowedRecipe: jest.fn((recipe: RecipeRecord) => ({
        recipeId: recipe._id.toString(),
        title: recipe.title,
        summary: recipe.summary ?? '',
        calories: 480,
        tags: recipe.tags ?? [],
      })),
    };
    const plannerAiService = {
      reviseDraft: jest.fn().mockResolvedValue(latestOutput),
    };
    const plannerDraftContextBuilder = {
      buildRevisionContext: jest.fn().mockReturnValue({}),
    };

    const handler = new CreateWeeklyPlanRevisionHandler(
      weeklyPlanRevisionModel as never,
      plannerReadService as never,
      plannerRecipeCatalogService as never,
      plannerAiService as never,
      plannerDraftContextBuilder as never,
    );

    await handler.execute(
      new CreateWeeklyPlanRevisionCommand(
        authUser,
        planId.toString(),
        'Add a lighter lunch.',
      ),
    );

    expect(plannerAiService.reviseDraft).toHaveBeenCalled();
    expect(weeklyPlanRevisionModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        latestOutput,
      }),
    );
  });

  it('CreateWeeklyPlanRevisionHandler compacts chat every third user message', async () => {
    const userId = new Types.ObjectId();
    const planId = new Types.ObjectId();
    const recipes = factory.createPlannerRecipeCatalog(
      userId,
      new Date('2026-03-09T00:00:00.000Z'),
    ) as RecipeRecord[];
    const latestOutput = buildHybridOutput(recipes);
    const plan = {
      _id: planId,
      userId,
      days: [],
      acceptedRevisionId: null,
    } as unknown as WeeklyPlanRecord;
    const latestRevision = {
      _id: new Types.ObjectId(),
      weeklyPlanId: planId,
      userId,
      revisionNumber: 3,
      chat: [
        {
          _id: new Types.ObjectId(),
          role: 'assistant',
          content: 'First response',
          timestamp: new Date('2026-03-09T08:00:00.000Z'),
        },
        {
          _id: new Types.ObjectId(),
          role: 'user',
          content: 'First request',
          timestamp: new Date('2026-03-09T08:01:00.000Z'),
        },
        {
          _id: new Types.ObjectId(),
          role: 'assistant',
          content: 'Second response',
          timestamp: new Date('2026-03-09T08:02:00.000Z'),
        },
        {
          _id: new Types.ObjectId(),
          role: 'user',
          content: 'Second request',
          timestamp: new Date('2026-03-09T08:03:00.000Z'),
        },
      ],
      conversationSummary: '',
      compactedUserMessageCount: 0,
      latestOutput,
      updatedAt: new Date('2026-03-09T08:03:00.000Z'),
    } as unknown as WeeklyPlanRevisionRecord;
    const weeklyPlanRevisionModel = {
      findOne: jest.fn().mockReturnValue(sortedResult(latestRevision)),
      create: jest.fn().mockResolvedValue({ ...latestRevision, _id: new Types.ObjectId() }),
    };
    const plannerReadService = {
      requireUser: jest.fn().mockResolvedValue({ _id: userId }),
      requireCompletedPreferenceDocument: jest
        .fn()
        .mockResolvedValue({ profile: factory.createDefaultProfile() }),
      requirePlanDocument: jest.fn().mockResolvedValue(plan),
      getWeekContextFromPlan: jest
        .fn()
        .mockReturnValue(factory.createWeekScaffold(new Date('2026-03-09T00:00:00.000Z'))),
      toRevisionResponse: jest.fn().mockReturnValue({ revisionNumber: 4 }),
    };
    const plannerRecipeCatalogService = {
      getOrSeedCatalog: jest.fn().mockResolvedValue(recipes),
      toAllowedRecipe: jest.fn((recipe: RecipeRecord) => ({
        recipeId: recipe._id.toString(),
        title: recipe.title,
        summary: recipe.summary ?? '',
        calories: 480,
        tags: recipe.tags ?? [],
      })),
    };
    const plannerAiService = { reviseDraft: jest.fn().mockResolvedValue(latestOutput) };
    const plannerDraftContextBuilder = { buildRevisionContext: jest.fn().mockReturnValue({}) };

    const handler = new CreateWeeklyPlanRevisionHandler(
      weeklyPlanRevisionModel as never,
      plannerReadService as never,
      plannerRecipeCatalogService as never,
      plannerAiService as never,
      plannerDraftContextBuilder as never,
    );

    await handler.execute(
      new CreateWeeklyPlanRevisionCommand(
        authUser,
        planId.toString(),
        'Third request triggers compaction.',
      ),
    );

    expect(weeklyPlanRevisionModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        compactedUserMessageCount: 3,
      }),
    );
    const createdPayload = weeklyPlanRevisionModel.create.mock.calls[0][0];
    expect(createdPayload.chat).toHaveLength(2);
  });

  it('AcceptWeeklyPlanRevisionHandler materializes inline recipes and rewrites the accepted plan', async () => {
    const userId = new Types.ObjectId();
    const planId = new Types.ObjectId();
    const revisionId = new Types.ObjectId();
    const latestOutput = buildHybridOutput(
      factory.createPlannerRecipeCatalog(
        userId,
        new Date('2026-03-09T00:00:00.000Z'),
      ) as RecipeRecord[],
    );
    const acceptedDays = factory.createSeedData(
      userId,
      factory.createDefaultProfile(),
      new Date('2026-03-09T00:00:00.000Z'),
    ).plan.days;
    const plan = {
      _id: planId,
      userId,
      status: 'active',
      days: [] as WeeklyPlanDayValue[],
      acceptedRevisionId: null,
      save: jest.fn().mockResolvedValue(undefined),
    } as unknown as WeeklyPlanRecord & { save: jest.Mock };
    const weeklyPlanRevisionModel = {
      findOne: jest.fn().mockResolvedValue({
        _id: revisionId,
        weeklyPlanId: planId,
        latestOutput,
      }),
    };
    const plannerReadService = {
      requireUser: jest.fn().mockResolvedValue({ _id: userId }),
      requirePlanDocument: jest.fn().mockResolvedValue(plan),
      toWeeklyPlanResponse: jest.fn().mockResolvedValue({ id: planId.toString() }),
    };
    const plannerDraftMaterializer = {
      materializeAcceptedOutput: jest.fn().mockResolvedValue(acceptedDays),
    };
    const plannerGroceryProjector = {
      rebuildFromAcceptedPlan: jest.fn().mockResolvedValue(undefined),
    };

    const handler = new AcceptWeeklyPlanRevisionHandler(
      weeklyPlanRevisionModel as never,
      plannerReadService as never,
      plannerDraftMaterializer as never,
      plannerGroceryProjector as never,
    );

    await handler.execute(
      new AcceptWeeklyPlanRevisionCommand(
        authUser,
        planId.toString(),
        revisionId.toString(),
      ),
    );

    expect(plannerDraftMaterializer.materializeAcceptedOutput).toHaveBeenCalledWith(
      userId,
      planId,
      latestOutput,
    );
    expect(plan.days).toEqual(acceptedDays);
    expect(plan.acceptedRevisionId?.toString()).toBe(revisionId.toString());
    expect(plan.save).toHaveBeenCalled();
    expect(plannerGroceryProjector.rebuildFromAcceptedPlan).toHaveBeenCalledWith(
      userId,
      planId,
      acceptedDays,
    );
  });
});
