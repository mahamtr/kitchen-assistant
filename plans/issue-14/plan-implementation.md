# Context
Issue #14 is being re-planned after closing the previous PR/feature branch. New direction: avoid durable full transcript persistence while preserving response behavior, add compact context persistence every 3 user turns, and ensure planner/recipe chat UIs stay scrollable with in-page memory continuity.

# Problem Statement
Planner and recipe chat currently persisted full `chat` arrays in revision documents, which increases privacy and storage exposure. A strict no-history approach can reduce model continuity. We need a middle path that:
- keeps user-visible behavior stable,
- avoids durable raw transcript storage,
- preserves enough context for LLM quality,
- keeps chat UI bounded/scrollable.

# Repository Analysis Summary
- Repo-wide file inventory re-scanned (`git ls-files`) and architecture/contract docs re-checked (`AGENTS.md`, `architecture.readme.md`, `src/backend/README.mongodb.md`, `src/backend/README.endpoints.md`).
- Backend persistence and AI context paths verified:
  - planner: `src/backend/src/planner/planner.command-handlers.ts`, `planner-draft-context.builder.ts`, `planner-read.service.ts`
  - recipes: `src/backend/src/recipes/recipes.service.ts`, `recipe-ai.service.ts`
  - schemas: `src/backend/src/data/schemas.ts`
- Frontend chat surfaces inspected:
  - planner route + screen: `src/frontend/app/(app)/planner/chat.tsx`, `src/frontend/src/features/planner/PlannerChatScreen.tsx`
  - recipe route + screen: `src/frontend/app/(app)/recipes/chat/[generationId].tsx`, `src/frontend/src/features/recipes/RecipeChatScreen.tsx`
- Current planner chat input is seeded with a hardcoded message and currently truncates to the last few entries; recipe already uses "What would you like to eat?" placeholder.

# Technical Approach and Reasoning
Chosen approach: **summary-compaction policy every 3 user turns + UI-memory transcript continuity + no durable raw transcript writes for new turns.**

1. Persistence strategy
- Stop durable full transcript append for new planner/recipe revisions.
- Introduce compact durable conversation state (summary) updated after each block of 3 user turns.
- Keep revision output state (`latestOutput`) as the primary durable artifact.

2. LLM-context strategy (behavior preservation)
- Preserve response behavior by sending:
  - latest durable summary (compacted conversation state),
  - latest draft/output,
  - current user message,
  - existing durable domain context (preferences, week plan, inventory/favorites/etc.).
- This keeps continuity close to current behavior without storing raw transcripts long-term.

3. UI continuity strategy
- Keep full visible chat history in frontend memory while user remains on planner/recipe chat page.
- Clear in-memory transcript when user leaves page.
- Add explicit scrollable chat container so message list grows inside a bounded area instead of expanding the full screen.
- Planner composer placeholder should use a planner-specific assistant-style prompt (similar UX quality to recipe placeholder) and remove seeded hardcoded user message text.

Why this fits the codebase:
- Existing planner/recipe context-builders and services are centralized and can absorb summary-first context with minimal spread.
- Frontend chat screens are isolated components, making in-memory + scroll behavior changes localized and testable.
- Meets privacy/storage goal while reducing regression risk versus a zero-history context approach.

Tradeoffs:
- Compact summary quality directly affects long chat fidelity.
- Requires clear, deterministic compaction format to avoid context drift.

# Likely Files to Change
- Backend
  - `src/backend/src/data/schemas.ts`
    - Add compact summary fields / compaction metadata for planner + recipe revision flows; make raw `chat` optional for legacy compatibility.
  - `src/backend/src/planner/planner.command-handlers.ts`
    - Stop full chat writes for new turns; trigger summary compaction on 3-user-turn boundaries.
  - `src/backend/src/planner/planner-draft-context.builder.ts`
    - Build revision context from compact summary + latest output + current message.
  - `src/backend/src/planner/planner-read.service.ts`
    - Maintain response compatibility for legacy chat-containing revisions.
  - `src/backend/src/recipes/recipes.service.ts`
    - Apply same non-persistent transcript + 3-turn compaction policy.
  - `src/backend/src/recipes/recipe-ai.service.ts`
    - Accept/use compacted conversation context in prompt payloads.

- Frontend
  - `src/frontend/src/features/planner/PlannerChatScreen.tsx`
    - Remove seeded hardcoded user message; add planner-specific placeholder; add bounded scroll region; keep in-page memory history.
  - `src/frontend/src/features/recipes/RecipeChatScreen.tsx`
    - Ensure bounded scroll region + in-page memory continuity behavior aligns with planner.
  - Any related frontend service/store files under `src/frontend/src/lib/services` and `src/frontend/src/lib/store` if session-memory helper state is introduced.

- Docs
  - `src/backend/README.mongodb.md`
  - `src/backend/README.endpoints.md`
  - `architecture.readme.md`

- Tests
  - `src/backend/src/planner/planner.command-handlers.spec.ts`
  - `src/backend/src/recipes/recipes.service.spec.ts`
  - `src/backend/src/planner/planner-draft-context.builder` related tests
  - `src/backend/src/recipes/recipe-ai.service.spec.ts`
  - Frontend chat screen tests for scroll + memory behavior where coverage exists.

# Implementation Steps
1. Define compact summary schema and compaction metadata for planner/recipe conversation state.
2. Implement backend compaction policy: update compact summary every 3 user turns; stop durable raw transcript writes for new revisions.
3. Update planner/recipe prompt context builders to consume compact summary + latest draft/output + current message.
4. Keep legacy read compatibility for old revisions that still contain `chat` arrays.
5. Update planner UI input behavior:
   - remove seeded hardcoded message,
   - use planner-specific placeholder message,
   - maintain in-page memory transcript.
6. Add bounded scroll containers for planner and recipe chat message lists.
7. Update docs and add/adjust tests for compaction cadence, context quality, and UI behavior.

# UI and Behavior
- No major redesign.
- Planner + recipe chat message lists must be scrollable in a bounded region to prevent unlimited screen growth.
- Chat history remains visible while user stays on the page/session.
- Leaving the page clears transient UI chat history memory.
- Recipe placeholder remains "What would you like to eat?".
- Planner gets a parallel assistant-style placeholder and no pre-filled user prompt text.

# Risks
- Weak summary compaction can degrade nuanced follow-up behavior.
- In-memory-only transcript means no cross-session transcript restore (intentional); UX messaging should be clear.
- Contract drift risk if docs and DTO mappings are not updated together.

# Validation Checklist
- [ ] New turns do not durably persist full raw planner/recipe transcripts.
- [ ] Compact summary is updated every 3 user turns for planner and recipe flows.
- [ ] Prompt context uses compact summary + latest output + current message.
- [ ] User-visible model behavior remains consistent for normal iterative edits.
- [ ] Planner and recipe chat UIs have bounded scrolling and do not expand screen height indefinitely.
- [ ] In-page chat memory persists while mounted and clears on page exit.
- [ ] Planner no longer pre-fills the old hardcoded request; placeholder is planner-specific.
- [ ] Docs and tests reflect the new compaction and UI behavior contracts.