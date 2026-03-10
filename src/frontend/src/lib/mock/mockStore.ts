import { create } from 'zustand';
import type {
  ChatMessage,
  GroceryList,
  GroceryListItem,
  InventoryEvent,
  InventoryEventItem,
  InventoryItem,
  InventoryQuantity,
  OnboardingDraft,
  OnboardingQuestion,
  OnboardingQuestionKey,
  OcrReceiptLine,
  Recipe,
  RecipeDraftOutput,
  RecipeGeneration,
  RecipeGenerationRevision,
  RecipeHistoryEvent,
  User,
  UserPreference,
  UserPreferenceProfile,
  WeeklyPlan,
  WeeklyPlanDay,
  WeeklyPlanRevision,
  WeeklyPlanRevisionOutput,
} from '../types/entities';
import type { OcrLineUpdatePayload, SessionUserSummary, UpdateInventoryItemPayload } from '../types/contracts';

const TODAY = new Date(Date.UTC(2026, 2, 9, 9, 0, 0));
const WEEK_START = new Date(Date.UTC(2026, 2, 9, 0, 0, 0));
const WEEK_END = new Date(Date.UTC(2026, 2, 15, 23, 59, 59));

type MockData = {
  onboardingQuestions: OnboardingQuestion[];
  users: Record<string, User>;
  userIdsBySupabaseId: Record<string, string>;
  preferences: Record<string, UserPreference>;
  onboardingDrafts: Record<string, OnboardingDraft>;
  weeklyPlans: Record<string, WeeklyPlan>;
  currentWeeklyPlanByUserId: Record<string, string>;
  weeklyPlanRevisionsByPlanId: Record<string, WeeklyPlanRevision[]>;
  groceryLists: Record<string, GroceryList>;
  currentGroceryListByUserId: Record<string, string>;
  recipes: Record<string, Recipe>;
  recipeGenerations: Record<string, RecipeGeneration>;
  activeRecipeGenerationByUserId: Record<string, string>;
  recipeGenerationRevisionsByGenerationId: Record<string, RecipeGenerationRevision[]>;
  recipeHistoryEvents: RecipeHistoryEvent[];
  inventoryItems: Record<string, InventoryItem>;
  inventoryEvents: InventoryEvent[];
};

type MockStore = {
  data: MockData;
  ensureUserFromSession: (authUser: SessionUserSummary) => string;
  setOnboardingAnswer: (
    userId: string,
    key: OnboardingQuestionKey,
    value: string | string[],
  ) => OnboardingDraft;
  completeOnboarding: (userId: string) => UserPreference;
  createPlannerRevision: (userId: string, userMessage: string) => WeeklyPlanRevision;
  acceptPlannerRevision: (userId: string, revisionId: string) => WeeklyPlan;
  syncGroceryFromPlan: (userId: string) => GroceryList;
  markGroceryPurchased: (userId: string, itemIds: string[]) => GroceryList;
  moveLowStockToBuy: (userId: string) => GroceryList;
  moveUrgentToBuy: (userId: string) => GroceryList;
  updateInventoryItem: (
    userId: string,
    itemId: string,
    patch: UpdateInventoryItemPayload,
  ) => InventoryItem;
  discardInventoryItem: (userId: string, itemId: string) => InventoryEvent;
  reviewOcrLine: (userId: string, lineId: string, patch: OcrLineUpdatePayload) => InventoryEvent;
  applyOcrReview: (userId: string) => { event: InventoryEvent; updatedItems: InventoryItem[] };
  startRecipeGeneration: (
    userId: string,
    userMessage: string,
    weeklyPlanId?: string,
  ) => { generation: RecipeGeneration; revision: RecipeGenerationRevision };
  createRecipeGenerationRevision: (
    userId: string,
    generationId: string,
    userMessage: string,
  ) => RecipeGenerationRevision;
  acceptRecipeGeneration: (userId: string, generationId: string, revisionId: string) => Recipe;
  setRecipeFavorite: (userId: string, recipeId: string, isFavorite: boolean) => void;
  cookRecipe: (userId: string, recipeId: string) => RecipeHistoryEvent;
  rateRecipe: (userId: string, recipeId: string, rating: number, feedback?: string) => RecipeHistoryEvent;
};

const DEFAULT_DRAFT: OnboardingDraft = {
  dietStyle: 'Mediterranean',
  allergies: [],
  cuisinePreferences: ['Italian', 'Japanese', 'Seasonal'],
  cookingTime: '30 minutes or less',
  nutritionTarget: 'High protein',
  weeklyStructure: ['Meal-prep lunches', 'Flexible dinners', 'Quick breakfasts'],
  weeklyIntentFocus: 'Build a high-protein week with meal-prep lunches.',
  weeklyIntentExclude: ['Mushrooms'],
  weeklyIntentNotes: 'Keep weekday dinners under 30 minutes and use spinach early.',
};

function cloneData(data: MockData): MockData {
  return JSON.parse(JSON.stringify(data)) as MockData;
}

function iso(dayOffset = 0, hour = 9, minute = 0): string {
  const value = new Date(TODAY);
  value.setUTCDate(value.getUTCDate() + dayOffset);
  value.setUTCHours(hour, minute, 0, 0);
  return value.toISOString();
}

function normalizeName(value: string): string {
  return value.toLowerCase().trim();
}

function stableId(prefix: string, key: string): string {
  return `${prefix}_${key.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`;
}

function createChatMessage(id: string, role: ChatMessage['role'], content: string, timestamp: string): ChatMessage {
  return { id, role, content, timestamp };
}

function createQuantity(value: number, unit: string): InventoryQuantity {
  return { value, unit };
}

function buildQuestionBank(): OnboardingQuestion[] {
  return [
    {
      id: 'q_diet_style',
      key: 'diet_style',
      prompt: 'Which diet style should anchor your default weekly plans?',
      hint: 'This becomes your saved baseline and can still be adjusted in AI chat later.',
      answerType: 'single_select',
      required: true,
      order: 1,
      isEnabled: true,
      defaultValue: DEFAULT_DRAFT.dietStyle,
      options: [
        { value: 'Mediterranean', label: 'Mediterranean', description: 'Balanced, plant-forward, and flexible.' },
        { value: 'High protein', label: 'High protein', description: 'Prioritize protein in every meal.' },
        { value: 'Vegetarian', label: 'Vegetarian', description: 'No meat, flexible on dairy and eggs.' },
        { value: 'Family mix', label: 'Family mix', description: 'Simple crowd-pleasers with broad appeal.' },
      ],
      metadata: {
        tipTitle: 'Good default',
        tipBody: 'Mediterranean works well with meal prep, pantry staples, and ingredient reuse.',
      },
      createdAt: iso(-2, 8),
      updatedAt: iso(-2, 8),
    },
    {
      id: 'q_allergies_avoids',
      key: 'allergies_avoids',
      prompt: 'What should Kitchen Assistant always avoid when planning?',
      hint: 'Choose ingredients that are allergies, intolerances, or just not worth seeing in drafts.',
      answerType: 'multi_select',
      required: false,
      order: 2,
      isEnabled: true,
      defaultValue: DEFAULT_DRAFT.allergies,
      options: [
        { value: 'None', label: 'None', description: 'No standing avoids right now.' },
        { value: 'Dairy', label: 'Dairy', description: 'Avoid milk, cheese, yogurt, and cream.' },
        { value: 'Gluten', label: 'Gluten', description: 'Avoid wheat-based ingredients.' },
        { value: 'Shellfish', label: 'Shellfish', description: 'Avoid shrimp, crab, lobster, and similar.' },
        { value: 'Mushrooms', label: 'Mushrooms', description: 'Hide mushrooms from plan drafts.' },
      ],
      metadata: {
        tipTitle: 'Keep it honest',
        tipBody: 'Avoids feed both weekly plans and recipe chat so fewer revisions are needed later.',
      },
      createdAt: iso(-2, 8),
      updatedAt: iso(-2, 8),
    },
    {
      id: 'q_cuisine_preferences',
      key: 'cuisine_preferences',
      prompt: 'Which cuisines should show up most often in your meal plan?',
      hint: 'Pick 2-4 so the planner can keep variety without becoming random.',
      answerType: 'multi_select',
      required: true,
      order: 3,
      isEnabled: true,
      defaultValue: DEFAULT_DRAFT.cuisinePreferences,
      options: [
        { value: 'Italian', label: 'Italian', description: 'Pasta, tomato, herbs, and comforting bowls.' },
        { value: 'Japanese', label: 'Japanese', description: 'Rice bowls, broths, and clean sauces.' },
        { value: 'Mexican', label: 'Mexican', description: 'Bowls, tacos, burritos, and pantry spice.' },
        { value: 'Seasonal', label: 'Seasonal', description: 'Ingredient-led and produce friendly.' },
        { value: 'Mediterranean', label: 'Mediterranean', description: 'Bright grains, herbs, and proteins.' },
      ],
      metadata: {
        tipTitle: 'Best range',
        tipBody: 'Three cuisines usually balances variety with strong grocery overlap.',
      },
      createdAt: iso(-2, 8),
      updatedAt: iso(-2, 8),
    },
    {
      id: 'q_cooking_time',
      key: 'cooking_time',
      prompt: 'What weekday cooking window should the planner optimize for?',
      hint: 'The weekly plan uses this hard limit for weekday dinners and lunch prep suggestions.',
      answerType: 'single_select',
      required: true,
      order: 4,
      isEnabled: true,
      defaultValue: DEFAULT_DRAFT.cookingTime,
      options: [
        { value: '15 minutes or less', label: '15 min', description: 'Maximize no-cook or fast skillet recipes.' },
        { value: '30 minutes or less', label: '30 min', description: 'Fast enough for weekdays, still flexible.' },
        { value: '45 minutes or less', label: '45 min', description: 'More range for sheet-pan and stovetop meals.' },
      ],
      metadata: {
        tipTitle: 'Most popular',
        tipBody: 'Thirty minutes keeps weeknights realistic and still allows flavor.',
      },
      createdAt: iso(-2, 8),
      updatedAt: iso(-2, 8),
    },
    {
      id: 'q_nutrition_target',
      key: 'nutrition_target',
      prompt: 'Which nutrition target should shape this week first?',
      hint: 'This sets the plan target card shown on Home and Weekly Planner.',
      answerType: 'single_select',
      required: true,
      order: 5,
      isEnabled: true,
      defaultValue: DEFAULT_DRAFT.nutritionTarget,
      options: [
        { value: 'High protein', label: 'High protein', description: 'Bias meals toward lean protein and satisfying snacks.' },
        { value: 'Balanced energy', label: 'Balanced energy', description: 'Moderate macros with steady meals.' },
        { value: 'Lower carb', label: 'Lower carb', description: 'Reduce carb-heavy defaults.' },
      ],
      metadata: {
        tipTitle: 'Visible everywhere',
        tipBody: 'The chosen target appears in weekly plan cards, home summaries, and recipe chat context.',
      },
      createdAt: iso(-2, 8),
      updatedAt: iso(-2, 8),
    },
    {
      id: 'q_weekly_structure',
      key: 'weekly_structure',
      prompt: 'What structure should the planner follow this week?',
      hint: 'Choose the patterns you want the system to repeat across the week.',
      answerType: 'multi_select',
      required: true,
      order: 6,
      isEnabled: true,
      defaultValue: DEFAULT_DRAFT.weeklyStructure,
      options: [
        { value: 'Meal-prep lunches', label: 'Meal-prep lunches', description: 'Reuse one or two lunch bases through the week.' },
        { value: 'Flexible dinners', label: 'Flexible dinners', description: 'Keep dinners easy to swap or repurpose.' },
        { value: 'Quick breakfasts', label: 'Quick breakfasts', description: 'Make breakfast almost automatic.' },
        { value: 'Weekend cooking project', label: 'Weekend project', description: 'Leave room for one bigger weekend meal.' },
      ],
      metadata: {
        tipTitle: 'Best match',
        tipBody: 'Meal-prep lunches plus quick breakfasts mirrors the draft_1 planner structure closely.',
      },
      createdAt: iso(-2, 8),
      updatedAt: iso(-2, 8),
    },
  ];
}

function recipeCatalog(userId: string, weeklyPlanId: string): Record<string, Recipe> {
  const raw = [
    {
      key: 'overnight_oats',
      title: 'Overnight Oats',
      summary: 'Prep-ahead breakfast with berries and chia.',
      readyInMinutes: 8,
      calories: 380,
      highlight: 'No-cook',
      tags: ['Breakfast', 'Meal prep'],
      ingredients: ['Rolled oats', 'Chia seeds', 'Greek yogurt', 'Frozen berries'],
      steps: [
        'Mix oats, chia, and yogurt in a jar.',
        'Top with berries and refrigerate overnight.',
        'Serve chilled with extra fruit in the morning.',
      ],
    },
    {
      key: 'chicken_quinoa_power_bowl',
      title: 'Chicken Quinoa Power Bowl',
      summary: 'Meal-prep lunch bowl with greens and lemon dressing.',
      readyInMinutes: 18,
      calories: 540,
      highlight: 'High protein',
      tags: ['Lunch', 'Weekly planned'],
      ingredients: ['Chicken breast', 'Quinoa', 'Spinach', 'Cherry tomatoes'],
      steps: [
        'Roast or sear the chicken until cooked through.',
        'Cook quinoa and toss with spinach and tomatoes.',
        'Finish with lemon dressing and sliced chicken.',
      ],
    },
    {
      key: 'salmon_rice_bowl',
      title: 'Salmon Rice Bowl',
      summary: 'Roasted salmon with rice, broccoli, and sesame drizzle.',
      readyInMinutes: 20,
      calories: 590,
      highlight: 'Balanced bowl',
      tags: ['Dinner', 'Seafood'],
      ingredients: ['Salmon fillet', 'Jasmine rice', 'Broccoli', 'Sesame soy glaze'],
      steps: [
        'Roast salmon and broccoli on one tray.',
        'Warm rice and season with sesame and lime.',
        'Assemble the bowl and spoon over the glaze.',
      ],
    },
    {
      key: 'egg_wrap',
      title: 'Egg Wrap',
      summary: 'Soft scramble wrap with spinach and herbs.',
      readyInMinutes: 12,
      calories: 360,
      highlight: 'Fast breakfast',
      tags: ['Breakfast', 'Quick'],
      ingredients: ['Eggs', 'Whole wheat wrap', 'Spinach', 'Feta'],
      steps: [
        'Soft scramble the eggs with spinach.',
        'Warm the wrap and add the filling.',
        'Fold tightly and finish with herbs.',
      ],
    },
    {
      key: 'turkey_chili',
      title: 'Turkey Chili',
      summary: 'One-pot turkey chili built for leftovers.',
      readyInMinutes: 30,
      calories: 610,
      highlight: 'Batch cook',
      tags: ['Dinner', 'Meal prep'],
      ingredients: ['Ground turkey', 'Beans', 'Tomatoes', 'Bell pepper'],
      steps: [
        'Brown the turkey with onions and peppers.',
        'Add beans and tomatoes and simmer until rich.',
        'Serve fresh or hold for leftovers later in the week.',
      ],
    },
    {
      key: 'tofu_stir_fry',
      title: 'Tofu Stir Fry',
      summary: 'Crisp tofu with garlic soy vegetables.',
      readyInMinutes: 22,
      calories: 500,
      highlight: 'Plant-forward',
      tags: ['Dinner', 'Vegetarian'],
      ingredients: ['Tofu', 'Broccoli', 'Carrots', 'Soy sauce'],
      steps: [
        'Crisp tofu in a hot pan.',
        'Stir-fry vegetables with garlic and ginger.',
        'Return tofu to the pan and coat everything in sauce.',
      ],
    },
    {
      key: 'greek_yogurt_power_bowl',
      title: 'Greek Yogurt Power Bowl',
      summary: 'Protein breakfast with oats, berries, and banana.',
      readyInMinutes: 8,
      calories: 420,
      highlight: 'No-cook',
      tags: ['Breakfast', 'Favorite'],
      ingredients: ['Greek yogurt', 'Oats', 'Frozen berries', 'Banana'],
      steps: [
        'Spoon yogurt into a chilled bowl.',
        'Top with berries, oats, and sliced banana.',
        'Finish with seeds or honey if you want extra texture.',
      ],
    },
    {
      key: 'tuna_pasta',
      title: 'Tuna Pasta',
      summary: 'Light pasta toss with lemon tuna and peas.',
      readyInMinutes: 18,
      calories: 520,
      highlight: 'Pantry hero',
      tags: ['Lunch', 'Quick'],
      ingredients: ['Tuna', 'Pasta', 'Peas', 'Lemon'],
      steps: [
        'Cook pasta and reserve a splash of cooking water.',
        'Flake tuna with lemon, olive oil, and peas.',
        'Toss everything together until glossy.',
      ],
    },
    {
      key: 'beef_tacos',
      title: 'Beef Tacos',
      summary: 'Weeknight tacos with crunchy cabbage slaw.',
      readyInMinutes: 25,
      calories: 640,
      highlight: 'Crowd-pleaser',
      tags: ['Dinner', 'Mexican'],
      ingredients: ['Lean beef', 'Corn tortillas', 'Cabbage', 'Lime'],
      steps: [
        'Brown the beef with taco spices.',
        'Warm tortillas and toss cabbage with lime.',
        'Build tacos with beef, slaw, and quick sauce.',
      ],
    },
    {
      key: 'egg_toast',
      title: 'Egg Toast',
      summary: 'Crisp toast with jammy eggs and chili crunch.',
      readyInMinutes: 10,
      calories: 340,
      highlight: 'Fast breakfast',
      tags: ['Breakfast', 'Quick'],
      ingredients: ['Eggs', 'Sourdough', 'Chili crunch', 'Herbs'],
      steps: [
        'Toast the bread until crisp.',
        'Cook jammy eggs and slice them over the toast.',
        'Finish with chili crunch and herbs.',
      ],
    },
    {
      key: 'lentil_bowl',
      title: 'Lentil Bowl',
      summary: 'Warm lentils with roasted vegetables and yogurt sauce.',
      readyInMinutes: 24,
      calories: 510,
      highlight: 'Fiber rich',
      tags: ['Lunch', 'Vegetarian'],
      ingredients: ['Lentils', 'Sweet potato', 'Cucumber', 'Yogurt sauce'],
      steps: [
        'Roast the sweet potato until caramelized.',
        'Warm lentils and season them with cumin and lemon.',
        'Assemble with cucumber and yogurt sauce.',
      ],
    },
    {
      key: 'chicken_pesto',
      title: 'Chicken Pesto',
      summary: 'Sheet-pan chicken with pesto vegetables.',
      readyInMinutes: 26,
      calories: 560,
      highlight: 'Weeknight roast',
      tags: ['Dinner', 'High protein'],
      ingredients: ['Chicken thighs', 'Pesto', 'Zucchini', 'Cherry tomatoes'],
      steps: [
        'Coat chicken and vegetables with pesto.',
        'Roast until the chicken is golden and cooked through.',
        'Finish with lemon and serve with any pan juices.',
      ],
    },
    {
      key: 'protein_waffles',
      title: 'Protein Waffles',
      summary: 'Cottage cheese waffles with berries.',
      readyInMinutes: 14,
      calories: 430,
      highlight: 'Breakfast prep',
      tags: ['Breakfast', 'High protein'],
      ingredients: ['Cottage cheese', 'Eggs', 'Oats', 'Berries'],
      steps: [
        'Blend the batter until smooth.',
        'Cook in a waffle iron until crisp.',
        'Serve with berries and a spoon of yogurt.',
      ],
    },
    {
      key: 'burrito_bowl',
      title: 'Burrito Bowl',
      summary: 'Rice bowl with chicken, beans, and bright salsa.',
      readyInMinutes: 20,
      calories: 580,
      highlight: 'Meal-prep lunch',
      tags: ['Lunch', 'Weekly planned'],
      ingredients: ['Chicken breast', 'Rice', 'Black beans', 'Salsa'],
      steps: [
        'Cook the chicken with cumin and paprika.',
        'Warm rice and beans together with a squeeze of lime.',
        'Layer the bowl and finish with salsa and herbs.',
      ],
    },
    {
      key: 'shrimp_soba',
      title: 'Shrimp Soba',
      summary: 'Garlic shrimp with chilled soba noodles.',
      readyInMinutes: 18,
      calories: 530,
      highlight: 'Seafood swap',
      tags: ['Dinner', 'Seafood'],
      ingredients: ['Shrimp', 'Soba noodles', 'Cucumber', 'Sesame'],
      steps: [
        'Cook soba noodles and rinse until cool.',
        'Sear shrimp with garlic and chili.',
        'Toss everything with sesame dressing and cucumber.',
      ],
    },
    {
      key: 'cottage_bowl',
      title: 'Cottage Bowl',
      summary: 'Savory cottage cheese bowl with crunchy vegetables.',
      readyInMinutes: 7,
      calories: 350,
      highlight: 'No-cook',
      tags: ['Breakfast', 'Quick'],
      ingredients: ['Cottage cheese', 'Cucumber', 'Tomatoes', 'Seeds'],
      steps: [
        'Spoon cottage cheese into a shallow bowl.',
        'Add chopped vegetables and seeds.',
        'Season with salt, pepper, and lemon.',
      ],
    },
    {
      key: 'chicken_salad',
      title: 'Chicken Salad',
      summary: 'Herby chicken salad with crunchy greens.',
      readyInMinutes: 16,
      calories: 490,
      highlight: 'Lunch reset',
      tags: ['Lunch', 'High protein'],
      ingredients: ['Chicken breast', 'Mixed greens', 'Celery', 'Herb dressing'],
      steps: [
        'Slice the cooked chicken thinly.',
        'Toss greens and celery with the dressing.',
        'Top with chicken and finish with herbs.',
      ],
    },
    {
      key: 'burger_wrap',
      title: 'Burger Wrap',
      summary: 'Burger-inspired wrap with pickles and sauce.',
      readyInMinutes: 20,
      calories: 620,
      highlight: 'Weekend dinner',
      tags: ['Dinner', 'Comfort'],
      ingredients: ['Lean beef', 'Wraps', 'Lettuce', 'Pickles'],
      steps: [
        'Cook seasoned beef patties or crumbles.',
        'Warm wraps and layer with lettuce and pickles.',
        'Add the beef and burger sauce before rolling.',
      ],
    },
    {
      key: 'bagel_eggs',
      title: 'Bagel Eggs',
      summary: 'Bagel breakfast sandwich with soft eggs.',
      readyInMinutes: 12,
      calories: 410,
      highlight: 'Weekend breakfast',
      tags: ['Breakfast', 'Weekend'],
      ingredients: ['Bagels', 'Eggs', 'Cream cheese', 'Arugula'],
      steps: [
        'Toast the bagels and cook the eggs.',
        'Spread cream cheese on both halves.',
        'Build the sandwich with eggs and arugula.',
      ],
    },
    {
      key: 'sheet_pan_fish',
      title: 'Sheet-Pan Fish',
      summary: 'Simple fish traybake with potatoes and greens.',
      readyInMinutes: 28,
      calories: 560,
      highlight: 'Low cleanup',
      tags: ['Dinner', 'Seafood'],
      ingredients: ['White fish', 'Baby potatoes', 'Green beans', 'Lemon'],
      steps: [
        'Start potatoes until nearly tender.',
        'Add fish and green beans to the tray.',
        'Roast until the fish flakes and finish with lemon.',
      ],
    },
  ] as const;

  return Object.fromEntries(
    raw.map((item, index) => {
      const id = `${userId}_recipe_${item.key}`;
      return [
        id,
        {
          id,
          weeklyPlanId,
          sourceGenerationId: null,
          sourceRevisionId: null,
          title: item.title,
          summary: item.summary,
          status: 'published',
          ingredients: item.ingredients.map((name, ingredientIndex) => ({
            id: `${id}_ingredient_${ingredientIndex + 1}`,
            name,
            quantity: ingredientIndex === 0 ? '1 main portion' : '1 supporting portion',
          })),
          steps: item.steps.map((text, stepIndex) => ({
            id: `${id}_step_${stepIndex + 1}`,
            order: stepIndex + 1,
            text,
          })),
          tags: [...item.tags, `${item.readyInMinutes} min`, `${item.calories} kcal`, item.highlight],
          isPublic: false,
          createdAt: iso(-7 + index, 12),
          updatedAt: iso(-3 + Math.min(index, 4), 12),
        } satisfies Recipe,
      ];
    }),
  );
}

function buildWeeklyPlanDays(userId: string): WeeklyPlanDay[] {
  const meal = (slot: WeeklyPlanDay['meals'][number]['slot'], key: string, title: string, calories: number, tags: string[]) => ({
    slot,
    recipeId: `${userId}_recipe_${key}`,
    title,
    shortLabel: title,
    calories,
    tags,
  });

  return [
    {
      dayKey: 'mon',
      label: 'Mon',
      meals: [
        meal('breakfast', 'overnight_oats', 'Overnight oats', 380, ['Meal prep']),
        meal('lunch', 'chicken_quinoa_power_bowl', 'Chicken bowl', 540, ['High protein']),
        meal('dinner', 'salmon_rice_bowl', 'Salmon rice', 590, ['Seafood']),
      ],
    },
    {
      dayKey: 'tue',
      label: 'Tue',
      meals: [
        meal('breakfast', 'egg_wrap', 'Egg wrap', 360, ['Quick']),
        meal('lunch', 'turkey_chili', 'Turkey chili', 610, ['Batch']),
        meal('dinner', 'tofu_stir_fry', 'Tofu stir fry', 500, ['Vegetarian']),
      ],
    },
    {
      dayKey: 'wed',
      label: 'Wed',
      meals: [
        meal('breakfast', 'greek_yogurt_power_bowl', 'Greek yogurt', 420, ['No-cook']),
        meal('lunch', 'tuna_pasta', 'Tuna pasta', 520, ['Pantry']),
        meal('dinner', 'beef_tacos', 'Beef tacos', 640, ['Mexican']),
      ],
    },
    {
      dayKey: 'thu',
      label: 'Thu',
      meals: [
        meal('breakfast', 'egg_toast', 'Egg toast', 340, ['Quick']),
        meal('lunch', 'lentil_bowl', 'Lentil bowl', 510, ['Vegetarian']),
        meal('dinner', 'chicken_pesto', 'Chicken pesto', 560, ['Weeknight']),
      ],
    },
    {
      dayKey: 'fri',
      label: 'Fri',
      meals: [
        meal('breakfast', 'protein_waffles', 'Protein waffles', 430, ['Breakfast']),
        meal('lunch', 'burrito_bowl', 'Burrito bowl', 580, ['Meal prep']),
        meal('dinner', 'shrimp_soba', 'Shrimp soba', 530, ['Seafood']),
      ],
    },
    {
      dayKey: 'sat',
      label: 'Sat',
      meals: [
        meal('breakfast', 'cottage_bowl', 'Cottage bowl', 350, ['No-cook']),
        meal('lunch', 'chicken_salad', 'Chicken salad', 490, ['Fresh']),
        meal('dinner', 'burger_wrap', 'Burger wrap', 620, ['Comfort']),
      ],
    },
    {
      dayKey: 'sun',
      label: 'Sun',
      meals: [
        meal('breakfast', 'bagel_eggs', 'Bagel eggs', 410, ['Weekend']),
        meal('lunch', 'turkey_chili', 'Chili leftovers', 480, ['Leftovers']),
        meal('dinner', 'sheet_pan_fish', 'Sheet-pan fish', 560, ['Low cleanup']),
      ],
    },
  ];
}

function buildWeeklyPlanRevisions(userId: string, weeklyPlanId: string, days: WeeklyPlanDay[]): WeeklyPlanRevision[] {
  const first: WeeklyPlanRevisionOutput = {
    badge: 'batch-cooking',
    rationale: 'Built around high-protein lunches, fast breakfasts, and ingredient reuse.',
    days,
  };

  const seafoodDays = days.map((day) =>
    day.dayKey === 'wed'
      ? {
          ...day,
          meals: day.meals.map((meal) =>
            meal.slot === 'dinner'
              ? {
                  ...meal,
                  recipeId: `${userId}_recipe_shrimp_soba`,
                  title: 'Shrimp soba',
                  shortLabel: 'Shrimp soba',
                  calories: 530,
                  tags: ['Seafood swap'],
                }
              : meal,
          ),
        }
      : day,
  );

  return [
    {
      id: `${weeklyPlanId}_revision_1`,
      weeklyPlanId,
      userId,
      revisionNumber: 1,
      chat: [
        createChatMessage(`${weeklyPlanId}_r1_m1`, 'assistant', 'I generated a weekly plan using your saved defaults and this week intent.', iso(-1, 10)),
      ],
      latestOutput: first,
      createdAt: iso(-1, 10),
      updatedAt: iso(-1, 10),
    },
    {
      id: `${weeklyPlanId}_revision_2`,
      weeklyPlanId,
      userId,
      revisionNumber: 2,
      chat: [
        createChatMessage(`${weeklyPlanId}_r2_m1`, 'assistant', 'I generated a weekly plan using your saved defaults and this week intent.', iso(-1, 10)),
        createChatMessage(`${weeklyPlanId}_r2_m2`, 'user', 'Swap Wednesday dinner to seafood and keep the rest simple.', iso(-1, 11)),
        createChatMessage(`${weeklyPlanId}_r2_m3`, 'assistant', 'Updated Wednesday dinner to shrimp soba and kept the rest of the plan intact.', iso(-1, 11, 10)),
      ],
      latestOutput: {
        badge: 'seafood swap',
        rationale: 'Wednesday dinner now leans seafood without changing the lunch prep structure.',
        days: seafoodDays,
      },
      createdAt: iso(-1, 11),
      updatedAt: iso(-1, 11, 10),
    },
  ];
}

function buildGroceryList(userId: string, weeklyPlanId: string): GroceryList {
  const items: Array<[string, number, string, string, string[], string]> = [
    ['Eggs', 12, 'pcs', 'Needed for Tue breakfast', [`${userId}_recipe_egg_wrap`, `${userId}_recipe_bagel_eggs`], 'weekly_plan'],
    ['Spinach', 300, 'g', 'Needed for Mon lunch', [`${userId}_recipe_chicken_quinoa_power_bowl`], 'weekly_plan'],
    ['Olive oil', 1, 'L', 'Needed for weekly batch prep', [], 'weekly_plan'],
    ['Greek yogurt', 2, 'tubs', 'For breakfasts and sauces', [`${userId}_recipe_greek_yogurt_power_bowl`], 'weekly_plan'],
    ['Bananas', 6, 'pcs', 'Breakfast rotation', [`${userId}_recipe_greek_yogurt_power_bowl`], 'weekly_plan'],
    ['Chicken breast', 500, 'g', 'Lunch bowls and burrito bowl', [`${userId}_recipe_chicken_quinoa_power_bowl`, `${userId}_recipe_burrito_bowl`], 'weekly_plan'],
    ['Broccoli', 2, 'heads', 'For salmon bowls and stir fry', [`${userId}_recipe_salmon_rice_bowl`, `${userId}_recipe_tofu_stir_fry`], 'weekly_plan'],
    ['Jasmine rice', 1, 'kg', 'Base for bowls this week', [`${userId}_recipe_salmon_rice_bowl`, `${userId}_recipe_burrito_bowl`], 'weekly_plan'],
    ['Shrimp', 400, 'g', 'Seafood dinner swap', [`${userId}_recipe_shrimp_soba`], 'weekly_plan'],
    ['Soba noodles', 250, 'g', 'Paired with shrimp soba', [`${userId}_recipe_shrimp_soba`], 'weekly_plan'],
    ['Black beans', 2, 'cans', 'For burrito bowls', [`${userId}_recipe_burrito_bowl`], 'weekly_plan'],
    ['Lemons', 4, 'pcs', 'Dressings and finishing', [`${userId}_recipe_chicken_quinoa_power_bowl`, `${userId}_recipe_sheet_pan_fish`], 'weekly_plan'],
  ];

  return {
    id: `${userId}_grocery_current`,
    userId,
    weeklyPlanId,
    status: 'active',
    items: items.map(([name, value, unit, notes, recipeIds, source], index) => ({
      itemId: `${userId}_grocery_item_${index + 1}`,
      name,
      quantity: { value, unit },
      status: 'to_buy',
      source: source as GroceryListItem['source'],
      recipeIds,
      notes,
    })),
    lastComputedAt: iso(-1, 15),
    createdAt: iso(-1, 15),
    updatedAt: iso(-1, 15),
  };
}

function buildInventoryItems(userId: string): Record<string, InventoryItem> {
  const coreItems: Array<Partial<InventoryItem> & { key: string; name: string; quantityValue: number; quantityUnit: string }> = [
    {
      key: 'eggs',
      name: 'Eggs',
      category: 'Dairy & eggs',
      location: 'fridge',
      quantityValue: 3,
      quantityUnit: 'pcs',
      status: 'low_stock',
      freshness: { estimatedDaysLeft: 5, confidence: 'high' },
    },
    {
      key: 'spinach',
      name: 'Spinach',
      category: 'Produce',
      location: 'fridge',
      quantityValue: 1,
      quantityUnit: 'bag',
      status: 'low_stock',
      dates: { expiresAt: iso(1, 18) },
      freshness: { estimatedDaysLeft: 1, confidence: 'high' },
    },
    {
      key: 'olive_oil',
      name: 'Olive oil',
      category: 'Pantry',
      location: 'pantry',
      quantityValue: 0.2,
      quantityUnit: 'L',
      status: 'low_stock',
      freshness: { estimatedDaysLeft: 20, confidence: 'medium' },
    },
    {
      key: 'chicken',
      name: 'Chicken',
      category: 'Protein',
      location: 'fridge',
      quantityValue: 400,
      quantityUnit: 'g',
      status: 'use_soon',
      dates: { expiresAt: iso(0, 21) },
      freshness: { estimatedDaysLeft: 0, confidence: 'high' },
    },
    {
      key: 'greek_yogurt',
      name: 'Greek yogurt',
      category: 'Dairy & eggs',
      location: 'fridge',
      quantityValue: 1,
      quantityUnit: 'tub',
      status: 'use_soon',
      dates: { expiresAt: iso(1, 12) },
      freshness: { estimatedDaysLeft: 1, confidence: 'high' },
    },
    {
      key: 'berries',
      name: 'Frozen berries',
      category: 'Frozen',
      location: 'freezer',
      quantityValue: 1,
      quantityUnit: 'bag',
      status: 'fresh',
    },
    {
      key: 'salmon',
      name: 'Salmon',
      category: 'Protein',
      location: 'fridge',
      quantityValue: 2,
      quantityUnit: 'fillets',
      status: 'fresh',
    },
    {
      key: 'rice',
      name: 'Jasmine rice',
      category: 'Pantry',
      location: 'pantry',
      quantityValue: 2,
      quantityUnit: 'kg',
      status: 'fresh',
    },
    {
      key: 'broccoli',
      name: 'Broccoli',
      category: 'Produce',
      location: 'fridge',
      quantityValue: 1,
      quantityUnit: 'head',
      status: 'use_soon',
      dates: { expiresAt: iso(2, 12) },
      freshness: { estimatedDaysLeft: 2, confidence: 'medium' },
    },
    {
      key: 'milk',
      name: 'Milk',
      category: 'Dairy & eggs',
      location: 'fridge',
      quantityValue: 1,
      quantityUnit: 'carton',
      status: 'use_soon',
      dates: { expiresAt: iso(3, 10) },
      freshness: { estimatedDaysLeft: 3, confidence: 'medium' },
    },
    {
      key: 'lettuce',
      name: 'Lettuce',
      category: 'Produce',
      location: 'fridge',
      quantityValue: 1,
      quantityUnit: 'head',
      status: 'expired',
      dates: { expiresAt: iso(-1, 20) },
      freshness: { estimatedDaysLeft: -1, confidence: 'high' },
    },
    {
      key: 'garlic',
      name: 'Garlic',
      category: 'Produce',
      location: 'pantry',
      quantityValue: 2,
      quantityUnit: 'bulbs',
      status: 'fresh',
    },
  ];

  const fillerNames = Array.from({ length: 52 }, (_, index) => `Pantry staple ${index + 1}`);
  const fillers = fillerNames.map((name, index) => ({
    key: `staple_${index + 1}`,
    name,
    category: index % 3 === 0 ? 'Pantry' : index % 3 === 1 ? 'Produce' : 'Protein',
    location: index % 4 === 0 ? 'pantry' : index % 4 === 1 ? 'fridge' : index % 4 === 2 ? 'freezer' : 'pantry',
    quantityValue: (index % 5) + 1,
    quantityUnit: index % 4 === 0 ? 'pcs' : index % 4 === 1 ? 'jars' : index % 4 === 2 ? 'packs' : 'bags',
    status: 'fresh' as const,
  }));

  return Object.fromEntries(
    [...coreItems, ...fillers].map((item, index) => {
      const id = `${userId}_inventory_${item.key}`;
      return [
        id,
        {
          id,
          userId,
          name: item.name,
          normalizedName: normalizeName(item.name),
          category: item.category,
          location: item.location ?? 'pantry',
          quantity: { value: item.quantityValue, unit: item.quantityUnit },
          status: item.status ?? 'fresh',
          dates: {
            addedAt: iso(-10 + (index % 7), 9),
            ...(item.dates ?? {}),
          },
          freshness: item.freshness ?? { estimatedDaysLeft: 7, confidence: 'medium' },
          source: 'manual',
          lastEventId: null,
          metadata: {},
          createdAt: iso(-14 + (index % 5), 8),
          lastUpdatedAt: iso(-1 + (index % 3), 7),
        } satisfies InventoryItem,
      ];
    }),
  );
}

function buildRecipeGeneration(userId: string, weeklyPlanId: string): {
  generation: RecipeGeneration;
  revisions: RecipeGenerationRevision[];
} {
  const generationId = `${userId}_generation_current`;
  const revisionOneDraft: RecipeDraftOutput = {
    title: 'Chicken Spinach Rice Bowl',
    summary: 'Balanced bowl built from weekly plan leftovers and in-stock items.',
    metadata: {
      readyInMinutes: 18,
      calories: 520,
      highlight: 'Version 1',
    },
    ingredients: [
      { id: `${generationId}_draft_i1`, name: 'Chicken breast', quantity: '250 g' },
      { id: `${generationId}_draft_i2`, name: 'Spinach', quantity: '2 handfuls' },
      { id: `${generationId}_draft_i3`, name: 'Jasmine rice', quantity: '2 cups cooked' },
      { id: `${generationId}_draft_i4`, name: 'Soy sauce', quantity: '2 tbsp' },
    ],
    steps: [
      { id: `${generationId}_draft_s1`, order: 1, text: 'Warm the rice and sear sliced chicken with soy sauce.' },
      { id: `${generationId}_draft_s2`, order: 2, text: 'Fold in spinach until just wilted.' },
      { id: `${generationId}_draft_s3`, order: 3, text: 'Serve in bowls with sesame and lime.' },
    ],
    tags: ['High protein', '18 min', 'Weekly plan'],
  };

  const revisionTwoDraft: RecipeDraftOutput = {
    ...revisionOneDraft,
    metadata: {
      readyInMinutes: 20,
      calories: 540,
      highlight: 'Version 2',
    },
    ingredients: [
      ...revisionOneDraft.ingredients,
      { id: `${generationId}_draft_i5`, name: 'Garlic', quantity: '3 cloves' },
    ],
    steps: [
      { id: `${generationId}_draft_s1b`, order: 1, text: 'Sear chicken with garlic and a splash of soy sauce.' },
      { id: `${generationId}_draft_s2b`, order: 2, text: 'Add spinach to the pan and fold through the rice.' },
      { id: `${generationId}_draft_s3b`, order: 3, text: 'Finish with lime and sesame for a brighter bowl.' },
    ],
    tags: ['High protein', '20 min', 'Garlic-forward'],
  };

  return {
    generation: {
      id: generationId,
      userId,
      weeklyPlanId,
      status: 'active',
      latestRevisionId: `${generationId}_revision_2`,
      acceptedRecipeId: null,
      contextSnapshot: {
        source: 'weekly plan + favorites + inventory',
        notes: DEFAULT_DRAFT.weeklyIntentNotes,
      },
      createdAt: iso(-1, 13),
      updatedAt: iso(-1, 14),
    },
    revisions: [
      {
        id: `${generationId}_revision_1`,
        generationId,
        userId,
        revisionNumber: 1,
        chat: [
          createChatMessage(`${generationId}_r1_m1`, 'assistant', 'I drafted a fast high-protein dinner from your weekly plan and current inventory.', iso(-1, 13)),
        ],
        latestOutput: revisionOneDraft,
        createdAt: iso(-1, 13),
        updatedAt: iso(-1, 13),
      },
      {
        id: `${generationId}_revision_2`,
        generationId,
        userId,
        revisionNumber: 2,
        chat: [
          createChatMessage(`${generationId}_r2_m1`, 'assistant', 'I drafted a fast high-protein dinner from your weekly plan and current inventory.', iso(-1, 13)),
          createChatMessage(`${generationId}_r2_m2`, 'user', 'Looks good. Keep it high protein and add garlic.', iso(-1, 13, 20)),
          createChatMessage(`${generationId}_r2_m3`, 'assistant', 'Added garlic and kept the bowl quick and protein-forward.', iso(-1, 13, 21)),
        ],
        latestOutput: revisionTwoDraft,
        createdAt: iso(-1, 13, 20),
        updatedAt: iso(-1, 13, 21),
      },
    ],
  };
}

function buildInitialHistory(userId: string, weeklyPlanId: string, recipes: Record<string, Recipe>): RecipeHistoryEvent[] {
  return [
    {
      id: `${userId}_history_generated_1`,
      userId,
      recipeId: `${userId}_recipe_chicken_quinoa_power_bowl`,
      weeklyPlanId,
      eventType: 'planned',
      source: 'planner',
      occurredAt: iso(-1, 9),
      metadata: {},
    },
    {
      id: `${userId}_history_favorite_1`,
      userId,
      recipeId: `${userId}_recipe_greek_yogurt_power_bowl`,
      weeklyPlanId,
      eventType: 'favorited',
      source: 'recipes',
      occurredAt: iso(-1, 10),
      metadata: {},
    },
    {
      id: `${userId}_history_cooked_1`,
      userId,
      recipeId: `${userId}_recipe_salmon_rice_bowl`,
      weeklyPlanId,
      eventType: 'cooked',
      source: 'home',
      inventoryEventId: `${userId}_inventory_event_cooked_salmon`,
      occurredAt: iso(-1, 19),
      metadata: { recipeTitle: recipes[`${userId}_recipe_salmon_rice_bowl`]?.title },
    },
  ];
}

function buildOcrMemoryEvent(userId: string, weeklyPlanId: string): InventoryEvent {
  const lines: OcrReceiptLine[] = [
    {
      id: `${userId}_ocr_line_1`,
      rawText: 'EGGS 12PK',
      name: 'Eggs',
      quantityValue: 12,
      quantityUnit: 'pcs',
      confidence: 0.98,
      accepted: true,
    },
    {
      id: `${userId}_ocr_line_2`,
      rawText: 'BABY SPINACH 300G',
      name: 'Spinach',
      quantityValue: 300,
      quantityUnit: 'g',
      confidence: 0.92,
      accepted: true,
    },
    {
      id: `${userId}_ocr_line_3`,
      rawText: 'GREEK YOGURT',
      name: 'Greek yogurt',
      quantityValue: 2,
      quantityUnit: 'tubs',
      confidence: 0.91,
      accepted: true,
    },
    {
      id: `${userId}_ocr_line_4`,
      rawText: 'OLIVE OIL 1L',
      name: 'Olive oil',
      quantityValue: 1,
      quantityUnit: 'L',
      confidence: 0.93,
      accepted: true,
    },
    {
      id: `${userId}_ocr_line_5`,
      rawText: 'BANANAS 6',
      name: 'Bananas',
      quantityValue: 6,
      quantityUnit: 'pcs',
      confidence: 0.9,
      accepted: true,
    },
  ];

  return {
    id: `${userId}_inventory_event_ocr_memory`,
    userId,
    type: 'MEMORY',
    source: 'ocr',
    weeklyPlanId,
    items: lines.map((line) => ({
      name: line.name,
      quantity: { value: line.quantityValue, unit: line.quantityUnit },
    })),
    metadata: {
      receiptLabel: 'Weekly grocery receipt',
      confidence: 0.93,
      lines,
      appliedAt: null,
    },
    createdAt: iso(0, 8),
  };
}

function applyPlannerMessage(days: WeeklyPlanDay[], userId: string, message: string): WeeklyPlanRevisionOutput {
  const normalized = message.toLowerCase();
  let nextDays = days;
  let badge = 'refined week';
  let rationale = 'Updated one part of the week while keeping the overall structure stable.';

  if (normalized.includes('seafood')) {
    nextDays = days.map((day) =>
      day.dayKey === 'wed'
        ? {
            ...day,
            meals: day.meals.map((meal) =>
              meal.slot === 'dinner'
                ? {
                    ...meal,
                    recipeId: `${userId}_recipe_shrimp_soba`,
                    title: 'Shrimp soba',
                    shortLabel: 'Shrimp soba',
                    calories: 530,
                    tags: ['Seafood swap'],
                  }
                : meal,
            ),
          }
        : day,
    );
    badge = 'seafood swap';
    rationale = 'Wednesday dinner now uses shrimp soba to satisfy the seafood request.';
  }

  if (normalized.includes('breakfast')) {
    nextDays = nextDays.map((day) =>
      day.dayKey === 'fri'
        ? {
            ...day,
            meals: day.meals.map((meal) =>
              meal.slot === 'breakfast'
                ? {
                    ...meal,
                    recipeId: `${userId}_recipe_greek_yogurt_power_bowl`,
                    title: 'Greek yogurt',
                    shortLabel: 'Greek yogurt',
                    calories: 420,
                    tags: ['No-cook'],
                  }
                : meal,
            ),
          }
        : day,
    );
    badge = 'lighter mornings';
    rationale = 'Friday breakfast was simplified so the week starts lighter in the mornings.';
  }

  return {
    badge,
    rationale,
    days: nextDays,
  };
}

function applyRecipeMessage(previous: RecipeDraftOutput, message: string): RecipeDraftOutput {
  const normalized = message.toLowerCase();
  const nextDraft: RecipeDraftOutput = JSON.parse(JSON.stringify(previous)) as RecipeDraftOutput;

  if (normalized.includes('garlic') && !nextDraft.ingredients.some((ingredient) => normalizeName(ingredient.name) === 'garlic')) {
    nextDraft.ingredients.push({
      id: `${stableId('draft_ingredient', message)}_garlic`,
      name: 'Garlic',
      quantity: '3 cloves',
    });
    nextDraft.tags = [...nextDraft.tags, 'Garlic-forward'];
  }

  if (normalized.includes('spicy')) {
    nextDraft.summary = `${nextDraft.summary} Added a spicier finish with chili and a sharper sauce.`;
    nextDraft.tags = [...nextDraft.tags, 'Spicy'];
  }

  if (normalized.includes('vegetarian')) {
    nextDraft.title = 'Crispy Tofu Spinach Rice Bowl';
    nextDraft.ingredients = nextDraft.ingredients.map((ingredient) =>
      normalizeName(ingredient.name).includes('chicken')
        ? { ...ingredient, name: 'Tofu', quantity: '250 g' }
        : ingredient,
    );
    nextDraft.summary = 'Vegetarian version of the bowl with tofu, spinach, and garlic soy glaze.';
    nextDraft.tags = nextDraft.tags.filter((tag) => tag !== 'High protein').concat('Vegetarian');
  }

  if (normalized.includes('30')) {
    nextDraft.metadata.readyInMinutes = Math.min(nextDraft.metadata.readyInMinutes, 30);
  }

  nextDraft.metadata = {
    ...nextDraft.metadata,
    highlight: `Version refresh`,
  };

  return nextDraft;
}

function quantityText(quantity?: InventoryQuantity): string {
  if (!quantity?.value || !quantity.unit) {
    return '1 item';
  }
  return `${quantity.value} ${quantity.unit}`;
}

function findInventoryItemByName(data: MockData, userId: string, name: string): InventoryItem | undefined {
  return Object.values(data.inventoryItems).find(
    (item) => item.userId === userId && normalizeName(item.name) === normalizeName(name),
  );
}

function getCurrentPlan(data: MockData, userId: string): WeeklyPlan | undefined {
  const planId = data.currentWeeklyPlanByUserId[userId];
  return planId ? data.weeklyPlans[planId] : undefined;
}

function getCurrentGroceryList(data: MockData, userId: string): GroceryList | undefined {
  const groceryListId = data.currentGroceryListByUserId[userId];
  return groceryListId ? data.groceryLists[groceryListId] : undefined;
}

function getLatestOcrEvent(data: MockData, userId: string): InventoryEvent | undefined {
  return [...data.inventoryEvents]
    .reverse()
    .find((event) => event.userId === userId && event.type === 'MEMORY' && event.source === 'ocr');
}

function getRecipeGenerationRevisions(data: MockData, generationId: string): RecipeGenerationRevision[] {
  return data.recipeGenerationRevisionsByGenerationId[generationId] ?? [];
}

function getLatestRecipeHistoryEvent(
  data: MockData,
  userId: string,
  recipeId: string,
  eventTypes: RecipeHistoryEvent['eventType'][],
): RecipeHistoryEvent | undefined {
  for (let index = data.recipeHistoryEvents.length - 1; index >= 0; index -= 1) {
    const event = data.recipeHistoryEvents[index];
    if (event.userId === userId && event.recipeId === recipeId && eventTypes.includes(event.eventType)) {
      return event;
    }
  }

  return undefined;
}

function nextRecipeHistoryOccurredAt(data: MockData): string {
  const value = new Date(TODAY);
  value.setUTCHours(12, 0, data.recipeHistoryEvents.length + 1, 0);
  return value.toISOString();
}

function isRecipeFavorite(data: MockData, userId: string, recipeId: string): boolean {
  const latest = getLatestRecipeHistoryEvent(data, userId, recipeId, ['favorited', 'unfavorited']);
  return latest?.eventType === 'favorited';
}

function seedUserDomainData(data: MockData, userId: string, profile: UserPreferenceProfile) {
  if (data.currentWeeklyPlanByUserId[userId]) {
    return;
  }

  const weeklyPlanId = `${userId}_weekly_plan_current`;
  const recipes = recipeCatalog(userId, weeklyPlanId);
  const days = buildWeeklyPlanDays(userId);
  const revisions = buildWeeklyPlanRevisions(userId, weeklyPlanId, days);
  const groceryList = buildGroceryList(userId, weeklyPlanId);
  const inventoryItems = buildInventoryItems(userId);
  const { generation, revisions: recipeRevisions } = buildRecipeGeneration(userId, weeklyPlanId);
  const initialHistory = buildInitialHistory(userId, weeklyPlanId, recipes);
  const ocrMemoryEvent = buildOcrMemoryEvent(userId, weeklyPlanId);

  data.recipes = {
    ...data.recipes,
    ...recipes,
  };
  data.weeklyPlans[weeklyPlanId] = {
    id: weeklyPlanId,
    userId,
    weekStartAt: WEEK_START.toISOString(),
    expiresAt: WEEK_END.toISOString(),
    status: 'active',
    constraintsSnapshot: {
      ...profile,
      targetCalories: 2100,
      targetMacros: {
        protein: 150,
        carbs: 180,
        fat: 70,
      },
      planningMode: 'batch-cooking',
    },
    days,
    acceptedRevisionId: revisions[0].id,
    createdAt: iso(-1, 9),
    updatedAt: iso(-1, 12),
  };
  data.currentWeeklyPlanByUserId[userId] = weeklyPlanId;
  data.weeklyPlanRevisionsByPlanId[weeklyPlanId] = revisions;
  data.groceryLists[groceryList.id] = groceryList;
  data.currentGroceryListByUserId[userId] = groceryList.id;
  data.inventoryItems = {
    ...data.inventoryItems,
    ...inventoryItems,
  };
  data.inventoryEvents.push(
    {
      id: `${userId}_inventory_event_seed`,
      userId,
      type: 'ADD',
      source: 'system',
      weeklyPlanId,
      items: [
        { name: 'Initial pantry and fridge baseline', quantity: { value: 64, unit: 'items' } },
      ],
      metadata: { note: 'Initial seeded inventory for UI preview.' },
      createdAt: iso(-2, 7),
    },
    {
      id: `${userId}_inventory_event_cooked_salmon`,
      userId,
      type: 'USE',
      source: 'recipe',
      weeklyPlanId,
      recipeId: `${userId}_recipe_salmon_rice_bowl`,
      items: [
        { name: 'Salmon', quantityDelta: { value: -1, unit: 'fillet' } },
        { name: 'Broccoli', quantityDelta: { value: -1, unit: 'head' } },
      ],
      metadata: { note: 'Yesterday dinner was marked as cooked.' },
      createdAt: iso(-1, 19),
    },
    ocrMemoryEvent,
  );
  data.recipeGenerations[generation.id] = generation;
  data.activeRecipeGenerationByUserId[userId] = generation.id;
  data.recipeGenerationRevisionsByGenerationId[generation.id] = recipeRevisions;
  data.recipeHistoryEvents.push(...initialHistory);
}

const initialData: MockData = {
  onboardingQuestions: buildQuestionBank(),
  users: {},
  userIdsBySupabaseId: {},
  preferences: {},
  onboardingDrafts: {},
  weeklyPlans: {},
  currentWeeklyPlanByUserId: {},
  weeklyPlanRevisionsByPlanId: {},
  groceryLists: {},
  currentGroceryListByUserId: {},
  recipes: {},
  recipeGenerations: {},
  activeRecipeGenerationByUserId: {},
  recipeGenerationRevisionsByGenerationId: {},
  recipeHistoryEvents: [],
  inventoryItems: {},
  inventoryEvents: [],
};

export const useMockAppStore = create<MockStore>((set, get) => ({
  data: initialData,

  ensureUserFromSession: (authUser) => {
    const existing = get().data.userIdsBySupabaseId[authUser.supabaseUserId];
    if (existing) {
      return existing;
    }

    const userId = stableId('usr', authUser.supabaseUserId);
    set((state) => {
      const data = cloneData(state.data);
      data.userIdsBySupabaseId[authUser.supabaseUserId] = userId;
      data.users[userId] = {
        id: userId,
        supabaseUserId: authUser.supabaseUserId,
        email: authUser.email ?? null,
        displayName: authUser.displayName ?? authUser.email?.split('@')[0] ?? 'Kitchen Assistant User',
        status: 'active',
        lastSeenAt: iso(0, 9),
        createdAt: iso(0, 8),
        updatedAt: iso(0, 9),
      };
      data.onboardingDrafts[userId] = DEFAULT_DRAFT;
      return { data };
    });

    return userId;
  },

  setOnboardingAnswer: (userId, key, value) => {
    let draft = DEFAULT_DRAFT;
    set((state) => {
      const data = cloneData(state.data);
      const currentDraft = data.onboardingDrafts[userId] ?? DEFAULT_DRAFT;
      draft = {
        ...currentDraft,
        ...(key === 'diet_style' ? { dietStyle: value as string } : {}),
        ...(key === 'allergies_avoids' ? { allergies: value as string[] } : {}),
        ...(key === 'cuisine_preferences' ? { cuisinePreferences: value as string[] } : {}),
        ...(key === 'cooking_time' ? { cookingTime: value as string } : {}),
        ...(key === 'nutrition_target' ? { nutritionTarget: value as string } : {}),
        ...(key === 'weekly_structure' ? { weeklyStructure: value as string[] } : {}),
      };
      data.onboardingDrafts[userId] = draft;
      return { data };
    });
    return draft;
  },

  completeOnboarding: (userId) => {
    let preference: UserPreference | null = null;
    set((state) => {
      const data = cloneData(state.data);
      const draft = data.onboardingDrafts[userId] ?? DEFAULT_DRAFT;
      preference = {
        id: `${userId}_preference`,
        userId,
        profile: {
          dietStyle: draft.dietStyle,
          allergies: draft.allergies,
          cuisinePreferences: draft.cuisinePreferences,
          cookingTime: draft.cookingTime,
          nutritionTarget: draft.nutritionTarget,
          weeklyStructure: draft.weeklyStructure,
          weeklyIntent: {
            focus: draft.weeklyIntentFocus,
            exclude: draft.weeklyIntentExclude,
            notes: draft.weeklyIntentNotes,
          },
        },
        source: 'onboarding',
        version: (data.preferences[userId]?.version ?? 0) + 1,
        updatedBy: userId,
        metadata: {
          profileCompleteAt: iso(0, 10),
        },
        createdAt: data.preferences[userId]?.createdAt ?? iso(0, 10),
        updatedAt: iso(0, 10),
      };
      data.preferences[userId] = preference;
      seedUserDomainData(data, userId, preference.profile);
      return { data };
    });

    if (!preference) {
      throw new Error('Unable to complete onboarding.');
    }
    return preference;
  },

  createPlannerRevision: (userId, userMessage) => {
    let revision: WeeklyPlanRevision | null = null;
    set((state) => {
      const data = cloneData(state.data);
      const plan = getCurrentPlan(data, userId);
      if (!plan) {
        throw new Error('No active weekly plan.');
      }
      const revisions = data.weeklyPlanRevisionsByPlanId[plan.id] ?? [];
      const previous = revisions[revisions.length - 1];
      const latestOutput = applyPlannerMessage(previous?.latestOutput.days ?? plan.days, userId, userMessage);
      revision = {
        id: `${plan.id}_revision_${revisions.length + 1}`,
        weeklyPlanId: plan.id,
        userId,
        revisionNumber: revisions.length + 1,
        chat: [
          ...(previous?.chat ?? []),
          createChatMessage(`${plan.id}_revision_${revisions.length + 1}_user`, 'user', userMessage, iso(0, 11)),
          createChatMessage(
            `${plan.id}_revision_${revisions.length + 1}_assistant`,
            'assistant',
            latestOutput.rationale,
            iso(0, 11, 1),
          ),
        ],
        latestOutput,
        createdAt: iso(0, 11),
        updatedAt: iso(0, 11, 1),
      };
      data.weeklyPlanRevisionsByPlanId[plan.id] = [...revisions, revision];
      return { data };
    });

    if (!revision) {
      throw new Error('Unable to create planner revision.');
    }
    return revision;
  },

  acceptPlannerRevision: (userId, revisionId) => {
    let plan: WeeklyPlan | null = null;
    set((state) => {
      const data = cloneData(state.data);
      const currentPlan = getCurrentPlan(data, userId);
      if (!currentPlan) {
        throw new Error('No active weekly plan.');
      }
      const revision = (data.weeklyPlanRevisionsByPlanId[currentPlan.id] ?? []).find(
        (entry) => entry.id === revisionId,
      );
      if (!revision) {
        throw new Error('Revision not found.');
      }
      currentPlan.days = revision.latestOutput.days;
      currentPlan.acceptedRevisionId = revision.id;
      currentPlan.updatedAt = iso(0, 12);
      data.weeklyPlans[currentPlan.id] = currentPlan;
      plan = currentPlan;
      return { data };
    });

    if (!plan) {
      throw new Error('Unable to accept revision.');
    }
    return plan;
  },

  syncGroceryFromPlan: (userId) => {
    let groceryList: GroceryList | null = null;
    set((state) => {
      const data = cloneData(state.data);
      const existingList = getCurrentGroceryList(data, userId);
      const currentPlan = getCurrentPlan(data, userId);
      if (!currentPlan) {
        throw new Error('No active weekly plan to sync from.');
      }

      if (existingList) {
        existingList.lastComputedAt = iso(0, 9, 30);
        existingList.updatedAt = iso(0, 9, 30);
        data.groceryLists[existingList.id] = existingList;
        groceryList = existingList;
      } else {
        groceryList = buildGroceryList(userId, currentPlan.id);
        data.groceryLists[groceryList.id] = groceryList;
        data.currentGroceryListByUserId[userId] = groceryList.id;
      }

      return { data };
    });

    if (!groceryList) {
      throw new Error('Unable to sync grocery list.');
    }
    return groceryList;
  },

  markGroceryPurchased: (userId, itemIds) => {
    let groceryList: GroceryList | null = null;
    set((state) => {
      const data = cloneData(state.data);
      const currentList = getCurrentGroceryList(data, userId);
      if (!currentList) {
        throw new Error('No active grocery list.');
      }
      const purchasedItems = currentList.items.filter(
        (item) => itemIds.includes(item.itemId) && item.status === 'to_buy',
      );
      const eventId = `${userId}_inventory_event_purchase_${itemIds.join('_')}`;
      currentList.items = currentList.items.map((item) =>
        itemIds.includes(item.itemId) ? { ...item, status: 'purchased' } : item,
      );

      purchasedItems.forEach((item) => {
        const existing = findInventoryItemByName(data, userId, item.name);
        if (existing) {
          const nextValue =
            typeof existing.quantity?.value === 'number' && typeof item.quantity.value === 'number'
              ? existing.quantity.value + item.quantity.value
              : item.quantity.value;
          existing.quantity = { value: nextValue, unit: item.quantity.unit };
          existing.status = 'fresh';
          existing.lastEventId = eventId;
          existing.lastUpdatedAt = iso(0, 9, 45);
        } else {
          const inventoryId = `${userId}_inventory_${stableId('item', item.name)}`;
          data.inventoryItems[inventoryId] = {
            id: inventoryId,
            userId,
            name: item.name,
            normalizedName: normalizeName(item.name),
            category: 'Groceries',
            location: item.name.toLowerCase().includes('yogurt') || item.name.toLowerCase().includes('spinach') ? 'fridge' : 'pantry',
            quantity: {
              value: item.quantity.value,
              unit: item.quantity.unit,
            },
            status: 'fresh',
            dates: {
              addedAt: iso(0, 9, 45),
            },
            freshness: {
              estimatedDaysLeft: 7,
              confidence: 'medium',
            },
            source: 'kitchen_hub',
            lastEventId: eventId,
            metadata: {},
            createdAt: iso(0, 9, 45),
            lastUpdatedAt: iso(0, 9, 45),
          };
        }
      });

      const eventItems: InventoryEventItem[] = purchasedItems.map((item) => ({
        inventoryItemId: findInventoryItemByName(data, userId, item.name)?.id ?? null,
        name: item.name,
        quantity: { value: item.quantity.value, unit: item.quantity.unit },
      }));

      data.inventoryEvents.push({
        id: eventId,
        userId,
        type: 'ADD',
        source: 'kitchen_hub',
        weeklyPlanId: currentList.weeklyPlanId,
        items: eventItems,
        metadata: {
          mode: itemIds.length > 1 ? 'bulk' : 'single',
        },
        createdAt: iso(0, 9, 45),
      });

      if (currentList.items.every((item) => item.status !== 'to_buy')) {
        currentList.status = 'completed';
      }
      currentList.updatedAt = iso(0, 9, 45);
      data.groceryLists[currentList.id] = currentList;
      groceryList = currentList;
      return { data };
    });

    if (!groceryList) {
      throw new Error('Unable to mark purchased.');
    }
    return groceryList;
  },

  moveLowStockToBuy: (userId) => {
    let groceryList: GroceryList | null = null;
    set((state) => {
      const data = cloneData(state.data);
      const currentList = getCurrentGroceryList(data, userId);
      if (!currentList) {
        throw new Error('No active grocery list.');
      }
      const additions = Object.values(data.inventoryItems).filter(
        (item) => item.userId === userId && item.status === 'low_stock',
      );
      additions.forEach((item) => {
        const exists = currentList.items.some((entry) => normalizeName(entry.name) === normalizeName(item.name));
        if (!exists) {
          currentList.items.push({
            itemId: `${currentList.id}_low_stock_${stableId('item', item.name)}`,
            name: item.name,
            quantity: { value: item.quantity?.value ?? 1, unit: item.quantity?.unit ?? 'item' },
            status: 'to_buy',
            source: 'low_stock',
            inventoryItemId: item.id,
            notes: 'Moved from low stock items',
          });
        }
      });
      currentList.updatedAt = iso(0, 10, 15);
      data.groceryLists[currentList.id] = currentList;
      groceryList = currentList;
      return { data };
    });

    if (!groceryList) {
      throw new Error('Unable to move low stock items.');
    }
    return groceryList;
  },

  moveUrgentToBuy: (userId) => {
    let groceryList: GroceryList | null = null;
    set((state) => {
      const data = cloneData(state.data);
      const currentList = getCurrentGroceryList(data, userId);
      if (!currentList) {
        throw new Error('No active grocery list.');
      }
      const additions = Object.values(data.inventoryItems).filter(
        (item) => item.userId === userId && (item.status === 'use_soon' || item.status === 'expired'),
      );
      additions.forEach((item) => {
        const exists = currentList.items.some((entry) => normalizeName(entry.name) === normalizeName(item.name));
        if (!exists) {
          currentList.items.push({
            itemId: `${currentList.id}_urgent_${stableId('item', item.name)}`,
            name: item.name,
            quantity: { value: item.quantity?.value ?? 1, unit: item.quantity?.unit ?? 'item' },
            status: 'to_buy',
            source: 'urgent_expiring',
            inventoryItemId: item.id,
            notes: 'Added from urgent expiring stock',
          });
        }
      });
      currentList.updatedAt = iso(0, 10, 30);
      data.groceryLists[currentList.id] = currentList;
      groceryList = currentList;
      return { data };
    });

    if (!groceryList) {
      throw new Error('Unable to move urgent items.');
    }
    return groceryList;
  },

  updateInventoryItem: (userId, itemId, patch) => {
    let item: InventoryItem | null = null;
    set((state) => {
      const data = cloneData(state.data);
      const current = data.inventoryItems[itemId];
      if (!current || current.userId !== userId) {
        throw new Error('Inventory item not found.');
      }
      item = {
        ...current,
        quantity: patch.quantity ?? current.quantity,
        location: patch.location ?? current.location,
        status: patch.status ?? current.status,
        dates: patch.dates ? { ...current.dates, ...patch.dates } : current.dates,
        metadata: patch.metadata ? { ...current.metadata, ...patch.metadata } : current.metadata,
        lastUpdatedAt: iso(0, 10, 45),
      };
      data.inventoryItems[itemId] = item;
      return { data };
    });

    if (!item) {
      throw new Error('Unable to update inventory item.');
    }
    return item;
  },

  discardInventoryItem: (userId, itemId) => {
    let event: InventoryEvent | null = null;
    set((state) => {
      const data = cloneData(state.data);
      const item = data.inventoryItems[itemId];
      if (!item || item.userId !== userId) {
        throw new Error('Inventory item not found.');
      }
      event = {
        id: `${userId}_inventory_event_discard_${stableId('item', item.name)}`,
        userId,
        type: 'DISCARD',
        source: 'manual',
        items: [
          {
            inventoryItemId: item.id,
            name: item.name,
            quantityDelta: {
              value: item.quantity?.value ? item.quantity.value * -1 : null,
              unit: item.quantity?.unit ?? null,
            },
            before: item,
          },
        ],
        metadata: {
          reason: 'Discarded from Kitchen item detail',
        },
        createdAt: iso(0, 11, 5),
      };
      delete data.inventoryItems[itemId];
      data.inventoryEvents.push(event);
      return { data };
    });

    if (!event) {
      throw new Error('Unable to discard inventory item.');
    }
    return event;
  },

  reviewOcrLine: (userId, lineId, patch) => {
    let event: InventoryEvent | null = null;
    set((state) => {
      const data = cloneData(state.data);
      const memoryEvent = getLatestOcrEvent(data, userId);
      if (!memoryEvent) {
        throw new Error('OCR review not found.');
      }
      const lines = (memoryEvent.metadata?.lines as OcrReceiptLine[]) ?? [];
      memoryEvent.metadata = {
        ...memoryEvent.metadata,
        lines: lines.map((line) =>
          line.id === lineId
            ? {
                ...line,
                ...(patch.name ? { name: patch.name } : {}),
                ...(typeof patch.quantityValue === 'number' ? { quantityValue: patch.quantityValue } : {}),
                ...(patch.quantityUnit ? { quantityUnit: patch.quantityUnit } : {}),
                ...(typeof patch.accepted === 'boolean' ? { accepted: patch.accepted } : {}),
                ...(patch.note ? { note: patch.note } : {}),
              }
            : line,
        ),
      };
      event = memoryEvent;
      data.inventoryEvents = data.inventoryEvents.map((entry) =>
        entry.id === memoryEvent.id ? memoryEvent : entry,
      );
      return { data };
    });

    if (!event) {
      throw new Error('Unable to update OCR line.');
    }
    return event;
  },

  applyOcrReview: (userId) => {
    let createdEvent: InventoryEvent | null = null;
    const updatedItems: InventoryItem[] = [];
    set((state) => {
      const data = cloneData(state.data);
      const memoryEvent = getLatestOcrEvent(data, userId);
      if (!memoryEvent) {
        throw new Error('No OCR extraction to apply.');
      }
      const lines = ((memoryEvent.metadata?.lines as OcrReceiptLine[]) ?? []).filter((line) => line.accepted);
      const appliedEventId = `${userId}_inventory_event_ocr_apply`;
      lines.forEach((line) => {
        const existing = findInventoryItemByName(data, userId, line.name);
        if (existing) {
          existing.quantity = {
            value:
              typeof existing.quantity?.value === 'number'
                ? existing.quantity.value + line.quantityValue
                : line.quantityValue,
            unit: line.quantityUnit,
          };
          existing.status = 'fresh';
          existing.lastEventId = appliedEventId;
          existing.lastUpdatedAt = iso(0, 11, 20);
          updatedItems.push(existing);
          return;
        }
        const itemId = `${userId}_inventory_${stableId('item', line.name)}`;
        const nextItem: InventoryItem = {
          id: itemId,
          userId,
          name: line.name,
          normalizedName: normalizeName(line.name),
          category: 'Groceries',
          location: line.name.toLowerCase().includes('spinach') || line.name.toLowerCase().includes('yogurt') ? 'fridge' : 'pantry',
          quantity: { value: line.quantityValue, unit: line.quantityUnit },
          status: 'fresh',
          dates: { addedAt: iso(0, 11, 20) },
          freshness: { estimatedDaysLeft: 7, confidence: 'medium' },
          source: 'ocr',
          lastEventId: appliedEventId,
          metadata: {
            ocrRawText: line.rawText,
          },
          createdAt: iso(0, 11, 20),
          lastUpdatedAt: iso(0, 11, 20),
        };
        data.inventoryItems[itemId] = nextItem;
        updatedItems.push(nextItem);
      });

      memoryEvent.metadata = {
        ...memoryEvent.metadata,
        appliedAt: iso(0, 11, 20),
      };
      data.inventoryEvents = data.inventoryEvents.map((entry) =>
        entry.id === memoryEvent.id ? memoryEvent : entry,
      );
      createdEvent = {
        id: `${userId}_inventory_event_ocr_apply`,
        userId,
        type: 'ADD',
        source: 'ocr',
        weeklyPlanId: memoryEvent.weeklyPlanId ?? null,
        items: lines.map((line) => ({
          inventoryItemId: findInventoryItemByName(data, userId, line.name)?.id ?? null,
          name: line.name,
          quantity: { value: line.quantityValue, unit: line.quantityUnit },
        })),
        metadata: {
          memoryEventId: memoryEvent.id,
        },
        createdAt: iso(0, 11, 20),
      };
      data.inventoryEvents.push(createdEvent);
      return { data };
    });

    if (!createdEvent) {
      throw new Error('Unable to apply OCR review.');
    }
    return {
      event: createdEvent,
      updatedItems,
    };
  },

  startRecipeGeneration: (userId, userMessage, weeklyPlanId) => {
    const activeGenerationId = get().data.activeRecipeGenerationByUserId[userId];
    if (activeGenerationId) {
      const latestRevision = getRecipeGenerationRevisions(get().data, activeGenerationId).slice(-1)[0];
      return {
        generation: get().data.recipeGenerations[activeGenerationId],
        revision: latestRevision,
      };
    }

    let created: { generation: RecipeGeneration; revision: RecipeGenerationRevision } | null = null;
    set((state) => {
      const data = cloneData(state.data);
      const planId = weeklyPlanId ?? getCurrentPlan(data, userId)?.id ?? null;
      if (!planId) {
        throw new Error('No weekly plan available for recipe generation.');
      }
      const generationId = `${userId}_generation_${stableId('seed', userMessage)}`;
      const revisionId = `${generationId}_revision_1`;
      const draft: RecipeDraftOutput = {
        title: 'Chef Special Bowl',
        summary: 'Fast recipe draft tailored from your weekly plan context.',
        metadata: {
          readyInMinutes: 22,
          calories: 540,
          highlight: 'Version 1',
        },
        ingredients: [
          { id: `${revisionId}_i1`, name: 'Chicken breast', quantity: '250 g' },
          { id: `${revisionId}_i2`, name: 'Rice', quantity: '2 cups cooked' },
          { id: `${revisionId}_i3`, name: 'Spinach', quantity: '2 handfuls' },
        ],
        steps: [
          { id: `${revisionId}_s1`, order: 1, text: 'Cook the protein and season well.' },
          { id: `${revisionId}_s2`, order: 2, text: 'Warm the rice and fold through spinach.' },
          { id: `${revisionId}_s3`, order: 3, text: 'Assemble the bowl and finish with sauce.' },
        ],
        tags: ['High protein', 'Chef chat'],
      };
      const generation: RecipeGeneration = {
        id: generationId,
        userId,
        weeklyPlanId: planId,
        status: 'active',
        latestRevisionId: revisionId,
        acceptedRecipeId: null,
        contextSnapshot: {
          requestedFrom: 'recipes',
          userMessage,
        },
        createdAt: iso(0, 11, 25),
        updatedAt: iso(0, 11, 25),
      };
      const revision: RecipeGenerationRevision = {
        id: revisionId,
        generationId,
        userId,
        revisionNumber: 1,
        chat: [
          createChatMessage(`${revisionId}_u1`, 'user', userMessage, iso(0, 11, 25)),
          createChatMessage(`${revisionId}_a1`, 'assistant', 'I created a first draft recipe to match that request.', iso(0, 11, 26)),
        ],
        latestOutput: draft,
        createdAt: iso(0, 11, 25),
        updatedAt: iso(0, 11, 26),
      };
      data.recipeGenerations[generation.id] = generation;
      data.recipeGenerationRevisionsByGenerationId[generation.id] = [revision];
      data.activeRecipeGenerationByUserId[userId] = generation.id;
      created = { generation, revision };
      return { data };
    });

    if (!created) {
      throw new Error('Unable to start recipe generation.');
    }
    return created;
  },

  createRecipeGenerationRevision: (userId, generationId, userMessage) => {
    let revision: RecipeGenerationRevision | null = null;
    set((state) => {
      const data = cloneData(state.data);
      const generation = data.recipeGenerations[generationId];
      if (!generation || generation.userId !== userId) {
        throw new Error('Recipe generation not found.');
      }
      const revisions = getRecipeGenerationRevisions(data, generationId);
      const previous = revisions[revisions.length - 1];
      const draft = applyRecipeMessage(previous.latestOutput, userMessage);
      revision = {
        id: `${generationId}_revision_${revisions.length + 1}`,
        generationId,
        userId,
        revisionNumber: revisions.length + 1,
        chat: [
          ...previous.chat,
          createChatMessage(`${generationId}_revision_${revisions.length + 1}_u`, 'user', userMessage, iso(0, 11, 35)),
          createChatMessage(`${generationId}_revision_${revisions.length + 1}_a`, 'assistant', 'I refreshed the draft recipe with your latest notes.', iso(0, 11, 36)),
        ],
        latestOutput: draft,
        createdAt: iso(0, 11, 35),
        updatedAt: iso(0, 11, 36),
      };
      generation.latestRevisionId = revision.id;
      generation.updatedAt = iso(0, 11, 36);
      data.recipeGenerations[generationId] = generation;
      data.recipeGenerationRevisionsByGenerationId[generationId] = [...revisions, revision];
      return { data };
    });

    if (!revision) {
      throw new Error('Unable to create recipe revision.');
    }
    return revision;
  },

  acceptRecipeGeneration: (userId, generationId, revisionId) => {
    let recipe: Recipe | null = null;
    set((state) => {
      const data = cloneData(state.data);
      const generation = data.recipeGenerations[generationId];
      if (!generation || generation.userId !== userId) {
        throw new Error('Recipe generation not found.');
      }
      const revision = getRecipeGenerationRevisions(data, generationId).find((entry) => entry.id === revisionId);
      if (!revision) {
        throw new Error('Recipe revision not found.');
      }
      if (generation.acceptedRecipeId) {
        recipe = data.recipes[generation.acceptedRecipeId];
        return { data };
      }
      const recipeId = `${userId}_recipe_generated_${stableId('draft', revision.latestOutput.title)}`;
      recipe = {
        id: recipeId,
        weeklyPlanId: generation.weeklyPlanId ?? null,
        sourceGenerationId: generation.id,
        sourceRevisionId: revision.id,
        title: revision.latestOutput.title,
        summary: revision.latestOutput.summary,
        status: 'published',
        ingredients: revision.latestOutput.ingredients,
        steps: revision.latestOutput.steps,
        tags: revision.latestOutput.tags,
        isPublic: false,
        createdAt: iso(0, 11, 45),
        updatedAt: iso(0, 11, 45),
      };
      data.recipes[recipeId] = recipe;
      generation.status = 'accepted';
      generation.acceptedRecipeId = recipeId;
      generation.latestRevisionId = revision.id;
      generation.updatedAt = iso(0, 11, 45);
      data.recipeGenerations[generation.id] = generation;
      data.recipeHistoryEvents.push({
        id: `${userId}_history_accept_${stableId('recipe', recipe.title)}`,
        userId,
        recipeId,
        weeklyPlanId: generation.weeklyPlanId ?? null,
        eventType: 'accepted_draft',
        source: 'ai_chat',
        occurredAt: iso(0, 11, 45),
        metadata: {},
      });
      return { data };
    });

    if (!recipe) {
      throw new Error('Unable to accept recipe.');
    }
    return recipe;
  },

  setRecipeFavorite: (userId, recipeId, isFavorite) => {
    set((state) => {
      const data = cloneData(state.data);
      const currentlyFavorite = isRecipeFavorite(data, userId, recipeId);
      if (currentlyFavorite === isFavorite) {
        return { data };
      }
      data.recipeHistoryEvents.push({
        id: `${userId}_history_${isFavorite ? 'favorite' : 'unfavorite'}_${stableId('recipe', recipeId)}`,
        userId,
        recipeId,
        weeklyPlanId: getCurrentPlan(data, userId)?.id ?? null,
        eventType: isFavorite ? 'favorited' : 'unfavorited',
        source: 'recipes',
        occurredAt: nextRecipeHistoryOccurredAt(data),
        metadata: {},
      });
      return { data };
    });
  },

  cookRecipe: (userId, recipeId) => {
    let historyEvent: RecipeHistoryEvent | null = null;
    set((state) => {
      const data = cloneData(state.data);
      const recipe = data.recipes[recipeId];
      if (!recipe) {
        throw new Error('Recipe not found.');
      }
      const inventoryEventId = `${userId}_inventory_event_cook_${stableId('recipe', recipe.title)}`;
      const eventItems = recipe.ingredients.slice(0, 3).map((ingredient) => ({
        inventoryItemId: findInventoryItemByName(data, userId, ingredient.name)?.id ?? null,
        name: ingredient.name,
        quantityDelta: {
          value: -1,
          unit: 'portion',
        },
      }));
      data.inventoryEvents.push({
        id: inventoryEventId,
        userId,
        type: 'USE',
        source: 'recipe',
        recipeId,
        weeklyPlanId: recipe.weeklyPlanId ?? null,
        items: eventItems,
        metadata: {
          cookedFrom: recipe.title,
        },
        createdAt: iso(0, 12, 10),
      });
      historyEvent = {
        id: `${userId}_history_cooked_${stableId('recipe', recipe.title)}`,
        userId,
        recipeId,
        weeklyPlanId: recipe.weeklyPlanId ?? null,
        eventType: 'cooked',
        source: 'recipes',
        inventoryEventId,
        occurredAt: iso(0, 12, 10),
        metadata: {},
      };
      data.recipeHistoryEvents.push(historyEvent);
      return { data };
    });

    if (!historyEvent) {
      throw new Error('Unable to mark recipe as cooked.');
    }
    return historyEvent;
  },

  rateRecipe: (userId, recipeId, rating, feedback) => {
    let ratingEvent: RecipeHistoryEvent | null = null;
    set((state) => {
      const data = cloneData(state.data);
      ratingEvent = {
        id: `${userId}_history_rated_${stableId('recipe', recipeId)}_${rating}`,
        userId,
        recipeId,
        weeklyPlanId: getCurrentPlan(data, userId)?.id ?? null,
        eventType: 'rated',
        source: 'recipes',
        rating,
        feedback,
        occurredAt: nextRecipeHistoryOccurredAt(data),
        metadata: {},
      };
      data.recipeHistoryEvents.push(ratingEvent);
      return { data };
    });

    if (!ratingEvent) {
      throw new Error('Unable to rate recipe.');
    }
    return ratingEvent;
  },
}));

export function getMockDataSnapshot(): MockData {
  return useMockAppStore.getState().data;
}

export function getRecipeFavoriteState(userId: string, recipeId: string): boolean {
  return isRecipeFavorite(useMockAppStore.getState().data, userId, recipeId);
}

export function getLatestRecipeRating(userId: string, recipeId: string): number | null {
  return getLatestRecipeHistoryEvent(useMockAppStore.getState().data, userId, recipeId, ['rated'])?.rating ?? null;
}

export function getLatestCookedAt(userId: string, recipeId: string): string | null {
  return getLatestRecipeHistoryEvent(useMockAppStore.getState().data, userId, recipeId, ['cooked'])?.occurredAt ?? null;
}

export function getCurrentPlanTarget(plan?: WeeklyPlan): { calories: string; macros: string } {
  return {
    calories: `${plan?.constraintsSnapshot?.targetCalories ?? 2100} kcal`,
    macros: 'P 150  C 180  F 70',
  };
}

export function getUrgentInventoryItems(userId: string): InventoryItem[] {
  return Object.values(useMockAppStore.getState().data.inventoryItems).filter(
    (item) =>
      item.userId === userId &&
      (item.status === 'use_soon' || item.status === 'expired') &&
      Boolean(item.dates?.expiresAt),
  );
}

export function buildRecipeCardMetadata(recipe: Recipe): string {
  const readyTag = recipe.tags?.find((tag) => tag.includes('min')) ?? '20 min';
  const calorieTag = recipe.tags?.find((tag) => tag.includes('kcal')) ?? '520 kcal';
  const highlightTag = recipe.tags?.find((tag) => !tag.includes('min') && !tag.includes('kcal')) ?? 'Balanced';
  return `Ready in ${readyTag.replace(' min', ' min')} • ${calorieTag} • ${highlightTag}`;
}

export function buildRecipeUsageHint(recipe: Recipe): string {
  return `Uses: ${recipe.ingredients
    .slice(0, 4)
    .map((ingredient) => ingredient.name.toLowerCase())
    .join(', ')}`;
}

export function buildGroceryNote(item: GroceryListItem): string {
  return `${quantityText(item.quantity)} • ${item.notes ?? 'Needed this week'}`;
}
