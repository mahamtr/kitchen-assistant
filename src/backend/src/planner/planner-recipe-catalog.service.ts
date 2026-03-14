import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  deriveRecipeMeasurement,
  formatMeasurement,
} from '../common/measurement';
import { DefaultDataFactory } from '../data/default-data.factory';
import {
  RECIPE_GENERATION_MODEL,
  RECIPE_MODEL,
  RecipeGenerationRecord,
  RecipeRecord,
  WEEKLY_PLAN_MODEL,
  WeeklyPlanRecord,
} from '../data/schemas';
import { estimateRecipeCalories } from './planner.shared';

@Injectable()
export class PlannerRecipeCatalogService {
  constructor(
    @InjectModel(RECIPE_MODEL)
    private readonly recipeModel: Model<RecipeRecord>,
    @InjectModel(WEEKLY_PLAN_MODEL)
    private readonly weeklyPlanModel: Model<WeeklyPlanRecord>,
    @InjectModel(RECIPE_GENERATION_MODEL)
    private readonly recipeGenerationModel: Model<RecipeGenerationRecord>,
    private readonly defaultDataFactory: DefaultDataFactory,
  ) {}

  async getOrSeedCatalog(userId: Types.ObjectId, now = new Date()) {
    await this.backfillRecipeOwnershipForUser(userId);

    let recipes = await this.recipeModel
      .find({
        userId,
        status: 'published',
      })
      .sort({ createdAt: -1 });

    if (recipes.length === 0) {
      const inserted = await this.recipeModel.insertMany(
        this.defaultDataFactory.createPlannerRecipeCatalog(userId, now),
      );
      recipes = inserted as unknown as typeof recipes;
    }

    await this.backfillRecipeMeasurements(recipes);
    return recipes;
  }

  async getOwnedRecipesByIds(userId: Types.ObjectId, recipeIds: string[]) {
    await this.backfillRecipeOwnershipForUser(userId);
    const uniqueRecipeIds = [...new Set(recipeIds)];
    const recipes = await this.recipeModel.find({
      _id: { $in: uniqueRecipeIds },
      userId,
    });

    await this.backfillRecipeMeasurements(recipes);
    return recipes;
  }

  toAllowedRecipe(recipe: RecipeRecord) {
    return {
      recipeId: recipe._id.toString(),
      title: recipe.title,
      summary: recipe.summary ?? '',
      calories: estimateRecipeCalories(recipe),
      tags: recipe.tags ?? [],
    };
  }

  async assertOwnedRecipe(userId: Types.ObjectId, recipeId: string) {
    const [recipe] = await this.getOwnedRecipesByIds(userId, [recipeId]);

    if (!recipe) {
      throw new NotFoundException('Recipe not found.');
    }

    return recipe;
  }

  async backfillRecipeOwnershipForUser(userId: Types.ObjectId) {
    const [plans, generations] = await Promise.all([
      this.weeklyPlanModel.find({ userId }).select('_id'),
      this.recipeGenerationModel.find({ userId }).select('_id'),
    ]);
    const planIds = plans.map((plan) => plan._id);
    const generationIds = generations.map((generation) => generation._id);

    if (planIds.length > 0) {
      await this.recipeModel.updateMany(
        {
          userId: null,
          weeklyPlanId: { $in: planIds },
        },
        {
          $set: {
            userId,
          },
        },
      );
    }

    if (generationIds.length > 0) {
      await this.recipeModel.updateMany(
        {
          userId: null,
          sourceGenerationId: { $in: generationIds },
        },
        {
          $set: {
            userId,
          },
        },
      );
    }
  }

  private async backfillRecipeMeasurements(recipes: RecipeRecord[]) {
    for (const recipe of recipes) {
      let changed = false;

      recipe.ingredients = recipe.ingredients.map((ingredient) => {
        const measurement =
          ingredient.measurement ??
          deriveRecipeMeasurement(ingredient.name, ingredient.quantity);
        const quantity = formatMeasurement(measurement);

        if (
          !ingredient.measurement ||
          ingredient.measurement.value !== measurement.value ||
          ingredient.measurement.unit !== measurement.unit ||
          ingredient.quantity !== quantity
        ) {
          changed = true;
        }

        return {
          id: ingredient.id,
          name: ingredient.name,
          quantity,
          measurement,
          note: ingredient.note,
        };
      });

      const save = (recipe as { save?: () => Promise<unknown> }).save;
      if (changed && typeof save === 'function') {
        await save.call(recipe);
      }
    }
  }
}
