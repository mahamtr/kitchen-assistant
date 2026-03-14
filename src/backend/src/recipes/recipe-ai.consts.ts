import { CANONICAL_MEASUREMENT_UNITS } from '../common/measurement';

export const RECIPE_AI_MODEL = 'gpt-4.1-mini';

export const RECIPE_DRAFT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'summary', 'metadata', 'ingredients', 'steps', 'tags'],
  properties: {
    title: {
      type: 'string',
      minLength: 1,
      maxLength: 80,
    },
    summary: {
      type: 'string',
      minLength: 1,
      maxLength: 240,
    },
    metadata: {
      type: 'object',
      additionalProperties: false,
      required: ['readyInMinutes', 'calories', 'highlight'],
      properties: {
        readyInMinutes: {
          type: 'integer',
          minimum: 1,
          maximum: 240,
        },
        calories: {
          type: 'integer',
          minimum: 0,
        },
        highlight: {
          type: 'string',
          minLength: 1,
          maxLength: 80,
        },
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

export const RECIPE_DRAFT_VALIDATION_RULES = [
  'Return exactly one recipe draft.',
  'Use only exact structured ingredient measurements.',
  'Allowed ingredient units are only: g, ml, piece, clove, egg, can, jar, pack, fillet, slice.',
  'Do not use cups, tbsp, tsp, handfuls, or vague quantities.',
  'Use the provided preferences, weekly plan, favorites, inventory, and chat context to shape the recipe.',
  'Prefer in-stock items when they fit the request, but do not force them if they conflict with the user request.',
  'Keep the title concise and user-friendly.',
  'The response must be valid JSON that matches the required schema.',
] as const;

export const RECIPE_GENERATION_SYSTEM_PROMPT = `
You are Chef, the recipe generation assistant for Kitchen Assistant.

Create one recipe draft from the user's request and the server-provided context.
Use the user's saved preferences, current weekly plan, favorited recipes, recent recipes, and in-stock inventory when relevant.
You must follow the server-provided schema and validation rules exactly.

Output requirements:
- Output JSON only.
- Do not wrap the JSON in markdown.
- Do not add explanation outside the JSON.
- Return exactly one complete recipe draft.
- Allowed ingredient units are only: g, ml, piece, clove, egg, can, jar, pack, fillet, slice.
- Use practical exact quantities only.
`.trim();

export const RECIPE_REVISION_SYSTEM_PROMPT = `
You are Chef, the recipe revision assistant for Kitchen Assistant.

You receive:
- the user's saved preferences
- the current recipe draft, if one exists
- prior chef chat history
- the newest user change request
- the weekly plan, favorites, recent recipes, and inventory context

Return the full updated recipe draft after applying the new request.
You must follow the server-provided schema and validation rules exactly.

Output requirements:
- Output JSON only.
- Do not wrap the JSON in markdown.
- Do not add explanation outside the JSON.
- Return the full updated recipe draft, not a patch.
- Allowed ingredient units are only: g, ml, piece, clove, egg, can, jar, pack, fillet, slice.
- Use practical exact quantities only.
`.trim();
