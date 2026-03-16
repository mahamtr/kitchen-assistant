import type {
  ChatMessage,
  EntityId,
  GroceryList,
  GroceryListItem,
  MeasurementValue,
  InventoryEvent,
  InventoryItem,
  OcrReceiptLine,
  OnboardingDraft,
  OnboardingQuestion,
  Recipe,
  RecipeDraftOutput,
  RecipeGeneration,
  RecipeGenerationRevision,
  RecipeHistoryEvent,
  User,
  UserPreference,
  WeeklyPlan,
  WeeklyPlanDay,
  WeeklyPlanRevision,
} from './entities';

export type KitchenView = 'to-buy' | 'in-stock' | 'expiring';
export type RecipeScope = 'weekly_planned' | 'favorites' | 'history';

export interface SessionUserSummary {
  supabaseUserId: string;
  email?: string | null;
  displayName?: string | null;
}

export interface SignInRequest {
  email: string;
  password: string;
}

export interface SignUpRequest {
  fullName: string;
  email: string;
  password: string;
}

export interface GoogleSignInRequest {
  idToken: string;
  nonce?: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  newPassword: string;
  confirmPassword: string;
  resetToken: string;
}

export interface UserProfileResponse {
  id: string;
  supabaseUserId: string;
  email?: string | null;
  displayName?: string | null;
  status: User['status'];
}

export interface UserPreferenceResponse {
  id: string;
  version: number;
  source: UserPreference['source'];
  profile: UserPreference['profile'];
}

export interface HomeTodayResponse {
  todayLabel: string;
  target: {
    calories: string;
    macros: string;
  };
  todayMeals: WeeklyPlanDay['meals'];
  importantInfo: {
    title: string;
    alerts: string[];
    ctaLabel: string;
  };
  shortcuts: Array<{
    label: string;
    href: string;
  }>;
}

export interface WeeklyPlanResponse {
  id: EntityId;
  title: string;
  subtitle: string;
  target: {
    calories: string;
    macros: string;
  };
  badge: string;
  days: WeeklyPlanDay[];
}

export interface GroceryPreviewItem {
  itemId: EntityId;
  name: string;
  quantity: string;
  measurement: MeasurementValue;
  note: string;
}

export interface GroceryPreviewResponse {
  weeklyPlanId: EntityId;
  items: GroceryPreviewItem[];
}

export interface WeeklyPlanRevisionResponse {
  id: EntityId;
  revisionNumber: number;
  chat: ChatMessage[];
  latestOutput: WeeklyPlanRevision['latestOutput'];
}

export interface GroceryListResponse {
  id: EntityId;
  weeklyPlanId: EntityId;
  items: GroceryListItem[];
  status: GroceryList['status'];
}

export interface InventorySummaryResponse {
  toBuyCount: number;
  inStockCount: number;
  expiringCount: number;
  lowStockCount: number;
  urgentItems: Array<{
    inventoryItemId: EntityId;
    name: string;
    expiresAt?: string | null;
  }>;
}

export interface InventoryListResponse {
  items: InventoryItem[];
  total: number;
}

export interface InventoryItemDetailResponse {
  item: InventoryItem;
  recentEvents: InventoryEvent[];
}

export interface InventoryEventsResponse {
  events: InventoryEvent[];
}

export interface OcrReviewResponse {
  eventId: EntityId;
  confidence: number;
  receiptLabel: string;
  lines: OcrReceiptLine[];
}

export interface OcrApplyResponse {
  appliedEventId: EntityId;
  updatedItems: InventoryItem[];
}

export interface RecipeListItemResponse {
  id: EntityId;
  title: string;
  subtitle: string;
  metadata: string;
  usageHint: string;
  relationshipLabel: string;
  isFavorite: boolean;
}

export interface RecipeListResponse {
  scope: RecipeScope;
  items: RecipeListItemResponse[];
}

export interface RecipeDetailResponse {
  recipe: Recipe;
  isFavorite: boolean;
  latestRating?: number | null;
  cookedAt?: string | null;
}

export interface RecipeGenerationResponse {
  generation: RecipeGeneration;
  latestRevision: RecipeGenerationRevision;
}

export interface RecipeGenerationRevisionResponse {
  generationId: EntityId;
  revision: RecipeGenerationRevision;
}

export interface OnboardingStateResponse {
  questions: OnboardingQuestion[];
  draft: OnboardingDraft;
}

export interface BootstrapSummary {
  user: User;
  preference?: UserPreference;
  currentPlan?: WeeklyPlan;
}

export interface RecipeRatingPayload {
  rating: number;
  feedback?: string;
}

export interface UpdateInventoryItemPayload {
  quantity?: InventoryItem['quantity'];
  location?: InventoryItem['location'];
  status?: InventoryItem['status'];
  dates?: InventoryItem['dates'];
  metadata?: InventoryItem['metadata'];
}

export interface OcrLineUpdatePayload {
  name?: string;
  quantityValue?: number;
  quantityUnit?: string;
  note?: string;
  accepted?: boolean;
}

export interface CreatePlannerRevisionPayload {
  userMessage: string;
}

export interface CreateRecipeRevisionPayload {
  userMessage: string;
}
