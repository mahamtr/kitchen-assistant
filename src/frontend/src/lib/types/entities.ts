export const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export type EntityId = string;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];
export type MealSlot = 'breakfast' | 'lunch' | 'dinner';
export type UserStatus = 'active' | 'invited' | 'disabled';
export type PreferenceSource = 'onboarding' | 'manual_edit' | 'import';
export type OnboardingQuestionKey =
  | 'diet_style'
  | 'allergies_avoids'
  | 'cuisine_preferences'
  | 'cooking_time'
  | 'nutrition_target'
  | 'weekly_structure';
export type OnboardingAnswerType =
  | 'single_select'
  | 'multi_select'
  | 'number'
  | 'boolean'
  | 'text';
export type WeeklyPlanStatus = 'active' | 'expired' | 'replaced';
export type GroceryListStatus = 'active' | 'completed' | 'archived';
export type GroceryItemStatus = 'to_buy' | 'purchased' | 'skipped';
export type GroceryItemSource =
  | 'weekly_plan'
  | 'low_stock'
  | 'urgent_expiring'
  | 'manual'
  | 'ocr';
export type RecipeStatus = 'draft' | 'published' | 'archived';
export type RecipeGenerationStatus = 'active' | 'accepted' | 'discarded';
export type RecipeHistoryEventType =
  | 'viewed'
  | 'planned'
  | 'generated'
  | 'accepted_draft'
  | 'cooked'
  | 'favorited'
  | 'unfavorited'
  | 'rated';
export type RecipeHistorySource = 'recipes' | 'planner' | 'home' | 'ai_chat';
export type InventoryLocation = 'fridge' | 'pantry' | 'freezer' | 'unknown';
export type InventoryStatus = 'fresh' | 'use_soon' | 'expired' | 'low_stock' | 'unknown';
export type InventoryConfidence = 'low' | 'medium' | 'high';
export type InventorySource = 'manual' | 'ocr' | 'recipe' | 'adjustment' | 'kitchen_hub';
export type InventoryEventType = 'ADD' | 'USE' | 'DISCARD' | 'ADJUST' | 'MEMORY';
export type InventoryEventSource =
  | 'home'
  | 'chat'
  | 'kitchen_hub'
  | 'planner'
  | 'ocr'
  | 'recipe'
  | 'manual'
  | 'system';
export type ChatRole = 'system' | 'assistant' | 'user';

export interface User {
  id: EntityId;
  supabaseUserId: string;
  email?: string | null;
  displayName?: string | null;
  status: UserStatus;
  lastSeenAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferenceProfile {
  dietStyle: string;
  allergies: string[];
  cuisinePreferences: string[];
  cookingTime: string;
  nutritionTarget: string;
  weeklyStructure: string[];
  weeklyIntent: {
    focus: string;
    exclude: string[];
    notes: string;
  };
}

export interface UserPreference {
  id: EntityId;
  userId: EntityId;
  profile: UserPreferenceProfile;
  source: PreferenceSource;
  version: number;
  updatedBy?: EntityId | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type OnboardingAnswerValue = string | string[] | number | boolean | null;

export interface OnboardingOption {
  value: string;
  label: string;
  description?: string;
}

export interface OnboardingQuestion {
  id: EntityId;
  key: OnboardingQuestionKey;
  prompt: string;
  hint?: string;
  answerType: OnboardingAnswerType;
  required: boolean;
  order: number;
  isEnabled: boolean;
  options?: OnboardingOption[];
  constraints?: Record<string, unknown>;
  defaultValue?: OnboardingAnswerValue;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyPlanMeal {
  slot: MealSlot;
  recipeId: EntityId;
  title: string;
  shortLabel: string;
  calories: number;
  tags: string[];
}

export interface WeeklyPlanDay {
  dayKey: WeekdayKey;
  label: string;
  meals: WeeklyPlanMeal[];
}

export interface WeeklyPlanRevisionExistingMeal {
  slot: MealSlot;
  source: 'existing';
  recipeId: EntityId;
  title: string;
  shortLabel: string;
  calories: number;
  tags: string[];
}

export interface WeeklyPlanRevisionDraftMeal {
  slot: MealSlot;
  source: 'draft';
  draftRecipeKey: string;
  title: string;
  shortLabel: string;
  calories: number;
  tags: string[];
}

export type WeeklyPlanRevisionMeal =
  | WeeklyPlanRevisionExistingMeal
  | WeeklyPlanRevisionDraftMeal;

export interface WeeklyPlanRevisionDay {
  dayKey: WeekdayKey;
  label: string;
  meals: WeeklyPlanRevisionMeal[];
}

export interface WeeklyPlanRevisionOutput {
  badge: string;
  rationale: string;
  draftRecipes: PlannerDraftRecipe[];
  days: WeeklyPlanRevisionDay[];
}

export interface WeeklyPlan {
  id: EntityId;
  userId: EntityId;
  weekStartAt: string;
  expiresAt: string;
  status: WeeklyPlanStatus;
  constraintsSnapshot?: Record<string, unknown>;
  days: WeeklyPlanDay[];
  acceptedRevisionId?: EntityId | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: EntityId;
  role: ChatRole;
  content: string;
  timestamp: string;
}

export interface WeeklyPlanRevision {
  id: EntityId;
  weeklyPlanId: EntityId;
  userId: EntityId;
  revisionNumber: number;
  chat: ChatMessage[];
  latestOutput: WeeklyPlanRevisionOutput;
  createdAt: string;
  updatedAt: string;
}

export interface GroceryQuantity {
  value: number;
  unit: string;
}

export interface MeasurementValue {
  value: number;
  unit: string;
}

export interface GroceryListItem {
  itemId: EntityId;
  name: string;
  quantity: GroceryQuantity;
  status: GroceryItemStatus;
  source: GroceryItemSource;
  inventoryItemId?: EntityId | null;
  recipeIds?: EntityId[];
  notes?: string;
}

export interface GroceryList {
  id: EntityId;
  userId: EntityId;
  weeklyPlanId: EntityId;
  status: GroceryListStatus;
  items: GroceryListItem[];
  lastComputedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeIngredient {
  id: EntityId;
  name: string;
  quantity: string;
  measurement: MeasurementValue;
  note?: string;
}

export interface RecipeStep {
  id: EntityId;
  order: number;
  text: string;
}

export interface RecipeDraftOutput {
  title: string;
  summary: string;
  metadata: {
    readyInMinutes: number;
    calories: number;
    highlight: string;
  };
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  tags: string[];
}

export interface PlannerDraftRecipe extends RecipeDraftOutput {
  draftRecipeKey: string;
}

export interface Recipe {
  id: EntityId;
  weeklyPlanId?: EntityId | null;
  sourceGenerationId?: EntityId | null;
  sourceRevisionId?: EntityId | null;
  title: string;
  summary?: string;
  status: RecipeStatus;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  tags?: string[];
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeGeneration {
  id: EntityId;
  userId: EntityId;
  weeklyPlanId?: EntityId | null;
  status: RecipeGenerationStatus;
  latestRevisionId?: EntityId | null;
  acceptedRecipeId?: EntityId | null;
  contextSnapshot?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeGenerationRevision {
  id: EntityId;
  generationId: EntityId;
  userId: EntityId;
  revisionNumber: number;
  chat: ChatMessage[];
  latestOutput: RecipeDraftOutput | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeHistoryEvent {
  id: EntityId;
  userId: EntityId;
  recipeId: EntityId;
  weeklyPlanId?: EntityId | null;
  eventType: RecipeHistoryEventType;
  source: RecipeHistorySource;
  rating?: number | null;
  feedback?: string;
  inventoryEventId?: EntityId | null;
  occurredAt: string;
  metadata?: Record<string, unknown>;
}

export interface InventoryQuantity {
  value: number | null;
  unit: string | null;
}

export interface InventoryDates {
  addedAt?: string;
  openedAt?: string | null;
  expiresAt?: string | null;
  lastUsedAt?: string | null;
}

export interface InventoryFreshness {
  estimatedDaysLeft?: number | null;
  confidence?: InventoryConfidence;
}

export interface InventoryItem {
  id: EntityId;
  userId: EntityId;
  name: string;
  normalizedName?: string;
  category?: string;
  location: InventoryLocation;
  quantity?: InventoryQuantity;
  status: InventoryStatus;
  dates?: InventoryDates;
  freshness?: InventoryFreshness;
  source?: InventorySource;
  lastEventId?: EntityId | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  lastUpdatedAt: string;
}

export interface InventoryEventItem {
  inventoryItemId?: EntityId | null;
  name: string;
  quantity?: InventoryQuantity;
  quantityDelta?: InventoryQuantity;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export interface InventoryEvent {
  id: EntityId;
  userId: EntityId;
  type: InventoryEventType;
  source: InventoryEventSource;
  items?: InventoryEventItem[];
  weeklyPlanId?: EntityId | null;
  recipeId?: EntityId | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface OcrReceiptLine {
  id: EntityId;
  rawText: string;
  name: string;
  quantityValue: number;
  quantityUnit: string;
  confidence: number;
  note?: string;
  accepted: boolean;
}

export interface OnboardingDraft {
  dietStyle: string;
  allergies: string[];
  cuisinePreferences: string[];
  cookingTime: string;
  nutritionTarget: string;
  weeklyStructure: string[];
  weeklyIntentFocus: string;
  weeklyIntentExclude: string[];
  weeklyIntentNotes: string;
}
