import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  formatMeasurement,
  normalizeMeasurementValue,
  type MeasurementValue,
} from '../common/measurement';
import { canonicalizeItemName } from '../common/item-canonicalization';
import type {
  ChatMessageValue,
  GroceryListItemValue,
  InventoryEventItemValue,
  InventoryItemRecord,
  OnboardingProfileValue,
  OcrReceiptLineValue,
  PlannerDraftRecipeValue,
  RecipeDraftOutputValue,
  RecipeGenerationRecord,
  RecipeGenerationRevisionRecord,
  RecipeHistoryEventRecord,
  RecipeIngredientValue,
  RecipeRecord,
  RecipeStepValue,
  WeeklyPlanDayValue,
  WeeklyPlanMealValue,
  WeeklyPlanRecord,
  WeeklyPlanRevisionDayValue,
  WeeklyPlanRevisionOutputValue,
  WeeklyPlanRevisionRecord,
} from './schemas';

type RecipeTemplate = {
  key: string;
  title: string;
  summary: string;
  readyInMinutes: number;
  calories: number;
  highlight: string;
  tags: string[];
  ingredients: Array<{ name: string; measurement: MeasurementValue }>;
  steps: string[];
};

type GeneratedSeedData = {
  plan: Omit<WeeklyPlanRecord, 'createdAt' | 'updatedAt'>;
  plannerRevision: Omit<WeeklyPlanRevisionRecord, 'createdAt' | 'updatedAt'>;
  groceryList: Omit<
    import('./schemas').GroceryListRecord,
    'createdAt' | 'updatedAt'
  >;
  recipes: Array<Omit<RecipeRecord, 'createdAt' | 'updatedAt'>>;
  inventoryItems: Array<
    Omit<InventoryItemRecord, 'createdAt' | 'lastUpdatedAt'>
  >;
  inventoryEvents: Array<import('./schemas').InventoryEventRecord>;
  recipeHistoryEvents: RecipeHistoryEventRecord[];
  activeGeneration: Omit<RecipeGenerationRecord, 'createdAt' | 'updatedAt'>;
  activeGenerationRevision: Omit<
    RecipeGenerationRevisionRecord,
    'createdAt' | 'updatedAt'
  >;
};

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function startOfCurrentWeek(now: Date): Date {
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

function endOfWeek(weekStart: Date): Date {
  const next = addDays(weekStart, 6);
  next.setUTCHours(23, 59, 59, 0);
  return next;
}

function buildChatMessage(
  role: ChatMessageValue['role'],
  content: string,
  timestamp: Date,
): ChatMessageValue {
  return {
    _id: new Types.ObjectId(),
    role,
    content,
    timestamp,
  };
}

function buildIngredient(
  name: string,
  value: number,
  unit: string,
): RecipeIngredientValue {
  const measurement = normalizeMeasurementValue(value, unit);
  return {
    id: new Types.ObjectId(),
    name,
    quantity: formatMeasurement(measurement),
    measurement,
  };
}

function buildSteps(lines: string[]): RecipeStepValue[] {
  return lines.map((text, index) => ({
    id: new Types.ObjectId(),
    order: index + 1,
    text,
  }));
}

function toRevisionDays(days: WeeklyPlanDayValue[]): WeeklyPlanRevisionDayValue[] {
  return days.map((day) => ({
    dayKey: day.dayKey,
    label: day.label,
    meals: day.meals.map((meal) => ({
      slot: meal.slot,
      source: 'existing' as const,
      recipeId: meal.recipeId,
      title: meal.title,
      shortLabel: meal.shortLabel,
      calories: meal.calories,
      tags: [...meal.tags],
    })),
  }));
}

function recipeCatalog(): RecipeTemplate[] {
  return [
    {
      key: 'overnight-oats',
      title: 'Overnight Oats with Berries',
      summary: 'Prep-ahead breakfast with chia, yogurt, and berries.',
      readyInMinutes: 8,
      calories: 380,
      highlight: 'No-cook',
      tags: ['Breakfast', 'Meal prep'],
      ingredients: [
        { name: 'Rolled oats', measurement: normalizeMeasurementValue(90, 'g') },
        { name: 'Greek yogurt', measurement: normalizeMeasurementValue(200, 'g') },
        { name: 'Frozen berries', measurement: normalizeMeasurementValue(140, 'g') },
        { name: 'Chia seeds', measurement: normalizeMeasurementValue(24, 'g') },
      ],
      steps: [
        'Mix oats, yogurt, and chia in a jar.',
        'Top with berries and refrigerate overnight.',
        'Serve chilled or warmed for one minute.',
      ],
    },
    {
      key: 'greek-yogurt-bowl',
      title: 'Greek Yogurt Power Bowl',
      summary: 'Fast breakfast with fruit, nuts, and extra protein.',
      readyInMinutes: 6,
      calories: 410,
      highlight: 'High protein',
      tags: ['Breakfast'],
      ingredients: [
        { name: 'Greek yogurt', measurement: normalizeMeasurementValue(250, 'g') },
        { name: 'Banana', measurement: normalizeMeasurementValue(1, 'piece') },
        { name: 'Walnuts', measurement: normalizeMeasurementValue(30, 'g') },
        { name: 'Honey', measurement: normalizeMeasurementValue(5, 'ml') },
      ],
      steps: [
        'Spoon yogurt into a bowl.',
        'Top with sliced banana and walnuts.',
        'Finish with a light drizzle of honey.',
      ],
    },
    {
      key: 'egg-spinach-wrap',
      title: 'Spinach Egg Wrap',
      summary: 'Quick skillet eggs folded into a warm wrap.',
      readyInMinutes: 10,
      calories: 365,
      highlight: 'Fast skillet',
      tags: ['Breakfast'],
      ingredients: [
        { name: 'Eggs', measurement: normalizeMeasurementValue(3, 'egg') },
        { name: 'Spinach', measurement: normalizeMeasurementValue(60, 'g') },
        { name: 'Tortilla wrap', measurement: normalizeMeasurementValue(1, 'piece') },
        { name: 'Feta', measurement: normalizeMeasurementValue(30, 'g') },
      ],
      steps: [
        'Wilt spinach in a skillet.',
        'Scramble eggs into the pan until softly set.',
        'Wrap with feta in a warmed tortilla.',
      ],
    },
    {
      key: 'chicken-quinoa-bowl',
      title: 'Chicken Quinoa Power Bowl',
      summary: 'Meal-prep bowl with quinoa, greens, and lemon dressing.',
      readyInMinutes: 22,
      calories: 545,
      highlight: 'Meal prep',
      tags: ['Lunch', 'Weekly planned'],
      ingredients: [
        { name: 'Chicken breast', measurement: normalizeMeasurementValue(220, 'g') },
        { name: 'Quinoa', measurement: normalizeMeasurementValue(185, 'g') },
        { name: 'Spinach', measurement: normalizeMeasurementValue(60, 'g') },
        { name: 'Cherry tomatoes', measurement: normalizeMeasurementValue(150, 'g') },
      ],
      steps: [
        'Cook chicken until the center is firm.',
        'Toss quinoa with spinach and tomatoes.',
        'Slice the chicken and finish with lemon dressing.',
      ],
    },
    {
      key: 'salmon-rice-bowl',
      title: 'Salmon Rice Bowl',
      summary: 'Roasted salmon with rice, broccoli, and sesame glaze.',
      readyInMinutes: 24,
      calories: 590,
      highlight: 'Balanced bowl',
      tags: ['Dinner', 'Seafood'],
      ingredients: [
        { name: 'Salmon fillet', measurement: normalizeMeasurementValue(200, 'g') },
        { name: 'Jasmine rice', measurement: normalizeMeasurementValue(180, 'g') },
        { name: 'Broccoli', measurement: normalizeMeasurementValue(180, 'g') },
        { name: 'Sesame soy glaze', measurement: normalizeMeasurementValue(30, 'ml') },
      ],
      steps: [
        'Roast salmon and broccoli together.',
        'Warm the rice and season lightly.',
        'Assemble the bowl and spoon over the glaze.',
      ],
    },
    {
      key: 'shrimp-soba-stir-fry',
      title: 'Shrimp Soba Stir Fry',
      summary: 'Fast seafood dinner with noodles and greens.',
      readyInMinutes: 18,
      calories: 520,
      highlight: 'Weeknight fast',
      tags: ['Dinner', 'Seafood'],
      ingredients: [
        { name: 'Shrimp', measurement: normalizeMeasurementValue(220, 'g') },
        { name: 'Soba noodles', measurement: normalizeMeasurementValue(150, 'g') },
        { name: 'Spinach', measurement: normalizeMeasurementValue(60, 'g') },
        { name: 'Garlic', measurement: normalizeMeasurementValue(3, 'clove') },
      ],
      steps: [
        'Cook noodles and reserve a little water.',
        'Sear shrimp with garlic until pink.',
        'Toss everything together with spinach until glossy.',
      ],
    },
    {
      key: 'turkey-taco-bowl',
      title: 'Turkey Taco Bowl',
      summary: 'Ground turkey, rice, and avocado for a fast lunch or dinner.',
      readyInMinutes: 20,
      calories: 560,
      highlight: 'Pantry-friendly',
      tags: ['Lunch', 'Dinner'],
      ingredients: [
        { name: 'Ground turkey', measurement: normalizeMeasurementValue(220, 'g') },
        { name: 'Rice', measurement: normalizeMeasurementValue(180, 'g') },
        { name: 'Black beans', measurement: normalizeMeasurementValue(120, 'g') },
        { name: 'Avocado', measurement: normalizeMeasurementValue(100, 'g') },
      ],
      steps: [
        'Brown turkey with taco seasoning.',
        'Warm rice and beans together.',
        'Top with turkey and sliced avocado.',
      ],
    },
    {
      key: 'sheet-pan-chicken',
      title: 'Sheet Pan Lemon Chicken',
      summary: 'One-pan chicken with potatoes and green beans.',
      readyInMinutes: 30,
      calories: 610,
      highlight: 'One pan',
      tags: ['Dinner'],
      ingredients: [
        { name: 'Chicken thighs', measurement: normalizeMeasurementValue(260, 'g') },
        { name: 'Baby potatoes', measurement: normalizeMeasurementValue(250, 'g') },
        { name: 'Green beans', measurement: normalizeMeasurementValue(180, 'g') },
        { name: 'Lemon', measurement: normalizeMeasurementValue(1, 'piece') },
      ],
      steps: [
        'Roast potatoes until almost tender.',
        'Add chicken and green beans to the tray.',
        'Finish with lemon and pan juices.',
      ],
    },
    {
      key: 'lentil-tomato-stew',
      title: 'Tomato Lentil Stew',
      summary: 'Comforting protein-rich stew for flexible dinners.',
      readyInMinutes: 28,
      calories: 470,
      highlight: 'Plant protein',
      tags: ['Dinner', 'Vegetarian'],
      ingredients: [
        { name: 'Red lentils', measurement: normalizeMeasurementValue(190, 'g') },
        { name: 'Crushed tomatoes', measurement: normalizeMeasurementValue(1, 'can') },
        { name: 'Carrot', measurement: normalizeMeasurementValue(2, 'piece') },
        { name: 'Spinach', measurement: normalizeMeasurementValue(60, 'g') },
      ],
      steps: [
        'Simmer lentils, tomatoes, and carrots until soft.',
        'Fold in spinach at the end.',
        'Serve with olive oil and black pepper.',
      ],
    },
  ];
}

@Injectable()
export class DefaultDataFactory {
  createDefaultProfile(): OnboardingProfileValue {
    return {
      dietStyle: 'Mediterranean',
      allergies: [],
      cuisinePreferences: ['Italian', 'Japanese', 'Seasonal'],
      cookingTime: '30 minutes or less',
      nutritionTarget: 'High protein',
      weeklyStructure: [
        'Meal-prep lunches',
        'Flexible dinners',
        'Quick breakfasts',
      ],
      weeklyIntentFocus: 'Build a high-protein week with meal-prep lunches.',
      weeklyIntentExclude: ['Mushrooms'],
      weeklyIntentNotes:
        'Keep weekday dinners under 30 minutes and use spinach early.',
    };
  }

  createQuestionBank(now = new Date()) {
    return [
      {
        key: 'diet_style',
        prompt: 'Which diet style should anchor your default weekly plans?',
        hint: 'This becomes your saved baseline and can still be adjusted later.',
        answerType: 'single_select' as const,
        required: true,
        order: 1,
        isEnabled: true,
        defaultValue: this.createDefaultProfile().dietStyle,
        options: [
          {
            value: 'Mediterranean',
            label: 'Mediterranean',
            description: 'Balanced, plant-forward, and flexible.',
          },
          {
            value: 'High protein',
            label: 'High protein',
            description: 'Prioritize protein in every meal.',
          },
          {
            value: 'Vegetarian',
            label: 'Vegetarian',
            description: 'No meat, flexible on dairy and eggs.',
          },
          {
            value: 'Family mix',
            label: 'Family mix',
            description: 'Simple crowd-pleasers with broad appeal.',
          },
        ],
        metadata: {
          tipTitle: 'Good default',
          tipBody:
            'Mediterranean works well with meal prep, pantry staples, and ingredient reuse.',
        },
        createdAt: now,
        updatedAt: now,
      },
      {
        key: 'allergies_avoids',
        prompt: 'What should Kitchen Assistant always avoid when planning?',
        hint: 'Choose allergies, intolerances, or ingredients you never want surfaced.',
        answerType: 'multi_select' as const,
        required: false,
        order: 2,
        isEnabled: true,
        defaultValue: this.createDefaultProfile().allergies,
        options: [
          { value: 'None', label: 'None', description: 'No standing avoids.' },
          { value: 'Dairy', label: 'Dairy' },
          { value: 'Gluten', label: 'Gluten' },
          { value: 'Shellfish', label: 'Shellfish' },
          { value: 'Mushrooms', label: 'Mushrooms' },
        ],
        metadata: {
          tipTitle: 'Keep it honest',
          tipBody:
            'Avoids feed both weekly plans and recipe chat so fewer revisions are needed later.',
        },
        createdAt: now,
        updatedAt: now,
      },
      {
        key: 'cuisine_preferences',
        prompt: 'Which cuisines should show up most often in your meal plan?',
        hint: 'Pick 2-4 so the planner can balance variety with grocery reuse.',
        answerType: 'multi_select' as const,
        required: true,
        order: 3,
        isEnabled: true,
        defaultValue: this.createDefaultProfile().cuisinePreferences,
        options: [
          { value: 'Italian', label: 'Italian' },
          { value: 'Japanese', label: 'Japanese' },
          { value: 'Mexican', label: 'Mexican' },
          { value: 'Seasonal', label: 'Seasonal' },
          { value: 'Mediterranean', label: 'Mediterranean' },
        ],
        metadata: {
          tipTitle: 'Best range',
          tipBody:
            'Three cuisines usually balances variety with strong grocery overlap.',
        },
        createdAt: now,
        updatedAt: now,
      },
      {
        key: 'cooking_time',
        prompt: 'What weekday cooking window should the planner optimize for?',
        hint: 'This acts as the hard limit for weekday dinners.',
        answerType: 'single_select' as const,
        required: true,
        order: 4,
        isEnabled: true,
        defaultValue: this.createDefaultProfile().cookingTime,
        options: [
          { value: '15 minutes or less', label: '15 min' },
          { value: '30 minutes or less', label: '30 min' },
          { value: '45 minutes or less', label: '45 min' },
        ],
        metadata: {
          tipTitle: 'Most popular',
          tipBody:
            'Thirty minutes keeps weeknights realistic and still allows variety.',
        },
        createdAt: now,
        updatedAt: now,
      },
      {
        key: 'nutrition_target',
        prompt: 'Which nutrition target should shape this week first?',
        hint: 'This becomes the plan target card on Home and Weekly Planner.',
        answerType: 'single_select' as const,
        required: true,
        order: 5,
        isEnabled: true,
        defaultValue: this.createDefaultProfile().nutritionTarget,
        options: [
          { value: 'High protein', label: 'High protein' },
          { value: 'Balanced energy', label: 'Balanced energy' },
          { value: 'Lower carb', label: 'Lower carb' },
        ],
        metadata: {
          tipTitle: 'Visible everywhere',
          tipBody:
            'The chosen target appears in weekly plan cards, home summaries, and recipe chat context.',
        },
        createdAt: now,
        updatedAt: now,
      },
      {
        key: 'weekly_structure',
        prompt: 'What structure should the planner follow this week?',
        hint: 'Choose the patterns you want repeated across the week.',
        answerType: 'multi_select' as const,
        required: true,
        order: 6,
        isEnabled: true,
        defaultValue: this.createDefaultProfile().weeklyStructure,
        options: [
          { value: 'Meal-prep lunches', label: 'Meal-prep lunches' },
          { value: 'Flexible dinners', label: 'Flexible dinners' },
          { value: 'Quick breakfasts', label: 'Quick breakfasts' },
          { value: 'Weekend cooking project', label: 'Weekend project' },
        ],
        metadata: {
          tipTitle: 'Best match',
          tipBody:
            'Meal-prep lunches plus quick breakfasts matches the current product draft closely.',
        },
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  getPlanTarget(profile: OnboardingProfileValue) {
    if (profile.nutritionTarget === 'Lower carb') {
      return {
        calories: '1,950',
        macros: '160g / 115g / 72g',
      };
    }

    if (profile.nutritionTarget === 'Balanced energy') {
      return {
        calories: '2,100',
        macros: '145g / 185g / 68g',
      };
    }

    return {
      calories: '2,050',
      macros: '170g / 155g / 64g',
    };
  }

  createWeekScaffold(now = new Date()) {
    const weekStart = startOfCurrentWeek(now);

    return WEEKDAY_KEYS.map((dayKey, index) => {
      const dayDate = addDays(weekStart, index);

      return {
        dayKey,
        label: dayDate.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        }),
      };
    });
  }

  createPlannerRecipeCatalog(
    userId: Types.ObjectId,
    now = new Date(),
  ): Array<Omit<RecipeRecord, 'createdAt' | 'updatedAt'>> {
    return recipeCatalog().map((entry) => {
      const createdAt = addDays(startOfCurrentWeek(now), -2);

      return {
        _id: new Types.ObjectId(),
        userId,
        weeklyPlanId: null,
        sourceGenerationId: null,
        sourceRevisionId: null,
        title: entry.title,
        summary: entry.summary,
        status: 'published' as const,
        ingredients: entry.ingredients.map((ingredient) =>
          buildIngredient(
            ingredient.name,
            ingredient.measurement.value,
            ingredient.measurement.unit,
          ),
        ),
        steps: buildSteps(entry.steps),
        tags: entry.tags,
        isPublic: false,
        createdAt,
        updatedAt: createdAt,
      };
    });
  }

  createPlannerRecipePool(
    userId: Types.ObjectId,
    weeklyPlanId: Types.ObjectId,
    now = new Date(),
  ): Array<Omit<RecipeRecord, 'createdAt' | 'updatedAt'>> {
    return this.createPlannerRecipeCatalog(userId, now).map((entry) => ({
      ...entry,
      weeklyPlanId,
    }));
  }

  createSeedData(
    userId: Types.ObjectId,
    profile: OnboardingProfileValue,
    now = new Date(),
  ): GeneratedSeedData {
    const weekStart = startOfCurrentWeek(now);
    const expiresAt = endOfWeek(weekStart);
    const planId = new Types.ObjectId();
    const revisionId = new Types.ObjectId();
    const recipes = this.createPlannerRecipePool(userId, planId, now);

    const weeklyRecipePool = [
      recipes[0],
      recipes[1],
      recipes[2],
      recipes[3],
      recipes[4],
      recipes[5],
      recipes[6],
      recipes[7],
      recipes[8],
    ];

    const days: WeeklyPlanDayValue[] = this.createWeekScaffold(now).map(
      (scaffold, index) => {
      const breakfastRecipe = weeklyRecipePool[index % 3];
      const lunchRecipe = weeklyRecipePool[3 + (index % 3)];
      const dinnerRecipe = weeklyRecipePool[4 + (index % 5)];
      const meals: WeeklyPlanMealValue[] = [
        this.toMeal('breakfast', breakfastRecipe),
        this.toMeal('lunch', lunchRecipe),
        this.toMeal('dinner', dinnerRecipe),
      ];

      return {
        dayKey: scaffold.dayKey,
        label: scaffold.label,
        meals,
      };
      },
    );

    const latestOutput: WeeklyPlanRevisionOutputValue = {
      badge: profile.weeklyStructure.includes('Meal-prep lunches')
        ? 'meal-prep'
        : 'balanced-week',
      rationale:
        'Built from your nutrition target, time limit, and preferred cuisines.',
      draftRecipes: [],
      days: toRevisionDays(days),
    };

    const baseInventoryItems = [
      this.inventoryItem(
        userId,
        'Greek yogurt',
        'fridge',
        'fresh',
        450,
        'g',
        addDays(now, 5),
      ),
      this.inventoryItem(
        userId,
        'Spinach',
        'fridge',
        'use_soon',
        120,
        'g',
        addDays(now, 1),
      ),
      this.inventoryItem(
        userId,
        'Eggs',
        'fridge',
        'fresh',
        6,
        'egg',
        addDays(now, 8),
      ),
      this.inventoryItem(
        userId,
        'Chicken breast',
        'freezer',
        'low_stock',
        1,
        'pack',
        addDays(now, 12),
      ),
      this.inventoryItem(
        userId,
        'Salmon fillet',
        'freezer',
        'fresh',
        2,
        'fillet',
        addDays(now, 14),
      ),
      this.inventoryItem(
        userId,
        'Broccoli',
        'fridge',
        'use_soon',
        400,
        'g',
        addDays(now, 2),
      ),
      this.inventoryItem(userId, 'Quinoa', 'pantry', 'fresh', 500, 'g', null),
      this.inventoryItem(userId, 'Rice', 'pantry', 'fresh', 500, 'g', null),
      this.inventoryItem(
        userId,
        'Berries',
        'freezer',
        'fresh',
        300,
        'g',
        addDays(now, 30),
      ),
      this.inventoryItem(userId, 'Garlic', 'pantry', 'fresh', 8, 'clove', null),
    ];

    const groceryListItems: GroceryListItemValue[] = [
      this.groceryItem('Chicken breast', 440, 'g', 'weekly_plan', [
        recipes[3]._id,
      ]),
      this.groceryItem('Greek yogurt', 450, 'g', 'weekly_plan', [
        recipes[0]._id,
        recipes[1]._id,
      ]),
      this.groceryItem('Frozen berries', 140, 'g', 'weekly_plan', [
        recipes[0]._id,
      ]),
      this.groceryItem('Shrimp', 220, 'g', 'weekly_plan', [recipes[5]._id]),
      this.groceryItem('Baby potatoes', 250, 'g', 'weekly_plan', [
        recipes[7]._id,
      ]),
      this.groceryItem('Avocado', 100, 'g', 'weekly_plan', [recipes[6]._id]),
    ];

    const ocrLines = this.createOcrLines();
    const memoryEventId = new Types.ObjectId();
    const inventoryEvents = [
      {
        _id: memoryEventId,
        userId,
        type: 'MEMORY' as const,
        source: 'ocr' as const,
        items: [],
        weeklyPlanId: planId,
        recipeId: null,
        metadata: {
          receiptLabel: 'Farmers market receipt',
          confidence: 0.93,
          lines: ocrLines,
        },
        createdAt: addDays(now, -1),
      },
    ];

    const favoritedRecipe = recipes[4];
    const cookedRecipe = recipes[3];
    const recipeHistoryEvents: RecipeHistoryEventRecord[] = [
      {
        _id: new Types.ObjectId(),
        userId,
        recipeId: favoritedRecipe._id,
        weeklyPlanId: planId,
        eventType: 'favorited',
        source: 'recipes',
        rating: null,
        feedback: '',
        inventoryEventId: null,
        occurredAt: addDays(now, -3),
        metadata: {},
      },
      {
        _id: new Types.ObjectId(),
        userId,
        recipeId: cookedRecipe._id,
        weeklyPlanId: planId,
        eventType: 'cooked',
        source: 'recipes',
        rating: null,
        feedback: '',
        inventoryEventId: null,
        occurredAt: addDays(now, -2),
        metadata: {},
      },
    ];

    const activeGenerationId = new Types.ObjectId();
    const activeRevisionId = new Types.ObjectId();
    const activeDraft = this.createRecipeDraft(
      'I want a high-protein dinner under 30 minutes.',
      1,
    );

    return {
      plan: {
        _id: planId,
        userId,
        weekStartAt: weekStart,
        expiresAt,
        status: 'active',
        constraintsSnapshot: clone(profile) as unknown as Record<
          string,
          unknown
        >,
        days,
        acceptedRevisionId: revisionId,
      },
      plannerRevision: {
        _id: revisionId,
        weeklyPlanId: planId,
        userId,
        revisionNumber: 1,
        chat: [
          buildChatMessage(
            'assistant',
            'I built a high-protein plan with quick breakfasts, meal-prep lunches, and flexible dinners.',
            addDays(now, -1),
          ),
        ],
        latestOutput,
      },
      groceryList: {
        _id: new Types.ObjectId(),
        userId,
        weeklyPlanId: planId,
        status: 'active',
        items: groceryListItems,
        lastComputedAt: now,
      },
      recipes,
      inventoryItems: baseInventoryItems,
      inventoryEvents,
      recipeHistoryEvents,
      activeGeneration: {
        _id: activeGenerationId,
        userId,
        weeklyPlanId: planId,
        status: 'discarded',
        latestRevisionId: activeRevisionId,
        acceptedRecipeId: null,
        contextSnapshot: {
          nutritionTarget: profile.nutritionTarget,
          cookingTime: profile.cookingTime,
        },
      },
      activeGenerationRevision: {
        _id: activeRevisionId,
        generationId: activeGenerationId,
        userId,
        revisionNumber: 1,
        chat: [
          buildChatMessage(
            'assistant',
            'What would you like to eat?',
            addDays(now, -1),
          ),
        ],
        latestOutput: null,
      },
    };
  }

  createPlannerRevision(
    currentDays: WeeklyPlanDayValue[],
    userMessage: string,
    revisionNumber: number,
  ): WeeklyPlanRevisionOutputValue {
    const nextDays = clone(currentDays);
    const normalized = userMessage.toLowerCase();

    if (normalized.includes('seafood')) {
      const day = nextDays.find((entry) => entry.dayKey === 'wed');
      const dinner = day?.meals.find((entry) => entry.slot === 'dinner');

      if (dinner) {
        dinner.title = 'Sesame Shrimp Bowl';
        dinner.shortLabel = 'Shrimp bowl';
        dinner.calories = 540;
        dinner.tags = ['Dinner', 'Seafood'];
      }
    }

    if (normalized.includes('lighter')) {
      nextDays
        .filter((entry) => ['tue', 'wed', 'thu'].includes(entry.dayKey))
        .forEach((entry) => {
          const dinner = entry.meals.find((meal) => meal.slot === 'dinner');

          if (dinner) {
            dinner.shortLabel = `${dinner.shortLabel} light`;
            dinner.calories = Math.max(420, dinner.calories - 60);
          }
        });
    }

    if (normalized.includes('high-protein')) {
      nextDays.forEach((entry) => {
        const lunch = entry.meals.find((meal) => meal.slot === 'lunch');

        if (lunch) {
          lunch.calories += 30;
          lunch.shortLabel = `${lunch.shortLabel} +protein`;
        }
      });
    }

    return {
      badge: normalized.includes('seafood')
        ? 'seafood-swap'
        : normalized.includes('lighter')
          ? 'lighter-week'
          : `revision-${revisionNumber}`,
      rationale: `Updated from your note: ${userMessage}`,
      draftRecipes: [],
      days: toRevisionDays(nextDays),
    };
  }

  createRecipeDraft(
    userMessage: string,
    revisionNumber: number,
  ): RecipeDraftOutputValue {
    const normalized = userMessage.toLowerCase();
    const title = normalized.includes('vegetarian')
      ? 'Smoky Lentil Garlic Skillet'
      : normalized.includes('garlic')
        ? 'Garlic Chicken Broccoli Stir Fry'
        : revisionNumber > 1
          ? 'Lemon Chicken Rice Bowl'
          : 'High-Protein Chicken Skillet';

    const highlight = normalized.includes('vegetarian')
      ? 'Vegetarian option'
      : normalized.includes('garlic')
        ? 'Garlicky weeknight'
        : 'Under 30 minutes';

    const ingredients = normalized.includes('vegetarian')
      ? [
          buildIngredient('Red lentils', 190, 'g'),
          buildIngredient('Garlic', 4, 'clove'),
          buildIngredient('Spinach', 60, 'g'),
          buildIngredient('Crushed tomatoes', 1, 'can'),
        ]
      : [
          buildIngredient('Chicken breast', 220, 'g'),
          buildIngredient('Broccoli', 180, 'g'),
          buildIngredient(
            'Garlic',
            normalized.includes('garlic') ? 5 : 2,
            'clove',
          ),
          buildIngredient('Rice', 180, 'g'),
        ];

    const steps = buildSteps(
      normalized.includes('vegetarian')
        ? [
            'Simmer lentils with tomatoes until tender.',
            'Add garlic and spinach for the last few minutes.',
            'Serve hot with lemon and olive oil.',
          ]
        : [
            'Sear the chicken in a hot pan until cooked through.',
            'Add broccoli and garlic and stir-fry until bright.',
            'Serve over rice with pan sauce.',
          ],
    );

    return {
      title,
      summary:
        'Generated from your weekly plan, current kitchen inventory, and recent recipe history.',
      metadata: {
        readyInMinutes: normalized.includes('vegetarian') ? 24 : 22,
        calories: normalized.includes('vegetarian') ? 480 : 560,
        highlight,
      },
      ingredients,
      steps,
      tags: normalized.includes('vegetarian')
        ? ['Dinner', 'Vegetarian', 'Chef chat']
        : ['Dinner', 'High protein', 'Chef chat'],
    };
  }

  private toMeal(
    slot: WeeklyPlanMealValue['slot'],
    recipe: Omit<RecipeRecord, 'createdAt' | 'updatedAt'>,
  ): WeeklyPlanMealValue {
    return {
      slot,
      recipeId: recipe._id,
      title: recipe.title,
      shortLabel:
        slot === 'breakfast'
          ? recipe.title.replace('with', '').split(' ').slice(0, 3).join(' ')
          : recipe.title.split(' ').slice(0, 3).join(' '),
      calories:
        (recipe.summary?.toLowerCase().includes('breakfast') ?? false)
          ? 380
          : recipe.title.toLowerCase().includes('salmon')
            ? 590
            : recipe.title.toLowerCase().includes('chicken')
              ? 545
              : 480,
      tags: recipe.tags ?? [],
    };
  }

  private inventoryItem(
    userId: Types.ObjectId,
    name: string,
    location: InventoryItemRecord['location'],
    status:
      | 'fresh'
      | 'use_soon'
      | 'expired'
      | 'low_stock'
      | 'unknown',
    value: number,
    unit: string,
    expiresAt: Date | null,
  ): Omit<InventoryItemRecord, 'createdAt' | 'lastUpdatedAt'> {
    const canonical = canonicalizeItemName(name);

    return {
      _id: new Types.ObjectId(),
      userId,
      name,
      normalizedName: canonical.normalizedName,
      canonicalKey: canonical.canonicalKey,
      category: '',
      location,
      quantity: normalizeMeasurementValue(value, unit),
      replenishmentState: status === 'low_stock' ? 'low_stock' : value <= 0 ? 'out_of_stock' : 'in_stock',
      freshnessState: status === 'low_stock' ? 'fresh' : status,
      reorderPoint: status === 'low_stock' ? 2 : 1,
      targetOnHand: null,
      dates: {
        addedAt: new Date(),
        openedAt: null,
        expiresAt,
        lastUsedAt: null,
      },
      freshness: {
        estimatedDaysLeft: expiresAt
          ? Math.max(
              0,
              Math.round(
                (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
              ),
            )
          : null,
        confidence: 'medium',
      },
      source: 'manual',
      lastEventId: null,
      metadata: {},
    };
  }

  private groceryItem(
    name: string,
    value: number,
    unit: string,
    source: GroceryListItemValue['source'],
    recipeIds: Types.ObjectId[],
  ): GroceryListItemValue {
    const canonical = canonicalizeItemName(name);

    return {
      itemId: new Types.ObjectId(),
      name,
      canonicalKey: canonical.canonicalKey,
      quantity: normalizeMeasurementValue(value, unit),
      status: 'to_buy',
      source,
      inventoryItemId: null,
      recipeIds,
      notes: 'Needed for this week',
    };
  }

  private createOcrLines(): OcrReceiptLineValue[] {
    return [
      {
        id: new Types.ObjectId(),
        rawText: 'Greek Yogurt 500g',
        name: 'Greek yogurt',
        quantityValue: 500,
        quantityUnit: 'g',
        confidence: 0.96,
        accepted: true,
      },
      {
        id: new Types.ObjectId(),
        rawText: 'Baby Spinach x1',
        name: 'Baby spinach',
        quantityValue: 1,
        quantityUnit: 'pack',
        confidence: 0.92,
        accepted: true,
      },
      {
        id: new Types.ObjectId(),
        rawText: 'Avocados 2pk',
        name: 'Avocado',
        quantityValue: 2,
        quantityUnit: 'piece',
        confidence: 0.88,
        note: '2-pack',
        accepted: true,
      },
    ];
  }

  createInventoryEventItemsFromOcrLines(
    lines: OcrReceiptLineValue[],
  ): InventoryEventItemValue[] {
    return lines
      .filter((line) => line.accepted)
      .map((line) => ({
        inventoryItemId: null,
        name: line.name,
        quantity: normalizeMeasurementValue(line.quantityValue, line.quantityUnit),
      }));
  }
}
