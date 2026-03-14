# Context
Issue #14 requests replacing default durable storage of full planner/chef chat transcripts with structured state persistence, while keeping optional/retained transcript behavior explicitly governed.

# Problem Statement
Planner and recipe generation revisions currently persist full `chat` arrays by default and repeatedly replay these histories into AI context, increasing privacy exposure and storage/retrieval noise.

# Repository Analysis Summary
- Repo-wide tracked-file inventory scanned (`git ls-files`) and architecture/guidance docs reviewed (`AGENTS.md`, `architecture.readme.md`, backend READMEs).
- Data model inspection (`src/backend/src/data/schemas.ts`) confirms `chat` arrays embedded in weekly-plan and recipe generation revision records.
- Planner flow (`src/backend/src/planner/planner.command-handlers.ts`, `planner-draft-context.builder.ts`, `planner-read.service.ts`) appends and returns full historical chat.
- Recipe flow (`src/backend/src/recipes/recipes.service.ts`, `recipe-ai.service.ts`) similarly appends and reuses full transcript history.
- AI prompt-context shape currently accepts `chat` arrays for both planner and recipe contexts.

# Technical Approach and Reasoning
1. Introduce structured durable interaction state for planner and recipe workflows:
   - accepted/revision metadata
   - explicit user decisions
   - compact rolling summary
   - optional bounded transcript fragment storage when enabled
2. Replace default context-building to consume structured state + summaries first; include raw transcript only when feature flag/retention policy allows.
3. Add retention governance:
   - opt-in transcript persistence toggle or bounded TTL policy
   - default path avoids long-lived full chat storage
4. Ensure backward compatibility:
   - readers support legacy revisions with `chat`
   - migration/backfill strategy converts legacy chat to summary/decision snapshots where feasible

Why this fits current codebase:
- Planner and recipe flows already have dedicated context builders/services where data-shape changes can be centralized.
- Mongoose schema can be extended additively for structured summary/decision fields.
- Existing AI-service payload assembly can switch sources without changing transport contracts.

Tradeoffs:
- Summary quality depends on extraction logic; overly lossy summaries may reduce revision quality.
- Supporting legacy and new persistence formats temporarily increases code complexity.

# Likely Files to Change
- `src/backend/src/data/schemas.ts`: add structured persistence fields and transcript-retention metadata.
- `src/backend/src/planner/planner.command-handlers.ts`: stop default full-chat append behavior; persist structured revision decisions/summaries.
- `src/backend/src/planner/planner-draft-context.builder.ts`: build AI context from structured state/summaries first.
- `src/backend/src/planner/planner-read.service.ts`: response shaping for compatibility and new structured fields.
- `src/backend/src/recipes/recipes.service.ts`: same structured persistence + retention behavior for chef chat revisions.
- `src/backend/src/recipes/recipe-ai.service.ts`: context contract update to prioritize summary/state inputs.
- `src/backend/README.mongodb.md`: revised persistence contract.
- `src/backend/README.endpoints.md`: revised planner/recipe generation revision payload contract.
- `architecture.readme.md`: durable-state pattern guidance across AI chat workflows.
- Tests:
  - `src/backend/src/planner/planner.command-handlers.spec.ts`
  - `src/backend/src/recipes/recipes.service.spec.ts`
  - `src/backend/src/planner/planner-ai.service.spec.ts`
  - `src/backend/src/recipes/recipe-ai.service.spec.ts`

# Implementation Steps
1. Define structured revision/session persistence schema for planner and chef workflows.
2. Implement write-path changes to persist structured decisions/summaries instead of default full transcript arrays.
3. Update context builders to consume structured state and summary-first inputs.
4. Add optional transcript retention rule (opt-in/TTL bounded) and guardrails.
5. Add compatibility layer for existing documents containing `chat` arrays.
6. Update docs and endpoint contracts.
7. Expand tests for structured persistence and context-building behavior.

# UI and Behavior
No major UI redesign required.
If response payloads change, UI should continue rendering assistant messages while using new structured fields for future interactions. Clarify that transcript history display is not assumed unless explicitly supported.

# Risks
- Migration/compatibility gaps could break existing revision reads.
- Summary-state extraction may omit context needed for high-quality AI revisions.
- Contract drift risk if docs and response mappers are not updated together.

# Validation Checklist
- [ ] Planner and chef workflows operate without requiring durable full transcript replay.
- [ ] Raw transcript retention has explicit policy and is not default durable storage.
- [ ] Existing revisions with legacy `chat` arrays remain readable or migrated safely.
- [ ] AI context builders use structured state + summaries as primary inputs.
- [ ] Docs updated (`README.mongodb.md`, `README.endpoints.md`, `architecture.readme.md`).
- [ ] Tests cover persistence and context-building in both planner and recipe paths.
