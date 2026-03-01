# AGENTS.md

Operational guide for human and AI contributors working in this repository.

## Required Reading (Before Backend Changes)

- Architecture: [`architecture.readme.md`](architecture.readme.md)
- Entities and data model: [`src/backend/README.mongodb.md`](src/backend/README.mongodb.md)
- API contract and endpoints: [`src/backend/README.endpoints.md`](src/backend/README.endpoints.md)

If your change touches persistence, auth, or API shape, read all three docs first.

## Repository Layout

- Backend (NestJS + MongoDB): `src/backend`
- Frontend (Expo + React Native): `src/frontend`
- Infra/local orchestration: `docker-compose.yml`, `docker-compose.override.yml`
- Product/UI draft reference: `draft_1.pen`

## Working Rules

- Keep backend modules domain-oriented (`auth`, `inventory`, future `weekly-plans`, `grocery`, `recipes`).
- Treat `README.endpoints.md` as the source of truth for API surface.
- Treat `README.mongodb.md` as the source of truth for entity design and naming.
- Prefer additive, backward-compatible endpoint changes unless a migration plan is documented.
- Avoid passing `userId` in request payloads for protected routes; derive identity from JWT.
- Keep business logic in services; controllers should stay thin.
- Update docs in the same change when endpoint or entity contracts change.

## Backend Dev Commands

Run from `src/backend`:

- Install: `npm install`
- Dev server: `npm run start:dev`
- Tests: `npm run test`
- E2E: `npm run test:e2e`
- Lint: `npm run lint`

## Frontend Dev Commands

Run from `src/frontend`:

- Install: `npm install`
- Start Expo: `npm run start`
- Lint: `npm run lint`

## Change Checklist

- Endpoint changes reflected in `src/backend/README.endpoints.md`
- Entity/schema changes reflected in `src/backend/README.mongodb.md`
- Architecture-impacting changes reflected in `architecture.readme.md`
- Tests updated or a clear note included for why test coverage was deferred
