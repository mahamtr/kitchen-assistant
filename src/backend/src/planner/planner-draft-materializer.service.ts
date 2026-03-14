import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  formatMeasurement,
  normalizeMeasurementValue,
} from '../common/measurement';
import {
  PlannerDraftRecipeValue,
  RECIPE_MODEL,
  RecipeIngredientValue,
  RecipeRecord,
  WeeklyPlanDayValue,
  WeeklyPlanMealValue,
  WeeklyPlanRevisionOutputValue,
} from '../data/schemas';
import { PlannerRecipeCatalogService } from './planner-recipe-catalog.service';
import { estimateRecipeCalories } from './planner.shared';

@Injectable()
export class PlannerDraftMaterializer {
  constructor(
    @InjectModel(RECIPE_MODEL)
    private readonly recipeModel: Model<RecipeRecord>,
    private readonly plannerRecipeCatalogService: PlannerRecipeCatalogService,
  ) {}

  async materializeAcceptedOutput(
    userId: Types.ObjectId,
    weeklyPlanId: Types.ObjectId,
    latestOutput: WeeklyPlanRevisionOutputValue,
  ) {
    const existingRecipeIds = [
      ...new Set(
        latestOutput.days.flatMap((day) =>
          day.meals.flatMap((meal) =>
            meal.source === 'existing' ? [meal.recipeId.toString()] : [],
          ),
        ),
      ),
    ];
    const existingRecipes = await this.plannerRecipeCatalogService.getOwnedRecipesByIds(
      userId,
      existingRecipeIds,
    );
    const existingRecipeById = new Map(
      existingRecipes.map((recipe) => [recipe._id.toString(), recipe]),
    );

    if (existingRecipeById.size !== existingRecipeIds.length) {
      throw new BadRequestException(
        'Planner draft references recipes that are not available to this user.',
      );
    }

    const referencedDraftKeys = [
      ...new Set(
        latestOutput.days.flatMap((day) =>
          day.meals.flatMap((meal) =>
            meal.source === 'draft' ? [meal.draftRecipeKey] : [],
          ),
        ),
      ),
    ];
    const draftRecipeByKey = new Map(
      latestOutput.draftRecipes.map((draftRecipe) => [
        draftRecipe.draftRecipeKey,
        draftRecipe,
      ]),
    );
    const draftRecipesToCreate = referencedDraftKeys.map((draftRecipeKey) => {
      const draftRecipe = draftRecipeByKey.get(draftRecipeKey);

      if (!draftRecipe) {
        throw new BadRequestException(
          `Planner draft is missing inline recipe ${draftRecipeKey}.`,
        );
      }

      return {
        _id: new Types.ObjectId(),
        userId,
        weeklyPlanId,
        sourceGenerationId: null,
        sourceRevisionId: null,
        title: draftRecipe.title,
        summary: draftRecipe.summary,
        status: 'published' as const,
        ingredients: draftRecipe.ingredients.map((ingredient) =>
          this.normalizeIngredient(ingredient),
        ),
        steps: draftRecipe.steps.map((step) => ({
          id: step.id,
          order: step.order,
          text: step.text,
        })),
        tags: [...draftRecipe.tags],
        isPublic: false,
      } satisfies Omit<RecipeRecord, 'createdAt' | 'updatedAt'>;
    });
    const createdDraftRecipes = draftRecipesToCreate.length
      ? ((await this.recipeModel.insertMany(draftRecipesToCreate)) as RecipeRecord[])
      : [];
    const createdRecipeByDraftKey = new Map(
      createdDraftRecipes.map((recipe, index) => [
        referencedDraftKeys[index],
        recipe,
      ]),
    );

    return latestOutput.days.map((day) => ({
      dayKey: day.dayKey,
      label: day.label,
      meals: day.meals.map((meal) => {
        if (meal.source === 'existing') {
          const recipe = existingRecipeById.get(meal.recipeId.toString());
          if (!recipe) {
            throw new BadRequestException(
              `Planner draft is missing recipe ${meal.recipeId.toString()}.`,
            );
          }

          return {
            slot: meal.slot,
            recipeId: new Types.ObjectId(recipe._id.toString()),
            title: recipe.title,
            shortLabel: meal.shortLabel,
            calories: estimateRecipeCalories(recipe, meal.slot),
            tags: recipe.tags ?? [],
          } satisfies WeeklyPlanMealValue;
        }

        const draftRecipe = draftRecipeByKey.get(meal.draftRecipeKey);
        const createdRecipe = createdRecipeByDraftKey.get(meal.draftRecipeKey);

        if (!draftRecipe || !createdRecipe) {
          throw new BadRequestException(
            `Planner draft is missing created inline recipe ${meal.draftRecipeKey}.`,
          );
        }

        return {
          slot: meal.slot,
          recipeId: new Types.ObjectId(createdRecipe._id.toString()),
          title: createdRecipe.title,
          shortLabel: meal.shortLabel,
          calories: draftRecipe.metadata.calories,
          tags: [...draftRecipe.tags],
        } satisfies WeeklyPlanMealValue;
      }),
    })) satisfies WeeklyPlanDayValue[];
  }

  private normalizeIngredient(ingredient: RecipeIngredientValue) {
    const measurement = normalizeMeasurementValue(
      ingredient.measurement.value,
      ingredient.measurement.unit,
    );

    return {
      id: ingredient.id,
      name: ingredient.name,
      quantity: formatMeasurement(measurement),
      measurement,
      note: ingredient.note,
    } satisfies RecipeIngredientValue;
  }
}
