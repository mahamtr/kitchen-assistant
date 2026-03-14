import { BadGatewayException, Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { AiService } from '../ai/ai.service';
import {
  CANONICAL_MEASUREMENT_UNITS,
  type CanonicalMeasurementUnit,
  formatMeasurement,
  normalizeMeasurementValue,
} from '../common/measurement';
import type { RecipeDraftOutputValue } from '../data/schemas';
import {
  RECIPE_AI_MODEL,
  RECIPE_DRAFT_JSON_SCHEMA,
  RECIPE_DRAFT_VALIDATION_RULES,
  RECIPE_GENERATION_SYSTEM_PROMPT,
  RECIPE_REVISION_SYSTEM_PROMPT,
} from './recipe-ai.consts';

export type RecipeChatEntry = {
  role: 'assistant' | 'user';
  content: string;
  timestamp: string;
};

export type RecipePromptRecipe = {
  title: string;
  summary: string;
  readyInMinutes: number;
  tags: string[];
  ingredients: string[];
};

export type RecipePromptInventoryItem = {
  name: string;
  quantity: {
    value: number;
    unit: string;
  };
  quantityLabel: string;
  location: string;
  status: string;
};

export type RecipeSerializedDraft = {
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
};

export type RecipeAiContext = {
  preferences?: unknown;
  weeklyPlanRecipes: RecipePromptRecipe[];
  favoriteRecipes: RecipePromptRecipe[];
  recentRecipes: RecipePromptRecipe[];
  inventoryItems: RecipePromptInventoryItem[];
  currentDraft?: RecipeSerializedDraft | null;
  chat?: RecipeChatEntry[];
  userMessage: string;
};

type RecipeDraftPayload = {
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
};

@Injectable()
export class RecipeAiService {
  constructor(private readonly aiService: AiService) {}

  async generateDraft(context: RecipeAiContext) {
    return this.requestDraft(RECIPE_GENERATION_SYSTEM_PROMPT, {
      mode: 'generate',
      validationRules: RECIPE_DRAFT_VALIDATION_RULES,
      ...context,
    });
  }

  async reviseDraft(context: RecipeAiContext) {
    return this.requestDraft(RECIPE_REVISION_SYSTEM_PROMPT, {
      mode: 'revise',
      validationRules: RECIPE_DRAFT_VALIDATION_RULES,
      ...context,
    });
  }

  validateDraftPayload(payload: unknown): RecipeDraftOutputValue {
    if (!payload || typeof payload !== 'object') {
      throw new BadGatewayException('Recipe AI response must be an object.');
    }

    const candidate = payload as RecipeDraftPayload;

    if (!candidate.title?.trim() || !candidate.summary?.trim()) {
      throw new BadGatewayException(
        'Recipe AI response is missing title or summary.',
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
      throw new BadGatewayException('Recipe AI response has invalid metadata.');
    }

    if (!Array.isArray(candidate.ingredients) || candidate.ingredients.length === 0) {
      throw new BadGatewayException(
        'Recipe AI response must contain ingredients.',
      );
    }

    if (!Array.isArray(candidate.steps) || candidate.steps.length === 0) {
      throw new BadGatewayException('Recipe AI response must contain steps.');
    }

    const ingredients = candidate.ingredients.map((ingredient) => {
      if (!ingredient.name?.trim()) {
        throw new BadGatewayException(
          'Recipe AI returned an unnamed ingredient.',
        );
      }

      try {
        const measurement = this.normalizeIngredientMeasurement(
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
          `Recipe AI returned an unsupported measurement "${ingredient.measurement.unit}" for ingredient "${ingredient.name}".`,
        );
      }
    });

    const seenOrders = new Set<number>();
    const steps = candidate.steps.map((step) => {
      if (!Number.isInteger(step.order) || step.order <= 0 || !step.text?.trim()) {
        throw new BadGatewayException('Recipe AI returned an invalid step.');
      }

      if (seenOrders.has(step.order)) {
        throw new BadGatewayException(
          `Recipe AI returned duplicate step order ${step.order}.`,
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
    } satisfies RecipeDraftOutputValue;
  }

  private async requestDraft(
    systemPrompt: string,
    context: Record<string, unknown>,
  ) {
    const parsed = await this.aiService.requestStructuredJson({
      featureName: 'recipe',
      defaultModel: RECIPE_AI_MODEL,
      temperature: 0.5,
      systemPrompt,
      userPayload: context,
      schemaName: 'recipe_draft',
      schema: RECIPE_DRAFT_JSON_SCHEMA as Record<string, unknown>,
    });

    return this.validateDraftPayload(parsed);
  }

  private normalizeIngredientMeasurement(value: number, unit: string) {
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
