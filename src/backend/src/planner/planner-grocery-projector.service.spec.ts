import { Types } from 'mongoose';
import type {
  GroceryListRecord,
  RecipeRecord,
  WeeklyPlanDayValue,
} from '../data/schemas';
import { PlannerGroceryProjector } from './planner-grocery-projector.service';

describe('PlannerGroceryProjector', () => {
  it('merges overlapping preserved to-buy items with weekly plan items', async () => {
    const userId = new Types.ObjectId();
    const weeklyPlanId = new Types.ObjectId();
    const recipeId = new Types.ObjectId();
    const inventoryItemId = new Types.ObjectId();
    const inventoryModel = {
      find: jest.fn().mockResolvedValue([]),
    };
    const recipeModel = {
      find: jest.fn().mockResolvedValue([
        {
          _id: recipeId,
          userId,
          ingredients: [
            {
              name: 'Chicken breast',
              measurement: {
                value: 440,
                unit: 'g',
              },
            },
          ],
        },
      ] satisfies Partial<RecipeRecord>[]),
    };
    const groceryList = {
      items: [
        {
          itemId: new Types.ObjectId(),
          name: 'Chicken breast',
          quantity: {
            value: 1,
            unit: 'g',
          },
          status: 'to_buy',
          source: 'low_stock',
          inventoryItemId,
          recipeIds: [],
          notes: 'Low stock item added from Kitchen inventory',
        },
        {
          itemId: new Types.ObjectId(),
          name: 'Dish soap',
          quantity: {
            value: 1,
            unit: 'piece',
          },
          status: 'to_buy',
          source: 'manual',
          inventoryItemId: null,
          recipeIds: [],
          notes: 'Manual add',
        },
      ],
      status: 'active',
      lastComputedAt: null,
      save: jest.fn().mockResolvedValue(undefined),
    } as unknown as GroceryListRecord & { save: jest.Mock };
    const groceryListModel = {
      findOne: jest.fn().mockResolvedValue(groceryList),
      create: jest.fn(),
    };
    const projector = new PlannerGroceryProjector(
      groceryListModel as never,
      inventoryModel as never,
      recipeModel as never,
    );
    const days = [
      {
        dayKey: 'mon',
        label: 'Mon, Mar 9',
        meals: [
          {
            slot: 'lunch',
            recipeId,
            title: 'Chicken Bowl',
            shortLabel: 'Chicken Bowl',
            calories: 540,
            tags: ['Lunch'],
          },
        ],
      },
    ] as WeeklyPlanDayValue[];

    await projector.rebuildFromAcceptedPlan(userId, weeklyPlanId, days);

    expect(groceryList.save).toHaveBeenCalled();
    expect(groceryList.items).toHaveLength(2);
    expect(
      groceryList.items.filter((item) => item.name === 'Chicken breast'),
    ).toHaveLength(1);
    expect(groceryList.items[0]).toEqual(
      expect.objectContaining({
        name: 'Chicken breast',
        quantity: {
          value: 440,
          unit: 'g',
        },
        status: 'to_buy',
        source: 'low_stock',
        inventoryItemId,
        recipeIds: [recipeId],
        notes:
          'Needed for this week • Low stock item added from Kitchen inventory',
      }),
    );
  });

  it('does not add weekly plan items already covered by inventory stock', async () => {
    const userId = new Types.ObjectId();
    const weeklyPlanId = new Types.ObjectId();
    const recipeId = new Types.ObjectId();
    const inventoryModel = {
      find: jest.fn().mockResolvedValue([
        {
          name: 'Eggs',
          quantity: {
            value: 3,
            unit: 'piece',
          },
          status: 'fresh',
        },
      ]),
    };
    const recipeModel = {
      find: jest.fn().mockResolvedValue([
        {
          _id: recipeId,
          userId,
          ingredients: [
            {
              name: 'Eggs',
              measurement: {
                value: 3,
                unit: 'egg',
              },
            },
          ],
        },
      ] satisfies Partial<RecipeRecord>[]),
    };
    const groceryListModel = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(undefined),
    };
    const projector = new PlannerGroceryProjector(
      groceryListModel as never,
      inventoryModel as never,
      recipeModel as never,
    );
    const days = [
      {
        dayKey: 'mon',
        label: 'Mon, Mar 9',
        meals: [
          {
            slot: 'breakfast',
            recipeId,
            title: 'Spinach Egg Wrap',
            shortLabel: 'Egg Wrap',
            calories: 480,
            tags: ['Breakfast'],
          },
        ],
      },
    ] as WeeklyPlanDayValue[];

    await projector.rebuildFromAcceptedPlan(userId, weeklyPlanId, days);

    expect(groceryListModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [],
      }),
    );
  });
});
