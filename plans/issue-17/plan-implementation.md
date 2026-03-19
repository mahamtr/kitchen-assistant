# Issue 17 — Structured Clarifications + Suggestion Chips in Planner and Chef Chat

## Context
Issue #17 asks for a contract-level change to planner and chef chat so the assistant can return either a normal draft, a single blocking clarification, or a draft plus non-blocking suggested reply chips. The repo already has backend-owned AI workflows with strict JSON schemas and frontend chat screens for planner and recipes.

## Problem Statement
Today both planner and recipe generation flows assume each chat turn should return a full draft payload. There is no first-class response mode for:
- a blocking structured clarification request (single outstanding question)
- non-blocking suggestion chips that help the user steer the next turn

Without explicit schema support, this behavior cannot be implemented reliably through prompt tuning alone.

## Repository Analysis Summary
Repo-wide scan was completed with `git ls-files`, top-level directory inspection, and guidance review (`AGENTS.md`, `architecture.readme.md`, backend contract docs).

Issue-relevant code areas identified:
- Backend AI contract + validation:
  - `src/backend/src/planner/planner-ai.consts.ts`
  - `src/backend/src/planner/planner-ai.service.ts`
  - `src/backend/src/recipes/recipe-ai.consts.ts`
  - `src/backend/src/recipes/recipe-ai.service.ts`
- Backend planner/recipe command-query entry points and chat persistence:
  - `src/backend/src/planner/*`
  - `src/backend/src/recipes/*`
  - shared schema definitions in `src/backend/src/data/schemas.ts`
- Frontend chat surfaces + typed API contracts:
  - `src/frontend/src/features/planner/PlannerChatScreen.tsx`
  - `src/frontend/src/features/recipes/RecipeChatScreen.tsx`
  - `src/frontend/src/lib/types/contracts.ts`

Current structure already enforces strict JSON parsing/validation and is a good fit for additive response-mode modeling.

## Technical Approach and Reasoning
Implement an additive “assistant response envelope” for planner and recipe AI outputs, with explicit mode semantics:
- `draft`
- `clarify`
- `draft_with_suggestions`

Key design decisions:
1. **Server-owned response contract**
   - Extend backend JSON schemas and validators to accept the new envelope and reject malformed clarifications/suggestions.
   - Keep existing draft payload structures for compatibility while wrapping with explicit mode metadata.

2. **Single blocking clarification invariant**
   - Persist at most one unresolved clarification per session/revision context.
   - Require stable clarification IDs and scope (`session` vs `profile`) so answered clarifications are not repeatedly asked.

3. **Backend-controlled curated options**
   - Validation enforces structured options (IDs/labels/mode) rather than free-form chip invention by the model.
   - Clarification answers are persisted in revision/session state and injected into subsequent AI context.

4. **Frontend rendering split by mode**
   - Planner and recipe chat UIs render message text always.
   - For `clarify`, render blocking chips and capture structured answer payload.
   - For `draft_with_suggestions`, render non-blocking suggestion chips while keeping free-text input available.

5. **Backward compatibility + migration safety**
   - Existing clients continue to function with `draft` mode.
   - DTOs and tests are updated together to keep typed contracts aligned.

## Likely Files to Change
- `src/backend/src/planner/planner-ai.consts.ts`
  - Extend planner AI response schema/rules for mode + clarification + suggestions.
- `src/backend/src/planner/planner-ai.service.ts`
  - Validate/normalize new planner response envelope and enforce invariants.
- `src/backend/src/recipes/recipe-ai.consts.ts`
  - Extend recipe AI response schema/rules similarly.
- `src/backend/src/recipes/recipe-ai.service.ts`
  - Validate/normalize new recipe response envelope and structured clarification behavior.
- `src/backend/src/data/schemas.ts`
  - Add persisted types for clarification state/answers and suggested replies where needed.
- `src/backend/src/planner/*.ts` and `src/backend/src/recipes/*.ts` command/query handlers
  - Persist clarification state, consume structured answers, prevent repeated unresolved prompts.
- `src/frontend/src/lib/types/contracts.ts`
  - Add typed response structures for mode/clarification/suggestions.
- `src/frontend/src/features/planner/PlannerChatScreen.tsx`
  - Render blocking clarification UI and suggestion chips, submit structured answers.
- `src/frontend/src/features/recipes/RecipeChatScreen.tsx`
  - Same UX pattern for chef chat.
- Docs:
  - `src/backend/README.mongodb.md`
  - `src/backend/README.endpoints.md`
  - `architecture.readme.md` (if response-contract pattern is elevated architecturally)
- Tests around planner/recipe AI validation and chat behavior across both modes.

## Implementation Steps
1. Define shared backend types for assistant response mode, clarification object, option schema, and suggested replies.
2. Update planner AI schema/constants and validator logic to parse/normalize the new response envelope.
3. Update recipe AI schema/constants and validator logic with the same envelope pattern.
4. Extend planner and recipe chat command flows to:
   - persist unresolved clarification state
   - persist structured clarification answers
   - inject answered clarifications into subsequent model context
   - block repeated prompting for the same resolved clarification ID within session scope.
5. Update endpoint DTO mapping so frontend receives stable mode + clarification/suggestions fields.
6. Update frontend contracts and both chat screens to render:
   - blocking clarification chips (single active question)
   - optional non-blocking suggested replies
   - normal draft rendering unchanged.
7. Add/adjust unit tests for backend schema validation and clarification lifecycle.
8. Add/adjust frontend tests for chip rendering and structured answer submission.
9. Update backend docs (and architecture doc if warranted) to reflect the contract and persistence behavior.

## UI and Behavior
Planner and Chef chat should follow the same interaction model:
- Always show `assistantMessage` as the main assistant text block.
- If mode is `clarify`:
  - render a single blocking clarification card below assistant message
  - present curated chips/options (single-select or multi-select per schema)
  - disable “send free-text as resolution” for that blocking clarification unless schema allows free-text fallback
  - after answer submit, show loading state, then continue normal chat flow
- If mode is `draft_with_suggestions`:
  - render draft preview as today
  - show suggestion chips beneath the assistant text as optional shortcuts
  - selecting a chip should submit the structured suggestion payload as next user turn
- If mode is `draft`:
  - preserve current behavior exactly.

States and UX details:
- Loading: chip controls disabled with visible “Updating...” state.
- Empty: if no suggestions, no chip container rendered.
- Error: structured submission failure surfaces inline error and re-enables choices.
- Accessibility: chip controls must have explicit labels/roles and deterministic test IDs.

## Risks
- Schema drift between planner and recipe implementations if done independently.
- Regression risk in existing draft generation if envelope migration is not additive.
- Repeated clarification loops if unresolved/resolved state transitions are not persisted correctly.
- Frontend complexity increase if blocking vs non-blocking chip handling is not clearly separated.

## Validation Checklist
- Backend unit tests cover:
  - valid/invalid `draft`, `clarify`, and `draft_with_suggestions` payloads
  - single active clarification enforcement
  - clarification answer persistence and no-repeat behavior.
- Planner and recipe command/query tests verify state transitions after structured answers.
- Frontend tests cover:
  - clarification chip rendering + submit path
  - suggestion chips rendering + submit path
  - unchanged draft rendering path.
- Manual sanity checks in planner and recipe chat flows for all three modes.
- Docs updated in same change set for API/entity contract changes.
