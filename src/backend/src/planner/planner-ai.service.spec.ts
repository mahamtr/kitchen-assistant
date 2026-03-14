import {
  BadGatewayException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { AiService } from '../ai/ai.service';
import { DefaultDataFactory } from '../data/default-data.factory';
import type { RecipeRecord } from '../data/schemas';
import { PlannerAiService } from './planner-ai.service';

function buildValidPayload(
  recipes: RecipeRecord[],
  week: ReturnType<DefaultDataFactory['createWeekScaffold']>,
) {
  return {
    badge: 'high-protein',
    rationale: 'Built from saved preferences and weekly intent.',
    draftRecipes: [],
    days: week.map((day, index) => ({
      dayKey: day.dayKey,
      label: day.label,
      meals: [
        {
          slot: 'breakfast',
          source: 'existing' as const,
          recipeId: recipes[index % 3]._id.toString(),
          title: recipes[index % 3].title,
          shortLabel: `Breakfast ${index + 1}`,
          calories: 380,
          tags: recipes[index % 3].tags ?? [],
        },
        {
          slot: 'lunch',
          source: 'existing' as const,
          recipeId: recipes[3 + (index % 3)]._id.toString(),
          title: recipes[3 + (index % 3)].title,
          shortLabel: `Lunch ${index + 1}`,
          calories: 480,
          tags: recipes[3 + (index % 3)].tags ?? [],
        },
        {
          slot: 'dinner',
          source: 'existing' as const,
          recipeId: recipes[6 + (index % 3)]._id.toString(),
          title: recipes[6 + (index % 3)].title,
          shortLabel: `Dinner ${index + 1}`,
          calories: 545,
          tags: recipes[6 + (index % 3)].tags ?? [],
        },
      ],
    })),
  };
}

describe('PlannerAiService', () => {
  const factory = new DefaultDataFactory();
  const userId = new Types.ObjectId();
  const weeklyPlanId = new Types.ObjectId();
  const recipes = factory.createPlannerRecipePool(
    userId,
    weeklyPlanId,
    new Date('2026-03-09T00:00:00.000Z'),
  ) as RecipeRecord[];
  const week = factory.createWeekScaffold(new Date('2026-03-09T00:00:00.000Z'));

  it('normalizes a valid draft payload into persisted weekly-plan output', () => {
    const service = new PlannerAiService({} as AiService);

    const result = service.validateDraftPayload(
      buildValidPayload(recipes, week),
      recipes,
      week,
    );

    expect(result.badge).toBe('high-protein');
    expect(result.days).toHaveLength(7);
    expect(result.draftRecipes).toHaveLength(0);
    expect(result.days[0].meals[0].source).toBe('existing');
    expect(result.days[0].meals[0].recipeId).toBeInstanceOf(Types.ObjectId);
    expect(result.days[0].meals[0].title).toBe(recipes[0].title);
  });

  it('accepts inline draft recipes referenced from the weekly plan', () => {
    const service = new PlannerAiService({} as AiService);
    const payload = buildValidPayload(recipes, week);
    payload.draftRecipes = [
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
            name: 'Cottage cheese',
            quantity: '250 g',
            measurement: {
              value: 250,
              unit: 'g',
            },
          },
          {
            name: 'Blueberries',
            quantity: '120 g',
            measurement: {
              value: 120,
              unit: 'g',
            },
          },
        ],
        steps: [
          {
            order: 1,
            text: 'Spoon cottage cheese into a bowl.',
          },
          {
            order: 2,
            text: 'Top with blueberries.',
          },
        ],
        tags: ['Lunch', 'High protein'],
      },
    ];
    payload.days[0].meals[1] = {
      slot: 'lunch',
      source: 'draft',
      draftRecipeKey: 'draft-1',
      title: 'Cottage Cheese Protein Bowl',
      shortLabel: 'Protein bowl',
      calories: 420,
      tags: ['Lunch', 'High protein'],
    };

    const result = service.validateDraftPayload(payload, recipes, week);

    expect(result.draftRecipes[0].draftRecipeKey).toBe('draft-1');
    expect(result.draftRecipes[0].ingredients[0].measurement).toEqual({
      value: 250,
      unit: 'g',
    });
    expect(result.days[0].meals[1]).toMatchObject({
      source: 'draft',
      draftRecipeKey: 'draft-1',
      title: 'Cottage Cheese Protein Bowl',
      calories: 420,
    });
  });

  it('rejects planner badges that are too long for the planner header', () => {
    const service = new PlannerAiService({} as AiService);
    const payload = buildValidPayload(recipes, week);
    payload.badge = 'high protein meal prep dinners this week';

    expect(() => service.validateDraftPayload(payload, recipes, week)).toThrow(
      'badge must be at most 4 words and 32 characters',
    );
  });

  it('rejects non-canonical count aliases in inline draft recipes', () => {
    const service = new PlannerAiService({} as AiService);
    const payload = buildValidPayload(recipes, week);
    payload.draftRecipes = [
      {
        draftRecipeKey: 'pretzel_egg_sandwich',
        title: 'Pretzel Egg Sandwich',
        summary: 'Breakfast sandwich with eggs.',
        metadata: {
          readyInMinutes: 12,
          calories: 510,
          highlight: 'Savory breakfast',
        },
        ingredients: [
          {
            name: 'Eggs',
            quantity: '2 eggs',
            measurement: {
              value: 2,
              unit: 'units',
            },
            note: null,
          },
          {
            name: 'Pretzel bun',
            quantity: '1 piece',
            measurement: {
              value: 1,
              unit: 'piece',
            },
            note: null,
          },
        ],
        steps: [
          {
            order: 1,
            text: 'Cook the eggs.',
          },
          {
            order: 2,
            text: 'Assemble the sandwich.',
          },
        ],
        tags: ['Breakfast'],
      },
    ];
    payload.days[0].meals[0] = {
      slot: 'breakfast',
      source: 'draft',
      recipeId: null as never,
      draftRecipeKey: 'pretzel_egg_sandwich',
      title: 'Pretzel Egg Sandwich',
      shortLabel: 'Egg sandwich',
      calories: 510,
      tags: ['Breakfast'],
    };

    expect(() => service.validateDraftPayload(payload, recipes, week)).toThrow(
      'unsupported measurement "units"',
    );
  });

  it('rejects spoon-based measurements in inline draft recipes', () => {
    const service = new PlannerAiService({} as AiService);
    const payload = buildValidPayload(recipes, week);
    payload.draftRecipes = [
      {
        draftRecipeKey: 'pretzel_breakfast_wrap',
        title: 'Pretzel Breakfast Wrap',
        summary: 'Breakfast wrap with eggs and olive oil.',
        metadata: {
          readyInMinutes: 14,
          calories: 530,
          highlight: 'Savory breakfast',
        },
        ingredients: [
          {
            name: 'Olive oil',
            quantity: '1 tbsp',
            measurement: {
              value: 1,
              unit: 'tbsp',
            },
            note: null,
          },
          {
            name: 'Eggs',
            quantity: '2 eggs',
            measurement: {
              value: 2,
              unit: 'egg',
            },
            note: null,
          },
        ],
        steps: [
          {
            order: 1,
            text: 'Cook the eggs.',
          },
          {
            order: 2,
            text: 'Wrap and serve.',
          },
        ],
        tags: ['Breakfast'],
      },
    ];
    payload.days[0].meals[0] = {
      slot: 'breakfast',
      source: 'draft',
      recipeId: null as never,
      draftRecipeKey: 'pretzel_breakfast_wrap',
      title: 'Pretzel Breakfast Wrap',
      shortLabel: 'Breakfast wrap',
      calories: 530,
      tags: ['Breakfast'],
    };

    expect(() => service.validateDraftPayload(payload, recipes, week)).toThrow(
      'unsupported measurement "tbsp"',
    );
  });

  it('rejects drafts that reference recipes outside the allowed pool', () => {
    const service = new PlannerAiService({} as AiService);
    const payload = buildValidPayload(recipes, week);
    payload.days[0].meals[0].recipeId = new Types.ObjectId().toString();

    expect(() => service.validateDraftPayload(payload, recipes, week)).toThrow(
      BadGatewayException,
    );
  });

  it('rejects drafts with duplicate slots on the same day', () => {
    const service = new PlannerAiService({} as AiService);
    const payload = buildValidPayload(recipes, week);
    payload.days[0].meals[1].slot = 'breakfast';

    expect(() => service.validateDraftPayload(payload, recipes, week)).toThrow(
      'duplicate slot breakfast',
    );
  });

  it('rejects orphan inline draft recipes', () => {
    const service = new PlannerAiService({} as AiService);
    const payload = buildValidPayload(recipes, week);
    payload.draftRecipes = [
      {
        draftRecipeKey: 'unused',
        title: 'Unused Draft',
        summary: 'Should fail',
        metadata: {
          readyInMinutes: 10,
          calories: 300,
          highlight: 'Unused',
        },
        ingredients: [
          {
            name: 'Greek yogurt',
            quantity: '200 g',
            measurement: {
              value: 200,
              unit: 'g',
            },
          },
        ],
        steps: [{ order: 1, text: 'Mix.' }],
        tags: ['Breakfast'],
      },
    ];

    expect(() => service.validateDraftPayload(payload, recipes, week)).toThrow(
      'unused draft recipe',
    );
  });

  it('propagates shared AI configuration failures', async () => {
    const aiService = {
      requestStructuredJson: jest
        .fn()
        .mockRejectedValue(new InternalServerErrorException('Missing OPENAI_API_KEY')),
    } as Partial<AiService> as AiService;
    const service = new PlannerAiService(aiService);

    await expect(
      service.generateDraft(
        {
          week,
          preferences: factory.createDefaultProfile(),
          allowedRecipes: recipes.map((recipe) => ({
            recipeId: recipe._id.toString(),
            title: recipe.title,
            summary: recipe.summary ?? '',
            calories: 480,
            tags: recipe.tags ?? [],
          })),
        },
        recipes,
        week,
      ),
    ).rejects.toThrow(InternalServerErrorException);
  });
});
