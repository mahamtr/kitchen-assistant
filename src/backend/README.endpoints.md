# Backend API Endpoints (Target)

This document defines the target API contract for app flows shown in `draft_1.pen`.

It is a spec for implementation planning.

Current implementation status on March 11, 2026:

- Core backend auth, onboarding, users/preferences, weekly plans, grocery lists, inventory, recipes, and home aggregation are implemented.
- Some provider-specific auth flows are still thinner than the target contract, especially Google OAuth and the full reset-password recovery handoff.

## Conventions

- Base URL: `/api/v1`
- Auth header: `Authorization: Bearer <access_token>`
- User identity for protected endpoints comes from JWT (do not pass `userId` in query/body).
- Dates are ISO-8601 UTC in API responses.

## 1) Auth (Login / Signup / Forgot Password)

These endpoints map to:

- `Step 1 - Screen/Login`
- `Step 1.1 - Screen/Reset Password`
- `Step 1.2 - Screen/Create Account`

### `POST /auth/signup`

Create account with email/password.

Request:

```json
{
  "fullName": "Alex Doe",
  "email": "alex@example.com",
  "password": "StrongPassword123!"
}
```

Response `201`:

```json
{
  "user": {
    "id": "usr_...",
    "email": "alex@example.com",
    "displayName": "Alex Doe"
  },
  "requiresEmailVerification": true
}
```

### `POST /auth/login`

Sign in with email/password.

Request:

```json
{
  "email": "alex@example.com",
  "password": "StrongPassword123!"
}
```

Response `200`:

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "expiresIn": 3600,
  "tokenType": "Bearer"
}
```

### `POST /auth/oauth/google`

Authenticate with Google (mobile/web).

Request:

```json
{
  "idToken": "google_openid_id_token",
  "nonce": "raw_client_nonce_when_google_nonce_is_used"
}
```

Response `200`: same token payload as `/auth/login`.

### `POST /auth/password/forgot`

Start forgot-password flow (send reset email/link or OTP).

Request:

```json
{
  "email": "alex@example.com"
}
```

Response `200`:

```json
{
  "message": "If the account exists, reset instructions were sent."
}
```

### `POST /auth/password/reset`

Complete password reset from reset screen.

Request:

```json
{
  "email": "alex@example.com",
  "newPassword": "NewStrongPassword123!",
  "confirmPassword": "NewStrongPassword123!",
  "resetToken": "token_from_email_link_or_otp"
}
```

Response `200`:

```json
{
  "message": "Password updated successfully."
}
```

### `POST /auth/refresh`

Exchange refresh token for a new access token.

Request:

```json
{
  "refreshToken": "..."
}
```

### `POST /auth/logout`

Invalidate current session/refresh token.

### Optional but commonly required

- `POST /auth/email/resend-verification`
- `POST /auth/email/verify`
- `GET /auth/session` (returns current session/user summary)

## 2) User and Preferences

### `POST /users/me/bootstrap`

Create app user record if missing (idempotent after login/signup/google).

Request:

```json
{
  "email": "user@example.com",
  "displayName": "Alex"
}
```

Response `200`:

```json
{
  "id": "...",
  "supabaseUserId": "...",
  "email": "user@example.com",
  "displayName": "Alex"
}
```

### `GET /users/me`

Get authenticated user profile.

### `GET /users/me/preferences`

Get the single preference JSON document.

Response `200`:

```json
{
  "id": "...",
  "version": 3,
  "source": "onboarding",
  "profile": {
    "dietStyle": "Mediterranean",
    "allergies": [],
    "cuisinePreferences": ["Italian", "Japanese"]
  }
}
```

### `PUT /users/me/preferences`

Replace preferences JSON (full upsert).

### `PATCH /users/me/preferences`

Partial merge update for preference profile.

## 3) Onboarding Questions (Dynamic)

### `GET /onboarding/questions?enabled=true`

Return enabled questions in display order.

### `GET /onboarding/state`

Convenience endpoint used by the app to fetch enabled questions plus the current saved onboarding draft.

### `PATCH /onboarding/draft`

Persist one onboarding answer into the server-side draft profile.

Request:

```json
{
  "key": "diet_style",
  "value": "Mediterranean"
}
```

### `POST /onboarding/complete`

Mark onboarding complete, persist the preference profile, and generate the initial weekly plan for the current week.

Notes:

- This endpoint is the first planner-generation entrypoint after onboarding.
- If weekly-plan generation fails, onboarding completion should fail as well.

### Admin/Backoffice endpoints

- `POST /onboarding/questions`
- `PATCH /onboarding/questions/:questionId`
- `POST /onboarding/questions/:questionId/enable`
- `POST /onboarding/questions/:questionId/disable`
- `GET /onboarding/questions` (all, including disabled)

## 4) Weekly Plan

### `POST /weekly-plans/current/generate`

Generate or regenerate the current week plan (Monday->Sunday) from the saved completed preference profile.

Notes:

- Uses OpenAI-backed weekly-plan generation.
- Planner AI may either reuse existing saved recipes or return brand-new inline `draftRecipes[]` inside the revision payload.
- If a current-week plan already exists, this creates a new accepted revision and replaces the accepted plan content in place.
- This endpoint auto-accepts the generated draft:
  - raw hybrid output is stored in `WeeklyPlanRevision.latestOutput`
  - any inline draft recipes are materialized into real `Recipe` documents
  - accepted `WeeklyPlan.days` is rewritten to concrete meals with real `recipeId`s only
- Fails clearly if the backend is missing `OPENAI_API_KEY`.

### `GET /weekly-plans/current`

Get active weekly plan.

### `GET /weekly-plans/:weeklyPlanId`

Get specific weekly plan by id.

### `GET /weekly-plans/:weeklyPlanId/grocery-preview`

Preview of computed needs from plan recipes minus inventory (used to initialize/sync GroceryList).

Notes:

- Preview is based on the accepted weekly plan only, not the latest unaccepted planner revision.
- Keeps `quantity` as a formatted string for compatibility.
- Also returns structured `measurement: { value, unit }`.
- Formatted quantities render `kg` and `l` thresholds from canonical stored `g` and `ml`.

### Internal scheduled operations

- Weekly generator job every Monday 00:00 (per user timezone)
- Weekly expiration job Sunday 23:59:59 (set status to `expired`)

## 5) Weekly Plan AI Chat Revisions

### `GET /weekly-plans/:weeklyPlanId/revisions`

List revisions ordered by `revisionNumber DESC`.

### `GET /weekly-plans/:weeklyPlanId/revisions/latest`

Get the most recent revision for fast chat/planner resume (`chat` + `latestOutput`).

### `GET /weekly-plans/:weeklyPlanId/revisions/:revisionId`

Get one revision (`chat` + `latestOutput`).

### `POST /weekly-plans/:weeklyPlanId/revisions`

Create next revision from one new user turn.

Request:

```json
{
  "userMessage": "Swap Wednesday dinner to seafood."
}
```

Notes:

- Client sends only the new user message.
- Server loads saved preferences, the accepted plan or latest unaccepted draft, prior revision chat, and the new user turn, then regenerates the full weekly-plan draft with OpenAI.
- Server appends the new user turn + assistant rationale and stores the full chat in the new revision.
- `latestOutput` now contains:
  - `badge`
  - `rationale`
  - `draftRecipes[]` for any brand-new inline recipe drafts
  - `days[]` with hybrid meals using either `source='existing'` + `recipeId` or `source='draft'` + `draftRecipeKey`
- Creating a revision does not update the accepted weekly plan.
- Creating a revision does not create real `Recipe` documents for inline drafts.

### `POST /weekly-plans/:weeklyPlanId/revisions/:revisionId/accept`

Accept one draft revision as the active weekly plan.

Notes:

- Materializes any inline `draftRecipes[]` into real `Recipe` documents first.
- Rewrites the accepted plan to concrete meals only, then copies them into `WeeklyPlan.days`.
- Sets `acceptedRevisionId`.
- Recomputes the weekly-plan grocery items from the accepted recipes.

## 6) Grocery List (Shopping State)

### `GET /grocery-lists/current?weeklyPlanId=<id|current>`

Get active grocery list for current (or specified) weekly plan.

### `POST /grocery-lists/current/sync-from-plan`

Create or refresh grocery list rows from weekly plan recipes minus current inventory.
Does not mark items purchased.

### `POST /grocery-lists/current/items/:itemId/mark-purchased`

Mark one item as purchased and apply to inventory.
Creates `InventoryEvent(type='ADD', source='kitchen_hub')`.

### `POST /grocery-lists/current/items/mark-purchased`

Bulk mark selected items as purchased.

Request:

```json
{
  "itemIds": ["gli_1", "gli_2"]
}
```

Creates one grouped `InventoryEvent(type='ADD', source='kitchen_hub')`.

### `POST /grocery-lists/current/items/mark-all-purchased`

Mark all remaining `to_buy` items as purchased and apply to inventory.

### `POST /grocery-lists/current/actions/move-low-stock-to-buy`

Add (or upsert) all current low-stock inventory items into GroceryList as `to_buy`.
No inventory mutation event is created.

### `POST /grocery-lists/current/actions/move-urgent-to-buy`

Add (or upsert) urgent expiring/missing items into GroceryList as `to_buy`.
No inventory mutation event is created.

### `POST /grocery-lists/current/items/:itemId/mark-to-buy`

Revert purchased/skipped item back to `to_buy` (list-state only).

## 7) Recipes

### `GET /recipes?scope=weekly_planned|favorites|history&weeklyPlanId=<id>`

Recipe list by segment.

Notes:

- `scope=weekly_planned` resolves recipes from the concrete `recipeId`s referenced in the accepted `WeeklyPlan.days`.
- Recipe catalog access is user-owned; planner and recipe detail endpoints must only expose recipes owned by the authenticated user.

### `GET /recipes/:recipeId`

Recipe detail (ingredients, steps, metadata).

Notes:

- Each ingredient returns:
  - `quantity` formatted display string
  - `measurement: { value, unit }` exact source-of-truth quantity
- New recipe drafts and accepted recipes must use exact canonical measurements.

### `POST /recipes/generations`

Start a recipe generation session.

Request:

```json
{
  "userMessage": "optional_seed_prompt"
}
```

Notes:

- `userMessage` is optional.
- Starting a new recipe generation discards any prior active chef-chat session for that user.
- When omitted, the backend starts an empty chef chat and creates revision `1` with the assistant greeting `"What would you like to eat?"`.
- In the empty-start flow, `latestOutput` is `null` until the user sends the first recipe request.
- If a client supplies `userMessage`, the backend immediately asks OpenAI for the first strict-JSON recipe draft in revision `1`.
- Recipe chat generation uses the user's saved preference profile, current weekly-plan recipes, favorites, recent accepted/cooked recipes, and non-expired inventory as prompt context.
- Draft output is server-validated before the revision is persisted.

Response `201`:

```json
{
  "generation": {
    "id": "...",
    "latestRevisionId": "...",
    "status": "active"
  },
  "latestRevision": {
    "revisionNumber": 1,
    "chat": [
      {
        "role": "assistant",
        "content": "What would you like to eat?"
      }
    ],
    "latestOutput": null,
    "conversationSummary": "",
    "compactedUserMessageCount": 0
  }
}
```

### `GET /recipes/generations/:generationId/revisions`

List revisions ordered by `revisionNumber DESC`.

### `GET /recipes/generations/active`

Return the currently active recipe generation for the authenticated user, or `null` if there is none.

### `GET /recipes/generations/:generationId`

Return the generation summary plus its latest revision.

Notes:

- `latestRevision.latestOutput` may be `null` before the first user request.
- When older turns are compacted, `latestRevision.conversationSummary` contains the server-generated summary and `latestRevision.compactedUserMessageCount` reports how many user turns were compacted.

### `GET /recipes/generations/:generationId/revisions/latest`

Get latest revision for recipe chat resume (`chat` + `latestOutput`).

### `GET /recipes/generations/:generationId/revisions/:revisionId`

Get one revision (`chat` + `latestOutput`).

### `POST /recipes/generations/:generationId/revisions`

Create next revision from one new user turn.

Request:

```json
{
  "userMessage": "Make it dairy-free and add a vegetarian option."
}
```

Notes:

- Client sends only the new user message.
- If the latest revision has no draft yet, this creates the first OpenAI recipe draft.
- Otherwise, it asks OpenAI for the next full variation of the current draft.
- Server loads prior revision chat, appends new user turn + assistant answer, and stores full chat in the new revision.
- The assistant chat line is server-authored from the validated draft title/summary; the draft content itself comes from OpenAI structured output.

### `POST /recipes/generations/:generationId/revisions/:revisionId/accept`

Accept one revision and persist final `Recipe` from revision `latestOutput`.
Also sets:

- `RecipeGeneration.status = accepted`
- `RecipeGeneration.acceptedRecipeId = <new_recipe_id>`

Notes:

- Returns `400` if the selected revision does not have a recipe draft yet (`latestOutput = null`).

### `POST /recipes/:recipeId/favorite`

Mark as favorite (creates history event).

### `DELETE /recipes/:recipeId/favorite`

Remove favorite (creates history event).

### `POST /recipes/:recipeId/cooked`

Mark recipe as cooked.

- creates `RecipeHistoryEvent(eventType='cooked')`
- creates `InventoryEvent(type='USE', source='recipe')`

### `POST /recipes/:recipeId/rate`

Rate a recipe (1-5), optional feedback.

## 8) Inventory (Kitchen Hub)

### `GET /inventory/summary?weeklyPlanId=<id|current>`

Header summary payload for Kitchen Hub chips and alerts.

Response `200`:

```json
{
  "toBuyCount": 12,
  "inStockCount": 64,
  "expiringCount": 5,
  "lowStockCount": 3,
  "urgentItems": [
    {
      "inventoryItemId": "...",
      "name": "Chicken",
      "expiresAt": "2026-03-01T23:59:59.000Z"
    }
  ]
}
```

### `GET /inventory/items?view=in_stock|expiring&search=<text>&limit=50&cursor=<token>`

Inventory list for Kitchen Hub tabs.

### `GET /inventory/items/:itemId`

Item detail payload for sheet/dialog.

### `PATCH /inventory/items/:itemId`

Manual item edits (quantity/unit/location/dates/status).

Notes:

- Supported quantity units for new writes are `g`, `kg`, `ml`, `l`, `piece`, `clove`, `egg`, `can`, `jar`, `pack`, `fillet`, `slice`.
- Backend normalizes `kg -> g` and `l -> ml` before persistence.
- Unsupported units such as `cup`, `tbsp`, and `tsp` should fail validation.

### `POST /inventory/items/:itemId/discard`

Discard item via event and remove/decrement inventory.

### `GET /inventory/to-buy?weeklyPlanId=<id|current>`

Read alias for GroceryList `to_buy` rows (for backward compatibility).

### `POST /inventory/to-buy/purchase`

Write alias for `POST /grocery-lists/current/items/mark-purchased`.

### `POST /inventory/events`

Generic event endpoint for `ADD|USE|DISCARD|ADJUST|MEMORY`.

### `GET /inventory/events?type=ADD&source=ocr&from=2026-02-01&to=2026-02-28`

Audit/event history feed.

## 9) OCR via InventoryEvent Memory

No dedicated OCR collection. Use inventory events.
If user leaves the OCR flow, session is reset (no `latest` resume endpoint for now).

### `POST /inventory/ocr/extract`

Parse receipt image and create a `MEMORY` event (`source='ocr'`) with extracted lines.

### `GET /inventory/ocr/review`

Get the latest OCR review memory payload.

### `PATCH /inventory/ocr/review/:lineId`

Store corrected OCR line decisions in `MEMORY` event context.

Notes:

- OCR quantity edits use the same supported unit set as manual inventory edits.
- Corrected OCR quantities are normalized before they are saved back into review state.

### `POST /inventory/ocr/apply`

Apply reviewed OCR lines as real inventory changes.
Creates `InventoryEvent(type='ADD', source='ocr')`.

Notes:

- Reviewed OCR quantities are normalized before inventory is updated.
- Inventory merges must fail clearly when an incoming OCR quantity uses an incompatible unit for an existing item.

## 10) Home Aggregation

### `GET /home/today`

Single payload for Home screen:

- today plan summary
- today recipes
- important alerts (expiring/low stock)
- shortcuts/navigation hints

## 11) Screen -> Endpoint Mapping (`draft_1.pen`)

- Step 1 Login:
  - `POST /auth/login`
  - `POST /auth/oauth/google`
  - `POST /auth/password/forgot`
- Step 1.1 Reset Password:
  - `POST /auth/password/reset`
- Step 1.2 Create Account:
  - `POST /auth/signup`
  - `POST /auth/oauth/google`
- Onboarding Flow 1-7:
  - `GET /onboarding/questions?enabled=true`
  - `PUT/PATCH /users/me/preferences`
  - `POST /weekly-plans/current/generate`
- Home Today:
  - `GET /home/today`
- Weekly Planner:
  - `GET /weekly-plans/current`
  - `GET /weekly-plans/:id/grocery-preview`
- Weekly Plan AI Chat:
  - `GET /weekly-plans/:id/revisions`
  - `GET /weekly-plans/:id/revisions/latest`
  - `POST /weekly-plans/:id/revisions`
  - `POST /weekly-plans/:id/revisions/:revisionId/accept`
- Kitchen To Buy / In Stock / Expiring:
  - `GET /inventory/summary`
  - `GET /grocery-lists/current`
  - `POST /grocery-lists/current/sync-from-plan`
  - `POST /grocery-lists/current/items/mark-purchased` (selected)
  - `POST /grocery-lists/current/items/mark-all-purchased`
  - `POST /grocery-lists/current/actions/move-low-stock-to-buy`
  - `POST /grocery-lists/current/actions/move-urgent-to-buy`
  - `GET /inventory/items?view=...`
  - `GET/PATCH /inventory/items/:itemId`
  - `POST /inventory/to-buy/purchase` (alias)
- OCR Review / Edit OCR Item:
  - `POST /inventory/ocr/extract`
  - `GET /inventory/ocr/review`
  - `PATCH /inventory/ocr/review/:lineId`
  - `POST /inventory/ocr/apply`
- Recipes + Recipe AI Chat + Recipe Detail:
  - `GET /recipes?scope=...`
  - `POST /recipes/generations`
  - `GET /recipes/generations/active`
  - `GET /recipes/generations/:generationId`
  - `GET /recipes/generations/:generationId/revisions`
  - `GET /recipes/generations/:generationId/revisions/latest`
  - `POST /recipes/generations/:generationId/revisions`
  - `POST /recipes/generations/:generationId/revisions/:revisionId/accept`
  - `GET /recipes/:id`
  - `POST /recipes/:id/cooked`
  - `POST /recipes/:id/rate`
  - `POST/DELETE /recipes/:id/favorite`

## Notes

- Grocery/shopping state is persisted in minimal `GroceryList`; inventory history stays in `InventoryEvent`.
- Recipe AI generation follows the same revision model as weekly plan AI chat; client never sends full chat history.
- If auth is fully delegated to Supabase/Auth provider, these endpoints can be thin wrappers around provider SDK/API.
