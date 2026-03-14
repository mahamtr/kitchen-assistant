import { CANONICAL_MEASUREMENT_UNITS } from '../common/measurement';

export const PLANNER_AI_MODEL = 'gpt-4.1-mini';
export const PLANNER_BADGE_MAX_LENGTH = 32;
export const PLANNER_BADGE_MAX_WORDS = 4;

const RECIPE_DRAFT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'draftRecipeKey',
    'title',
    'summary',
    'metadata',
    'ingredients',
    'steps',
    'tags',
  ],
  properties: {
    draftRecipeKey: {
      type: 'string',
      minLength: 1,
    },
    title: {
      type: 'string',
      minLength: 1,
    },
    summary: {
      type: 'string',
      minLength: 1,
    },
    metadata: {
      type: 'object',
      additionalProperties: false,
      required: ['readyInMinutes', 'calories', 'highlight'],
      properties: {
        readyInMinutes: { type: 'integer', minimum: 1 },
        calories: { type: 'integer', minimum: 0 },
        highlight: { type: 'string', minLength: 1 },
      },
    },
    ingredients: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'quantity', 'measurement', 'note'],
        properties: {
          name: {
            type: 'string',
            minLength: 1,
          },
          quantity: {
            type: 'string',
            minLength: 1,
          },
          measurement: {
            type: 'object',
            additionalProperties: false,
            required: ['value', 'unit'],
            properties: {
              value: {
                type: 'number',
                exclusiveMinimum: 0,
              },
              unit: {
                type: 'string',
                enum: [...CANONICAL_MEASUREMENT_UNITS],
              },
            },
          },
          note: {
            type: ['string', 'null'],
          },
        },
      },
    },
    steps: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['order', 'text'],
        properties: {
          order: {
            type: 'integer',
            minimum: 1,
          },
          text: {
            type: 'string',
            minLength: 1,
          },
        },
      },
    },
    tags: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
  },
} as const;

const HYBRID_MEAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'slot',
    'source',
    'recipeId',
    'draftRecipeKey',
    'title',
    'shortLabel',
    'calories',
    'tags',
  ],
  properties: {
    slot: {
      type: 'string',
      enum: ['breakfast', 'lunch', 'dinner'],
    },
    source: {
      type: 'string',
      enum: ['existing', 'draft'],
    },
    recipeId: {
      type: ['string', 'null'],
    },
    draftRecipeKey: {
      type: ['string', 'null'],
    },
    title: {
      type: 'string',
      minLength: 1,
    },
    shortLabel: {
      type: 'string',
      minLength: 1,
    },
    calories: {
      type: 'integer',
      minimum: 0,
    },
    tags: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
  },
} as const;

export const WEEKLY_PLAN_DRAFT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['badge', 'rationale', 'draftRecipes', 'days'],
  properties: {
    badge: {
      type: 'string',
      minLength: 1,
      maxLength: PLANNER_BADGE_MAX_LENGTH,
    },
    rationale: {
      type: 'string',
      minLength: 1,
    },
    draftRecipes: {
      type: 'array',
      items: RECIPE_DRAFT_SCHEMA,
    },
    days: {
      type: 'array',
      minItems: 7,
      maxItems: 7,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['dayKey', 'label', 'meals'],
        properties: {
          dayKey: {
            type: 'string',
            enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
          },
          label: {
            type: 'string',
            minLength: 1,
          },
          meals: {
            type: 'array',
            minItems: 3,
            maxItems: 3,
            items: HYBRID_MEAL_SCHEMA,
          },
        },
      },
    },
  },
} as const;

export const WEEKLY_PLAN_VALIDATION_RULES = [
  'Return exactly one weekly plan draft for one Monday-Sunday week.',
  'Return exactly 7 days in order: mon, tue, wed, thu, fri, sat, sun.',
  'Each day must contain exactly 3 meals: breakfast, lunch, dinner.',
  'Existing meals must use only recipeId values from the allowed existing recipe catalog provided by the server.',
  'If you invent a new recipe, put the full recipe inside draftRecipes[] and reference it from meals only by draftRecipeKey.',
  'Allowed ingredient units are only: g, ml, piece, clove, egg, can, jar, pack, fillet, slice.',
  'For source="existing", set recipeId and set draftRecipeKey to null.',
  'For source="draft", set draftRecipeKey and set recipeId to null.',
  'Do not invent or alter recipe IDs for existing meals.',
  'Every draft recipe must be fully specified and use exact structured ingredient measurements.',
  'Do not return orphan draft recipes that are not used by any meal.',
  `Badge must be a short user-facing label with at most ${PLANNER_BADGE_MAX_WORDS} words and at most ${PLANNER_BADGE_MAX_LENGTH} characters.`,
  'Keep rationale concise and user-facing.',
  'The response must be valid JSON that matches the required schema.',
] as const;

export const PLANNER_GENERATION_SYSTEM_PROMPT = `
You are the weekly plan generation assistant for Kitchen Assistant.

Generate one 7-day weekly meal-plan draft from the user's saved preferences.
You must follow the server-provided schema and validation rules exactly.
You may either:
- reuse recipes from the allowed existing recipe catalog, or
- create new recipes inside draftRecipes[] and reference them from meals by draftRecipeKey.

Output requirements:
- Output JSON only.
- Do not wrap the JSON in markdown.
- Do not add explanation outside the JSON.
- Choose one meal for each slot on each day.
- Keep the plan coherent with the user's preferences and weekly intent.
- Use the provided week scaffold labels and day keys exactly.
- Badge must be a short user-facing label with at most 4 words and at most 32 characters.
- Allowed ingredient units are only: g, ml, piece, clove, egg, can, jar, pack, fillet, slice.
- Always include both recipeId and draftRecipeKey. Set the unused one to null.
- Inline draft recipes must be complete and practical enough to become saved recipes if accepted.
`.trim();

export const PLANNER_REVISION_SYSTEM_PROMPT = `
You are the weekly plan revision assistant for Kitchen Assistant.

You receive:
- the user's saved preference profile
- the current weekly plan draft
- the full planner chat history
- the newest user change request
- the allowed existing recipe catalog

Regenerate the full 7-day weekly-plan draft after applying the user's requested edits.
You must follow the server-provided schema and validation rules exactly.
You may either reuse existing recipes or return new inline draft recipes in draftRecipes[].

Output requirements:
- Output JSON only.
- Do not wrap the JSON in markdown.
- Do not add explanation outside the JSON.
- Return the full updated weekly plan draft, not a patch.
- Use the provided week scaffold labels and day keys exactly.
- Badge must be a short user-facing label with at most 4 words and at most 32 characters.
- Allowed ingredient units are only: g, ml, piece, clove, egg, can, jar, pack, fillet, slice.
- Always include both recipeId and draftRecipeKey. Set the unused one to null.
- Keep inline draft recipes consistent with the meals that reference them.
`.trim();
