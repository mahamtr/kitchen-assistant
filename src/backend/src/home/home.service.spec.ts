import { HomeService } from './home.service';

describe('HomeService', () => {
  it('filters malformed meals from the today payload', async () => {
    const plannerService = {
      getCurrentPlan: jest.fn().mockResolvedValue({
        target: {
          calories: '2,100 kcal',
          macros: 'P150 C180 F70',
        },
        days: [
          {
            dayKey: 'mon',
            label: 'Monday',
            meals: [
              {
                slot: 'breakfast',
                recipeId: 'recipe-1',
                title: 'Greek yogurt bowl',
                shortLabel: 'Greek yogurt bowl',
                calories: 420,
                tags: ['breakfast'],
              },
              {
                recipeId: 'recipe-2',
                title: 'Broken meal',
              },
            ],
          },
        ],
      }),
    };
    const inventoryService = {
      getSummary: jest.fn().mockResolvedValue({
        toBuyCount: 0,
        inStockCount: 0,
        expiringCount: 0,
        lowStockCount: 0,
        urgentItems: [],
      }),
    };
    const service = new HomeService(
      plannerService as never,
      inventoryService as never,
    );

    const result = await service.getToday({ sub: 'user-1' } as never);

    expect(result.todayMeals).toEqual([
      {
        slot: 'breakfast',
        recipeId: 'recipe-1',
        title: 'Greek yogurt bowl',
        shortLabel: 'Greek yogurt bowl',
        calories: 420,
        tags: ['breakfast'],
      },
    ]);
  });
});
