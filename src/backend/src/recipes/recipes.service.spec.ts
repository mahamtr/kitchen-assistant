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

  it('starts chef chat without persisting transcript and no draft output', async () => {
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
      }),
    );
    expect(recipeGenerationRevisionModel.create.mock.calls[0][0]).not.toHaveProperty(
      'chat',
    );
    expect(result.latestRevision.latestOutput).toBeNull();
  });

  it('starts chef chat with first draft output and does not persist transcript', async () => {
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

    weeklyPlanModel.findOne.mockReturnValue({
      sort: jest.fn().mockResolvedValue(null),
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

    const result = await service.startGeneration(
      authUser,
      'I want a fast high-protein rice bowl',
    );

    expect(recipeGenerationRevisionModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        revisionNumber: 1,
        latestOutput: generatedDraft,
      }),
    );
    expect(recipeGenerationRevisionModel.create.mock.calls[0][0]).not.toHaveProperty(
      'chat',
    );
    expect(result.latestRevision.latestOutput?.title).toBe('Garlic Turkey Rice Bowl');
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
      }),
    );
    expect(recipeGenerationRevisionModel.create.mock.calls[0][0]).not.toHaveProperty(
      'chat',
    );
    expect(result.revision.latestOutput?.title).toBe('Garlic Turkey Rice Bowl');
  });
});
