import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import type { AuthenticatedUser } from '../common/current-user';
import { normalizeMeasurementValue } from '../common/measurement';
import {
  GROCERY_LIST_MODEL,
  GroceryListRecord,
  INVENTORY_EVENT_MODEL,
  INVENTORY_ITEM_MODEL,
  InventoryEventItemValue,
  InventoryEventRecord,
  InventoryItemRecord,
  WEEKLY_PLAN_MODEL,
  WeeklyPlanRecord,
} from '../data/schemas';
import { UsersService } from '../users/users.service';

function normalizeName(value: string) {
  return value.toLowerCase().trim();
}

@Injectable()
export class GroceryService {
  constructor(
    @InjectModel(GROCERY_LIST_MODEL)
    private readonly groceryListModel: Model<GroceryListRecord>,
    @InjectModel(WEEKLY_PLAN_MODEL)
    private readonly weeklyPlanModel: Model<WeeklyPlanRecord>,
    @InjectModel(INVENTORY_ITEM_MODEL)
    private readonly inventoryItemModel: Model<InventoryItemRecord>,
    @InjectModel(INVENTORY_EVENT_MODEL)
    private readonly inventoryEventModel: Model<InventoryEventRecord>,
    private readonly usersService: UsersService,
  ) {}

  async getCurrentList(authUser: AuthenticatedUser) {
    const groceryList = await this.requireCurrentList(authUser);
    return this.toResponse(groceryList);
  }

  async syncFromPlan(authUser: AuthenticatedUser) {
    const groceryList = await this.requireCurrentList(authUser);
    groceryList.lastComputedAt = new Date();
    await groceryList.save();
    return this.toResponse(groceryList);
  }

  async markPurchased(authUser: AuthenticatedUser, itemIds: string[]) {
    const user = await this.usersService.ensureUser(authUser);
    return this.runInOptionalTransaction((session) =>
      this.markPurchasedForUser(user._id, itemIds, session),
    );
  }

  async markAllPurchased(authUser: AuthenticatedUser) {
    const groceryList = await this.requireCurrentList(authUser);
    const itemIds = groceryList.items
      .filter((item) => item.status === 'to_buy')
      .map((item) => item.itemId.toString());

    return this.markPurchased(authUser, itemIds);
  }

  async moveLowStockToBuy(authUser: AuthenticatedUser) {
    const user = await this.usersService.ensureUser(authUser);
    const groceryList = await this.requireCurrentList(authUser);
    const lowStockItems = await this.inventoryItemModel.find({
      userId: user._id,
      status: 'low_stock',
    });

    this.upsertItemsIntoList(groceryList, lowStockItems, 'low_stock');
    await groceryList.save();

    return this.toResponse(groceryList);
  }

  async moveUrgentToBuy(authUser: AuthenticatedUser) {
    const user = await this.usersService.ensureUser(authUser);
    const groceryList = await this.requireCurrentList(authUser);
    const urgentItems = await this.inventoryItemModel.find({
      userId: user._id,
      status: { $in: ['use_soon', 'expired'] },
    });

    this.upsertItemsIntoList(groceryList, urgentItems, 'urgent_expiring');
    await groceryList.save();

    return this.toResponse(groceryList);
  }

  private async markPurchasedForUser(
    userId: GroceryListRecord['userId'],
    itemIds: string[],
    session?: ClientSession,
  ) {
    const groceryList = await this.requireCurrentListDocument(userId, session);
    const selectedItems = groceryList.items.filter(
      (item) =>
        item.status === 'to_buy' && itemIds.includes(item.itemId.toString()),
    );

    if (selectedItems.length === 0) {
      return this.toResponse(groceryList);
    }

    groceryList.items = groceryList.items.map((item) =>
      itemIds.includes(item.itemId.toString())
        ? { ...item, status: 'purchased' }
        : item,
    );
    const [event] = await this.inventoryEventModel.create(
      [
        {
          userId,
          type: 'ADD',
          source: 'kitchen_hub',
          items: selectedItems.map<InventoryEventItemValue>((item) => ({
            inventoryItemId: item.inventoryItemId ?? null,
            name: item.name,
            quantity: {
              value: item.quantity.value,
              unit: item.quantity.unit,
            },
          })),
          weeklyPlanId: groceryList.weeklyPlanId,
          recipeId: null,
          metadata: {},
          createdAt: new Date(),
        },
      ],
      session ? { session } : undefined,
    );

    for (const item of selectedItems) {
      const normalizedName = normalizeName(item.name);
      const existingInventoryItem = await this.inventoryItemModel.findOne(
        {
          userId,
          normalizedName,
        },
        null,
        session ? { session } : undefined,
      );

      if (existingInventoryItem) {
        existingInventoryItem.quantity = this.mergeQuantities(
          item.name,
          existingInventoryItem.quantity,
          item.quantity,
        );
        existingInventoryItem.status = 'fresh';
        existingInventoryItem.source = 'kitchen_hub';
        existingInventoryItem.lastEventId = event._id;
        await existingInventoryItem.save(session ? { session } : undefined);
        continue;
      }

      const [created] = await this.inventoryItemModel.create(
        [
          {
            userId,
            name: item.name,
            normalizedName,
            location: 'pantry',
            quantity: {
              value: item.quantity.value,
              unit: item.quantity.unit,
            },
            status: 'fresh',
            dates: {
              addedAt: new Date(),
              openedAt: null,
              expiresAt: null,
              lastUsedAt: null,
            },
            freshness: {
              estimatedDaysLeft: null,
              confidence: 'medium',
            },
            source: 'kitchen_hub',
            lastEventId: event._id,
            metadata: {},
          },
        ],
        session ? { session } : undefined,
      );

      groceryList.items = groceryList.items.map((entry) =>
        entry.itemId.toString() === item.itemId.toString()
          ? { ...entry, inventoryItemId: created._id }
          : entry,
      );
    }

    await groceryList.save(session ? { session } : undefined);

    return this.toResponse(groceryList);
  }

  private async requireCurrentList(authUser: AuthenticatedUser) {
    const user = await this.usersService.ensureUser(authUser);
    return this.requireCurrentListDocument(user._id);
  }

  private async requireCurrentListDocument(
    userId: GroceryListRecord['userId'],
    session?: ClientSession,
  ) {
    const currentPlan = await this.weeklyPlanModel
      .findOne(
        { userId, status: 'active' },
        null,
        session ? { session } : undefined,
      )
      .sort({ weekStartAt: -1 });

    if (!currentPlan) {
      throw new NotFoundException('No active weekly plan found.');
    }

    const groceryList = await this.groceryListModel.findOne(
      {
        userId,
        weeklyPlanId: currentPlan._id,
      },
      null,
      session ? { session } : undefined,
    );

    if (!groceryList) {
      throw new NotFoundException('No active grocery list found.');
    }

    return groceryList;
  }

  private async runInOptionalTransaction<T>(
    operation: (session?: ClientSession) => Promise<T>,
  ) {
    const startSession = this.groceryListModel.db?.startSession?.bind(
      this.groceryListModel.db,
    );

    if (!startSession) {
      return operation();
    }

    const session = await startSession();

    try {
      return await session.withTransaction(async () => operation(session));
    } catch (error) {
      if (!this.isUnsupportedTransactionError(error)) {
        throw error;
      }

      return operation();
    } finally {
      await session.endSession();
    }
  }

  private isUnsupportedTransactionError(error: unknown) {
    if (!(error instanceof Error)) {
      return false;
    }

    return (
      error.message.includes('Transaction numbers are only allowed') ||
      error.message.includes('Transaction support is required')
    );
  }

  private upsertItemsIntoList(
    groceryList: GroceryListRecord,
    inventoryItems: InventoryItemRecord[],
    source: 'low_stock' | 'urgent_expiring',
  ) {
    for (const inventoryItem of inventoryItems) {
      const existing = groceryList.items.find(
        (item) =>
          normalizeName(item.name) === normalizeName(inventoryItem.name),
      );

      if (existing) {
        existing.status = 'to_buy';
        existing.source = source;
        existing.inventoryItemId = inventoryItem._id;
        continue;
      }

      groceryList.items.push({
        itemId: inventoryItem._id,
        name: inventoryItem.name,
        quantity: {
          value: 1,
          unit: inventoryItem.quantity?.unit ?? 'piece',
        },
        status: 'to_buy',
        source,
        inventoryItemId: inventoryItem._id,
        recipeIds: [],
        notes:
          source === 'low_stock'
            ? 'Low stock item added from Kitchen inventory'
            : 'Urgent item added from Kitchen inventory',
      });
    }
  }

  private toResponse(groceryList: GroceryListRecord) {
    return {
      id: groceryList._id.toString(),
      weeklyPlanId: groceryList.weeklyPlanId.toString(),
      status: groceryList.status,
      items: groceryList.items.map((item) => ({
        itemId: item.itemId.toString(),
        name: item.name,
        quantity: item.quantity,
        status: item.status,
        source: item.source,
        inventoryItemId: item.inventoryItemId?.toString() ?? null,
        recipeIds: item.recipeIds?.map((recipeId) => recipeId.toString()) ?? [],
        notes: item.notes,
      })),
    };
  }

  private mergeQuantities(
    name: string,
    current:
      | {
          value: number | null;
          unit: string | null;
        }
      | undefined,
    incoming: {
      value: number;
      unit: string;
    },
  ) {
    const normalizedIncoming = normalizeMeasurementValue(
      incoming.value,
      incoming.unit,
    );

    if (current?.value == null || current.unit == null) {
      return normalizedIncoming;
    }

    const normalizedCurrent = normalizeMeasurementValue(current.value, current.unit);
    if (normalizedCurrent.unit !== normalizedIncoming.unit) {
      throw new BadRequestException(
        `Cannot merge incompatible units for ${name}.`,
      );
    }

    return {
      value: Number(
        (normalizedCurrent.value + normalizedIncoming.value).toFixed(2),
      ),
      unit: normalizedCurrent.unit,
    };
  }
}
