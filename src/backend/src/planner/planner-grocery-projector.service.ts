import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  GROCERY_LIST_MODEL,
  GroceryListItemValue,
  GroceryListRecord,
  INVENTORY_ITEM_MODEL,
  InventoryItemRecord,
  RECIPE_MODEL,
  RecipeRecord,
  WeeklyPlanDayValue,
} from '../data/schemas';
import { canonicalizeItemName } from '../common/item-canonicalization';

@Injectable()
export class PlannerGroceryProjector {
  constructor(
    @InjectModel(GROCERY_LIST_MODEL)
    private readonly groceryListModel: Model<GroceryListRecord>,
    @InjectModel(INVENTORY_ITEM_MODEL)
    private readonly inventoryItemModel: Model<InventoryItemRecord>,
    @InjectModel(RECIPE_MODEL)
    private readonly recipeModel: Model<RecipeRecord>,
  ) {}

  async rebuildFromAcceptedPlan(
    userId: Types.ObjectId,
    weeklyPlanId: Types.ObjectId,
    days: WeeklyPlanDayValue[],
  ) {
    const selectedRecipeIds = [
      ...new Set(
        days.flatMap((day) => day.meals.map((meal) => meal.recipeId.toString())),
      ),
    ];
    const [selectedRecipes, inventoryItems] = await Promise.all([
      this.recipeModel.find({
        _id: { $in: selectedRecipeIds },
        userId,
      }),
      this.inventoryItemModel.find({ userId }),
    ]);
    const eligibleInventoryItems = inventoryItems.filter((item) =>
      this.isUsableInventoryForProjection(item),
    );
    const aggregates = new Map<
      string,
      {
        name: string;
        canonicalKey: string;
        quantity: { value: number; unit: string };
        recipeIds: Set<string>;
      }
    >();

    for (const recipe of selectedRecipes) {
      for (const ingredient of recipe.ingredients) {
        const quantity = ingredient.measurement;
        const canonical = canonicalizeItemName(ingredient.name);
        const key = `${canonical.canonicalKey}::${quantity.unit}`;
        const existing = aggregates.get(key);

        if (existing) {
          existing.quantity.value += quantity.value;
          existing.recipeIds.add(recipe._id.toString());
          continue;
        }

        aggregates.set(key, {
          name: ingredient.name,
          canonicalKey: canonical.canonicalKey,
          quantity,
          recipeIds: new Set([recipe._id.toString()]),
        });
      }
    }

    const weeklyPlanItems: GroceryListItemValue[] = Array.from(
      aggregates.values(),
    )
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((entry) => ({
        ...entry,
        quantity: this.subtractInventoryQuantity(
          entry.name,
          entry.canonicalKey,
          entry.quantity,
          eligibleInventoryItems,
        ),
      }))
      .filter((entry) => entry.quantity.value > 0)
      .map((entry) => ({
        itemId: new Types.ObjectId(),
        name: entry.name,
        canonicalKey: entry.canonicalKey,
        quantity: {
          value: Number(entry.quantity.value.toFixed(2)),
          unit: entry.quantity.unit,
        },
        status: 'to_buy',
        source: 'weekly_plan',
        inventoryItemId: null,
        recipeIds: Array.from(entry.recipeIds).map(
          (recipeId) => new Types.ObjectId(recipeId),
        ),
        notes: 'Needed for this week',
      }));

    const groceryList = await this.groceryListModel.findOne({
      userId,
      weeklyPlanId,
    });

    if (!groceryList) {
      await this.groceryListModel.create({
        userId,
        weeklyPlanId,
        status: 'active',
        items: weeklyPlanItems,
        lastComputedAt: new Date(),
      });
      return;
    }

    const preservedItems = groceryList.items.filter(
      (item) => item.source !== 'weekly_plan',
    );

    groceryList.items = this.mergeWithPreservedItems(
      weeklyPlanItems,
      preservedItems,
    );
    groceryList.status = 'active';
    groceryList.lastComputedAt = new Date();
    await groceryList.save();
  }

  private getLegacyStatus(item: InventoryItemRecord) {
    const legacyStatus = (item as unknown as { status?: unknown }).status;

    if (
      legacyStatus === 'fresh' ||
      legacyStatus === 'use_soon' ||
      legacyStatus === 'expired' ||
      legacyStatus === 'low_stock'
    ) {
      return legacyStatus;
    }

    return null;
  }

  private getFreshnessStateWithFallback(item: InventoryItemRecord) {
    if (item.freshnessState) {
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

    return 'unknown' as const;
  }

  private getReplenishmentStateWithFallback(item: InventoryItemRecord) {
    if (item.replenishmentState) {
      return item.replenishmentState;
    }

    const legacyStatus = this.getLegacyStatus(item);
    if (legacyStatus === 'low_stock') {
      return 'low_stock' as const;
    }

    return 'in_stock' as const;
  }

  private isUsableInventoryForProjection(item: InventoryItemRecord) {
    return (
      this.getFreshnessStateWithFallback(item) !== 'expired' &&
      this.getReplenishmentStateWithFallback(item) !== 'out_of_stock'
    );
  }

  private mergeWithPreservedItems(
    weeklyPlanItems: GroceryListItemValue[],
    preservedItems: GroceryListItemValue[],
  ) {
    const mergedItems = [...weeklyPlanItems];
    const weeklyItemIndexes = new Map<string, number>();

    weeklyPlanItems.forEach((item, index) => {
      weeklyItemIndexes.set(
        this.getItemKey(item.canonicalKey ?? item.name, item.quantity.unit),
        index,
      );
    });

    for (const preservedItem of preservedItems) {
      const key = this.getItemKey(
        preservedItem.canonicalKey ?? preservedItem.name,
        preservedItem.quantity.unit,
      );
      const weeklyItemIndex = weeklyItemIndexes.get(key);

      if (
        preservedItem.status === 'to_buy' &&
        weeklyItemIndex !== undefined
      ) {
        const weeklyItem = mergedItems[weeklyItemIndex];
        mergedItems[weeklyItemIndex] = {
          ...weeklyItem,
          canonicalKey: weeklyItem.canonicalKey ?? preservedItem.canonicalKey,
          itemId: preservedItem.itemId,
          source: preservedItem.source,
          inventoryItemId:
            preservedItem.inventoryItemId ?? weeklyItem.inventoryItemId ?? null,
          notes: this.mergeNotes(weeklyItem.notes, preservedItem.notes),
        };
        continue;
      }

      mergedItems.push(preservedItem);
    }

    return mergedItems;
  }

  private getItemKey(canonicalNameOrLabel: string, unit: string) {
    const canonical = canonicalizeItemName(canonicalNameOrLabel);
    return `${canonical.canonicalKey}::${unit}`;
  }

  private mergeNotes(
    weeklyPlanNote: string | undefined,
    preservedNote: string | undefined,
  ) {
    if (weeklyPlanNote && preservedNote && weeklyPlanNote !== preservedNote) {
      return `${weeklyPlanNote} • ${preservedNote}`;
    }

    return weeklyPlanNote ?? preservedNote;
  }

  private subtractInventoryQuantity(
    ingredientName: string,
    ingredientCanonicalKey: string,
    quantity: { value: number; unit: string },
    inventoryItems: InventoryItemRecord[],
  ) {
    const availableQuantity = inventoryItems.reduce((total, inventoryItem) => {
      if (
        !this.inventoryMatchesIngredient(
          inventoryItem,
          ingredientName,
          ingredientCanonicalKey,
          quantity.unit,
        )
      ) {
        return total;
      }

      return total + (inventoryItem.quantity?.value ?? 0);
    }, 0);

    return {
      value: Number(Math.max(quantity.value - availableQuantity, 0).toFixed(2)),
      unit: quantity.unit,
    };
  }

  private inventoryMatchesIngredient(
    inventoryItem: InventoryItemRecord,
    ingredientName: string,
    ingredientCanonicalKey: string,
    ingredientUnit: string,
  ) {
    const inventoryCanonical =
      inventoryItem.canonicalKey || canonicalizeItemName(inventoryItem.name).canonicalKey;

    if (inventoryCanonical !== ingredientCanonicalKey) {
      return false;
    }

    const inventoryUnit = inventoryItem.quantity?.unit;
    const inventoryValue = inventoryItem.quantity?.value;
    if (!inventoryUnit || inventoryValue == null || inventoryValue <= 0) {
      return false;
    }

    if (inventoryUnit === ingredientUnit) {
      return true;
    }

    return this.areCompatibleCountUnits(
      canonicalizeItemName(ingredientName).canonicalKey,
      ingredientUnit,
      inventoryUnit,
    );
  }

  private areCompatibleCountUnits(
    normalizedName: string,
    ingredientUnit: string,
    inventoryUnit: string,
  ) {
    if (!normalizedName.includes('egg')) {
      return false;
    }

    return (
      (ingredientUnit === 'egg' && inventoryUnit === 'piece') ||
      (ingredientUnit === 'piece' && inventoryUnit === 'egg')
    );
  }
}
