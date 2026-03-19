# Issue #15 — Replace Manual Low-Stock Handling With Threshold-Based Replenishment

## Context
Issue: https://github.com/mahamtr/kitchen-assistant/issues/15

Current flows still depend on manually setting `InventoryItem.status = low_stock` and then moving those items to grocery via `move-low-stock-to-buy`. This blocks reliable replenishment behavior and produces placeholder grocery quantities.

## Problem Statement
The codebase uses one mixed inventory status model to represent both freshness and replenishment intent. In practice:
- low-stock replenishment is manually tagged, not derived
- zero-quantity items are not consistently treated as buy-needed
- shortage quantity (`targetOnHand - currentQuantity`) is not the source of truth for grocery rows

We need backend-owned, threshold-derived replenishment while preserving compatibility with existing clients during rollout.

## Repository Analysis Summary
Repo-wide scan and targeted reads show:
- Inventory schema/service currently center on `status` (`fresh|use_soon|expired|low_stock|unknown`) and patch endpoints allow manual `status` editing.
- Grocery service `moveLowStockToBuy()` queries inventory by `status: 'low_stock'` and upserts rows from that subset.
- Kitchen UI and entity types derive `In Stock`, hints, edit defaults, and action labels from the same mixed `status` field.
- Recent issue #13 planning direction already introduces split-state migration expectations (`replenishment` vs `freshness`) and compatibility projection.

Primary files inspected: `src/backend/src/data/schemas.ts`, `src/backend/src/inventory/inventory.service.ts`, `src/backend/src/grocery/grocery.service.ts`, `src/frontend/src/lib/types/entities.ts`, `src/frontend/src/features/kitchen/KitchenHubScreen.tsx`, `src/frontend/src/features/kitchen/KitchenItemScreen.tsx`, plus repo guidance `AGENTS.md`.

## Technical Approach and Reasoning
Adopt additive schema + derived server policy:
1. Add replenishment policy/state fields (e.g., reorder point + target on hand + derived shortage).
2. Compute buy-needed from quantity and policy thresholds on backend reads/writes.
3. Drive low-stock-to-grocery from derived replenishment state, not manual status.
4. Keep a backward-compatible projected `status` during migration so existing consumers remain stable while frontend switches to explicit fields.

Why this approach:
- Matches existing repo preference for additive/backward-compatible API changes.
- Minimizes break risk while multiple issues (#13, #16, #20, #21) are in flight.
- Keeps business rules centralized in backend services rather than fragile client inference.

## Likely Files to Change
- `src/backend/src/data/schemas.ts`
  - Add replenishment policy/state fields to inventory documents; keep mixed status compatibility projection for transition.
- `src/backend/src/inventory/inventory.service.ts`
  - Compute derived replenishment fields; stop requiring manual low_stock authoring in patch paths.
- `src/backend/src/grocery/grocery.service.ts`
  - Replace `status: low_stock` source selection with threshold-derived buy-needed; compute shortage quantity.
- `src/backend/src/inventory/inventory.service.spec.ts`
  - Add/adjust tests for threshold derivation, zero quantity handling, compatibility status projection.
- `src/backend/src/grocery/grocery.service.spec.ts`
  - Validate low-stock-to-buy uses shortage quantities and merges cleanly.
- `src/backend/README.mongodb.md`
  - Document new replenishment fields and migration/compatibility notes.
- `src/backend/README.endpoints.md`
  - Document response/request behavior changes and derived fields.
- `src/frontend/src/lib/types/entities.ts`
  - Add explicit replenishment types; de-emphasize direct manual low_stock editing.
- `src/frontend/src/features/kitchen/KitchenHubScreen.tsx`
  - `In Stock` and action affordances should follow replenishment state from backend-derived fields.
- `src/frontend/src/features/kitchen/KitchenItemScreen.tsx`
  - Remove requirement to manually set low_stock; show/edit policy fields as needed (or leave non-editable if backend-owned defaults are used).
- `src/frontend/src/features/kitchen/*.test.tsx`
  - Cover derived view transitions and action behavior after threshold-based derivation.

## Implementation Steps
1. **Schema introduction**
   - Add replenishment policy + derived state fields to inventory schema.
   - Keep legacy mixed `status` field as compatibility projection (read-time or write-time projection policy documented).
2. **Derivation utilities**
   - Introduce pure helper(s) to compute buy-needed and shortage from quantity + thresholds.
   - Reuse helper across inventory and grocery modules.
3. **Inventory service migration**
   - Update mapping/DTO outputs with explicit replenishment fields.
   - Ensure patch/update no longer depends on setting low_stock directly.
4. **Grocery integration**
   - Change low-stock selection from manual status query to derived buy-needed query.
   - Write shortage quantity into grocery rows (`targetOnHand - currentQuantity`, clamped at >= 0).
5. **Frontend and contracts**
   - Update shared types and kitchen screens to consume explicit replenishment fields.
   - Keep compatibility fallback while backend + frontend roll out.
6. **Docs and tests**
   - Update mongodb + endpoints docs in same change.
   - Add focused unit/integration/frontend tests for thresholds, zero quantity, and UI transitions.

## UI and Behavior
- `In Stock` must be derived from replenishment/on-hand semantics (positive usable on-hand), not mixed status labels.
- `Expiring` remains freshness-driven.
- Item edit should no longer require manually setting `low_stock` as user input.
- `Mark Low Stock -> To Buy` should operate on threshold-derived buy-needed items and resulting shortage quantities.
- Empty/loading/error states remain unchanged; copy may be adjusted only to reflect derived behavior accurately.

## Risks
- Migration complexity if old clients still write `status` directly.
- Potential mismatch between shortage units and existing grocery merge keys.
- Behavior regressions in kitchen chips/filters if compatibility projection is inconsistent.

Mitigations:
- Compatibility projection retained until frontend migration is complete.
- Shared derivation helpers with unit tests.
- Integration tests for grocery merge behavior and quantity math.

## Validation Checklist
- Backend unit tests for derivation helpers and inventory service mapping pass.
- Grocery integration tests verify threshold-based selection and shortage quantity writes.
- Frontend kitchen tests verify In Stock vs Expiring behavior with split derived state.
- `src/backend/README.mongodb.md` updated.
- `src/backend/README.endpoints.md` updated.
- No manual `low_stock` requirement remains in normal edit flow.
