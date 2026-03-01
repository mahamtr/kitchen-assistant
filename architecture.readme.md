# Architecture README

This document describes the current architecture of the Kitchen Assistant codebase and the target direction implied by existing entity and endpoint specs.

## 1) System Overview

Kitchen Assistant is a multi-client app with:

- Frontend: Expo/React Native app (`src/frontend`)
- Backend: NestJS API (`src/backend`)
- Database: MongoDB
- Auth provider: Supabase JWT (verified in backend auth module)

High-level flow:

1. User authenticates via Supabase on frontend.
2. Frontend sends Bearer token to backend.
3. Backend verifies JWT and executes domain logic.
4. Domain services read/write MongoDB documents.
5. Frontend consumes normalized API responses.

## 2) Repository Architecture

- `src/backend`: API and domain services (NestJS)
- `src/frontend`: Mobile/web client (Expo Router, Tamagui, Zustand)
- `docker-compose.yml`: local orchestration for `mongo`, `backend`, and `frontend`

## 3) Backend Architecture (Current)

App composition (`AppModule`):

- `ConfigModule` (global env configuration)
- `MongooseModule.forRoot(...)` (Mongo connection)
- `AuthModule` (Supabase JWT verification/guard)
- `InventoryModule` (implemented domain)

Implemented domain:

- `InventoryController`
  - `POST /inventory/events`
  - `GET /inventory/home`
  - `GET /inventory/events`
- `InventoryService`
  - Applies inventory event writes and updates item state
  - Computes home projections (`useSoon`, `fridge`, `pantry`)

Current gap to target contract:

- Some inventory endpoints still accept `userId` in query/body; target design moves protected routes to JWT-derived identity.
- Additional planned domains (users/preferences, onboarding, weekly plans, grocery lists, recipes) are not yet implemented.

## 4) Backend Architecture (Target)

Target domain boundaries:

- `auth`: token/session validation and guarding
- `users`: profile bootstrap + user document lifecycle
- `preferences`: one JSON preference document per user
- `onboarding`: dynamic enabled question bank
- `weekly-plans`: plan generation + lifecycle
- `weekly-plan-revisions`: AI chat revision history
- `grocery-lists`: shopping state synchronized from weekly plan + inventory
- `recipes` and `recipe-history`: recipe generation, acceptance, and usage timeline
- `inventory`: event-driven stock state and home projections

Target data/API references:

- Entities: [`src/backend/README.mongodb.md`](src/backend/README.mongodb.md)
- Endpoints: [`src/backend/README.endpoints.md`](src/backend/README.endpoints.md)

## 5) Data and Consistency Strategy

- Primary write model for stock is event-oriented (`InventoryEvent`), with `InventoryItem` as current-state projection.
- User preferences are JSON-first (`UserPreference.profile`) to support onboarding evolution and AI workflows.
- Weekly planning and recipe generation preserve revision history to support iterative AI edits and acceptance checkpoints.

Consistency expectations:

- Domain service methods should perform multi-step state transitions atomically where possible.
- If transactions are introduced, scope them per user action boundary (for example: mark purchased -> create event + update item/list states).
- Persist enough metadata for auditability (source, actor, timestamp, context).

## 6) Frontend Architecture (Current)

- Routing: Expo Router (`src/frontend/app`)
- UI: Tamagui components + theme context
- API layer: axios wrapper in `src/frontend/src/lib/api.ts`
- Domain API client: `inventoryService` currently implemented
- Local state: Zustand (`userStore`)

Target frontend direction:

- Keep screen components thin.
- Route all server interactions through service modules.
- Centralize auth/session handling and attach access token in API layer.

## 7) Deployment and Runtime

Local default topology:

- MongoDB on `27017`
- Backend on `3000`
- Frontend/Expo dev ports `19000`, `19001`, `19002`, `8081`

Backend runtime concerns:

- Environment-driven CORS (`BACKEND_CORS_ORIGINS`)
- Environment-driven Mongo URI (`MONGO_URI`)
- Default fallback values are useful for local development but should be explicit in production.

## 8) Architecture Guardrails

- Keep controller responsibilities minimal; place orchestration in services.
- Avoid cross-domain leakage; use explicit module boundaries.
- Avoid API contracts that diverge from `README.endpoints.md`.
- Avoid schema drift from `README.mongodb.md` without coordinated doc updates.
- Prefer backward-compatible evolution and explicit migration notes when changing persisted shapes.
