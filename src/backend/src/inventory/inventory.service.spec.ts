import { Types } from 'mongoose';
import { DefaultDataFactory } from '../data/default-data.factory';
import type { InventoryItemRecord } from '../data/schemas';
import { InventoryService } from './inventory.service';

function createModelMock() {
  return {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };
}

describe('InventoryService', () => {
  const authUser = {
    sub: 'supabase-user-1',
    email: 'user@example.com',
  } as const;

  function createInventoryItem(userId: Types.ObjectId) {
    return {
      _id: new Types.ObjectId(),
      userId,
      name: 'Greek yogurt',
      normalizedName: 'greek yogurt',
      canonicalKey: 'greek yogurt',
      category: '',
      location: 'fridge',
      quantity: { value: 500, unit: 'g' },
      replenishmentState: 'in_stock',
      freshnessState: 'fresh',
      reorderPoint: 1,
      targetOnHand: null,
      dates: {
        addedAt: new Date('2026-03-01T00:00:00.000Z'),
        openedAt: null,
        expiresAt: null,
        lastUsedAt: null,
      },
      freshness: {
        estimatedDaysLeft: 5,
        confidence: 'medium',
      },
      source: 'manual',
      lastEventId: null,
      metadata: {},
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      lastUpdatedAt: new Date('2026-03-01T00:00:00.000Z'),
      save: jest.fn().mockResolvedValue(undefined),
    } as unknown as InventoryItemRecord & { save: jest.Mock };
  }

  it('rejects unsupported inventory patch fields', async () => {
    const userId = new Types.ObjectId();
    const inventoryItemModel = createModelMock();
    const inventoryEventModel = createModelMock();
    const groceryListModel = createModelMock();
    const weeklyPlanModel = createModelMock();
    const usersService = {
      ensureUser: jest.fn().mockResolvedValue({ _id: userId }),
    };
    const item = createInventoryItem(userId);

    inventoryItemModel.findOne.mockResolvedValue(item);

    const service = new InventoryService(
      inventoryItemModel as never,
      inventoryEventModel as never,
      groceryListModel as never,
      weeklyPlanModel as never,
      usersService as never,
      new DefaultDataFactory(),
    );

    await expect(
      service.patchItem(authUser as never, item._id.toString(), {
        userId: new Types.ObjectId().toString(),
      }),
    ).rejects.toThrow('Unsupported inventory patch fields: userId');
    expect(item.save).not.toHaveBeenCalled();
  });

  it('merges allowed nested inventory patch fields safely', async () => {
    const userId = new Types.ObjectId();
    const inventoryItemModel = createModelMock();
    const inventoryEventModel = createModelMock();
    const groceryListModel = createModelMock();
    const weeklyPlanModel = createModelMock();
    const usersService = {
      ensureUser: jest.fn().mockResolvedValue({ _id: userId }),
    };
    const item = createInventoryItem(userId);

    inventoryItemModel.findOne.mockResolvedValue(item);

    const service = new InventoryService(
      inventoryItemModel as never,
      inventoryEventModel as never,
      groceryListModel as never,
      weeklyPlanModel as never,
      usersService as never,
      new DefaultDataFactory(),
    );

    const result = await service.patchItem(authUser as never, item._id.toString(), {
      quantity: {
        value: 1,
        unit: 'kg',
      },
      dates: {
        expiresAt: '2026-03-20T00:00:00.000Z',
      },
      metadata: {
        shelf: 'top',
      },
    });

    expect(item.save).toHaveBeenCalled();
    expect(result.quantity).toEqual({
      value: 1000,
      unit: 'g',
    });
    expect(result.dates.addedAt).toBe('2026-03-01T00:00:00.000Z');
    expect(result.dates.expiresAt).toBe('2026-03-20T00:00:00.000Z');
    expect(result.metadata).toEqual({ shelf: 'top' });
  });

  it('rejects unsupported inventory quantity units', async () => {
    const userId = new Types.ObjectId();
    const inventoryItemModel = createModelMock();
    const inventoryEventModel = createModelMock();
    const groceryListModel = createModelMock();
    const weeklyPlanModel = createModelMock();
    const usersService = {
      ensureUser: jest.fn().mockResolvedValue({ _id: userId }),
    };
    const item = createInventoryItem(userId);

    inventoryItemModel.findOne.mockResolvedValue(item);

    const service = new InventoryService(
      inventoryItemModel as never,
      inventoryEventModel as never,
      groceryListModel as never,
      weeklyPlanModel as never,
      usersService as never,
      new DefaultDataFactory(),
    );

    await expect(
      service.patchItem(authUser as never, item._id.toString(), {
        quantity: {
          value: 1,
          unit: 'cup',
        },
      }),
    ).rejects.toThrow('Unsupported measurement unit: cup');
    expect(item.save).not.toHaveBeenCalled();
  });

  it('preserves explicit split-state patch values when provided', async () => {
    const userId = new Types.ObjectId();
    const inventoryItemModel = createModelMock();
    const inventoryEventModel = createModelMock();
    const groceryListModel = createModelMock();
    const weeklyPlanModel = createModelMock();
    const usersService = {
      ensureUser: jest.fn().mockResolvedValue({ _id: userId }),
    };
    const item = createInventoryItem(userId);
    item.dates = {
      ...item.dates,
      expiresAt: null,
    };

    inventoryItemModel.findOne.mockResolvedValue(item);

    const service = new InventoryService(
      inventoryItemModel as never,
      inventoryEventModel as never,
      groceryListModel as never,
      weeklyPlanModel as never,
      usersService as never,
      new DefaultDataFactory(),
    );

    const result = await service.patchItem(authUser as never, item._id.toString(), {
      freshnessState: 'fresh',
      replenishmentState: 'out_of_stock',
    });

    expect(item.save).toHaveBeenCalled();
    expect(result.freshnessState).toBe('fresh');
    expect(result.replenishmentState).toBe('out_of_stock');
  });

  it('derives freshness transitions from expiresAt when freshnessState is omitted', async () => {
    const userId = new Types.ObjectId();
    const inventoryItemModel = createModelMock();
    const inventoryEventModel = createModelMock();
    const groceryListModel = createModelMock();
    const weeklyPlanModel = createModelMock();
    const usersService = {
      ensureUser: jest.fn().mockResolvedValue({ _id: userId }),
    };

    const service = new InventoryService(
      inventoryItemModel as never,
      inventoryEventModel as never,
      groceryListModel as never,
      weeklyPlanModel as never,
      usersService as never,
      new DefaultDataFactory(),
    );

    const unknownItem = createInventoryItem(userId);
    unknownItem.dates = { ...unknownItem.dates, expiresAt: null };
    inventoryItemModel.findOne.mockResolvedValueOnce(unknownItem);
    const unknownResult = await service.patchItem(authUser as never, unknownItem._id.toString(), {
      metadata: { note: 'keep' },
    });
    expect(unknownResult.freshnessState).toBe('unknown');

    const useSoonItem = createInventoryItem(userId);
    const soon = new Date();
    soon.setDate(soon.getDate() + 1);
    inventoryItemModel.findOne.mockResolvedValueOnce(useSoonItem);
    const useSoonResult = await service.patchItem(authUser as never, useSoonItem._id.toString(), {
      dates: { expiresAt: soon.toISOString() },
    });
    expect(useSoonResult.freshnessState).toBe('use_soon');

    const expiredItem = createInventoryItem(userId);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    inventoryItemModel.findOne.mockResolvedValueOnce(expiredItem);
    const expiredResult = await service.patchItem(authUser as never, expiredItem._id.toString(), {
      dates: { expiresAt: yesterday.toISOString() },
    });
    expect(expiredResult.freshnessState).toBe('expired');

    const freshItem = createInventoryItem(userId);
    const later = new Date();
    later.setDate(later.getDate() + 5);
    inventoryItemModel.findOne.mockResolvedValueOnce(freshItem);
    const freshResult = await service.patchItem(authUser as never, freshItem._id.toString(), {
      dates: { expiresAt: later.toISOString() },
    });
    expect(freshResult.freshnessState).toBe('fresh');
  });

  it('derives replenishment transitions from quantity and reorderPoint when omitted', async () => {
    const userId = new Types.ObjectId();
    const inventoryItemModel = createModelMock();
    const inventoryEventModel = createModelMock();
    const groceryListModel = createModelMock();
    const weeklyPlanModel = createModelMock();
    const usersService = {
      ensureUser: jest.fn().mockResolvedValue({ _id: userId }),
    };

    const service = new InventoryService(
      inventoryItemModel as never,
      inventoryEventModel as never,
      groceryListModel as never,
      weeklyPlanModel as never,
      usersService as never,
      new DefaultDataFactory(),
    );

    const outOfStockItem = createInventoryItem(userId);
    outOfStockItem.quantity = { value: 5, unit: 'g' };
    outOfStockItem.reorderPoint = 1;
    inventoryItemModel.findOne.mockResolvedValueOnce(outOfStockItem);
    const outResult = await service.patchItem(authUser as never, outOfStockItem._id.toString(), {
      quantity: { value: 0, unit: 'g' },
      reorderPoint: 1,
    });
    expect(outResult.replenishmentState).toBe('out_of_stock');

    const lowStockItem = createInventoryItem(userId);
    lowStockItem.quantity = { value: 5, unit: 'g' };
    lowStockItem.reorderPoint = 2;
    inventoryItemModel.findOne.mockResolvedValueOnce(lowStockItem);
    const lowResult = await service.patchItem(authUser as never, lowStockItem._id.toString(), {
      quantity: { value: 2, unit: 'g' },
      reorderPoint: 2,
    });
    expect(lowResult.replenishmentState).toBe('low_stock');

    const inStockItem = createInventoryItem(userId);
    inStockItem.quantity = { value: 5, unit: 'g' };
    inStockItem.reorderPoint = 2;
    inventoryItemModel.findOne.mockResolvedValueOnce(inStockItem);
    const inStockResult = await service.patchItem(authUser as never, inStockItem._id.toString(), {
      quantity: { value: 3, unit: 'g' },
      reorderPoint: 2,
    });
    expect(inStockResult.replenishmentState).toBe('in_stock');
  });

  it('rejects invalid reorderPoint and targetOnHand patch values', async () => {
    const userId = new Types.ObjectId();
    const inventoryItemModel = createModelMock();
    const inventoryEventModel = createModelMock();
    const groceryListModel = createModelMock();
    const weeklyPlanModel = createModelMock();
    const usersService = {
      ensureUser: jest.fn().mockResolvedValue({ _id: userId }),
    };

    const service = new InventoryService(
      inventoryItemModel as never,
      inventoryEventModel as never,
      groceryListModel as never,
      weeklyPlanModel as never,
      usersService as never,
      new DefaultDataFactory(),
    );

    const item = createInventoryItem(userId);
    inventoryItemModel.findOne.mockResolvedValue(item);

    await expect(
      service.patchItem(authUser as never, item._id.toString(), {
        reorderPoint: Number.NaN as unknown as number,
      }),
    ).rejects.toThrow('Inventory reorderPoint must be a finite non-negative number or null.');

    await expect(
      service.patchItem(authUser as never, item._id.toString(), {
        targetOnHand: Number.POSITIVE_INFINITY as unknown as number,
      }),
    ).rejects.toThrow('Inventory targetOnHand must be a finite non-negative number or null.');

    await expect(
      service.patchItem(authUser as never, item._id.toString(), {
        reorderPoint: -1,
      }),
    ).rejects.toThrow('Inventory reorderPoint must be a finite non-negative number or null.');

    await expect(
      service.patchItem(authUser as never, item._id.toString(), {
        targetOnHand: -2,
      }),
    ).rejects.toThrow('Inventory targetOnHand must be a finite non-negative number or null.');
  });

  it('supports legacy status-only inventory documents in list filters', async () => {
    const userId = new Types.ObjectId();
    const inventoryItemModel = createModelMock();
    const inventoryEventModel = createModelMock();
    const groceryListModel = createModelMock();
    const weeklyPlanModel = createModelMock();
    const usersService = {
      ensureUser: jest.fn().mockResolvedValue({ _id: userId }),
    };

    const service = new InventoryService(
      inventoryItemModel as never,
      inventoryEventModel as never,
      groceryListModel as never,
      weeklyPlanModel as never,
      usersService as never,
      new DefaultDataFactory(),
    );

    inventoryItemModel.find.mockResolvedValue([
      {
        ...createInventoryItem(userId),
        name: 'Low Stock Legacy',
        replenishmentState: undefined,
        freshnessState: undefined,
        status: 'low_stock',
      },
      {
        ...createInventoryItem(userId),
        name: 'Expired Legacy',
        replenishmentState: undefined,
        freshnessState: undefined,
        status: 'expired',
      },
      {
        ...createInventoryItem(userId),
        name: 'Fresh Split',
        replenishmentState: 'in_stock',
        freshnessState: 'fresh',
      },
    ]);

    const inStock = await service.getItems(authUser as never, 'in-stock');
    const expiring = await service.getItems(authUser as never, 'expiring');

    expect(inStock.items.map((item) => item.name)).toContain('Low Stock Legacy');
    expect(expiring.items.map((item) => item.name)).toContain('Expired Legacy');
  });

  it('merges OCR receipt lines by canonical key across ingredient aliases', async () => {
    const userId = new Types.ObjectId();
    const inventoryItemModel = createModelMock();
    const inventoryEventModel = createModelMock();
    const groceryListModel = createModelMock();
    const weeklyPlanModel = createModelMock();
    const usersService = {
      ensureUser: jest.fn().mockResolvedValue({ _id: userId }),
    };
    const item = createInventoryItem(userId);
    item.name = 'Fresh spinach';
    item.normalizedName = 'fresh spinach';
    item.canonicalKey = 'spinach';
    item.quantity = { value: 100, unit: 'g' };
    item.source = 'manual';
    const reviewEvent = {
      _id: new Types.ObjectId(),
      metadata: {
        confidence: 0.97,
        receiptLabel: 'Market receipt',
        lines: [
          {
            id: new Types.ObjectId(),
            rawText: 'SPINACH LEAVES',
            name: 'Spinach leaves',
            quantityValue: 200,
            quantityUnit: 'g',
            confidence: 0.97,
            accepted: true,
          },
        ],
      },
    };
    const createdEvent = {
      _id: new Types.ObjectId(),
    };

    inventoryEventModel.findOne.mockReturnValue({
      sort: jest.fn().mockResolvedValue(reviewEvent),
    });
    inventoryEventModel.create.mockResolvedValue(createdEvent);
    inventoryItemModel.findOne.mockResolvedValue(item);

    const service = new InventoryService(
      inventoryItemModel as never,
      inventoryEventModel as never,
      groceryListModel as never,
      weeklyPlanModel as never,
      usersService as never,
      new DefaultDataFactory(),
    );

    const result = await service.applyOcrReview(authUser as never);

    expect(inventoryItemModel.findOne).toHaveBeenCalledWith({
      userId,
      canonicalKey: 'spinach',
    });
    expect(item.quantity).toEqual({ value: 300, unit: 'g' });
    expect(item.source).toBe('ocr');
    expect(item.lastEventId).toBe(createdEvent._id);
    expect(item.save).toHaveBeenCalled();
    expect(result.updatedItems).toHaveLength(1);
    expect(result.updatedItems[0]).toMatchObject({
      canonicalKey: 'spinach',
      normalizedName: 'fresh spinach',
      quantity: { value: 300, unit: 'g' },
    });
  });
});
