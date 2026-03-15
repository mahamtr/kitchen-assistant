# Context
Issue #14 re-plan scope is intentionally narrow.

# Problem Statement
We want to reduce durable chat footprint while preserving current behavior and avoid UI chat growth.

# Repository Analysis Summary
Reviewed current planner/recipe backend and chat UI paths:
- Backend chat/revision flow:
  - `src/backend/src/planner/planner.command-handlers.ts`
  - `src/backend/src/planner/planner-draft-context.builder.ts`
  - `src/backend/src/recipes/recipes.service.ts`
  - `src/backend/src/recipes/recipe-ai.service.ts`
  - `src/backend/src/data/schemas.ts`
- Frontend chat UI:
  - `src/frontend/src/features/planner/PlannerChatScreen.tsx`
  - `src/frontend/src/features/recipes/RecipeChatScreen.tsx`

# Technical Approach and Reasoning
Implement only these two changes:

1. **Compact conversation every 3 user messages (backend)**
- Keep behavior the same from user perspective.
- Replace durable raw transcript growth with a compact summary checkpoint every 3 user turns.
- Use compact summary + existing durable draft/output context so model behavior remains stable.
- No broader persistence redesign in this pass.

2. **Add bounded chat scroll in UI (frontend)**
- Planner and recipe chat message lists render inside fixed/limited-height scrollable regions.
- Prevent full screen height growth as chats get longer.
- Keep existing interaction flow and message rendering behavior.

Why this fits:
- Minimal, surgical scope.
- Addresses continuity/privacy and UX growth issue directly.
- Low regression risk compared to larger schema/workflow changes.

# Likely Files to Change
- Backend:
  - `src/backend/src/data/schemas.ts`
  - `src/backend/src/planner/planner.command-handlers.ts`
  - `src/backend/src/planner/planner-draft-context.builder.ts`
  - `src/backend/src/recipes/recipes.service.ts`
  - `src/backend/src/recipes/recipe-ai.service.ts`
- Frontend:
  - `src/frontend/src/features/planner/PlannerChatScreen.tsx`
  - `src/frontend/src/features/recipes/RecipeChatScreen.tsx`
- Tests (targeted): planner/recipes backend specs + frontend chat screen tests where present.

# Implementation Steps
1. Add compact-summary checkpoint logic triggered every 3 user messages.
2. Keep prompt/context assembly behavior-equivalent using compacted context + current turn + existing draft/output state.
3. Add bounded scroll containers to planner and recipe chat message sections.
4. Add/update focused tests for compaction cadence and UI scroll behavior.

# UI and Behavior
- No redesign.
- Message flow remains the same.
- Chat lists are scrollable and do not expand the page indefinitely.

# Risks
- Compact summaries must be consistent enough to preserve multi-turn intent.

# Validation Checklist
- [ ] Conversation compaction occurs every 3 user messages.
- [ ] User-visible planner/recipe behavior remains unchanged.
- [ ] Planner chat UI is bounded + scrollable.
- [ ] Recipe chat UI is bounded + scrollable.
- [ ] Tests cover compaction trigger and scroll behavior.