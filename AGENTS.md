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
- Local development should use Docker Compose commands from the repository root.

## Local Dev (Docker Compose)

Run from repository root:

- Start all services: `docker compose up -d`
- Start with logs attached: `docker compose up`
- Rebuild images: `docker compose up --build`
- Stop services: `docker compose down`
- Stop and remove volumes: `docker compose down -v`
- View logs: `docker compose logs -f backend frontend mongo`

## Backend Commands (via Docker Compose)

Run from repository root:

- Backend shell: `docker compose exec backend sh`
- Tests: `docker compose exec backend npm run test`
- E2E: `docker compose exec backend npm run test:e2e`
- Lint: `docker compose exec backend npm run lint`

## Frontend Commands (via Docker Compose)

Run from repository root:

- Frontend shell: `docker compose exec frontend sh`
- Lint: `docker compose exec frontend npm run lint`
- Tests: `docker compose run --rm frontend-test`
- Coverage: `docker compose run --rm frontend-coverage`

For frontend UI work, prefer `docker compose run --rm frontend-test` while iterating and `docker compose run --rm frontend-coverage` before closing the task so generated code is exercised and the coverage summary is available in the same containerized workflow other agents use.

## Direct npm Usage (Optional)

Direct local `npm` commands are optional and mainly useful inside containers (`docker compose exec ...`) or for CI scripts.

## Change Checklist

- Endpoint changes reflected in `src/backend/README.endpoints.md`
- Entity/schema changes reflected in `src/backend/README.mongodb.md`
- Architecture-impacting changes reflected in `architecture.readme.md`
- Tests updated or a clear note included for why test coverage was deferred
- Frontend changes include the relevant unit tests, and `docker compose run --rm frontend-coverage` was run or explicitly deferred
