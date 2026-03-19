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
