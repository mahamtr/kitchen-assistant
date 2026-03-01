# MongoDB Entities (Target Design v4)

This document defines the target MongoDB model based on `draft_1.pen` and latest decisions.

Implementation status: design spec only.

## Connection

- Database: `kitchen`
- URI source:
  - `MONGO_URI` env var
  - fallback: `mongodb://localhost:27017/kitchen`

## Key Decisions Applied

1. One preference document per user (`UserPreference`).
2. Onboarding uses only enabled `OnboardingQuestion` records.
3. No `OnboardingQuestionnaire` and no `UserOnboardingSession`.
4. Weekly plan is regenerated weekly (Monday start, Sunday 23:59:59 expiration).
5. Minimal persisted `GroceryList` exists for shopping/planning state.
6. No `InventoryOcrScan`; OCR memory/review is stored as `InventoryEvent` context.

## Collections Overview

- `users`
- `userpreferences`
- `onboardingquestions`
- `weeklyplans`
- `weeklyplanrevisions`
- `recipegenerations`
- `recipegenerationrevisions`
- `grocerylists`
- `recipes`
- `recipehistoryevents`
- `inventoryitems`
- `inventoryevents`

## 1) Entity: User

| Field | Type | Required | Notes |
|---|---|---|---|
| `_id` | `ObjectId` | auto | Primary key |
| `supabaseUserId` | `string` | yes | External auth user id (unique) |
| `email` | `string` | no | Unique/sparse |
| `displayName` | `string` | no | Profile display name |
| `status` | `'active' \| 'invited' \| 'disabled'` | yes | Account status |
| `lastSeenAt` | `Date` | no | Last activity |
| `createdAt` | `Date` | auto | Timestamp |
| `updatedAt` | `Date` | auto | Timestamp |

## 2) Entity: UserPreference

Single preference container per user, JSON-first for LLM usage and flexible onboarding evolution.

| Field | Type | Required | Notes |
|---|---|---|---|
| `_id` | `ObjectId` | auto | Primary key |
| `userId` | `ObjectId` | yes | Ref -> `User._id` |
| `profile` | `object (JSON)` | yes | Full preference payload (dynamic schema) |
| `source` | `'onboarding' \| 'manual_edit' \| 'import'` | yes | Last update source |
| `version` | `number` | yes | Optional optimistic/version counter |
| `updatedBy` | `ObjectId \| null` | no | Actor id (user/admin/system) |
| `metadata` | `object` | no | Extra app flags |
| `createdAt` | `Date` | auto | Timestamp |
| `updatedAt` | `Date` | auto | Timestamp |

Rules:
- One document per user.
- Update `profile` JSON atomically when user changes answers/preferences.

Suggested unique index:
- `(userId)` unique

## 3) Entity: OnboardingQuestion

DB-driven question bank. Onboarding flow is built from all `isEnabled=true` records ordered by `order`.

| Field | Type | Required | Notes |
|---|---|---|---|
| `_id` | `ObjectId` | auto | Primary key |
| `key` | `string` | yes | Stable key (`diet_style`) |
| `prompt` | `string` | yes | Question text |
| `hint` | `string` | no | Helper text |
| `answerType` | `'single_select' \| 'multi_select' \| 'number' \| 'boolean' \| 'text'` | yes | Render/validation type |
| `required` | `boolean` | yes | Must answer |
| `order` | `number` | yes | Display order |
| `isEnabled` | `boolean` | yes | Included in onboarding if true |
| `options` | `array` | no | Choice options for select types |
| `constraints` | `object` | no | Min/max, regex, limits |
| `defaultValue` | `mixed` | no | Optional default |
| `metadata` | `object` | no | UI/feature flags |
| `createdAt` | `Date` | auto | Timestamp |
| `updatedAt` | `Date` | auto | Timestamp |

Suggested indexes:
- `(key)` unique
- `(isEnabled, order)`

## 4) Entity: WeeklyPlan

Exactly one plan per user per week.

| Field | Type | Required | Notes |
|---|---|---|---|
| `_id` | `ObjectId` | auto | Primary key |
| `userId` | `ObjectId` | yes | Ref -> `User._id` |
| `weekStartAt` | `Date` | yes | Monday 00:00:00 (app timezone) |
| `expiresAt` | `Date` | yes | Sunday 23:59:59 (app timezone) |
| `status` | `'active' \| 'expired' \| 'replaced'` | yes | Plan state |
| `constraintsSnapshot` | `object` | no | Snapshot copied from `UserPreference.profile` at generation time |
| `days` | `array` | yes | 7-day plan payload |
| `acceptedRevisionId` | `ObjectId \| null` | no | Ref -> `WeeklyPlanRevision._id` |
| `createdAt` | `Date` | auto | Timestamp |
| `updatedAt` | `Date` | auto | Timestamp |

Notes:
- No direct `preferenceId` relationship.
- Grocery list can be initialized from plan recipes and then updated by shopping-state actions.

Suggested indexes:
- `(userId, weekStartAt)` unique
- `(userId, status)` (or partial unique for `status='active'`)

## 5) Entity: WeeklyPlanRevision

LLM chat revision history for a weekly plan.

| Field | Type | Required | Notes |
|---|---|---|---|
| `_id` | `ObjectId` | auto | Primary key |
| `weeklyPlanId` | `ObjectId` | yes | Ref -> `WeeklyPlan._id` |
| `userId` | `ObjectId` | yes | Ref -> `User._id` |
| `revisionNumber` | `number` | yes | Sequential per plan |
| `chat` | `array` | yes | Conversation messages (`role`, `content`, `timestamp`) |
| `latestOutput` | `object` | yes | Latest LLM JSON weekly plan output |
| `createdAt` | `Date` | auto | Timestamp |
| `updatedAt` | `Date` | auto | Timestamp |

Suggested unique index:
- `(weeklyPlanId, revisionNumber)`

## 5.1) Entity: RecipeGeneration

Server-managed recipe AI chat session (same pattern as weekly plan revisions).

| Field | Type | Required | Notes |
|---|---|---|---|
| `_id` | `ObjectId` | auto | Primary key |
| `userId` | `ObjectId` | yes | Ref -> `User._id` |
| `weeklyPlanId` | `ObjectId` | no | Ref -> `WeeklyPlan._id` |
| `status` | `'active' \| 'accepted' \| 'discarded'` | yes | Session lifecycle |
| `latestRevisionId` | `ObjectId \| null` | no | Ref -> `RecipeGenerationRevision._id` |
| `acceptedRecipeId` | `ObjectId \| null` | no | Ref -> `Recipe._id` |
| `contextSnapshot` | `object` | no | Inventory/plan/favorites snapshot used for generation |
| `createdAt` | `Date` | auto | Timestamp |
| `updatedAt` | `Date` | auto | Timestamp |

Suggested indexes:
- `(userId, createdAt)`
- `(weeklyPlanId, status)`

## 5.2) Entity: RecipeGenerationRevision

LLM revision history for a recipe generation session.

| Field | Type | Required | Notes |
|---|---|---|---|
| `_id` | `ObjectId` | auto | Primary key |
| `generationId` | `ObjectId` | yes | Ref -> `RecipeGeneration._id` |
| `userId` | `ObjectId` | yes | Ref -> `User._id` |
| `revisionNumber` | `number` | yes | Sequential per generation |
| `chat` | `array` | yes | Server-maintained conversation (`role`, `content`, `timestamp`) |
| `latestOutput` | `object` | yes | Latest LLM JSON recipe draft output |
| `createdAt` | `Date` | auto | Timestamp |
| `updatedAt` | `Date` | auto | Timestamp |

Suggested unique index:
- `(generationId, revisionNumber)`

## 6) Entity: GroceryList

Minimal persisted shopping/planning state used by Kitchen Hub (`To Buy`).

| Field | Type | Required | Notes |
|---|---|---|---|
| `_id` | `ObjectId` | auto | Primary key |
| `userId` | `ObjectId` | yes | Ref -> `User._id` |
| `weeklyPlanId` | `ObjectId` | yes | Ref -> `WeeklyPlan._id` |
| `status` | `'active' \| 'completed' \| 'archived'` | yes | List lifecycle |
| `items` | `array` | yes | To-buy rows and states |
| `lastComputedAt` | `Date \| null` | no | Last sync/recompute time |
| `createdAt` | `Date` | auto | Timestamp |
| `updatedAt` | `Date` | auto | Timestamp |

`items[]` minimal shape:
- `itemId` (stable sub-id)
- `name`
- `quantity` (`{ value, unit }`)
- `status`: `'to_buy' | 'purchased' | 'skipped'`
- `source`: `'weekly_plan' | 'low_stock' | 'urgent_expiring' | 'manual' | 'ocr'`
- `inventoryItemId` (optional ref)
- `recipeIds` (optional refs)
- `notes` (optional)

Suggested indexes:
- `(userId, weeklyPlanId)` unique
- `(userId, status)`

## 7) Entity: Recipe

Recipes used by weekly plans and/or favorited by users.

| Field | Type | Required | Notes |
|---|---|---|---|
| `_id` | `ObjectId` | auto | Primary key |
| `weeklyPlanId` | `ObjectId` | no | Ref -> `WeeklyPlan._id` |
| `sourceGenerationId` | `ObjectId \| null` | no | Ref -> `RecipeGeneration._id` |
| `sourceRevisionId` | `ObjectId \| null` | no | Ref -> `RecipeGenerationRevision._id` |
| `title` | `string` | yes | Recipe name |
| `summary` | `string` | no | Short description |
| `status` | `'draft' \| 'published' \| 'archived'` | yes | Lifecycle |
| `ingredients` | `array` | yes | Ingredient lines (matching strategy TBD) |
| `steps` | `array` | yes | Ordered instructions |
| `tags` | `string[]` | no | Filters/search |
| `isPublic` | `boolean` | yes | Visibility |
| `createdAt` | `Date` | auto | Timestamp |
| `updatedAt` | `Date` | auto | Timestamp |

Note:
- Ingredient-to-inventory matching remains open and will be defined later.

## 8) Entity: RecipeHistoryEvent

Timeline for recipe interactions and favorites/history behavior.

| Field | Type | Required | Notes |
|---|---|---|---|
| `_id` | `ObjectId` | auto | Primary key |
| `userId` | `ObjectId` | yes | Ref -> `User._id` |
| `recipeId` | `ObjectId` | yes | Ref -> `Recipe._id` |
| `weeklyPlanId` | `ObjectId` | no | Ref -> `WeeklyPlan._id` |
| `eventType` | `'viewed' \| 'planned' \| 'generated' \| 'accepted_draft' \| 'cooked' \| 'favorited' \| 'unfavorited' \| 'rated'` | yes | User action |
| `source` | `'recipes' \| 'planner' \| 'home' \| 'ai_chat'` | yes | Origin screen |
| `rating` | `number \| null` | no | 1-5 |
| `feedback` | `string` | no | Optional note |
| `inventoryEventId` | `ObjectId \| null` | no | Ref -> `InventoryEvent._id` when cooking deducts stock |
| `occurredAt` | `Date` | yes | Event time |
| `metadata` | `object` | no | Extra attrs |

## 9) Entity: InventoryItem

Current state of tracked kitchen items.

| Field | Type | Required | Notes |
|---|---|---|---|
| `_id` | `ObjectId` | auto | Primary key |
| `userId` | `ObjectId` | yes | Ref -> `User._id` |
| `name` | `string` | yes | Display name |
| `normalizedName` | `string` | no | Matching/search |
| `category` | `string` | no | Grouping |
| `location` | `'fridge' \| 'pantry' \| 'freezer' \| 'unknown'` | yes | Storage location |
| `quantity` | `object` | no | `{ value, unit }` |
| `status` | `'fresh' \| 'use_soon' \| 'expired' \| 'low_stock' \| 'unknown'` | yes | Freshness/stock state |
| `dates` | `object` | no | Added/opened/expires/lastUsed |
| `freshness` | `object` | no | Computed freshness data |
| `source` | `'manual' \| 'ocr' \| 'recipe' \| 'adjustment' \| 'kitchen_hub'` | no | Initial source |
| `lastEventId` | `ObjectId \| null` | no | Ref -> `InventoryEvent._id` |
| `metadata` | `object` | no | Extra attrs |
| `createdAt` | `Date` | auto | Timestamp |
| `lastUpdatedAt` | `Date` | auto | Timestamp |

## 10) Entity: InventoryEvent

Immutable inventory log, including OCR memory/review context.

| Field | Type | Required | Notes |
|---|---|---|---|
| `_id` | `ObjectId` | auto | Primary key |
| `userId` | `ObjectId` | yes | Ref -> `User._id` |
| `type` | `'ADD' \| 'USE' \| 'DISCARD' \| 'ADJUST' \| 'MEMORY'` | yes | Inventory operation or memory event |
| `source` | `'home' \| 'chat' \| 'kitchen_hub' \| 'planner' \| 'ocr' \| 'recipe' \| 'manual' \| 'system'` | yes | Origin channel |
| `items` | `array` | no | Per-item deltas/links |
| `weeklyPlanId` | `ObjectId \| null` | no | Ref -> `WeeklyPlan._id` |
| `recipeId` | `ObjectId \| null` | no | Ref -> `Recipe._id` |
| `metadata` | `object` | no | OCR lines, review decisions, and other context |
| `createdAt` | `Date` | auto | Timestamp |

`items[]` should support:
- `inventoryItemId`
- `name`
- `quantity` / `quantityDelta`
- optional before/after snapshot

OCR flow without separate collection:
- Save extraction/review/apply context inside `InventoryEvent.metadata`
- Use `type='MEMORY'` for non-mutating OCR memory logs
- Use `type='ADD'` with `source='ocr'` when inventory is actually updated

## Grocery List vs Inventory History Boundary

- `GroceryList` stores shopping/planning state:
  - move low stock to buy
  - move urgent/expiring to buy
  - mark selected/all purchased
- `InventoryEvent` stores true inventory history:
  - `ADD` when purchased items are applied into stock
  - `USE`, `DISCARD`, `ADJUST` for stock changes
  - `MEMORY` for OCR/review context

Rule:
- Moving items into To Buy is not an inventory mutation by itself.
- Only purchase/apply-to-inventory operations should create `InventoryEvent(type='ADD')`.

## Relationship Map

- `User 1 -> 1 UserPreference`
- `OnboardingQuestion` is global config (enabled questions drive onboarding)
- `User 1 -> N WeeklyPlan` (one plan per week)
- `WeeklyPlan 1 -> N WeeklyPlanRevision`
- `User 1 -> N RecipeGeneration`
- `RecipeGeneration 1 -> N RecipeGenerationRevision`
- `RecipeGeneration 0..1 -> 1 Recipe` (accepted result)
- `WeeklyPlan 1 -> 1 GroceryList` (minimal persisted shopping state)
- `WeeklyPlan` references recipes through day meal slots
- `User 1 -> N RecipeHistoryEvent`
- `RecipeHistoryEvent N -> 1 Recipe`
- `InventoryEvent N -> 1 User`
- `InventoryEvent items[] N -> 1 InventoryItem` (logical ref)
- `RecipeHistoryEvent(cooked) 0..1 -> 1 InventoryEvent`

## Query and Index Priorities

- `users.supabaseUserId` unique
- `userpreferences.userId` unique
- `onboardingquestions.key` unique
- `onboardingquestions (isEnabled, order)`
- `weeklyplans (userId, weekStartAt)` unique
- `weeklyplans (userId, status)`
- `weeklyplanrevisions (weeklyPlanId, revisionNumber)` unique
- `recipegenerations (userId, createdAt)`
- `recipegenerationrevisions (generationId, revisionNumber)` unique
- `grocerylists (userId, weeklyPlanId)` unique
- `grocerylists (userId, status)`
- `recipes (weeklyPlanId, title)`
- `recipehistoryevents (userId, occurredAt)`
- `inventoryitems (userId, name)`
- `inventoryevents (userId, createdAt)`

## Why WeeklyPlan No Longer References UserPreference

Traceability is preserved by embedding `constraintsSnapshot` in `WeeklyPlan` at generation time.

This avoids hard coupling to mutable preference documents while keeping reproducibility of plan generation inputs.
