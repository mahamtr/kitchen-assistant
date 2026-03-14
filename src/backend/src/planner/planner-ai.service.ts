import { BadGatewayException, Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { AiService } from '../ai/ai.service';
import {
  CANONICAL_MEASUREMENT_UNITS,
  type CanonicalMeasurementUnit,
  formatMeasurement,
  normalizeMeasurementValue,
} from '../common/measurement';
import type {
  OnboardingProfileValue,
  PlannerDraftRecipeValue,
  RecipeDraftOutputValue,
  RecipeRecord,
  WeeklyPlanDayValue,
  WeeklyPlanMealValue,
  WeeklyPlanRevisionDayValue,
  WeeklyPlanRevisionMealValue,
  WeeklyPlanRevisionOutputValue,
} from '../data/schemas';
import {
  PLANNER_AI_MODEL,
  PLANNER_BADGE_MAX_LENGTH,
  PLANNER_BADGE_MAX_WORDS,
  PLANNER_GENERATION_SYSTEM_PROMPT,
  PLANNER_REVISION_SYSTEM_PROMPT,
  WEEKLY_PLAN_DRAFT_JSON_SCHEMA,
  WEEKLY_PLAN_VALIDATION_RULES,
} from './planner-ai.consts';
import { DraftWeekContext, estimateRecipeCalories } from './planner.shared';

type PlannerChatEntry = {
  role: 'assistant' | 'user';
  content: string;
  timestamp: string;
};

type PlannerAllowedRecipe = {
  recipeId: string;
  title: string;
  summary: string;
  calories: number;
  tags: string[];
};

type PlannerSerializedIngredient = {
  id?: string;
  name: string;
  quantity: string;
  measurement: {
    value: number;
    unit: string;
  };
  note?: string | null;
};

type PlannerSerializedDraftRecipe = Omit<RecipeDraftOutputValue, 'ingredients' | 'steps'> & {
  draftRecipeKey: string;
  ingredients: PlannerSerializedIngredient[];
  steps: Array<{
    id?: string;
    order: number;
    text: string;
  }>;
};

type PlannerDraftContext = {
  week: DraftWeekContext;
  preferences: OnboardingProfileValue;
  allowedRecipes: PlannerAllowedRecipe[];
  currentDraft?: {
    badge: string;
    rationale: string;
    draftRecipes: PlannerSerializedDraftRecipe[];
    days: Array<{
      dayKey: WeeklyPlanDayValue['dayKey'];
      label: string;
      meals: Array<
        | {
            slot: WeeklyPlanMealValue['slot'];
            source: 'existing';
            recipeId: string;
            title: string;
            shortLabel: string;
            calories: number;
            tags: string[];
          }
        | {
            slot: WeeklyPlanMealValue['slot'];
            source: 'draft';
            draftRecipeKey: string;
            title: string;
            shortLabel: string;
            calories: number;
            tags: string[];
          }
      >;
    }>;
  };
  chat?: PlannerChatEntry[];
  userMessage?: string;
};

type PlannerDraftPayload = {
  badge: string;
  rationale: string;
  draftRecipes: Array<{
    draftRecipeKey: string;
    title: string;
    summary: string;
    metadata: {
      readyInMinutes: number;
      calories: number;
      highlight: string;
    };
    ingredients: Array<{
      name: string;
      quantity: string;
      measurement: {
        value: number;
        unit: string;
      };
      note?: string | null;
    }>;
    steps: Array<{
      order: number;
      text: string;
    }>;
    tags: string[];
  }>;
  days: Array<{
    dayKey: string;
    label: string;
    meals: Array<
      | {
          slot: string;
          source: 'existing';
          recipeId: string;
          title: string;
          shortLabel: string;
          calories: number;
          tags: string[];
        }
      | {
          slot: string;
          source: 'draft';
          draftRecipeKey: string;
          title: string;
          shortLabel: string;
          calories: number;
          tags: string[];
        }
    >;
  }>;
};

@Injectable()
export class PlannerAiService {
  constructor(private readonly aiService: AiService) {}

  async generateDraft(
    context: PlannerDraftContext,
    recipes: RecipeRecord[],
    week: DraftWeekContext,
  ): Promise<WeeklyPlanRevisionOutputValue> {
    return this.requestDraft(
      PLANNER_GENERATION_SYSTEM_PROMPT,
      {
        mode: 'generate',
        validationRules: WEEKLY_PLAN_VALIDATION_RULES,
        ...context,
      },
      recipes,
      week,
    );
  }

  async reviseDraft(
    context: PlannerDraftContext,
    recipes: RecipeRecord[],
    week: DraftWeekContext,
  ): Promise<WeeklyPlanRevisionOutputValue> {
    return this.requestDraft(
      PLANNER_REVISION_SYSTEM_PROMPT,
      {
        mode: 'revise',
        validationRules: WEEKLY_PLAN_VALIDATION_RULES,
        ...context,
      },
      recipes,
      week,
    );
  }

  validateDraftPayload(
    payload: unknown,
    recipes: RecipeRecord[],
    week: DraftWeekContext,
  ): WeeklyPlanRevisionOutputValue {
    if (!payload || typeof payload !== 'object') {
      throw new BadGatewayException('Planner AI response must be an object.');
    }

    const candidate = payload as PlannerDraftPayload;
    const badge = this.normalizeBadge(candidate.badge);

    if (!candidate.rationale?.trim()) {
      throw new BadGatewayException(
        'Planner AI response is missing rationale.',
      );
    }

    if (!Array.isArray(candidate.draftRecipes)) {
      throw new BadGatewayException(
        'Planner AI response must contain draftRecipes.',
      );
    }

    if (!Array.isArray(candidate.days) || candidate.days.length !== 7) {
      throw new BadGatewayException(
        'Planner AI response must contain exactly 7 days.',
      );
    }

    const recipeById = new Map(
      recipes.map((recipe) => [recipe._id.toString(), recipe]),
    );
    const draftRecipeByKey = new Map<string, PlannerDraftRecipeValue>();
    for (const draftRecipe of candidate.draftRecipes) {
      const normalized = this.normalizeDraftRecipe(draftRecipe);

      if (draftRecipeByKey.has(normalized.draftRecipeKey)) {
        throw new BadGatewayException(
          `Planner AI returned duplicate draftRecipeKey: ${normalized.draftRecipeKey}`,
        );
      }

      draftRecipeByKey.set(normalized.draftRecipeKey, normalized);
    }

    const expectedDays = new Map(week.map((day) => [day.dayKey, day.label]));
    const seenDayKeys = new Set<string>();
    const referencedDraftKeys = new Set<string>();

    const days = candidate.days.map((day) => {
      if (!expectedDays.has(day.dayKey as WeeklyPlanDayValue['dayKey'])) {
        throw new BadGatewayException(
          `Planner AI returned an unknown day key: ${day.dayKey}`,
        );
      }

      if (seenDayKeys.has(day.dayKey)) {
        throw new BadGatewayException(
          `Planner AI returned duplicate day key: ${day.dayKey}`,
        );
      }

      seenDayKeys.add(day.dayKey);

      if (!Array.isArray(day.meals) || day.meals.length !== 3) {
        throw new BadGatewayException(
          `Planner AI must return exactly 3 meals for ${day.dayKey}.`,
        );
      }

      const seenSlots = new Set<string>();
      const mealMap = new Map<WeeklyPlanMealValue['slot'], WeeklyPlanRevisionMealValue>();

      for (const meal of day.meals) {
        if (!['breakfast', 'lunch', 'dinner'].includes(meal.slot)) {
          throw new BadGatewayException(
            `Planner AI returned an invalid meal slot: ${meal.slot}`,
          );
        }

        if (seenSlots.has(meal.slot)) {
          throw new BadGatewayException(
            `Planner AI returned duplicate slot ${meal.slot} for ${day.dayKey}.`,
          );
        }

        seenSlots.add(meal.slot);

        const shortLabel = meal.shortLabel?.trim();
        if (!shortLabel) {
          throw new BadGatewayException(
            `Planner AI returned an empty shortLabel for ${day.dayKey} ${meal.slot}.`,
          );
        }

        if (meal.source === 'existing') {
          const recipe = recipeById.get(meal.recipeId);
          if (!recipe) {
            throw new BadGatewayException(
              `Planner AI used an unknown recipeId: ${meal.recipeId}`,
            );
          }

          mealMap.set(
            meal.slot as WeeklyPlanMealValue['slot'],
            this.toExistingMeal(
              recipe,
              meal.slot as WeeklyPlanMealValue['slot'],
              shortLabel,
            ),
          );
          continue;
        }

        if (meal.source !== 'draft') {
          throw new BadGatewayException(
            `Planner AI returned an invalid meal source for ${day.dayKey}.`,
          );
        }

        const draftRecipe = draftRecipeByKey.get(meal.draftRecipeKey);
        if (!draftRecipe) {
          throw new BadGatewayException(
            `Planner AI used an unknown draftRecipeKey: ${meal.draftRecipeKey}`,
          );
        }

        referencedDraftKeys.add(meal.draftRecipeKey);
        mealMap.set(
          meal.slot as WeeklyPlanMealValue['slot'],
          {
            slot: meal.slot as WeeklyPlanMealValue['slot'],
            source: 'draft',
            draftRecipeKey: draftRecipe.draftRecipeKey,
            title: draftRecipe.title,
            shortLabel,
            calories: draftRecipe.metadata.calories,
            tags: [...draftRecipe.tags],
          },
        );
      }

      return {
        dayKey: day.dayKey as WeeklyPlanDayValue['dayKey'],
        label:
          expectedDays.get(day.dayKey as WeeklyPlanDayValue['dayKey']) ??
          day.label,
        meals: (['breakfast', 'lunch', 'dinner'] as const).map((slot) => {
          const meal = mealMap.get(slot);
          if (!meal) {
            throw new BadGatewayException(
              `Planner AI is missing ${slot} for ${day.dayKey}.`,
            );
          }

          return meal;
        }),
      } satisfies WeeklyPlanRevisionDayValue;
    });

    for (const day of week) {
      if (!seenDayKeys.has(day.dayKey)) {
        throw new BadGatewayException(
          `Planner AI is missing day ${day.dayKey}.`,
        );
      }
    }

    for (const draftRecipeKey of draftRecipeByKey.keys()) {
      if (!referencedDraftKeys.has(draftRecipeKey)) {
        throw new BadGatewayException(
          `Planner AI returned an unused draft recipe: ${draftRecipeKey}`,
        );
      }
    }

    return {
      badge,
      rationale: candidate.rationale.trim(),
      draftRecipes: Array.from(draftRecipeByKey.values()),
      days,
    };
  }

  private normalizeBadge(candidate: string | undefined) {
    const badge = candidate?.trim();
    if (!badge) {
      throw new BadGatewayException('Planner AI response is missing badge.');
    }

    const badgeWords = badge.split(/\s+/).filter(Boolean);
    if (
      badge.length > PLANNER_BADGE_MAX_LENGTH ||
      badgeWords.length > PLANNER_BADGE_MAX_WORDS
    ) {
      throw new BadGatewayException(
        `Planner AI badge must be at most ${PLANNER_BADGE_MAX_WORDS} words and ${PLANNER_BADGE_MAX_LENGTH} characters.`,
      );
    }

    return badge;
  }

  private normalizeDraftRecipe(candidate: PlannerDraftPayload['draftRecipes'][number]) {
    if (!candidate.draftRecipeKey?.trim()) {
      throw new BadGatewayException(
        'Planner AI returned a draft recipe without draftRecipeKey.',
      );
    }

    if (!candidate.title?.trim() || !candidate.summary?.trim()) {
      throw new BadGatewayException(
        `Planner AI returned an incomplete draft recipe: ${candidate.draftRecipeKey}`,
      );
    }

    if (
      !candidate.metadata ||
      !Number.isFinite(candidate.metadata.readyInMinutes) ||
      candidate.metadata.readyInMinutes <= 0 ||
      !Number.isFinite(candidate.metadata.calories) ||
      candidate.metadata.calories < 0 ||
      !candidate.metadata.highlight?.trim()
    ) {
      throw new BadGatewayException(
        `Planner AI returned invalid metadata for draft recipe ${candidate.draftRecipeKey}.`,
      );
    }

    if (!Array.isArray(candidate.ingredients) || candidate.ingredients.length === 0) {
      throw new BadGatewayException(
        `Planner AI returned no ingredients for draft recipe ${candidate.draftRecipeKey}.`,
      );
    }

    if (!Array.isArray(candidate.steps) || candidate.steps.length === 0) {
      throw new BadGatewayException(
        `Planner AI returned no steps for draft recipe ${candidate.draftRecipeKey}.`,
      );
    }

    const ingredients = candidate.ingredients.map((ingredient) => {
      if (!ingredient.name?.trim()) {
        throw new BadGatewayException(
          `Planner AI returned an unnamed ingredient in ${candidate.draftRecipeKey}.`,
        );
      }

      try {
        const measurement = this.normalizeDraftIngredientMeasurement(
          ingredient.measurement.value,
          ingredient.measurement.unit,
        );

        return {
          id: new Types.ObjectId(),
          name: ingredient.name.trim(),
          quantity: formatMeasurement(measurement),
          measurement,
          note: ingredient.note?.trim() || undefined,
        };
      } catch {
        throw new BadGatewayException(
          `Planner AI returned an unsupported measurement "${ingredient.measurement.unit}" for ingredient "${ingredient.name}" in ${candidate.draftRecipeKey}.`,
        );
      }
    });

    const seenOrders = new Set<number>();
    const steps = candidate.steps.map((step) => {
      if (!Number.isInteger(step.order) || step.order <= 0 || !step.text?.trim()) {
        throw new BadGatewayException(
          `Planner AI returned an invalid step in draft recipe ${candidate.draftRecipeKey}.`,
        );
      }

      if (seenOrders.has(step.order)) {
        throw new BadGatewayException(
          `Planner AI returned duplicate step order ${step.order} in ${candidate.draftRecipeKey}.`,
        );
      }

      seenOrders.add(step.order);

      return {
        id: new Types.ObjectId(),
        order: step.order,
        text: step.text.trim(),
      };
    });

    return {
      draftRecipeKey: candidate.draftRecipeKey.trim(),
      title: candidate.title.trim(),
      summary: candidate.summary.trim(),
      metadata: {
        readyInMinutes: Math.trunc(candidate.metadata.readyInMinutes),
        calories: Math.trunc(candidate.metadata.calories),
        highlight: candidate.metadata.highlight.trim(),
      },
      ingredients,
      steps,
      tags: Array.isArray(candidate.tags)
        ? candidate.tags
            .filter((tag): tag is string => typeof tag === 'string')
            .map((tag) => tag.trim())
            .filter(Boolean)
        : [],
    } satisfies PlannerDraftRecipeValue;
  }

  private async requestDraft(
    systemPrompt: string,
    context: Record<string, unknown>,
    recipes: RecipeRecord[],
    week: DraftWeekContext,
  ) {
    const parsed = await this.aiService.requestStructuredJson({
      featureName: 'planner',
      defaultModel: PLANNER_AI_MODEL,
      temperature: 0.4,
      systemPrompt,
      userPayload: context,
      schemaName: 'weekly_plan_draft',
      schema: WEEKLY_PLAN_DRAFT_JSON_SCHEMA as Record<string, unknown>,
    });

    return this.validateDraftPayload(parsed, recipes, week);
  }

  private toExistingMeal(
    recipe: RecipeRecord,
    slot: WeeklyPlanMealValue['slot'],
    shortLabel: string,
  ) {
    return {
      slot,
      source: 'existing',
      recipeId: new Types.ObjectId(recipe._id.toString()),
      title: recipe.title,
      shortLabel,
      calories: estimateRecipeCalories(recipe, slot),
      tags: recipe.tags ?? [],
    } satisfies WeeklyPlanRevisionMealValue;
  }

  private normalizeDraftIngredientMeasurement(
    value: number,
    unit: string,
  ) {
    const normalizedUnit = unit.trim().toLowerCase();

    if (
      !CANONICAL_MEASUREMENT_UNITS.includes(
        normalizedUnit as CanonicalMeasurementUnit,
      )
    ) {
      throw new Error(`Unsupported measurement unit: ${unit}`);
    }

    return normalizeMeasurementValue(value, normalizedUnit);
  }
}
