import { Types } from 'mongoose';
import type {
  RecipeGenerationRecord,
  RecipeGenerationRevisionRecord,
  RecipeRecord,
} from '../data/schemas';
import { RecipeAiService } from './recipe-ai.service';
import { RecipesService } from './recipes.service';

function createBasicModelMock() {
  return {
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    updateMany: jest.fn(),
  };
}

function createRecipeAiServiceMock() {
  return {
    generateDraft: jest.fn(),
    reviseDraft: jest.fn(),
  } satisfies Partial<Record<keyof RecipeAiService, jest.Mock>>;
}

describe('RecipesService', () => {
  const authUser = {
    sub: 'supabase-user-1',
    email: 'user@example.com',
  } as const;

  it('serializes recipe detail ingredients with structured measurements and backfills legacy data', async () => {
    const userId = new Types.ObjectId();
    const recipe = {
      _id: new Types.ObjectId(),
      weeklyPlanId: null,
      sourceGenerationId: null,
      sourceRevisionId: null,
      title: 'Legacy Spinach Wrap',
      summary: 'Old recipe payload',
      status: 'published',
      ingredients: [
        {
          id: new Types.ObjectId(),
          name: 'Spinach',
          quantity: '2 cups',
        },
      ],
      steps: [{ id: new Types.ObjectId(), order: 1, text: 'Cook.' }],
      tags: ['Lunch'],
      isPublic: false,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
      save: jest.fn().mockResolvedValue(undefined),
    } as unknown as RecipeRecord & { save: jest.Mock };

    const recipeModel = createBasicModelMock();
    const recipeGenerationModel = createBasicModelMock();
    const recipeGenerationRevisionModel = createBasicModelMock();
    const recipeHistoryEventModel = createBasicModelMock();
    const weeklyPlanModel = createBasicModelMock();
    const inventoryEventModel = createBasicModelMock();
    const inventoryItemModel = createBasicModelMock();
    const preferenceModel = createBasicModelMock();
    const recipeAiService = createRecipeAiServiceMock();
    const usersService = {
      ensureUser: jest.fn().mockResolvedValue({ _id: userId }),
    };

    recipeModel.findOne.mockResolvedValue(recipe);
    weeklyPlanModel.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([]),
    });
    recipeGenerationModel.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([]),
    });
    recipeHistoryEventModel.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue([]),
    });

    const service = new RecipesService(
      recipeModel as never,
      recipeGenerationModel as never,
      recipeGenerationRevisionModel as never,
      recipeHistoryEventModel as never,
      weeklyPlanModel as never,
      inventoryEventModel as never,
      inventoryItemModel as never,
      preferenceModel as never,
      usersService as never,
      recipeAiService as never,
    );

    const result = await service.getRecipe(authUser, recipe._id.toString());

    expect(recipe.save).toHaveBeenCalled();
    expect(result.recipe.ingredients[0]).toMatchObject({
      name: 'Spinach',
      quantity: '60 g',
      measurement: {
        value: 60,
        unit: 'g',
      },
    });
  });

  it('serializes generation revisions with structured measurements', async () => {
    const userId = new Types.ObjectId();
    const generation = {
      _id: new Types.ObjectId(),
      userId,
      weeklyPlanId: null,
      status: 'active',
      latestRevisionId: new Types.ObjectId(),
      acceptedRecipeId: null,
      contextSnapshot: {},
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    } as RecipeGenerationRecord;
    const revision = {
      _id: generation.latestRevisionId,
      generationId: generation._id,
      userId,
      revisionNumber: 2,
      chat: [
        {
          _id: new Types.ObjectId(),
          role: 'assistant',
          content: 'Updated draft.',
          timestamp: new Date('2026-03-13T00:00:00.000Z'),
        },
      ],
      latestOutput: {
        title: 'Garlic Chicken Broccoli Stir Fry',
        summary: 'Fast dinner',
        metadata: {
          readyInMinutes: 22,
          calories: 560,
          highlight: 'Under 30 minutes',
        },
        ingredients: [
          {
            id: new Types.ObjectId(),
            name: 'Garlic',
            quantity: '4 cloves',
          },
        ],
        steps: [{ id: new Types.ObjectId(), order: 1, text: 'Cook.' }],
        tags: ['Dinner'],
      },
      conversationSummary:
        'User asked for quick high-protein dinners and simple ingredients.',
      compactedUserMessageCount: 3,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    } as RecipeGenerationRevisionRecord;

    const recipeModel = createBasicModelMock();
    const recipeGenerationModel = createBasicModelMock();
    const recipeGenerationRevisionModel = createBasicModelMock();
    const recipeHistoryEventModel = createBasicModelMock();
    const weeklyPlanModel = createBasicModelMock();
    const inventoryEventModel = createBasicModelMock();
    const inventoryItemModel = createBasicModelMock();
    const preferenceModel = createBasicModelMock();
    const recipeAiService = createRecipeAiServiceMock();
    const usersService = {
      ensureUser: jest.fn().mockResolvedValue({ _id: userId }),
    };

    recipeGenerationModel.findOne.mockResolvedValue(generation);
    recipeGenerationRevisionModel.findOne.mockResolvedValue(revision);

    const service = new RecipesService(
      recipeModel as never,
      recipeGenerationModel as never,
      recipeGenerationRevisionModel as never,
      recipeHistoryEventModel as never,
      weeklyPlanModel as never,
      inventoryEventModel as never,
      inventoryItemModel as never,
      preferenceModel as never,
      usersService as never,
      recipeAiService as never,
    );

    const result = await service.getGeneration(
      authUser,
      generation._id.toString(),
    );

    expect(result.latestRevision.latestOutput.ingredients[0]).toMatchObject({
      name: 'Garlic',
      quantity: '4 cloves',
      measurement: {
        value: 4,
        unit: 'clove',
      },
    });
    expect(result.latestRevision.conversationSummary).toBe(
      'User asked for quick high-protein dinners and simple ingredients.',
    );
    expect(result.latestRevision.compactedUserMessageCount).toBe(3);
  });

  it('rejects access to recipe generations outside the authenticated user scope', async () => {
    const userId = new Types.ObjectId();
    const recipeModel = createBasicModelMock();
    const recipeGenerationModel = createBasicModelMock();
    const recipeGenerationRevisionModel = createBasicModelMock();
    const recipeHistoryEventModel = createBasicModelMock();
    const weeklyPlanModel = createBasicModelMock();
    const inventoryEventModel = createBasicModelMock();
    const inventoryItemModel = createBasicModelMock();
    const preferenceModel = createBasicModelMock();
    const recipeAiService = createRecipeAiServiceMock();
    const usersService = {
      ensureUser: jest.fn().mockResolvedValue({ _id: userId }),
    };

    recipeGenerationModel.findOne.mockResolvedValue(null);

    const service = new RecipesService(
      recipeModel as never,
      recipeGenerationModel as never,
      recipeGenerationRevisionModel as never,
      recipeHistoryEventModel as never,
      weeklyPlanModel as never,
      inventoryEventModel as never,
      inventoryItemModel as never,
      preferenceModel as never,
      usersService as never,
      recipeAiService as never,
    );

    await expect(
      service.getGeneration(authUser, new Types.ObjectId().toString()),
    ).rejects.toThrow('Recipe generation not found.');
  });

  it('starts chef chat with an assistant greeting and no draft output', async () => {
    const userId = new Types.ObjectId();
    const generationId = new Types.ObjectId();
    const revisionId = new Types.ObjectId();
    const recipeModel = createBasicModelMock();
    const recipeGenerationModel = createBasicModelMock();
    const recipeGenerationRevisionModel = createBasicModelMock();
    const recipeHistoryEventModel = createBasicModelMock();
    const weeklyPlanModel = createBasicModelMock();
    const inventoryEventModel = createBasicModelMock();
    const inventoryItemModel = createBasicModelMock();
    const preferenceModel = createBasicModelMock();
    const recipeAiService = createRecipeAiServiceMock();
    const usersService = {
      ensureUser: jest.fn().mockResolvedValue({ _id: userId }),
    };

    weeklyPlanModel.findOne.mockReturnValue({
      sort: jest.fn().mockResolvedValue(null),
    });
    recipeGenerationModel.create.mockResolvedValue({
      _id: generationId,
      userId,
      weeklyPlanId: null,
      status: 'active',
      latestRevisionId: null,
      acceptedRecipeId: null,
      contextSnapshot: {},
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
      save: jest.fn().mockResolvedValue(undefined),
    });
    recipeGenerationRevisionModel.create.mockResolvedValue({
      _id: revisionId,
      generationId,
      userId,
      revisionNumber: 1,
      chat: [
        {
          _id: new Types.ObjectId(),
          role: 'assistant',
          content: 'What would you like to eat?',
          timestamp: new Date('2026-03-13T00:00:00.000Z'),
        },
      ],
      latestOutput: null,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    });

    const service = new RecipesService(
      recipeModel as never,
      recipeGenerationModel as never,
      recipeGenerationRevisionModel as never,
      recipeHistoryEventModel as never,
      weeklyPlanModel as never,
      inventoryEventModel as never,
      inventoryItemModel as never,
      preferenceModel as never,
      usersService as never,
      recipeAiService as never,
    );

    const result = await service.startGeneration(authUser);

    expect(recipeGenerationModel.updateMany).toHaveBeenCalledWith(
      { userId, status: 'active' },
      { $set: { status: 'discarded' } },
    );
    expect(recipeGenerationRevisionModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        revisionNumber: 1,
        latestOutput: null,
        chat: [
          expect.objectContaining({
            role: 'assistant',
            content: 'What would you like to eat?',
          }),
        ],
      }),
    );
    expect(result.latestRevision.latestOutput).toBeNull();
  });

  it('rejects accepting a chef chat revision before the first draft exists', async () => {
    const userId = new Types.ObjectId();
    const generationId = new Types.ObjectId();
    const revisionId = new Types.ObjectId();
    const recipeModel = createBasicModelMock();
    const recipeGenerationModel = createBasicModelMock();
    const recipeGenerationRevisionModel = createBasicModelMock();
    const recipeHistoryEventModel = createBasicModelMock();
    const weeklyPlanModel = createBasicModelMock();
    const inventoryEventModel = createBasicModelMock();
    const inventoryItemModel = createBasicModelMock();
    const preferenceModel = createBasicModelMock();
    const recipeAiService = createRecipeAiServiceMock();
    const usersService = {
      ensureUser: jest.fn().mockResolvedValue({ _id: userId }),
    };

    recipeGenerationModel.findOne.mockResolvedValue({
      _id: generationId,
      userId,
      weeklyPlanId: null,
      status: 'active',
      latestRevisionId: revisionId,
      acceptedRecipeId: null,
      contextSnapshot: {},
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    });
    recipeGenerationRevisionModel.findOne.mockResolvedValue({
      _id: revisionId,
      generationId,
      userId,
      revisionNumber: 1,
      chat: [],
      latestOutput: null,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    });

    const service = new RecipesService(
      recipeModel as never,
      recipeGenerationModel as never,
      recipeGenerationRevisionModel as never,
      recipeHistoryEventModel as never,
      weeklyPlanModel as never,
      inventoryEventModel as never,
      inventoryItemModel as never,
      preferenceModel as never,
      usersService as never,
      recipeAiService as never,
    );

    await expect(
      service.acceptGeneration(
        authUser,
        generationId.toString(),
        revisionId.toString(),
      ),
    ).rejects.toThrow('No recipe draft exists for this revision yet.');
  });

  it('compacts chef chat every third user message', async () => {
    const userId = new Types.ObjectId();
    const generationId = new Types.ObjectId();
    const recipeModel = createBasicModelMock();
    const recipeGenerationModel = createBasicModelMock();
    const recipeGenerationRevisionModel = createBasicModelMock();
    const recipeHistoryEventModel = createBasicModelMock();
    const weeklyPlanModel = createBasicModelMock();
    const inventoryEventModel = createBasicModelMock();
    const inventoryItemModel = createBasicModelMock();
    const preferenceModel = createBasicModelMock();
    const recipeAiService = createRecipeAiServiceMock();
    const usersService = {
      ensureUser: jest.fn().mockResolvedValue({ _id: userId }),
    };

    const latestRevision = {
      _id: new Types.ObjectId(),
      generationId,
      userId,
      revisionNumber: 3,
      chat: [
        {
          _id: new Types.ObjectId(),
          role: 'assistant',
          content: 'Chef response one',
          timestamp: new Date('2026-03-13T00:00:00.000Z'),
        },
        {
          _id: new Types.ObjectId(),
          role: 'user',
          content: 'User request one',
          timestamp: new Date('2026-03-13T00:01:00.000Z'),
        },
        {
          _id: new Types.ObjectId(),
          role: 'assistant',
          content: 'Chef response two',
          timestamp: new Date('2026-03-13T00:02:00.000Z'),
        },
        {
          _id: new Types.ObjectId(),
          role: 'user',
          content: 'User request two',
          timestamp: new Date('2026-03-13T00:03:00.000Z'),
        },
        {
          _id: new Types.ObjectId(),
          role: 'assistant',
          content: 'Chef response three',
          timestamp: new Date('2026-03-13T00:04:00.000Z'),
        },
      ],
      conversationSummary: '',
      compactedUserMessageCount: 0,
      latestOutput: {
        title: 'Current Draft',
        summary: 'Current draft summary',
        metadata: { readyInMinutes: 20, calories: 500, highlight: 'Fast' },
        ingredients: [{ id: new Types.ObjectId(), name: 'Rice', quantity: '200 g', measurement: { value: 200, unit: 'g' } }],
        steps: [{ id: new Types.ObjectId(), order: 1, text: 'Cook.' }],
        tags: ['Dinner'],
      },
      updatedAt: new Date('2026-03-13T00:03:00.000Z'),
    } as unknown as RecipeGenerationRevisionRecord;

    recipeGenerationModel.findOne.mockResolvedValue({
      _id: generationId,
      userId,
      weeklyPlanId: null,
      status: 'active',
      latestRevisionId: latestRevision._id,
      acceptedRecipeId: null,
      contextSnapshot: {},
      save: jest.fn().mockResolvedValue(undefined),
    });
    recipeGenerationRevisionModel.findOne.mockReturnValue({
      sort: jest.fn().mockResolvedValue(latestRevision),
    });
    preferenceModel.findOne.mockResolvedValue(null);
    recipeHistoryEventModel.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
    inventoryItemModel.find.mockResolvedValue([]);
    recipeAiService.reviseDraft.mockResolvedValue(latestRevision.latestOutput);
    recipeGenerationRevisionModel.create.mockResolvedValue({
      ...latestRevision,
      _id: new Types.ObjectId(),
      revisionNumber: 4,
      createdAt: new Date('2026-03-13T00:04:00.000Z'),
    });

    const service = new RecipesService(
      recipeModel as never,
      recipeGenerationModel as never,
      recipeGenerationRevisionModel as never,
      recipeHistoryEventModel as never,
      weeklyPlanModel as never,
      inventoryEventModel as never,
      inventoryItemModel as never,
      preferenceModel as never,
      usersService as never,
      recipeAiService as never,
    );

    await service.createGenerationRevision(
      authUser,
      generationId.toString(),
      'Third user request triggers compaction',
    );

    expect(recipeGenerationRevisionModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        compactedUserMessageCount: 1,
      }),
    );
    const createdPayload = recipeGenerationRevisionModel.create.mock.calls[0][0];
    expect(createdPayload.chat).toHaveLength(4);
    expect(createdPayload.chat[0]?.content).toBe('User request two');
    expect(createdPayload.conversationSummary).toContain(
      'Recent chef replies: Chef response one',
    );
  });

  it('waits for three new visible chef-chat user turns before compacting again', async () => {
    const userId = new Types.ObjectId();
    const generationId = new Types.ObjectId();
    const recipeModel = createBasicModelMock();
    const recipeGenerationModel = createBasicModelMock();
    const recipeGenerationRevisionModel = createBasicModelMock();
    const recipeHistoryEventModel = createBasicModelMock();
    const weeklyPlanModel = createBasicModelMock();
    const inventoryEventModel = createBasicModelMock();
    const inventoryItemModel = createBasicModelMock();
    const preferenceModel = createBasicModelMock();
    const recipeAiService = createRecipeAiServiceMock();
    const usersService = {
      ensureUser: jest.fn().mockResolvedValue({ _id: userId }),
    };
    const latestRevision = {
      _id: new Types.ObjectId(),
      generationId,
      userId,
      revisionNumber: 4,
      chat: [
        {
          _id: new Types.ObjectId(),
          role: 'user',
          content: 'Visible request zero',
          timestamp: new Date('2026-03-13T00:00:00.000Z'),
        },
        {
          _id: new Types.ObjectId(),
          role: 'assistant',
          content: 'Visible response zero',
          timestamp: new Date('2026-03-13T00:00:30.000Z'),
        },
        {
          _id: new Types.ObjectId(),
          role: 'user',
          content: 'Visible request one',
          timestamp: new Date('2026-03-13T00:01:00.000Z'),
        },
        {
          _id: new Types.ObjectId(),
          role: 'assistant',
          content: 'Visible response one',
          timestamp: new Date('2026-03-13T00:02:00.000Z'),
        },
        {
          _id: new Types.ObjectId(),
          role: 'user',
          content: 'Visible request two',
          timestamp: new Date('2026-03-13T00:03:00.000Z'),
        },
        {
          _id: new Types.ObjectId(),
          role: 'assistant',
          content: 'Visible response two',
          timestamp: new Date('2026-03-13T00:04:00.000Z'),
        },
        {
          _id: new Types.ObjectId(),
          role: 'user',
          content: 'Visible request three',
          timestamp: new Date('2026-03-13T00:05:00.000Z'),
        },
        {
          _id: new Types.ObjectId(),
          role: 'assistant',
          content: 'Visible response three',
          timestamp: new Date('2026-03-13T00:06:00.000Z'),
        },
      ],
      conversationSummary: 'Recent user requests: Older request',
      compactedUserMessageCount: 1,
      latestOutput: {
        title: 'Current Draft',
        summary: 'Current draft summary',
        metadata: { readyInMinutes: 20, calories: 500, highlight: 'Fast' },
        ingredients: [
          {
            id: new Types.ObjectId(),
            name: 'Rice',
            quantity: '200 g',
            measurement: { value: 200, unit: 'g' },
          },
        ],
        steps: [{ id: new Types.ObjectId(), order: 1, text: 'Cook.' }],
        tags: ['Dinner'],
      },
      updatedAt: new Date('2026-03-13T00:04:00.000Z'),
    } as unknown as RecipeGenerationRevisionRecord;

    recipeGenerationModel.findOne.mockResolvedValue({
      _id: generationId,
      userId,
      weeklyPlanId: null,
      status: 'active',
      latestRevisionId: latestRevision._id,
      acceptedRecipeId: null,
      contextSnapshot: {},
      save: jest.fn().mockResolvedValue(undefined),
    });
    recipeGenerationRevisionModel.findOne.mockReturnValue({
      sort: jest.fn().mockResolvedValue(latestRevision),
    });
    preferenceModel.findOne.mockResolvedValue(null);
    recipeHistoryEventModel.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue([]),
    });
    inventoryItemModel.find.mockResolvedValue([]);
    recipeAiService.reviseDraft.mockResolvedValue(latestRevision.latestOutput);
    recipeGenerationRevisionModel.create.mockResolvedValue({
      ...latestRevision,
      _id: new Types.ObjectId(),
      revisionNumber: 5,
      createdAt: new Date('2026-03-13T00:05:00.000Z'),
    });

    const service = new RecipesService(
      recipeModel as never,
      recipeGenerationModel as never,
      recipeGenerationRevisionModel as never,
      recipeHistoryEventModel as never,
      weeklyPlanModel as never,
      inventoryEventModel as never,
      inventoryItemModel as never,
      preferenceModel as never,
      usersService as never,
      recipeAiService as never,
    );

    await service.createGenerationRevision(
      authUser,
      generationId.toString(),
      'Third new visible request',
    );

    expect(recipeGenerationRevisionModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        compactedUserMessageCount: 4,
      }),
    );
    const createdPayload = recipeGenerationRevisionModel.create.mock.calls[0][0];
    expect(createdPayload.chat).toHaveLength(4);
    expect(createdPayload.chat[0]?.content).toBe('Visible request three');
    expect(createdPayload.conversationSummary).toContain(
      'Recent user requests: Older request',
    );
    expect(createdPayload.conversationSummary).toContain(
      'Recent user requests: Visible request zero | Visible request one | Visible request two',
    );
  });

  it('uses RecipeAiService to create the first draft when the user sends the first chef-chat message', async () => {
    const userId = new Types.ObjectId();
    const generationId = new Types.ObjectId();
    const revisionId = new Types.ObjectId();
    const recipeModel = createBasicModelMock();
    const recipeGenerationModel = createBasicModelMock();
    const recipeGenerationRevisionModel = createBasicModelMock();
    const recipeHistoryEventModel = createBasicModelMock();
    const weeklyPlanModel = createBasicModelMock();
    const inventoryEventModel = createBasicModelMock();
    const inventoryItemModel = createBasicModelMock();
    const preferenceModel = createBasicModelMock();
    const recipeAiService = createRecipeAiServiceMock();
    const usersService = {
      ensureUser: jest.fn().mockResolvedValue({ _id: userId }),
    };
    const generatedDraft = {
      title: 'Garlic Turkey Rice Bowl',
      summary: 'Fast, protein-heavy dinner built from your request.',
      metadata: {
        readyInMinutes: 24,
        calories: 610,
        highlight: 'Weeknight dinner',
      },
      ingredients: [
        {
          id: new Types.ObjectId(),
          name: 'Turkey mince',
          quantity: '220 g',
          measurement: { value: 220, unit: 'g' as const },
        },
      ],
      steps: [{ id: new Types.ObjectId(), order: 1, text: 'Cook.' }],
      tags: ['Dinner', 'Chef chat'],
    };

    recipeGenerationModel.findOne.mockResolvedValue({
      _id: generationId,
      userId,
      weeklyPlanId: null,
      status: 'active',
      latestRevisionId: revisionId,
      acceptedRecipeId: null,
      contextSnapshot: {},
      save: jest.fn().mockResolvedValue(undefined),
    });
    recipeGenerationRevisionModel.findOne.mockReturnValue({
      sort: jest.fn().mockResolvedValue({
        _id: revisionId,
        generationId,
        userId,
        revisionNumber: 1,
        chat: [
          {
            _id: new Types.ObjectId(),
            role: 'assistant',
            content: 'What would you like to eat?',
            timestamp: new Date('2026-03-13T00:00:00.000Z'),
          },
        ],
        latestOutput: null,
      }),
    });
    preferenceModel.findOne.mockResolvedValue({
      userId,
      profile: {
        dietStyle: 'Balanced',
        allergies: [],
        cuisinePreferences: ['Italian'],
        cookingTime: 'Under 30 min',
        nutritionTarget: 'High protein',
        weeklyStructure: ['Prep lunches'],
        weeklyIntentFocus: 'Quick dinners',
        weeklyIntentExclude: [],
        weeklyIntentNotes: '',
      },
    });
    recipeHistoryEventModel.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue([]),
    });
    inventoryItemModel.find.mockResolvedValue([]);
    recipeAiService.generateDraft.mockResolvedValue(generatedDraft);
    recipeGenerationRevisionModel.create.mockResolvedValue({
      _id: new Types.ObjectId(),
      generationId,
      userId,
      revisionNumber: 2,
      chat: [],
      latestOutput: generatedDraft,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    });

    const service = new RecipesService(
      recipeModel as never,
      recipeGenerationModel as never,
      recipeGenerationRevisionModel as never,
      recipeHistoryEventModel as never,
      weeklyPlanModel as never,
      inventoryEventModel as never,
      inventoryItemModel as never,
      preferenceModel as never,
      usersService as never,
      recipeAiService as never,
    );

    const result = await service.createGenerationRevision(
      authUser,
      generationId.toString(),
      'I want a fast high-protein rice bowl',
    );

    expect(recipeAiService.generateDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        preferences: expect.objectContaining({
          nutritionTarget: 'High protein',
        }),
        userMessage: 'I want a fast high-protein rice bowl',
        currentDraft: null,
      }),
    );
    expect(recipeGenerationRevisionModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        latestOutput: generatedDraft,
        chat: expect.arrayContaining([
          expect.objectContaining({
            role: 'assistant',
            content:
              'Here is a first draft for Garlic Turkey Rice Bowl. Fast, protein-heavy dinner built from your request.',
          }),
        ]),
      }),
    );
    expect(result.revision.latestOutput?.title).toBe('Garlic Turkey Rice Bowl');
  });

  it('falls back to normalizedName for legacy inventory rows when cooking recipes', async () => {
    const userId = new Types.ObjectId();
    const recipe = {
      _id: new Types.ObjectId(),
      userId,
      weeklyPlanId: null,
      ingredients: [
        {
          id: new Types.ObjectId(),
          name: 'Spinach',
          quantity: '60 g',
          measurement: { value: 60, unit: 'g' as const },
        },
      ],
      save: jest.fn().mockResolvedValue(undefined),
    } as unknown as RecipeRecord;
    const inventoryItem = {
      _id: new Types.ObjectId(),
      name: 'Spinach',
      normalizedName: 'spinach',
      canonicalKey: null,
      quantity: { value: 100, unit: 'g' },
      dates: {},
      save: jest.fn().mockResolvedValue(undefined),
    };

    const recipeModel = createBasicModelMock();
    const recipeGenerationModel = createBasicModelMock();
    const recipeGenerationRevisionModel = createBasicModelMock();
    const recipeHistoryEventModel = createBasicModelMock();
    const weeklyPlanModel = createBasicModelMock();
    const inventoryEventModel = createBasicModelMock();
    const inventoryItemModel = createBasicModelMock();
    const preferenceModel = createBasicModelMock();
    const recipeAiService = createRecipeAiServiceMock();
    const usersService = {
      ensureUser: jest.fn().mockResolvedValue({ _id: userId }),
    };

    recipeModel.findOne.mockResolvedValue(recipe);
    inventoryEventModel.create.mockResolvedValue({ _id: new Types.ObjectId() });
    inventoryItemModel.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(inventoryItem);
    recipeHistoryEventModel.create.mockResolvedValue({ _id: new Types.ObjectId() });

    const service = new RecipesService(
      recipeModel as never,
      recipeGenerationModel as never,
      recipeGenerationRevisionModel as never,
      recipeHistoryEventModel as never,
      weeklyPlanModel as never,
      inventoryEventModel as never,
      inventoryItemModel as never,
      preferenceModel as never,
      usersService as never,
      recipeAiService as never,
    );
    jest.spyOn(service, 'getRecipe').mockResolvedValue({} as never);

    await service.cookRecipe(authUser, recipe._id.toString());

    expect(inventoryItemModel.findOne).toHaveBeenNthCalledWith(1, {
      userId,
      canonicalKey: 'spinach',
    });
    expect(inventoryItemModel.findOne).toHaveBeenNthCalledWith(2, {
      userId,
      normalizedName: { $in: ['spinach', 'spinach'] },
    });
    expect(inventoryItem.canonicalKey).toBe('spinach');
    expect(inventoryItem.normalizedName).toBe('spinach');
    expect(inventoryItem.quantity).toEqual({ value: 40, unit: 'g' });
    expect(inventoryItem.save).toHaveBeenCalled();
  });

  it('matches canonical aliases against legacy normalized names when cooking recipes', async () => {
    const userId = new Types.ObjectId();
    const recipe = {
      _id: new Types.ObjectId(),
      userId,
      weeklyPlanId: null,
      ingredients: [
        {
          id: new Types.ObjectId(),
          name: 'Spinach leaves',
          quantity: '30 g',
          measurement: { value: 30, unit: 'g' as const },
        },
      ],
      save: jest.fn().mockResolvedValue(undefined),
    } as unknown as RecipeRecord;
    const inventoryItem = {
      _id: new Types.ObjectId(),
      name: 'Spinach',
      normalizedName: 'spinach',
      canonicalKey: undefined,
      quantity: { value: 50, unit: 'g' },
      dates: {},
      save: jest.fn().mockResolvedValue(undefined),
    };

    const recipeModel = createBasicModelMock();
    const recipeGenerationModel = createBasicModelMock();
    const recipeGenerationRevisionModel = createBasicModelMock();
    const recipeHistoryEventModel = createBasicModelMock();
    const weeklyPlanModel = createBasicModelMock();
    const inventoryEventModel = createBasicModelMock();
    const inventoryItemModel = createBasicModelMock();
    const preferenceModel = createBasicModelMock();
    const recipeAiService = createRecipeAiServiceMock();
    const usersService = {
      ensureUser: jest.fn().mockResolvedValue({ _id: userId }),
    };

    recipeModel.findOne.mockResolvedValue(recipe);
    inventoryEventModel.create.mockResolvedValue({ _id: new Types.ObjectId() });
    inventoryItemModel.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(inventoryItem);
    recipeHistoryEventModel.create.mockResolvedValue({ _id: new Types.ObjectId() });

    const service = new RecipesService(
      recipeModel as never,
      recipeGenerationModel as never,
      recipeGenerationRevisionModel as never,
      recipeHistoryEventModel as never,
      weeklyPlanModel as never,
      inventoryEventModel as never,
      inventoryItemModel as never,
      preferenceModel as never,
      usersService as never,
      recipeAiService as never,
    );
    jest.spyOn(service, 'getRecipe').mockResolvedValue({} as never);

    await service.cookRecipe(authUser, recipe._id.toString());

    expect(inventoryItemModel.findOne).toHaveBeenNthCalledWith(1, {
      userId,
      canonicalKey: 'spinach',
    });
    expect(inventoryItemModel.findOne).toHaveBeenNthCalledWith(2, {
      userId,
      normalizedName: { $in: ['spinach leaves', 'spinach'] },
    });
    expect(inventoryItem.canonicalKey).toBe('spinach');
    expect(inventoryItem.normalizedName).toBe('spinach leaves');
    expect(inventoryItem.quantity).toEqual({ value: 20, unit: 'g' });
    expect(inventoryItem.save).toHaveBeenCalled();
  });
});
