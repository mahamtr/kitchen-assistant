# Architecture README

This document defines the architecture target for Kitchen Assistant and the implementation rules to keep backend, frontend, and contracts aligned.

Implementation note:

- This document describes the target backend architecture for upcoming implementation and refactors.
- The current backend codebase is not fully at this target yet.
- New backend work should move the codebase toward this design incrementally, module by module.

Normative references:

- Mongo entity contract: [`src/backend/README.mongodb.md`](src/backend/README.mongodb.md)
- API contract: [`src/backend/README.endpoints.md`](src/backend/README.endpoints.md)

If this file conflicts with either contract doc, update all three in the same change.

## 1) System Overview

Kitchen Assistant is a multi-client system:

- Frontend: Expo + React Native (`src/frontend`)
- Backend: NestJS API (`src/backend`)
- Database: MongoDB
- Auth provider: Supabase Auth, accessed by the backend; frontend talks only to backend APIs

Request flow:

1. User authenticates against backend auth endpoints.
2. Backend exchanges or manages the Supabase auth flow and returns tokens to the client.
3. Client sends `Authorization: Bearer <token>` to backend.
4. Backend validates JWT and derives identity from auth context.
5. Backend executes domain logic and persists Mongo documents.
6. Client consumes API DTOs (not raw DB entities).

Rule: protected endpoints must not accept `userId` from request body/query.

## 2) Architecture Style

The project follows a modular monolith with domain-oriented NestJS modules.

This is not a microservices-first system. Keep deployment and runtime simple while keeping code boundaries strict enough to scale business logic safely.

Primary bounded contexts/modules:

- `auth`
- `users`
- `preferences`
- `onboarding`
- `weekly-plans`
- `weekly-plan-revisions`
- `grocery-lists`
- `recipes`
- `recipe-history`
- `inventory`

Within each module, use layered responsibilities:

- Controllers: transport only (validation, auth, response mapping)
- Command/Query handlers (or services): application orchestration
- Domain services/policies: business rules
- Repositories: persistence abstractions
- Schemas/models: Mongo persistence definitions

### 2.1 Current maturity

Current implementation status is earlier than this target:

- The backend currently retains only auth infrastructure code.
- Some existing code is still service-centric and CRUD-oriented.
- This is acceptable as a starting point, but new business logic should not deepen that pattern.

Rule:

- Do not pause feature delivery waiting for a full rewrite.
- Refactor incrementally, starting with the module being actively changed.
- Use `inventory` as the first module to establish the target template for later domains.

### 2.2 DDD approach: lightweight, not academic

Use DDD as a boundary and modeling tool, not as ceremony.

What this means in this project:

- Each NestJS module is a bounded context for one business area.
- Model aggregates where invariants actually matter.
- Put business rules in application/domain layers, not in controllers or persistence models.
- Keep Mongo schemas as persistence concerns, not as the domain model itself.
- Use value-object style structures when they clarify invariants (`Quantity`, `DateRange`, `PlanDay`, etc.), but do not over-model trivial fields.

What this does **not** mean:

- No separate microservice per domain.
- No mandatory repository/interface/factory boilerplate for every trivial case.
- No attempt to make the codebase "pure DDD" at the cost of delivery speed.

Recommended aggregate focus:

- `Inventory`: `InventoryItem` current-state projection + `InventoryEvent` immutable history
- `WeeklyPlans`: `WeeklyPlan` + `WeeklyPlanRevision`
- `Recipes`: `RecipeGeneration`/`RecipeGenerationRevision` and accepted `Recipe`
- `GroceryLists`: current shopping/planning state derived from plan and inventory
- `Preferences`: single `UserPreference` aggregate per user

Planner AI implementation rules:

- Weekly-plan generation and revision chat are backend-owned workflows.
- Backend sends the normalized saved preference profile plus revision chat context to OpenAI.
- OpenAI output must be validated as strict JSON before persisting any planner revision or accepted plan update.
- Planner revisions may mix existing saved recipes with brand-new inline recipe drafts.
- Inline planner draft recipes live only inside `WeeklyPlanRevision.latestOutput` until the user accepts the revision.
- Accepting a planner revision must materialize any inline draft recipes into real `Recipe` documents, then rewrite the accepted `WeeklyPlan.days` to concrete `recipeId` references.
- Accepted weekly plans must remain concrete and stable: no inline draft recipes are stored in `WeeklyPlan.days`.
- Planner recipe selection is user-catalog based, not week-pool based; default planner recipes seed a reusable per-user recipe catalog once and accepted planner-created recipes join that same catalog.
- Prompt text should live in planner-specific backend constants, not inline in controllers or services.
- All provider SDK access should flow through a shared backend AI gateway/module so planner and recipe workflows stay provider-agnostic at the application layer.
- Recipe and grocery quantities must use exact structured measurements as source of truth.
- Canonical stored units are `g`, `ml`, and exact count units; `kg` and `l` are accepted input/display conveniences, not stored base units.
- Backend must never rely on parsing formatted quantity strings once a structured measurement is available.
- Recipe chef-chat sessions may start empty with an assistant greeting and no draft recipe yet; the first user turn creates the first recipe draft revision.
- Recipe chef-chat draft generation is backend-owned and OpenAI-backed: backend assembles prompt context from preferences, weekly-plan recipes, favorites, recent recipe history, and inventory, then validates strict JSON draft output before persisting any revision.

## 3) CQRS Strategy (Pragmatic)

CQRS is adopted for complexity management, not dogma.

Use CQRS primarily to separate write-side business workflows from read-side screen/view shaping.

Rules:

- Separate commands from queries when a use case changes state or enforces invariants.
- Keep read handlers side-effect free.
- It is acceptable for reads and writes to use the same Mongo collections initially.
- Logical separation is required even when physical storage is shared.
- `@nestjs/cqrs` is required for backend modules that implement command/query workflows.
- Use `CommandBus`, `QueryBus`, and event handlers from `@nestjs/cqrs` instead of ad hoc service dispatching.
- Simple internal helper services are still acceptable, but application entry points should flow through explicit commands and queries.

We are **not** doing full event sourcing. Inventory keeps event history because the domain benefits from it, but the system as a whole should remain projection-oriented and pragmatic.

### 3.1 Write side (Commands)

Use explicit command handlers for state-changing operations, for example:

- `GenerateCurrentWeeklyPlanCommand`
- `CreateWeeklyPlanRevisionCommand`
- `AcceptWeeklyPlanRevisionCommand`
- `MarkGroceryItemsPurchasedCommand`
- `ApplyOcrInventoryCommand`
- `CookRecipeCommand`

Command handler responsibilities:

- Validate invariants and permissions
- Execute multi-document writes (transaction when needed)
- Emit domain events after successful commit
- Return minimal write result (IDs/status), not heavy read payloads

### 3.2 Read side (Queries/Projections)

Use explicit query handlers for read endpoints, for example:

- `GetHomeTodayQuery`
- `GetInventorySummaryQuery`
- `GetCurrentGroceryListQuery`
- `GetCurrentWeeklyPlanQuery`
- `GetWeeklyPlanRevisionsQuery`

Query handler responsibilities:

- Read optimized projections/documents
- Avoid side effects
- Shape response DTOs for screens

### 3.3 Domain events and reactions

Use domain events to decouple reactions from command intent, for example:

- `GroceryItemsPurchased`
- `InventoryAdjusted`
- `WeeklyPlanAccepted`
- `RecipeCooked`
- `PreferencesUpdated`

Reactions can trigger:

- Projection refresh
- Alert calculations
- History logging
- Async AI follow-up workflows

## 4) Reliability: Outbox, Idempotency, and Transactions

For cross-module reactions and async processing, use an outbox collection.

This is required for workflows that cross module boundaries or have retry risk. It is not necessary to introduce an outbox for every simple single-document write on day one.

Flow:

1. Command transaction writes domain state + outbox event atomically.
2. Background worker publishes/handles pending outbox records.
3. Consumer marks event processed with retry metadata.

Guidelines:

- Use Mongo transactions for multi-document invariants per user action boundary.
- Add idempotency keys for retry-prone commands (OCR apply, purchase bulk, AI accept).
- Keep event handlers idempotent (safe to re-run).

## 5) Data and Consistency Model

Inventory already follows event + projection semantics:

- Immutable history: `InventoryEvent`
- Current state projection: `InventoryItem`

General consistency rules:

- Preserve audit metadata (`source`, actor, timestamp, context)
- Prefer append-only history for user-visible timeline behavior
- Keep list/planning state (`GroceryList`) separate from true stock mutations (`InventoryEvent`)
- Cross-module item matching (planner, grocery, inventory, recipes) should use shared canonical item keys with a deterministic fallback path.

## 6) Repository Strategy (Including Generic Repository)

Yes, a generic repository in NestJS is possible and recommended with limits.

Recommended pattern:

- `BaseMongoRepository<TDocument>` for shared operations:
  - `create`, `findById`, `findOne`, `updateById`, `deleteById`, pagination helpers
- Domain-specific repositories per aggregate for business queries:
  - `InventoryItemRepository.findLowStockByUser(...)`
  - `WeeklyPlanRepository.findActiveByUserAndWeek(...)`
  - `GroceryListRepository.upsertCurrentList(...)`

Rules:

- Keep business logic out of generic repository.
- Never let controllers call repositories directly.
- Keep aggregate-specific query methods near each domain module.
- Do not create a "mega repository" abstraction that hides all useful query intent.
- Prefer repositories per aggregate root or projection, not per controller endpoint.

## 6.1 Recommended module template

For modules with meaningful business logic, prefer this structure:

- `controllers/`
- `application/commands/`
- `application/queries/`
- `application/handlers/`
- `domain/entities/`
- `domain/services/`
- `domain/events/`
- `infrastructure/repositories/`
- `infrastructure/schemas/`
- `dto/`

This is a target structure, not a rigid rule for every tiny module.

Simpler modules may collapse some folders as long as these boundaries remain clear:

- transport
- application orchestration
- domain rules
- persistence

Implementation note:

- Modules using this template should import `CqrsModule`.
- Command handlers, query handlers, and event handlers should be registered explicitly in the owning module.

## 7) API and Contract Governance

API contract source of truth:

- [`src/backend/README.endpoints.md`](src/backend/README.endpoints.md)

Data contract source of truth:

- [`src/backend/README.mongodb.md`](src/backend/README.mongodb.md)

Governance rules:

- Endpoint changes require matching doc updates in same PR.
- Entity/schema changes require matching Mongo doc updates in same PR.
- Prefer additive and backward-compatible API evolution.

## 8) Shared Types Between Backend and Frontend

Goal: frontend and backend share API shape, while backend keeps DB model internal.

Rule: do not expose Mongo entities directly to the mobile app.

Recommended options:

1. OpenAPI-first:
   - Define/derive OpenAPI from NestJS DTOs
   - Generate frontend API types and client bindings
2. Shared contracts package (monorepo):
   - `packages/contracts` with runtime schema + TS types (`zod`/`typebox`)
   - Backend validates/parses; frontend consumes inferred types

Mapping layers:

- Mongo Entity -> Application DTO -> Frontend ViewModel

## 9) Frontend Architecture (React Native)

Current stack:

- Expo Router
- Tamagui
- Zustand
- Axios API wrapper

Target structure (feature-first):

- `src/features/<domain>/api/*` for server calls
- `src/features/<domain>/hooks/*` for query/mutation orchestration
- `src/features/<domain>/components/*` for feature UI
- `src/features/<domain>/types/*` for DTO/view model types
- `src/components/ui/*` for shared presentational primitives

Component rules:

- Define explicit props interfaces for all reusable components.
- Keep screen files orchestration-focused (navigation + composition only).
- Keep data-fetching and mutation side effects in hooks/services, not in visual components.

State rules:

- Server state should be cached by query layer.
- UI/session state stays in local store (`zustand`).

## 10) Security and Access Control

- JWT is mandatory for protected routes.
- Identity is always derived from JWT claims and mapped to internal `User`.
- Authorization checks happen in command/query application layer, not only in controllers.
- Protected endpoints must not accept `userId` in request body or query parameters.
- Controllers should read identity from auth context and pass it into application handlers.

## 11) Observability and Operations

Minimum operational standards:

- Structured logs with correlation/request ID
- Error boundaries with actionable domain context
- Metrics for command latency, query latency, and event handler retries
- Dead-letter handling for unrecoverable outbox jobs

## 12) Testing Strategy

- Unit tests for domain policies and handlers
- Integration tests for repository + Mongo behavior
- API tests for endpoint contract compliance
- Event handler tests for idempotency and retry behavior

### 12.1 Coverage philosophy

Coverage is a quality signal, not the goal by itself.

Rules:

- Do not optimize for a vanity 100% project-wide number.
- Optimize for confidence in business-critical behavior and change safety.
- Prefer testing commands, queries, domain policies, and repository behavior over trivial DTO/schema boilerplate.
- A low-value test that only executes lines without asserting business behavior does not count as meaningful coverage.

Coverage should answer:

- Are important invariants protected?
- Are failure paths exercised?
- Are cross-document workflows verified?
- Are auth and contract boundaries enforced?

### 12.2 Coverage targets

Use these as default backend targets once modules are implemented:

- Application handlers and domain services: aim for `>= 90%` line coverage and strong branch coverage
- Repositories and persistence integration paths: cover all major success and failure paths
- Controllers/API endpoints: cover auth, validation, mapping, and status-code behavior
- Event handlers/outbox consumers: cover idempotency, retry safety, and duplicate delivery handling

Project-wide target:

- Prefer a minimum global line coverage of `>= 80%` for implemented backend modules
- Prefer a minimum global branch coverage of `>= 70%`

Changed-code target:

- New or heavily changed backend business logic should usually be covered at `>= 90%`
- If coverage is intentionally lower, document the reason in the same PR

Do not enforce coverage equally across all file types.

Lower priority for strict coverage targets:

- passive DTO definitions
- thin schema declarations
- framework wiring modules
- generated or trivial bootstrap code

### 12.3 Test pyramid for this project

Use a practical pyramid:

1. Many unit tests for command handlers, query handlers, and domain policies
2. Focused integration tests for repositories, Mongo transactions, and projection updates
3. Smaller number of endpoint/e2e tests for auth, contracts, and critical user flows

This project should not rely primarily on end-to-end coverage to find business regressions.

### 12.4 Best practices

- Test one business rule per test when possible
- Name tests by behavior, not implementation detail
- Use factories/builders for domain fixtures instead of hand-writing large object literals in every test
- Freeze time or inject clocks for date-sensitive logic
- Inject ID generators or random sources when determinism matters
- Prefer real repository integration tests over deeply mocked persistence behavior
- Mock only external boundaries: auth verification, third-party APIs, LLM calls, background publishers
- Keep command/query tests explicit about both success and failure cases
- Assert observable outcomes, not private method calls
- Include concurrency/idempotency scenarios for commands that can be retried
- Verify authorization rules in application-layer tests, not only controller tests

### 12.5 What every command/query should usually test

Commands should usually have tests for:

- happy path
- validation/invariant failure
- authorization failure
- idempotent retry behavior if applicable
- emitted domain event or outbox write if applicable
- projection/state updates across all affected aggregates

Queries should usually have tests for:

- correct filtering/scoping by authenticated user
- DTO/view-model shaping
- empty-state behavior
- sorting/pagination rules where relevant

### 12.6 Mongo-specific guidance

- Use integration tests against real Mongo behavior for repository logic
- Use transaction-capable test setup for workflows that rely on multi-document atomicity
- Verify index-dependent queries and unique-constraint behavior where those constraints protect invariants
- Test projection rebuild/update behavior whenever events or command side effects feed read models

### 12.7 Coverage review rule

During review, ask:

- Does the test suite protect the business invariant introduced by this change?
- Does it exercise the failure mode most likely to break in production?
- Does coverage include both command side effects and query/read visibility where relevant?

If not, add tests before merging or explicitly defer with reason.

Testing priority for early implementation:

1. Application command/query handler tests
2. Repository integration tests for aggregate behavior
3. Endpoint tests for auth + contract mapping
4. Outbox/idempotency tests once async reactions are introduced

When behavior or contract changes, tests should be updated in the same change or explicitly deferred with reason.

## 13) Implementation Roadmap

1. Refactor `inventory` into the target layered shape and use it as the reference module.
2. Remove remaining protected-route `userId` payload/query usage and enforce JWT-derived identity only.
3. Introduce explicit command/query handlers for the first real workflows in `inventory`.
4. Add domain events + outbox for high-impact actions (`mark-purchased`, OCR apply, recipe cooked).
5. Roll out the same module template to weekly plans, grocery lists, recipes, and preferences.
6. Introduce shared contract generation for frontend (OpenAPI or contracts package).
