import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { AuthenticatedUser } from '../common/current-user';
import {
  normalizeMeasurementValue,
  normalizeOptionalMeasurement,
} from '../common/measurement';
import { DefaultDataFactory } from '../data/default-data.factory';
import {
  GROCERY_LIST_MODEL,
  GroceryListRecord,
  InventoryDatesValue,
  InventoryFreshnessValue,
  INVENTORY_EVENT_MODEL,
  INVENTORY_ITEM_MODEL,
  InventoryEventRecord,
  InventoryItemRecord,
  OcrReceiptLineValue,
  WEEKLY_PLAN_MODEL,
  WeeklyPlanRecord,
} from '../data/schemas';
import { UsersService } from '../users/users.service';

function normalizeName(value: string) {
  return value.toLowerCase().trim();
}

function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type InventoryPatch = Partial<
  Pick<
    InventoryItemRecord,
    | 'name'
    | 'category'
    | 'location'
    | 'quantity'
    | 'status'
    | 'dates'
    | 'freshness'
    | 'metadata'
  >
>;

@Injectable()
export class InventoryService {
  constructor(
    @InjectModel(INVENTORY_ITEM_MODEL)
    private readonly inventoryItemModel: Model<InventoryItemRecord>,
    @InjectModel(INVENTORY_EVENT_MODEL)
    private readonly inventoryEventModel: Model<InventoryEventRecord>,
    @InjectModel(GROCERY_LIST_MODEL)
    private readonly groceryListModel: Model<GroceryListRecord>,
    @InjectModel(WEEKLY_PLAN_MODEL)
    private readonly weeklyPlanModel: Model<WeeklyPlanRecord>,
    private readonly usersService: UsersService,
    private readonly defaultDataFactory: DefaultDataFactory,
  ) {}

  async getSummary(authUser: AuthenticatedUser) {
    const user = await this.usersService.ensureUser(authUser);
    const [inventoryItems, groceryList] = await Promise.all([
      this.inventoryItemModel.find({ userId: user._id }),
      this.getCurrentGroceryListDocument(user._id),
    ]);

    const urgentItems = inventoryItems
      .filter((item) => item.status === 'use_soon' || item.status === 'expired')
      .sort((left, right) => {
        const leftValue =
          left.dates?.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const rightValue =
          right.dates?.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return leftValue - rightValue;
      })
      .slice(0, 3);

    return {
      toBuyCount:
        groceryList?.items.filter((item) => item.status === 'to_buy').length ??
        0,
      inStockCount: inventoryItems.length,
      expiringCount: inventoryItems.filter((item) =>
        ['use_soon', 'expired'].includes(item.status),
      ).length,
      lowStockCount: inventoryItems.filter(
        (item) => item.status === 'low_stock',
      ).length,
      urgentItems: urgentItems.map((item) => ({
        inventoryItemId: item._id.toString(),
        name: item.name,
        expiresAt: item.dates?.expiresAt?.toISOString() ?? null,
      })),
    };
  }

  async getItems(
    authUser: AuthenticatedUser,
    view: 'in-stock' | 'expiring',
    search = '',
  ) {
    const user = await this.usersService.ensureUser(authUser);
    const normalizedSearch = search.toLowerCase().trim();
    const items = await this.inventoryItemModel.find({ userId: user._id });

    const filtered = items
      .filter((item) =>
        view === 'in-stock'
          ? ['fresh', 'low_stock'].includes(item.status)
          : ['use_soon', 'expired'].includes(item.status),
      )
      .filter((item) =>
        normalizedSearch
          ? item.name.toLowerCase().includes(normalizedSearch)
          : true,
      )
      .sort((left, right) => left.name.localeCompare(right.name));

    return {
      items: filtered.map((item) => this.toInventoryItem(item)),
      total: filtered.length,
    };
  }

  async getItem(authUser: AuthenticatedUser, itemId: string) {
    const user = await this.usersService.ensureUser(authUser);
    const item = await this.inventoryItemModel.findOne({
      _id: itemId,
      userId: user._id,
    });

    if (!item) {
      throw new NotFoundException('Inventory item not found.');
    }

    const recentEvents = await this.inventoryEventModel
      .find({
        userId: user._id,
        $or: [
          { 'items.inventoryItemId': item._id },
          { 'items.name': item.name },
        ],
      })
      .sort({ createdAt: -1 })
      .limit(5);

    return {
      item: this.toInventoryItem(item),
      recentEvents: recentEvents.map((event) => this.toInventoryEvent(event)),
    };
  }

  async patchItem(
    authUser: AuthenticatedUser,
    itemId: string,
    patch: Record<string, unknown>,
  ) {
    const user = await this.usersService.ensureUser(authUser);
    const item = await this.inventoryItemModel.findOne({
      _id: itemId,
      userId: user._id,
    });

    if (!item) {
      throw new NotFoundException('Inventory item not found.');
    }

    const nextPatch = this.toValidatedPatch(patch);

    if (nextPatch.dates) {
      item.dates = {
        ...(item.dates ?? {}),
        ...nextPatch.dates,
      };
    }

    if (nextPatch.freshness) {
      item.freshness = {
        ...(item.freshness ?? {}),
        ...nextPatch.freshness,
      };
    }

    if (nextPatch.metadata) {
      item.metadata = {
        ...(item.metadata ?? {}),
        ...nextPatch.metadata,
      };
    }

    Object.assign(item, {
      ...nextPatch,
      dates: item.dates,
      freshness: item.freshness,
      metadata: item.metadata,
    });
    if (nextPatch.name) {
      item.normalizedName = normalizeName(nextPatch.name);
    }
    await item.save();

    return this.toInventoryItem(item);
  }

  async discardItem(authUser: AuthenticatedUser, itemId: string) {
    const user = await this.usersService.ensureUser(authUser);
    const item = await this.inventoryItemModel.findOne({
      _id: itemId,
      userId: user._id,
    });

    if (!item) {
      throw new NotFoundException('Inventory item not found.');
    }

    const event = await this.inventoryEventModel.create({
      userId: user._id,
      type: 'DISCARD',
      source: 'manual',
      items: [
        {
          inventoryItemId: item._id,
          name: item.name,
          quantity: item.quantity,
        },
      ],
      weeklyPlanId: null,
      recipeId: null,
      metadata: {},
      createdAt: new Date(),
    });

    await item.deleteOne();

    return this.toInventoryEvent(event);
  }

  private toValidatedPatch(patch: Record<string, unknown>): InventoryPatch {
    if (!isPlainObject(patch)) {
      throw new BadRequestException('Inventory patch must be an object.');
    }

    const allowedKeys = new Set([
      'name',
      'category',
      'location',
      'quantity',
      'status',
      'dates',
      'freshness',
      'metadata',
    ]);
    const unknownKeys = Object.keys(patch).filter((key) => !allowedKeys.has(key));

    if (unknownKeys.length > 0) {
      throw new BadRequestException(
        `Unsupported inventory patch fields: ${unknownKeys.join(', ')}`,
      );
    }

    const nextPatch: InventoryPatch = {};

    if ('name' in patch) {
      if (typeof patch.name !== 'string' || patch.name.trim().length === 0) {
        throw new BadRequestException('Inventory item name must be a non-empty string.');
      }
      nextPatch.name = patch.name.trim();
    }

    if ('category' in patch) {
      if (typeof patch.category !== 'string') {
        throw new BadRequestException('Inventory item category must be a string.');
      }
      nextPatch.category = patch.category.trim();
    }

    if ('location' in patch) {
      if (
        patch.location !== 'fridge' &&
        patch.location !== 'pantry' &&
        patch.location !== 'freezer' &&
        patch.location !== 'unknown'
      ) {
        throw new BadRequestException('Invalid inventory location.');
      }
      nextPatch.location = patch.location;
    }

    if ('status' in patch) {
      if (
        patch.status !== 'fresh' &&
        patch.status !== 'use_soon' &&
        patch.status !== 'expired' &&
        patch.status !== 'low_stock' &&
        patch.status !== 'unknown'
      ) {
        throw new BadRequestException('Invalid inventory status.');
      }
      nextPatch.status = patch.status;
    }

    if ('quantity' in patch) {
      if (!isPlainObject(patch.quantity)) {
        throw new BadRequestException('Inventory quantity must be an object.');
      }
      nextPatch.quantity = normalizeOptionalMeasurement(
        patch.quantity as InventoryItemRecord['quantity'],
      );
    }

    if ('dates' in patch) {
      nextPatch.dates = this.toValidatedDates(patch.dates);
    }

    if ('freshness' in patch) {
      nextPatch.freshness = this.toValidatedFreshness(patch.freshness);
    }

    if ('metadata' in patch) {
      if (!isPlainObject(patch.metadata)) {
        throw new BadRequestException('Inventory metadata must be an object.');
      }
      nextPatch.metadata = patch.metadata;
    }

    return nextPatch;
  }

  private toValidatedDates(value: unknown): InventoryDatesValue {
    if (!isPlainObject(value)) {
      throw new BadRequestException('Inventory dates must be an object.');
    }

    const allowedKeys = new Set([
      'addedAt',
      'openedAt',
      'expiresAt',
      'lastUsedAt',
    ]);
    const unknownKeys = Object.keys(value).filter((key) => !allowedKeys.has(key));

    if (unknownKeys.length > 0) {
      throw new BadRequestException(
        `Unsupported inventory date fields: ${unknownKeys.join(', ')}`,
      );
    }

    const dates: InventoryDatesValue = {};

    if ('addedAt' in value) {
      dates.addedAt = this.parseDateField(value.addedAt, 'addedAt');
    }
    if ('openedAt' in value) {
      dates.openedAt = this.parseNullableDateField(value.openedAt, 'openedAt');
    }
    if ('expiresAt' in value) {
      dates.expiresAt = this.parseNullableDateField(
        value.expiresAt,
        'expiresAt',
      );
    }
    if ('lastUsedAt' in value) {
      dates.lastUsedAt = this.parseNullableDateField(
        value.lastUsedAt,
        'lastUsedAt',
      );
    }

    return dates;
  }

  private toValidatedFreshness(value: unknown): InventoryFreshnessValue {
    if (!isPlainObject(value)) {
      throw new BadRequestException('Inventory freshness must be an object.');
    }

    const allowedKeys = new Set(['estimatedDaysLeft', 'confidence']);
    const unknownKeys = Object.keys(value).filter((key) => !allowedKeys.has(key));

    if (unknownKeys.length > 0) {
      throw new BadRequestException(
        `Unsupported inventory freshness fields: ${unknownKeys.join(', ')}`,
      );
    }

    const freshness: InventoryFreshnessValue = {};

    if ('estimatedDaysLeft' in value) {
      if (
        value.estimatedDaysLeft !== null &&
        typeof value.estimatedDaysLeft !== 'number'
      ) {
        throw new BadRequestException(
          'Inventory freshness estimatedDaysLeft must be a number or null.',
        );
      }
      freshness.estimatedDaysLeft = value.estimatedDaysLeft as number | null;
    }

    if ('confidence' in value) {
      if (
        value.confidence !== undefined &&
        value.confidence !== 'low' &&
        value.confidence !== 'medium' &&
        value.confidence !== 'high'
      ) {
        throw new BadRequestException('Invalid inventory freshness confidence.');
      }
      freshness.confidence = value.confidence as
        | InventoryFreshnessValue['confidence']
        | undefined;
    }

    return freshness;
  }

  private parseDateField(value: unknown, fieldName: string) {
    if (value instanceof Date) {
      return value;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException(`${fieldName} must be an ISO date string.`);
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${fieldName} must be a valid ISO date string.`);
    }

    return parsed;
  }

  private parseNullableDateField(value: unknown, fieldName: string) {
    if (value === null) {
      return null;
    }

    return this.parseDateField(value, fieldName);
  }

  async getEvents(authUser: AuthenticatedUser) {
    const user = await this.usersService.ensureUser(authUser);
    const events = await this.inventoryEventModel
      .find({ userId: user._id })
      .sort({ createdAt: -1 });

    return {
      events: events.map((event) => this.toInventoryEvent(event)),
    };
  }

  async getOcrReview(authUser: AuthenticatedUser) {
    const user = await this.usersService.ensureUser(authUser);
    const event = await this.inventoryEventModel
      .findOne({
        userId: user._id,
        type: 'MEMORY',
        source: 'ocr',
      })
      .sort({ createdAt: -1 });

    if (!event) {
      throw new NotFoundException('No OCR review available.');
    }

    const metadata = (event.metadata ?? {}) as {
      confidence?: number;
      receiptLabel?: string;
      lines?: OcrReceiptLineValue[];
    };

    return {
      eventId: event._id.toString(),
      confidence: Number(metadata.confidence ?? 0.93),
      receiptLabel: metadata.receiptLabel ?? 'Receipt review',
      lines: (metadata.lines ?? []).map((line) => ({
        ...line,
        id: line.id.toString(),
      })),
    };
  }

  async updateOcrLine(
    authUser: AuthenticatedUser,
    lineId: string,
    patch: Partial<OcrReceiptLineValue>,
  ) {
    const user = await this.usersService.ensureUser(authUser);
    const event = await this.inventoryEventModel
      .findOne({
        userId: user._id,
        type: 'MEMORY',
        source: 'ocr',
      })
      .sort({ createdAt: -1 });

    if (!event) {
      throw new NotFoundException('No OCR review available.');
    }

    const metadata = (event.metadata ?? {}) as {
      confidence?: number;
      receiptLabel?: string;
      lines?: OcrReceiptLineValue[];
    };

    metadata.lines = (metadata.lines ?? []).map((line) => {
      if (line.id.toString() !== lineId) {
        return line;
      }

      const nextValue = patch.quantityValue ?? line.quantityValue;
      const nextUnit = patch.quantityUnit ?? line.quantityUnit;
      const normalizedQuantity = normalizeMeasurementValue(nextValue, nextUnit);

      return {
        ...line,
        ...patch,
        quantityValue: normalizedQuantity.value,
        quantityUnit: normalizedQuantity.unit,
      };
    });
    event.metadata = metadata;
    await event.save();

    return this.getOcrReview(authUser);
  }

  async applyOcrReview(authUser: AuthenticatedUser) {
    const user = await this.usersService.ensureUser(authUser);
    const review = await this.getOcrReview(authUser);
    const acceptedLines = review.lines
      .filter((line) => line.accepted)
      .map((line) => {
        const normalizedQuantity = normalizeMeasurementValue(
          line.quantityValue,
          line.quantityUnit,
        );

        return {
          ...line,
          quantityValue: normalizedQuantity.value,
          quantityUnit: normalizedQuantity.unit,
        };
      });

    const event = await this.inventoryEventModel.create({
      userId: user._id,
      type: 'ADD',
      source: 'ocr',
      items: this.defaultDataFactory.createInventoryEventItemsFromOcrLines(
        acceptedLines.map((line) => ({
          ...line,
          id: new Types.ObjectId(line.id),
        })),
      ),
      weeklyPlanId: null,
      recipeId: null,
      metadata: {
        receiptLabel: review.receiptLabel,
      },
      createdAt: new Date(),
    });

    const updatedItems: InventoryItemRecord[] = [];

    for (const line of acceptedLines) {
      const normalizedName = normalizeName(line.name);
      const existing = await this.inventoryItemModel.findOne({
        userId: user._id,
        normalizedName,
      });

      if (existing) {
        existing.quantity = this.mergeQuantities(
          line.name,
          existing.quantity,
          {
            value: line.quantityValue,
            unit: line.quantityUnit,
          },
        );
        existing.status = 'fresh';
        existing.source = 'ocr';
        existing.lastEventId = event._id;
        await existing.save();
        updatedItems.push(existing);
        continue;
      }

      const created = await this.inventoryItemModel.create({
        userId: user._id,
        name: line.name,
        normalizedName,
        location: 'pantry',
        quantity: {
          value: line.quantityValue,
          unit: line.quantityUnit,
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
        source: 'ocr',
        lastEventId: event._id,
        metadata: {},
      });
      updatedItems.push(created);
    }

    return {
      appliedEventId: event._id.toString(),
      updatedItems: updatedItems.map((item) => this.toInventoryItem(item)),
    };
  }

  private async getCurrentGroceryListDocument(userId: Types.ObjectId) {
    const currentPlan = await this.weeklyPlanModel
      .findOne({ userId, status: 'active' })
      .sort({ weekStartAt: -1 });

    if (!currentPlan) {
      return null;
    }

    return this.groceryListModel.findOne({
      userId,
      weeklyPlanId: currentPlan._id,
    });
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

  private toInventoryItem(item: InventoryItemRecord) {
    return {
      id: item._id.toString(),
      userId: item.userId.toString(),
      name: item.name,
      normalizedName: item.normalizedName,
      category: item.category,
      location: item.location,
      quantity: item.quantity ?? { value: null, unit: null },
      status: item.status,
      dates: {
        addedAt: item.dates?.addedAt?.toISOString(),
        openedAt: item.dates?.openedAt?.toISOString() ?? null,
        expiresAt: item.dates?.expiresAt?.toISOString() ?? null,
        lastUsedAt: item.dates?.lastUsedAt?.toISOString() ?? null,
      },
      freshness: item.freshness ?? {},
      source: item.source,
      lastEventId: item.lastEventId?.toString() ?? null,
      metadata: item.metadata ?? {},
      createdAt: item.createdAt.toISOString(),
      lastUpdatedAt: item.lastUpdatedAt.toISOString(),
    };
  }

  private toInventoryEvent(event: InventoryEventRecord) {
    return {
      id: event._id.toString(),
      userId: event.userId.toString(),
      type: event.type,
      source: event.source,
      items: (event.items ?? []).map((item) => ({
        inventoryItemId: item.inventoryItemId?.toString() ?? null,
        name: item.name,
        quantity: item.quantity ?? { value: null, unit: null },
        quantityDelta: item.quantityDelta ?? { value: null, unit: null },
        before: item.before ?? undefined,
        after: item.after ?? undefined,
      })),
      weeklyPlanId: event.weeklyPlanId?.toString() ?? null,
      recipeId: event.recipeId?.toString() ?? null,
      metadata: event.metadata ?? {},
      createdAt: event.createdAt.toISOString(),
    };
  }
}
