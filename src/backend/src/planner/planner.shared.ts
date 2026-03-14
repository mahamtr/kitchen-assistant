import { Types } from 'mongoose';
import type {
  OnboardingProfileValue,
  PlannerDraftRecipeValue,
  RecipeIngredientValue,
  RecipeRecord,
  WeeklyPlanDayValue,
  WeeklyPlanMealValue,
  WeeklyPlanRevisionDayValue,
  WeeklyPlanRevisionExistingMealValue,
  WeeklyPlanRevisionMealValue,
  WeeklyPlanRevisionOutputValue,
} from '../data/schemas';

export type DraftWeekContext = Array<{
  dayKey: WeeklyPlanDayValue['dayKey'];
  label: string;
}>;

export function normalizeName(value: string) {
  return value.toLowerCase().trim();
}

export function startOfCurrentWeek(now: Date): Date {
  const next = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
  const weekday = next.getUTCDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  next.setUTCDate(next.getUTCDate() + diff);
  return next;
}

export function endOfWeek(weekStart: Date): Date {
  const next = new Date(weekStart);
  next.setUTCDate(next.getUTCDate() + 6);
  next.setUTCHours(23, 59, 59, 0);
  return next;
}

export function estimateRecipeCalories(
  recipe: Pick<RecipeRecord, 'title' | 'summary'>,
  slot?: WeeklyPlanMealValue['slot'],
) {
  const title = recipe.title.toLowerCase();
  const summary = recipe.summary?.toLowerCase() ?? '';

  if (summary.includes('breakfast')) {
    return 380;
  }

  if (title.includes('salmon')) {
    return 590;
  }

  if (title.includes('chicken') || slot === 'dinner') {
    return 545;
  }

  return 480;
}

export function cloneProfile(profile: OnboardingProfileValue) {
  return JSON.parse(JSON.stringify(profile)) as Record<string, unknown>;
}

export function toAcceptedMeal(
  recipe: RecipeRecord,
  slot: WeeklyPlanMealValue['slot'],
  shortLabel: string,
): WeeklyPlanMealValue {
  return {
    slot,
    recipeId: new Types.ObjectId(recipe._id.toString()),
    title: recipe.title,
    shortLabel,
    calories: estimateRecipeCalories(recipe, slot),
    tags: recipe.tags ?? [],
  };
}

export function toAcceptedDaysFromRevisionDays(
  days: WeeklyPlanRevisionDayValue[],
) {
  return days.flatMap((day) => day.meals);
}

export function toHybridAcceptedDays(
  days: WeeklyPlanDayValue[],
): WeeklyPlanRevisionDayValue[] {
  return days.map((day) => ({
    dayKey: day.dayKey,
    label: day.label,
    meals: day.meals.map(
      (meal) =>
        ({
          slot: meal.slot,
          source: 'existing',
          recipeId: meal.recipeId,
          title: meal.title,
          shortLabel: meal.shortLabel,
          calories: meal.calories,
          tags: [...meal.tags],
        }) satisfies WeeklyPlanRevisionExistingMealValue,
    ),
  }));
}

export function serializeAcceptedMeal(meal: WeeklyPlanMealValue) {
  return {
    slot: meal.slot,
    recipeId: meal.recipeId.toString(),
    title: meal.title,
    shortLabel: meal.shortLabel,
    calories: meal.calories,
    tags: Array.isArray(meal.tags) ? [...meal.tags] : [],
  };
}

export function serializeAcceptedDays(days: WeeklyPlanDayValue[]) {
  return days.map((day) => ({
    dayKey: day.dayKey,
    label: day.label,
    meals: day.meals.map((meal) => serializeAcceptedMeal(meal)),
  }));
}

function serializeRevisionMeal(meal: WeeklyPlanRevisionMealValue) {
  if (meal.source === 'existing') {
    return {
      slot: meal.slot,
      source: meal.source,
      recipeId: meal.recipeId.toString(),
      title: meal.title,
      shortLabel: meal.shortLabel,
      calories: meal.calories,
      tags: Array.isArray(meal.tags) ? [...meal.tags] : [],
    };
  }

  return {
    slot: meal.slot,
    source: meal.source,
    draftRecipeKey: meal.draftRecipeKey,
    title: meal.title,
    shortLabel: meal.shortLabel,
    calories: meal.calories,
    tags: Array.isArray(meal.tags) ? [...meal.tags] : [],
  };
}

export function serializeRevisionDays(days: WeeklyPlanRevisionDayValue[]) {
  return days.map((day) => ({
    dayKey: day.dayKey,
    label: day.label,
    meals: day.meals.map((meal) => serializeRevisionMeal(meal)),
  }));
}

function serializeIngredient(ingredient: RecipeIngredientValue) {
  return {
    id: ingredient.id.toString(),
    name: ingredient.name,
    quantity: ingredient.quantity,
    measurement: ingredient.measurement,
    note: ingredient.note,
  };
}

export function serializeDraftRecipe(draftRecipe: PlannerDraftRecipeValue) {
  return {
    draftRecipeKey: draftRecipe.draftRecipeKey,
    title: draftRecipe.title,
    summary: draftRecipe.summary,
    metadata: draftRecipe.metadata,
    ingredients: draftRecipe.ingredients.map((ingredient) =>
      serializeIngredient(ingredient),
    ),
    steps: draftRecipe.steps.map((step) => ({
      id: step.id.toString(),
      order: step.order,
      text: step.text,
    })),
    tags: [...draftRecipe.tags],
  };
}

export function serializeRevisionOutput(output: WeeklyPlanRevisionOutputValue) {
  return {
    badge: output.badge,
    rationale: output.rationale,
    draftRecipes: output.draftRecipes.map((draftRecipe) =>
      serializeDraftRecipe(draftRecipe),
    ),
    days: serializeRevisionDays(output.days),
  };
}
