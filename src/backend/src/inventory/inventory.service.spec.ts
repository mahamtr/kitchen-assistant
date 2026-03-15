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
      status: 'fresh',
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
});
