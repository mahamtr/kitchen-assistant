import { Types } from 'mongoose';
import { GroceryService } from './grocery.service';

function createModelMock() {
  return {
    create: jest.fn(),
    db: {
      startSession: jest.fn(),
    },
    find: jest.fn(),
    findOne: jest.fn(),
  };
}

describe('GroceryService', () => {
  const authUser = {
    sub: 'supabase-user-1',
    email: 'user@example.com',
  } as const;

  it('uses a transaction when marking grocery items as purchased', async () => {
    const userId = new Types.ObjectId();
    const weeklyPlanId = new Types.ObjectId();
    const groceryListModel = createModelMock();
    const weeklyPlanModel = createModelMock();
    const inventoryItemModel = createModelMock();
    const inventoryEventModel = createModelMock();
    const usersService = {
      ensureUser: jest.fn().mockResolvedValue({ _id: userId }),
    };
    const session = {
      endSession: jest.fn().mockResolvedValue(undefined),
      withTransaction: jest.fn(async (handler: () => Promise<unknown>) => handler()),
    };
    const groceryList = {
      _id: new Types.ObjectId(),
      userId,
      weeklyPlanId,
      status: 'active',
      items: [
        {
          itemId: new Types.ObjectId(),
          name: 'Greek yogurt',
          quantity: { value: 1, unit: 'piece' },
          status: 'to_buy',
          source: 'manual',
          inventoryItemId: null,
          recipeIds: [],
          notes: '',
        },
      ],
      save: jest.fn().mockResolvedValue(undefined),
    };
    const existingInventoryItem = {
      _id: new Types.ObjectId(),
      canonicalKey: 'greek yogurt',
      normalizedName: 'greek yogurt',
      quantity: { value: 1, unit: 'piece' },
      replenishmentState: 'low_stock',
      freshnessState: 'fresh',
      source: 'manual',
      lastEventId: null,
      save: jest.fn().mockResolvedValue(undefined),
    };

    groceryListModel.db.startSession.mockResolvedValue(session);
    weeklyPlanModel.findOne.mockReturnValue({
      sort: jest.fn().mockResolvedValue({
        _id: weeklyPlanId,
      }),
    });
    groceryListModel.findOne.mockResolvedValue(groceryList);
    inventoryEventModel.create.mockResolvedValue([
      {
        _id: new Types.ObjectId(),
      },
    ]);
    inventoryItemModel.findOne.mockResolvedValue(existingInventoryItem);

    const service = new GroceryService(
      groceryListModel as never,
      weeklyPlanModel as never,
      inventoryItemModel as never,
      inventoryEventModel as never,
      usersService as never,
    );

    await service.markPurchased(authUser as never, [
      groceryList.items[0].itemId.toString(),
    ]);

    expect(session.withTransaction).toHaveBeenCalled();
    expect(inventoryEventModel.create).toHaveBeenCalledWith(
      expect.any(Array),
      { session },
    );
    expect(inventoryItemModel.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ canonicalKey: 'greek yogurt' }),
      null,
      { session },
    );
    expect(existingInventoryItem.save).toHaveBeenCalledWith({ session });
    expect(groceryList.save).toHaveBeenCalledWith({ session });
  });

  it('merges purchased grocery items by canonical key across name variants', async () => {
    const userId = new Types.ObjectId();
    const weeklyPlanId = new Types.ObjectId();
    const groceryListModel = createModelMock();
    const weeklyPlanModel = createModelMock();
    const inventoryItemModel = createModelMock();
    const inventoryEventModel = createModelMock();
    const usersService = {
      ensureUser: jest.fn().mockResolvedValue({ _id: userId }),
    };
    const session = {
      endSession: jest.fn().mockResolvedValue(undefined),
      withTransaction: jest.fn(async (handler: () => Promise<unknown>) => handler()),
    };
    const groceryList = {
      _id: new Types.ObjectId(),
      userId,
      weeklyPlanId,
      status: 'active',
      items: [
        {
          itemId: new Types.ObjectId(),
          name: 'Spinach leaves',
          canonicalKey: 'spinach',
          quantity: { value: 200, unit: 'g' },
          status: 'to_buy',
          source: 'weekly_plan',
          inventoryItemId: null,
          recipeIds: [],
          notes: 'Needed for this week',
        },
      ],
      save: jest.fn().mockResolvedValue(undefined),
    };
    const existingInventoryItem = {
      _id: new Types.ObjectId(),
      name: 'Fresh spinach',
      canonicalKey: 'spinach',
      normalizedName: 'fresh spinach',
      quantity: { value: 100, unit: 'g' },
      replenishmentState: 'low_stock',
      freshnessState: 'fresh',
      source: 'manual',
      lastEventId: null,
      save: jest.fn().mockResolvedValue(undefined),
    };

    groceryListModel.db.startSession.mockResolvedValue(session);
    weeklyPlanModel.findOne.mockReturnValue({
      sort: jest.fn().mockResolvedValue({
        _id: weeklyPlanId,
      }),
    });
    groceryListModel.findOne.mockResolvedValue(groceryList);
    inventoryEventModel.create.mockResolvedValue([
      {
        _id: new Types.ObjectId(),
      },
    ]);
    inventoryItemModel.findOne.mockResolvedValue(existingInventoryItem);

    const service = new GroceryService(
      groceryListModel as never,
      weeklyPlanModel as never,
      inventoryItemModel as never,
      inventoryEventModel as never,
      usersService as never,
    );

    await service.markPurchased(authUser as never, [
      groceryList.items[0].itemId.toString(),
    ]);

    expect(inventoryItemModel.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ canonicalKey: 'spinach' }),
      null,
      { session },
    );
    expect(existingInventoryItem.quantity).toEqual({ value: 300, unit: 'g' });
    expect(existingInventoryItem.save).toHaveBeenCalledWith({ session });
  });

  it('moves low stock items using split states with legacy status fallback', async () => {
    const userId = new Types.ObjectId();
    const weeklyPlanId = new Types.ObjectId();
    const groceryListModel = createModelMock();
    const weeklyPlanModel = createModelMock();
    const inventoryItemModel = createModelMock();
    const inventoryEventModel = createModelMock();
    const usersService = {
      ensureUser: jest.fn().mockResolvedValue({ _id: userId }),
    };
    const groceryList = {
      _id: new Types.ObjectId(),
      weeklyPlanId,
      status: 'active',
      items: [],
      save: jest.fn().mockResolvedValue(undefined),
    };

    weeklyPlanModel.findOne.mockReturnValue({
      sort: jest.fn().mockResolvedValue({ _id: weeklyPlanId }),
    });
    groceryListModel.findOne.mockResolvedValue(groceryList);
    inventoryItemModel.find.mockResolvedValue([
      {
        _id: new Types.ObjectId(),
        name: 'Milk',
        quantity: { value: 1, unit: 'piece' },
        replenishmentState: 'low_stock',
      },
      {
        _id: new Types.ObjectId(),
        name: 'Eggs',
        quantity: { value: 0, unit: 'piece' },
        status: 'low_stock',
      },
      {
        _id: new Types.ObjectId(),
        name: 'Rice',
        quantity: { value: 5, unit: 'kg' },
        replenishmentState: 'in_stock',
      },
    ]);

    const service = new GroceryService(
      groceryListModel as never,
      weeklyPlanModel as never,
      inventoryItemModel as never,
      inventoryEventModel as never,
      usersService as never,
    );

    const result = await service.moveLowStockToBuy(authUser as never);

    expect(inventoryItemModel.find).toHaveBeenCalledWith({ userId });
    expect(result.items).toHaveLength(2);
    expect(result.items.map((item) => item.name).sort()).toEqual(['Eggs', 'Milk']);
  });

  it('moves urgent items using freshness states with legacy status fallback', async () => {
    const userId = new Types.ObjectId();
    const weeklyPlanId = new Types.ObjectId();
    const groceryListModel = createModelMock();
    const weeklyPlanModel = createModelMock();
    const inventoryItemModel = createModelMock();
    const inventoryEventModel = createModelMock();
    const usersService = {
      ensureUser: jest.fn().mockResolvedValue({ _id: userId }),
    };
    const groceryList = {
      _id: new Types.ObjectId(),
      weeklyPlanId,
      status: 'active',
      items: [],
      save: jest.fn().mockResolvedValue(undefined),
    };

    weeklyPlanModel.findOne.mockReturnValue({
      sort: jest.fn().mockResolvedValue({ _id: weeklyPlanId }),
    });
    groceryListModel.findOne.mockResolvedValue(groceryList);
    inventoryItemModel.find.mockResolvedValue([
      {
        _id: new Types.ObjectId(),
        name: 'Yogurt',
        quantity: { value: 1, unit: 'piece' },
        freshnessState: 'use_soon',
      },
      {
        _id: new Types.ObjectId(),
        name: 'Bread',
        quantity: { value: 1, unit: 'piece' },
        status: 'expired',
      },
      {
        _id: new Types.ObjectId(),
        name: 'Pasta',
        quantity: { value: 1, unit: 'piece' },
        freshnessState: 'fresh',
      },
    ]);

    const service = new GroceryService(
      groceryListModel as never,
      weeklyPlanModel as never,
      inventoryItemModel as never,
      inventoryEventModel as never,
      usersService as never,
    );

    const result = await service.moveUrgentToBuy(authUser as never);

    expect(inventoryItemModel.find).toHaveBeenCalledWith({ userId });
    expect(result.items).toHaveLength(2);
    expect(result.items.map((item) => item.name).sort()).toEqual(['Bread', 'Yogurt']);
  });
});
