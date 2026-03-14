# Context
Issue #14 requests stopping default persistence of full planner and chef chat transcripts. Latest direction in-thread narrows this further: treat chat history as UI memory only (non-durable) and keep backend persistence to draft/output state needed for functionality.

# Problem Statement
Planner (`WeeklyPlanRevision.chat`) and recipe generation (`RecipeGenerationRevision.chat`) currently store full historical chat arrays on every revision and replay them into AI context. This creates avoidable durable storage of conversational content and unnecessary payload growth.

# Repository Analysis Summary
- Completed repo-wide tracked-file scan (`git ls-files`) and reviewed repository guidance/docs (`AGENTS.md`, `architecture.readme.md`, `src/backend/README.mongodb.md`, `src/backend/README.endpoints.md`).
- Current persistence model in `src/backend/src/data/schemas.ts` includes `chat` arrays on both weekly-plan revisions and recipe-generation revisions.
- Planner write/read/context flow inspected in:
  - `src/backend/src/planner/planner.command-handlers.ts`
  - `src/backend/src/planner/planner-draft-context.builder.ts`
  - `src/backend/src/planner/planner-read.service.ts`
- Recipe write/read/context flow inspected in:
  - `src/backend/src/recipes/recipes.service.ts`
  - `src/backend/src/recipes/recipe-ai.service.ts`
- Both flows currently append prior chat + new turns and persist the entire updated chat array each revision.

# Technical Approach and Reasoning
Chosen approach: **remove durable transcript persistence from planner and recipe revisions, and rely on non-chat durable state plus current user turn for generation/revision.**

Concretely:
1. Stop writing full `chat` arrays in new revision documents (planner + recipe).
2. Keep durable fields that are functionally required:
   - planner: `latestOutput` + revision metadata
   - recipe: `latestOutput` + revision metadata
3. Update AI context builders so they no longer depend on persisted transcript arrays by default.
4. Keep response contracts stable where possible by returning `chat: []` (or equivalent compatibility behavior) for newer revisions without durable transcript history.
5. Preserve backward compatibility for existing documents that already have `chat` persisted.

Why this fits current codebase:
- Transcript handling is centralized in planner command handlers/context builder and recipes service; removing persistence is localized and low-risk.
- Core product behavior is driven by `latestOutput` and accepted plan/recipe materialization, not by mandatory server-side replay of full transcript logs.
- The user explicitly requested a simple removal of backend transcript persistence and UI-memory-only behavior, so this is the smallest viable implementation.

Tradeoffs:
- Multi-turn refinement quality may decrease if no transcript summary/context replacement is added.
- UI must own transient chat history for active session continuity.

# Likely Files to Change
- `src/backend/src/data/schemas.ts`
  - Make revision `chat` persistence optional/non-required for planner and recipe revisions.
- `src/backend/src/planner/planner.command-handlers.ts`
  - Remove full-chat append persistence in revision creation paths.
- `src/backend/src/planner/planner-draft-context.builder.ts`
  - Remove dependency on persisted revision transcript for AI revision context.
- `src/backend/src/planner/planner-read.service.ts`
  - Response compatibility for revisions without persisted chat.
- `src/backend/src/recipes/recipes.service.ts`
  - Remove full-chat persistence in generation/revision creation paths.
  - Keep backward-compatible read mapping for legacy revisions with chat.
- `src/backend/src/recipes/recipe-ai.service.ts`
  - Context contract adjustments when transcript history is absent.
- `src/backend/README.mongodb.md`
  - Update persistence model to state chat transcript is not durably stored by default (UI memory).
- `src/backend/README.endpoints.md`
  - Clarify revision payload/transcript behavior.
- `architecture.readme.md`
  - Align AI workflow persistence guidance with UI-memory transcript direction.
- Tests:
  - `src/backend/src/planner/planner.command-handlers.spec.ts`
  - `src/backend/src/recipes/recipes.service.spec.ts`
  - Any affected context-builder and response-shaping tests.

# Implementation Steps
1. Update schemas to allow revisions without durable `chat` arrays.
2. Remove transcript append/write logic from planner revision creation and weekly generation revision seed path.
3. Remove transcript append/write logic from recipe generation start/revision creation.
4. Update planner/recipe AI context construction to function without persisted transcript history.
5. Keep legacy read compatibility for existing revisions containing `chat`.
6. Update docs (`README.mongodb.md`, `README.endpoints.md`, `architecture.readme.md`).
7. Update/add tests for non-persisted transcript behavior and compatibility.

# UI and Behavior
No major UI redesign.
Expected behavior: chat transcript continuity is handled by UI memory/session state; backend persists only revision outputs and related functional state.

# Risks
- Reduced AI context depth can affect refinement quality in longer conversations.
- Any frontend path assuming durable transcript retrieval may need a compatibility fallback.
- Incomplete compatibility handling could break reads for legacy revisions.

# Validation Checklist
- [ ] New planner revisions do not durably persist full `chat` transcripts.
- [ ] New recipe generation revisions do not durably persist full `chat` transcripts.
- [ ] Planner and recipe flows still generate/revise/accept correctly.
- [ ] Existing legacy revisions with persisted `chat` remain readable.
- [ ] Docs updated to match new transcript persistence behavior.
- [ ] Tests cover new non-persistence behavior and legacy compatibility.