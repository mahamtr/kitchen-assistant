import {
  BadGatewayException,
  InternalServerErrorException,
} from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { RecipeAiService } from './recipe-ai.service';

describe('RecipeAiService', () => {
  it('normalizes a valid recipe draft payload into persisted recipe output', () => {
    const service = new RecipeAiService({} as AiService);

    const result = service.validateDraftPayload({
      title: 'Garlic Chicken Bowl',
      summary: 'Fast dinner with rice and broccoli.',
      metadata: {
        readyInMinutes: 22,
        calories: 560,
        highlight: 'High protein',
      },
      ingredients: [
        {
          name: 'Chicken breast',
          quantity: '220 g',
          measurement: {
            value: 220,
            unit: 'g',
          },
          note: null,
        },
        {
          name: 'Rice',
          quantity: '180 g',
          measurement: {
            value: 180,
            unit: 'g',
          },
          note: null,
        },
      ],
      steps: [
        {
          order: 1,
          text: 'Cook the chicken.',
        },
        {
          order: 2,
          text: 'Serve over rice.',
        },
      ],
      tags: ['Dinner', 'Chef chat'],
    });

    expect(result.title).toBe('Garlic Chicken Bowl');
    expect(result.ingredients[0]).toMatchObject({
      name: 'Chicken breast',
      quantity: '220 g',
      measurement: {
        value: 220,
        unit: 'g',
      },
    });
    expect(result.steps[0].order).toBe(1);
  });

  it('rejects unsupported ingredient measurements', () => {
    const service = new RecipeAiService({} as AiService);

    expect(() =>
      service.validateDraftPayload({
        title: 'Bad Draft',
        summary: 'Should fail.',
        metadata: {
          readyInMinutes: 15,
          calories: 420,
          highlight: 'Invalid',
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
        ],
        steps: [{ order: 1, text: 'Mix.' }],
        tags: ['Dinner'],
      }),
    ).toThrow(BadGatewayException);
  });

  it('propagates shared AI configuration failures', async () => {
    const aiService = {
      requestStructuredJson: jest
        .fn()
        .mockRejectedValue(new InternalServerErrorException('Missing OPENAI_API_KEY')),
    } as Partial<AiService> as AiService;
    const service = new RecipeAiService(aiService);

    await expect(
      service.generateDraft({
        preferences: null,
        weeklyPlanRecipes: [],
        favoriteRecipes: [],
        recentRecipes: [],
        inventoryItems: [],
        currentDraft: null,
        chat: [],
        userMessage: 'I want pasta.',
      }),
    ).rejects.toThrow(InternalServerErrorException);
  });
});
