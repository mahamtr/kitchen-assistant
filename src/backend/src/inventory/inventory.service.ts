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
import { canonicalizeItemName } from '../common/item-canonicalization';
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
  QuantityValue,
  WEEKLY_PLAN_MODEL,
  WeeklyPlanRecord,
} from '../data/schemas';
import { UsersService } from '../users/users.service';

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
    | 'freshnessState'
    | 'replenishmentState'
    | 'reorderPoint'
    | 'targetOnHand'
    | 'dates'
    | 'freshness'
    | 'metadata'
  >
>;

type LegacyInventoryStatus = 'fresh' | 'use_soon' | 'expired' | 'low_stock';

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
  ) { }

  async getSummary(authUser: AuthenticatedUser) {
    const user = await this.usersService.ensureUser(authUser);
    const [inventoryItems, groceryList] = await Promise.all([
      this.inventoryItemModel.find({ userId: user._id }),
      this.getCurrentGroceryListDocument(user._id),
    ]);

    const urgentItems = inventoryItems
      .filter((item) => {
        const freshnessState = this.resolveFreshnessState(item);
        return freshnessState === 'use_soon' || freshnessState === 'expired';
      })
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
      expiringCount: inventoryItems.filter((item) => {
        const freshnessState = this.resolveFreshnessState(item);
        return ['use_soon', 'expired'].includes(freshnessState);
      }).length,
      lowStockCount: inventoryItems.filter((item) => {
        const replenishmentState = this.resolveReplenishmentState(item);
        return replenishmentState === 'low_stock' || replenishmentState === 'out_of_stock';
      }).length,
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
      .filter((item) => {
        if (view === 'in-stock') {
          const replenishmentState = this.resolveReplenishmentState(item);
          return ['in_stock', 'low_stock'].includes(replenishmentState);
        }

        const freshnessState = this.resolveFreshnessState(item);
        return ['use_soon', 'expired'].includes(freshnessState);
      })
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
      const canonical = canonicalizeItemName(nextPatch.name);
      item.normalizedName = canonical.normalizedName;
      item.canonicalKey = canonical.canonicalKey;
    }

    if (!('replenishmentState' in nextPatch)) {
      item.replenishmentState = this.deriveReplenishmentState(item);
    }
    if (!('freshnessState' in nextPatch)) {
      item.freshnessState = this.deriveFreshnessState(item);
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
      'freshnessState',
      'replenishmentState',
      'reorderPoint',
      'targetOnHand',
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

    if ('freshnessState' in patch) {
      if (
        patch.freshnessState !== 'fresh' &&
        patch.freshnessState !== 'use_soon' &&
        patch.freshnessState !== 'expired' &&
        patch.freshnessState !== 'unknown'
      ) {
        throw new BadRequestException('Invalid inventory freshnessState.');
      }
      nextPatch.freshnessState = patch.freshnessState;
    }

    if ('replenishmentState' in patch) {
      if (
        patch.replenishmentState !== 'in_stock' &&
        patch.replenishmentState !== 'low_stock' &&
        patch.replenishmentState !== 'out_of_stock'
      ) {
        throw new BadRequestException('Invalid inventory replenishmentState.');
      }
      nextPatch.replenishmentState = patch.replenishmentState;
    }

    if ('reorderPoint' in patch) {
      if (patch.reorderPoint !== null && typeof patch.reorderPoint !== 'number') {
        throw new BadRequestException('Inventory reorderPoint must be a number or null.');
      }
      nextPatch.reorderPoint = patch.reorderPoint as number | null;
    }

    if ('targetOnHand' in patch) {
      if (patch.targetOnHand !== null && typeof patch.targetOnHand !== 'number') {
        throw new BadRequestException('Inventory targetOnHand must be a number or null.');
      }
      nextPatch.targetOnHand = patch.targetOnHand as number | null;
    }

    if ('quantity' in patch) {
      nextPatch.quantity = this.toValidatedQuantity(patch.quantity);
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

  private toValidatedQuantity(value: unknown): QuantityValue {
    if (!isPlainObject(value)) {
      throw new BadRequestException('Inventory quantity must be an object.');
    }

    const allowedKeys = new Set(['value', 'unit']);
    const unknownKeys = Object.keys(value).filter((key) => !allowedKeys.has(key));

    if (unknownKeys.length > 0) {
      throw new BadRequestException(
        `Unsupported inventory quantity fields: ${unknownKeys.join(', ')}`,
      );
    }

    const quantity = {
      value: 'value' in value ? value.value : null,
      unit: 'unit' in value ? value.unit : null,
    };

    if (quantity.value !== null && typeof quantity.value !== 'number') {
      throw new BadRequestException(
        'Inventory quantity value must be a number or null.',
      );
    }

    if (quantity.unit !== null && typeof quantity.unit !== 'string') {
      throw new BadRequestException(
        'Inventory quantity unit must be a string or null.',
      );
    }

    try {
      return normalizeOptionalMeasurement({
        value: quantity.value,
        unit: quantity.unit,
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid inventory quantity.',
      );
    }
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
      const canonical = canonicalizeItemName(line.name);
      const existing = await this.inventoryItemModel.findOne({
        userId: user._id,
        canonicalKey: canonical.canonicalKey,
      });

      if (existing) {
        if (!existing.canonicalKey || !existing.normalizedName) {
          existing.canonicalKey = canonical.canonicalKey;
          existing.normalizedName = canonical.normalizedName;
        }

        existing.quantity = this.mergeQuantities(
          line.name,
          existing.quantity,
          {
            value: line.quantityValue,
            unit: line.quantityUnit,
          },
        );
        existing.source = 'ocr';
        existing.freshnessState = this.deriveFreshnessState(existing);
        existing.replenishmentState = this.deriveReplenishmentState(existing);
        existing.lastEventId = event._id;
        await existing.save();
        updatedItems.push(existing);
        continue;
      }

      const created = await this.inventoryItemModel.create({
        userId: user._id,
        name: line.name,
        normalizedName: canonical.normalizedName,
        canonicalKey: canonical.canonicalKey,
        location: 'pantry',
        quantity: {
          value: line.quantityValue,
          unit: line.quantityUnit,
        },
        replenishmentState: 'in_stock',
        freshnessState: 'unknown',
        reorderPoint: 1,
        targetOnHand: null,
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

  private getLegacyStatus(item: InventoryItemRecord): LegacyInventoryStatus | null {
    const legacyValue = (item as unknown as { status?: unknown }).status;

    if (
      legacyValue === 'fresh' ||
      legacyValue === 'use_soon' ||
      legacyValue === 'expired' ||
      legacyValue === 'low_stock'
    ) {
      return legacyValue;
    }

    return null;
  }

  private resolveReplenishmentState(
    item: InventoryItemRecord,
  ): 'in_stock' | 'low_stock' | 'out_of_stock' {
    if (
      item.replenishmentState === 'in_stock' ||
      item.replenishmentState === 'low_stock' ||
      item.replenishmentState === 'out_of_stock'
    ) {
      return item.replenishmentState;
    }

    const legacyStatus = this.getLegacyStatus(item);
    if (legacyStatus === 'low_stock') {
      return 'low_stock';
    }

    return this.deriveReplenishmentState(item);
  }

  private resolveFreshnessState(
    item: InventoryItemRecord,
  ): 'fresh' | 'use_soon' | 'expired' | 'unknown' {
    if (
      item.freshnessState === 'fresh' ||
      item.freshnessState === 'use_soon' ||
      item.freshnessState === 'expired' ||
      item.freshnessState === 'unknown'
    ) {
      return item.freshnessState;
    }

    const legacyStatus = this.getLegacyStatus(item);
    if (
      legacyStatus === 'fresh' ||
      legacyStatus === 'use_soon' ||
      legacyStatus === 'expired'
    ) {
      return legacyStatus;
    }

    return this.deriveFreshnessState(item);
  }

  private deriveReplenishmentState(item: InventoryItemRecord) {
    const quantityValue = item.quantity?.value ?? 0;
    const reorderPoint = item.reorderPoint ?? 1;

    if (quantityValue <= 0) {
      return 'out_of_stock' as const;
    }

    if (quantityValue <= reorderPoint) {
      return 'low_stock' as const;
    }

    return 'in_stock' as const;
  }

  private deriveFreshnessState(item: InventoryItemRecord) {
    const expiresAt = item.dates?.expiresAt;
    if (!expiresAt) {
      return 'unknown' as const;
    }

    const today = new Date();
    const nowDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const expDay = new Date(expiresAt.getFullYear(), expiresAt.getMonth(), expiresAt.getDate());
    const diff = Math.round((expDay.getTime() - nowDay.getTime()) / (1000 * 60 * 60 * 24));

    if (diff < 0) {
      return 'expired' as const;
    }

    if (diff <= 2) {
      return 'use_soon' as const;
    }

    return 'fresh' as const;
  }

  private toInventoryItem(item: InventoryItemRecord) {
    return {
      id: item._id.toString(),
      userId: item.userId.toString(),
      name: item.name,
      normalizedName: item.normalizedName,
      canonicalKey: item.canonicalKey ?? canonicalizeItemName(item.name).canonicalKey,
      category: item.category,
      location: item.location,
      quantity: item.quantity ?? { value: null, unit: null },
      replenishmentState: this.resolveReplenishmentState(item),
      freshnessState: this.resolveFreshnessState(item),
      reorderPoint: item.reorderPoint ?? null,
      targetOnHand: item.targetOnHand ?? null,
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
