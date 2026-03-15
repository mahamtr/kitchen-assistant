import { Schema, Types, type HydratedDocument } from 'mongoose';
import type { MeasurementValue } from '../common/measurement';

export type EntityId = Types.ObjectId;

export interface QuantityValue {
  value: number | null;
  unit: string | null;
}

export interface GroceryQuantity {
  value: number;
  unit: string;
}

export interface InventoryDatesValue {
  addedAt?: Date;
  openedAt?: Date | null;
  expiresAt?: Date | null;
  lastUsedAt?: Date | null;
}

export interface InventoryFreshnessValue {
  estimatedDaysLeft?: number | null;
  confidence?: 'low' | 'medium' | 'high';
}

export interface OnboardingProfileValue {
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

export interface OnboardingOptionValue {
  value: string;
  label: string;
  description?: string;
}

export interface WeeklyPlanMealValue {
  slot: 'breakfast' | 'lunch' | 'dinner';
  recipeId: EntityId;
  title: string;
  shortLabel: string;
  calories: number;
  tags: string[];
}

export interface WeeklyPlanDayValue {
  dayKey: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  label: string;
  meals: WeeklyPlanMealValue[];
}

export interface WeeklyPlanRevisionExistingMealValue {
  slot: 'breakfast' | 'lunch' | 'dinner';
  source: 'existing';
  recipeId: EntityId;
  title: string;
  shortLabel: string;
  calories: number;
  tags: string[];
}

export interface WeeklyPlanRevisionDraftMealValue {
  slot: 'breakfast' | 'lunch' | 'dinner';
  source: 'draft';
  draftRecipeKey: string;
  title: string;
  shortLabel: string;
  calories: number;
  tags: string[];
}

export type WeeklyPlanRevisionMealValue =
  | WeeklyPlanRevisionExistingMealValue
  | WeeklyPlanRevisionDraftMealValue;

export interface WeeklyPlanRevisionDayValue {
  dayKey: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  label: string;
  meals: WeeklyPlanRevisionMealValue[];
}

export interface ChatMessageValue {
  _id?: EntityId;
  role: 'system' | 'assistant' | 'user';
  content: string;
  timestamp: Date;
}

export interface WeeklyPlanRevisionOutputValue {
  badge: string;
  rationale: string;
  draftRecipes: PlannerDraftRecipeValue[];
  days: WeeklyPlanRevisionDayValue[];
}

export interface GroceryListItemValue {
  itemId: EntityId;
  name: string;
  quantity: GroceryQuantity;
  status: 'to_buy' | 'purchased' | 'skipped';
  source: 'weekly_plan' | 'low_stock' | 'urgent_expiring' | 'manual' | 'ocr';
  inventoryItemId?: EntityId | null;
  recipeIds?: EntityId[];
  notes?: string;
}

export interface RecipeIngredientValue {
  id: EntityId;
  name: string;
  quantity: string;
  measurement: MeasurementValue;
  note?: string;
}

export interface RecipeStepValue {
  id: EntityId;
  order: number;
  text: string;
}

export interface RecipeDraftOutputValue {
  title: string;
  summary: string;
  metadata: {
    readyInMinutes: number;
    calories: number;
    highlight: string;
  };
  ingredients: RecipeIngredientValue[];
  steps: RecipeStepValue[];
  tags: string[];
}

export interface PlannerDraftRecipeValue extends RecipeDraftOutputValue {
  draftRecipeKey: string;
}

export interface InventoryEventItemValue {
  inventoryItemId?: EntityId | null;
  name: string;
  quantity?: QuantityValue;
  quantityDelta?: QuantityValue;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export interface OcrReceiptLineValue {
  id: EntityId;
  rawText: string;
  name: string;
  quantityValue: number;
  quantityUnit: string;
  confidence: number;
  note?: string;
  accepted: boolean;
}

const quantitySchema = new Schema<QuantityValue>(
  {
    value: { type: Number, default: null },
    unit: { type: String, default: null },
  },
  { _id: false },
);

const groceryQuantitySchema = new Schema<GroceryQuantity>(
  {
    value: { type: Number, required: true },
    unit: { type: String, required: true },
  },
  { _id: false },
);

const inventoryDatesSchema = new Schema<InventoryDatesValue>(
  {
    addedAt: { type: Date },
    openedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    lastUsedAt: { type: Date, default: null },
  },
  { _id: false },
);

const inventoryFreshnessSchema = new Schema<InventoryFreshnessValue>(
  {
    estimatedDaysLeft: { type: Number, default: null },
    confidence: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
  },
  { _id: false },
);

const onboardingOptionSchema = new Schema<OnboardingOptionValue>(
  {
    value: { type: String, required: true },
    label: { type: String, required: true },
    description: { type: String },
  },
  { _id: false },
);

const weeklyPlanMealSchema = new Schema<WeeklyPlanMealValue>(
  {
    slot: {
      type: String,
      enum: ['breakfast', 'lunch', 'dinner'],
      required: true,
    },
    recipeId: { type: Schema.Types.ObjectId, required: true },
    title: { type: String, required: true },
    shortLabel: { type: String, required: true },
    calories: { type: Number, required: true },
    tags: { type: [String], default: [] },
  },
  { _id: false },
);

const weeklyPlanDaySchema = new Schema<WeeklyPlanDayValue>(
  {
    dayKey: {
      type: String,
      enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      required: true,
    },
    label: { type: String, required: true },
    meals: { type: [weeklyPlanMealSchema], default: [] },
  },
  { _id: false },
);

const weeklyPlanRevisionMealSchema = new Schema<WeeklyPlanRevisionMealValue>(
  {
    slot: {
      type: String,
      enum: ['breakfast', 'lunch', 'dinner'],
      required: true,
    },
    source: {
      type: String,
      enum: ['existing', 'draft'],
      required: true,
    },
    recipeId: { type: Schema.Types.ObjectId, default: null },
    draftRecipeKey: { type: String, default: null },
    title: { type: String, required: true },
    shortLabel: { type: String, required: true },
    calories: { type: Number, required: true },
    tags: { type: [String], default: [] },
  },
  { _id: false },
);

const weeklyPlanRevisionDaySchema = new Schema<WeeklyPlanRevisionDayValue>(
  {
    dayKey: {
      type: String,
      enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      required: true,
    },
    label: { type: String, required: true },
    meals: { type: [weeklyPlanRevisionMealSchema], default: [] },
  },
  { _id: false },
);

const chatMessageSchema = new Schema<ChatMessageValue>(
  {
    role: {
      type: String,
      enum: ['system', 'assistant', 'user'],
      required: true,
    },
    content: { type: String, required: true },
    timestamp: { type: Date, required: true },
  },
  { _id: true },
);

const groceryListItemSchema = new Schema<GroceryListItemValue>(
  {
    itemId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    quantity: { type: groceryQuantitySchema, required: true },
    status: {
      type: String,
      enum: ['to_buy', 'purchased', 'skipped'],
      required: true,
    },
    source: {
      type: String,
      enum: ['weekly_plan', 'low_stock', 'urgent_expiring', 'manual', 'ocr'],
      required: true,
    },
    inventoryItemId: { type: Schema.Types.ObjectId, default: null },
    recipeIds: { type: [Schema.Types.ObjectId], default: [] },
    notes: { type: String },
  },
  { _id: false },
);

const recipeIngredientSchema = new Schema<RecipeIngredientValue>(
  {
    id: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    quantity: { type: String, required: true },
    measurement: { type: groceryQuantitySchema, required: true },
    note: { type: String },
  },
  { _id: false },
);

const recipeStepSchema = new Schema<RecipeStepValue>(
  {
    id: { type: Schema.Types.ObjectId, required: true },
    order: { type: Number, required: true },
    text: { type: String, required: true },
  },
  { _id: false },
);

const recipeDraftOutputSchema = new Schema<RecipeDraftOutputValue>(
  {
    title: { type: String, required: true },
    summary: { type: String, required: true },
    metadata: {
      readyInMinutes: { type: Number, required: true },
      calories: { type: Number, required: true },
      highlight: { type: String, required: true },
    },
    ingredients: { type: [recipeIngredientSchema], default: [] },
    steps: { type: [recipeStepSchema], default: [] },
    tags: { type: [String], default: [] },
  },
  { _id: false },
);

const plannerDraftRecipeSchema = new Schema<PlannerDraftRecipeValue>(
  {
    draftRecipeKey: { type: String, required: true },
    title: { type: String, required: true },
    summary: { type: String, required: true },
    metadata: {
      readyInMinutes: { type: Number, required: true },
      calories: { type: Number, required: true },
      highlight: { type: String, required: true },
    },
    ingredients: { type: [recipeIngredientSchema], default: [] },
    steps: { type: [recipeStepSchema], default: [] },
    tags: { type: [String], default: [] },
  },
  { _id: false },
);

const weeklyPlanRevisionOutputSchema =
  new Schema<WeeklyPlanRevisionOutputValue>(
    {
      badge: { type: String, required: true },
      rationale: { type: String, required: true },
      draftRecipes: { type: [plannerDraftRecipeSchema], default: [] },
      days: { type: [weeklyPlanRevisionDaySchema], default: [] },
    },
    { _id: false },
  );

const inventoryEventItemSchema = new Schema<InventoryEventItemValue>(
  {
    inventoryItemId: { type: Schema.Types.ObjectId, default: null },
    name: { type: String, required: true },
    quantity: { type: quantitySchema },
    quantityDelta: { type: quantitySchema },
    before: { type: Schema.Types.Mixed, default: undefined },
    after: { type: Schema.Types.Mixed, default: undefined },
  },
  { _id: false },
);

const ocrReceiptLineSchema = new Schema<OcrReceiptLineValue>(
  {
    id: { type: Schema.Types.ObjectId, required: true },
    rawText: { type: String, required: true },
    name: { type: String, required: true },
    quantityValue: { type: Number, required: true },
    quantityUnit: { type: String, required: true },
    confidence: { type: Number, required: true },
    note: { type: String },
    accepted: { type: Boolean, required: true },
  },
  { _id: false },
);

export const USER_MODEL = 'User';
export interface UserRecord {
  _id: EntityId;
  supabaseUserId: string;
  email?: string | null;
  displayName?: string | null;
  status: 'active' | 'invited' | 'disabled';
  lastSeenAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
export type UserDocument = HydratedDocument<UserRecord>;
export const UserSchema = new Schema<UserRecord>(
  {
    supabaseUserId: { type: String, required: true, unique: true },
    email: { type: String, default: null },
    displayName: { type: String, default: null },
    status: {
      type: String,
      enum: ['active', 'invited', 'disabled'],
      default: 'active',
    },
    lastSeenAt: { type: Date, default: null },
  },
  {
    collection: 'users',
    timestamps: true,
  },
);
UserSchema.index({ email: 1 }, { unique: true, sparse: true });

export const USER_PREFERENCE_MODEL = 'UserPreference';
export interface UserPreferenceRecord {
  _id: EntityId;
  userId: EntityId;
  profile: OnboardingProfileValue;
  source: 'onboarding' | 'manual_edit' | 'import';
  version: number;
  updatedBy?: EntityId | null;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
export type UserPreferenceDocument = HydratedDocument<UserPreferenceRecord>;
export const UserPreferenceSchema = new Schema<UserPreferenceRecord>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, unique: true },
    profile: { type: Schema.Types.Mixed, required: true },
    source: {
      type: String,
      enum: ['onboarding', 'manual_edit', 'import'],
      required: true,
    },
    version: { type: Number, required: true, default: 0 },
    updatedBy: { type: Schema.Types.ObjectId, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    collection: 'userpreferences',
    timestamps: true,
  },
);

export const ONBOARDING_QUESTION_MODEL = 'OnboardingQuestion';
export interface OnboardingQuestionRecord {
  _id: EntityId;
  key: string;
  prompt: string;
  hint?: string;
  answerType: 'single_select' | 'multi_select' | 'number' | 'boolean' | 'text';
  required: boolean;
  order: number;
  isEnabled: boolean;
  options?: OnboardingOptionValue[];
  constraints?: Record<string, unknown>;
  defaultValue?: string | string[] | number | boolean | null;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
export type OnboardingQuestionDocument =
  HydratedDocument<OnboardingQuestionRecord>;
export const OnboardingQuestionSchema = new Schema<OnboardingQuestionRecord>(
  {
    key: { type: String, required: true, unique: true },
    prompt: { type: String, required: true },
    hint: { type: String },
    answerType: {
      type: String,
      enum: ['single_select', 'multi_select', 'number', 'boolean', 'text'],
      required: true,
    },
    required: { type: Boolean, required: true },
    order: { type: Number, required: true },
    isEnabled: { type: Boolean, required: true, default: true },
    options: { type: [onboardingOptionSchema], default: [] },
    constraints: { type: Schema.Types.Mixed, default: {} },
    defaultValue: { type: Schema.Types.Mixed, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    collection: 'onboardingquestions',
    timestamps: true,
  },
);
OnboardingQuestionSchema.index({ isEnabled: 1, order: 1 });

export const WEEKLY_PLAN_MODEL = 'WeeklyPlan';
export interface WeeklyPlanRecord {
  _id: EntityId;
  userId: EntityId;
  weekStartAt: Date;
  expiresAt: Date;
  status: 'active' | 'expired' | 'replaced';
  constraintsSnapshot?: Record<string, unknown>;
  days: WeeklyPlanDayValue[];
  acceptedRevisionId?: EntityId | null;
  createdAt: Date;
  updatedAt: Date;
}
export type WeeklyPlanDocument = HydratedDocument<WeeklyPlanRecord>;
export const WeeklyPlanSchema = new Schema<WeeklyPlanRecord>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    weekStartAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ['active', 'expired', 'replaced'],
      required: true,
      default: 'active',
    },
    constraintsSnapshot: { type: Schema.Types.Mixed, default: {} },
    days: { type: [weeklyPlanDaySchema], default: [] },
    acceptedRevisionId: { type: Schema.Types.ObjectId, default: null },
  },
  {
    collection: 'weeklyplans',
    timestamps: true,
  },
);
WeeklyPlanSchema.index({ userId: 1, weekStartAt: 1 }, { unique: true });
WeeklyPlanSchema.index({ userId: 1, status: 1 });

export const WEEKLY_PLAN_REVISION_MODEL = 'WeeklyPlanRevision';
export interface WeeklyPlanRevisionRecord {
  _id: EntityId;
  weeklyPlanId: EntityId;
  userId: EntityId;
  revisionNumber: number;
  chat: ChatMessageValue[];
  conversationSummary?: string;
  compactedUserMessageCount?: number;
  latestOutput: WeeklyPlanRevisionOutputValue;
  createdAt: Date;
  updatedAt: Date;
}
export type WeeklyPlanRevisionDocument =
  HydratedDocument<WeeklyPlanRevisionRecord>;
export const WeeklyPlanRevisionSchema = new Schema<WeeklyPlanRevisionRecord>(
  {
    weeklyPlanId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    revisionNumber: { type: Number, required: true },
    chat: { type: [chatMessageSchema], default: [] },
    conversationSummary: { type: String, default: '' },
    compactedUserMessageCount: { type: Number, default: 0 },
    latestOutput: { type: weeklyPlanRevisionOutputSchema, required: true },
  },
  {
    collection: 'weeklyplanrevisions',
    timestamps: true,
  },
);
WeeklyPlanRevisionSchema.index(
  { weeklyPlanId: 1, revisionNumber: 1 },
  { unique: true },
);

export const GROCERY_LIST_MODEL = 'GroceryList';
export interface GroceryListRecord {
  _id: EntityId;
  userId: EntityId;
  weeklyPlanId: EntityId;
  status: 'active' | 'completed' | 'archived';
  items: GroceryListItemValue[];
  lastComputedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
export type GroceryListDocument = HydratedDocument<GroceryListRecord>;
export const GroceryListSchema = new Schema<GroceryListRecord>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    weeklyPlanId: { type: Schema.Types.ObjectId, required: true },
    status: {
      type: String,
      enum: ['active', 'completed', 'archived'],
      required: true,
      default: 'active',
    },
    items: { type: [groceryListItemSchema], default: [] },
    lastComputedAt: { type: Date, default: null },
  },
  {
    collection: 'grocerylists',
    timestamps: true,
  },
);
GroceryListSchema.index({ userId: 1, weeklyPlanId: 1 }, { unique: true });
GroceryListSchema.index({ userId: 1, status: 1 });

export const RECIPE_MODEL = 'Recipe';
export interface RecipeRecord {
  _id: EntityId;
  userId?: EntityId | null;
  weeklyPlanId?: EntityId | null;
  sourceGenerationId?: EntityId | null;
  sourceRevisionId?: EntityId | null;
  title: string;
  summary?: string;
  status: 'draft' | 'published' | 'archived';
  ingredients: RecipeIngredientValue[];
  steps: RecipeStepValue[];
  tags?: string[];
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export type RecipeDocument = HydratedDocument<RecipeRecord>;
export const RecipeSchema = new Schema<RecipeRecord>(
  {
    userId: { type: Schema.Types.ObjectId, default: null },
    weeklyPlanId: { type: Schema.Types.ObjectId, default: null },
    sourceGenerationId: { type: Schema.Types.ObjectId, default: null },
    sourceRevisionId: { type: Schema.Types.ObjectId, default: null },
    title: { type: String, required: true },
    summary: { type: String, default: '' },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      required: true,
      default: 'published',
    },
    ingredients: { type: [recipeIngredientSchema], default: [] },
    steps: { type: [recipeStepSchema], default: [] },
    tags: { type: [String], default: [] },
    isPublic: { type: Boolean, required: true, default: false },
  },
  {
    collection: 'recipes',
    timestamps: true,
  },
);
RecipeSchema.index({ userId: 1, status: 1, createdAt: -1 });

export const RECIPE_GENERATION_MODEL = 'RecipeGeneration';
export interface RecipeGenerationRecord {
  _id: EntityId;
  userId: EntityId;
  weeklyPlanId?: EntityId | null;
  status: 'active' | 'accepted' | 'discarded';
  latestRevisionId?: EntityId | null;
  acceptedRecipeId?: EntityId | null;
  contextSnapshot?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
export type RecipeGenerationDocument = HydratedDocument<RecipeGenerationRecord>;
export const RecipeGenerationSchema = new Schema<RecipeGenerationRecord>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    weeklyPlanId: { type: Schema.Types.ObjectId, default: null },
    status: {
      type: String,
      enum: ['active', 'accepted', 'discarded'],
      required: true,
      default: 'active',
    },
    latestRevisionId: { type: Schema.Types.ObjectId, default: null },
    acceptedRecipeId: { type: Schema.Types.ObjectId, default: null },
    contextSnapshot: { type: Schema.Types.Mixed, default: {} },
  },
  {
    collection: 'recipegenerations',
    timestamps: true,
  },
);
RecipeGenerationSchema.index({ userId: 1, createdAt: -1 });
RecipeGenerationSchema.index({ weeklyPlanId: 1, status: 1 });

export const RECIPE_GENERATION_REVISION_MODEL = 'RecipeGenerationRevision';
export interface RecipeGenerationRevisionRecord {
  _id: EntityId;
  generationId: EntityId;
  userId: EntityId;
  revisionNumber: number;
  chat: ChatMessageValue[];
  conversationSummary?: string;
  compactedUserMessageCount?: number;
  latestOutput: RecipeDraftOutputValue | null;
  createdAt: Date;
  updatedAt: Date;
}
export type RecipeGenerationRevisionDocument =
  HydratedDocument<RecipeGenerationRevisionRecord>;
export const RecipeGenerationRevisionSchema =
  new Schema<RecipeGenerationRevisionRecord>(
    {
      generationId: { type: Schema.Types.ObjectId, required: true },
      userId: { type: Schema.Types.ObjectId, required: true },
      revisionNumber: { type: Number, required: true },
      chat: { type: [chatMessageSchema], default: [] },
      conversationSummary: { type: String, default: '' },
      compactedUserMessageCount: { type: Number, default: 0 },
      latestOutput: { type: recipeDraftOutputSchema, default: null },
    },
    {
      collection: 'recipegenerationrevisions',
      timestamps: true,
    },
  );
RecipeGenerationRevisionSchema.index(
  { generationId: 1, revisionNumber: 1 },
  { unique: true },
);

export const RECIPE_HISTORY_EVENT_MODEL = 'RecipeHistoryEvent';
export interface RecipeHistoryEventRecord {
  _id: EntityId;
  userId: EntityId;
  recipeId: EntityId;
  weeklyPlanId?: EntityId | null;
  eventType:
    | 'viewed'
    | 'planned'
    | 'generated'
    | 'accepted_draft'
    | 'cooked'
    | 'favorited'
    | 'unfavorited'
    | 'rated';
  source: 'recipes' | 'planner' | 'home' | 'ai_chat';
  rating?: number | null;
  feedback?: string;
  inventoryEventId?: EntityId | null;
  occurredAt: Date;
  metadata?: Record<string, unknown>;
}
export type RecipeHistoryEventDocument =
  HydratedDocument<RecipeHistoryEventRecord>;
export const RecipeHistoryEventSchema = new Schema<RecipeHistoryEventRecord>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    recipeId: { type: Schema.Types.ObjectId, required: true },
    weeklyPlanId: { type: Schema.Types.ObjectId, default: null },
    eventType: {
      type: String,
      enum: [
        'viewed',
        'planned',
        'generated',
        'accepted_draft',
        'cooked',
        'favorited',
        'unfavorited',
        'rated',
      ],
      required: true,
    },
    source: {
      type: String,
      enum: ['recipes', 'planner', 'home', 'ai_chat'],
      required: true,
    },
    rating: { type: Number, default: null },
    feedback: { type: String, default: '' },
    inventoryEventId: { type: Schema.Types.ObjectId, default: null },
    occurredAt: { type: Date, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    collection: 'recipehistoryevents',
    versionKey: false,
  },
);
RecipeHistoryEventSchema.index({ userId: 1, occurredAt: -1 });

export const INVENTORY_ITEM_MODEL = 'InventoryItem';
export interface InventoryItemRecord {
  _id: EntityId;
  userId: EntityId;
  name: string;
  normalizedName?: string;
  category?: string;
  location: 'fridge' | 'pantry' | 'freezer' | 'unknown';
  quantity?: QuantityValue;
  status: 'fresh' | 'use_soon' | 'expired' | 'low_stock' | 'unknown';
  dates?: InventoryDatesValue;
  freshness?: InventoryFreshnessValue;
  source?: 'manual' | 'ocr' | 'recipe' | 'adjustment' | 'kitchen_hub';
  lastEventId?: EntityId | null;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  lastUpdatedAt: Date;
}
export type InventoryItemDocument = HydratedDocument<InventoryItemRecord>;
export const InventoryItemSchema = new Schema<InventoryItemRecord>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    normalizedName: { type: String, default: '' },
    category: { type: String, default: '' },
    location: {
      type: String,
      enum: ['fridge', 'pantry', 'freezer', 'unknown'],
      required: true,
      default: 'pantry',
    },
    quantity: { type: quantitySchema, default: { value: null, unit: null } },
    status: {
      type: String,
      enum: ['fresh', 'use_soon', 'expired', 'low_stock', 'unknown'],
      required: true,
      default: 'fresh',
    },
    dates: { type: inventoryDatesSchema, default: {} },
    freshness: { type: inventoryFreshnessSchema, default: {} },
    source: {
      type: String,
      enum: ['manual', 'ocr', 'recipe', 'adjustment', 'kitchen_hub'],
      default: 'manual',
    },
    lastEventId: { type: Schema.Types.ObjectId, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    collection: 'inventoryitems',
    timestamps: { createdAt: 'createdAt', updatedAt: 'lastUpdatedAt' },
  },
);
InventoryItemSchema.index({ userId: 1, name: 1 });
InventoryItemSchema.index({ userId: 1, status: 1 });

export const INVENTORY_EVENT_MODEL = 'InventoryEvent';
export interface InventoryEventRecord {
  _id: EntityId;
  userId: EntityId;
  type: 'ADD' | 'USE' | 'DISCARD' | 'ADJUST' | 'MEMORY';
  source:
    | 'home'
    | 'chat'
    | 'kitchen_hub'
    | 'planner'
    | 'ocr'
    | 'recipe'
    | 'manual'
    | 'system';
  items?: InventoryEventItemValue[];
  weeklyPlanId?: EntityId | null;
  recipeId?: EntityId | null;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}
export type InventoryEventDocument = HydratedDocument<InventoryEventRecord>;
export const InventoryEventSchema = new Schema<InventoryEventRecord>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    type: {
      type: String,
      enum: ['ADD', 'USE', 'DISCARD', 'ADJUST', 'MEMORY'],
      required: true,
    },
    source: {
      type: String,
      enum: [
        'home',
        'chat',
        'kitchen_hub',
        'planner',
        'ocr',
        'recipe',
        'manual',
        'system',
      ],
      required: true,
    },
    items: { type: [inventoryEventItemSchema], default: [] },
    weeklyPlanId: { type: Schema.Types.ObjectId, default: null },
    recipeId: { type: Schema.Types.ObjectId, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, required: true },
  },
  {
    collection: 'inventoryevents',
    versionKey: false,
  },
);
InventoryEventSchema.index({ userId: 1, createdAt: -1 });

export { ocrReceiptLineSchema };
