## Context
Issue #13 separates inventory replenishment state from freshness state so low-stock logic and expiring logic stop competing through one overloaded `status` field.

## Problem Statement
Today `InventoryItem.status` mixes two independent concerns (`low_stock` vs `fresh/use_soon/expired`). Backend workflows and UI branches consume this mixed field directly, which causes coupling in summary chips, view filtering, grocery upserts, and item editing.

## Repository Analysis Summary
- Repo-wide scan confirms backend and frontend both model inventory state through a single `status` enum (`src/backend/src/data/schemas.ts`, `src/frontend/src/lib/types/entities.ts`).
- `inventory.service.ts` uses `status` for summary counts and view filters (`in-stock` vs `expiring`).
- `grocery.service.ts` uses `status: 'low_stock'` as source-of-truth for `move-low-stock-to-buy` and uses freshness statuses for urgent flow.
- Kitchen UI (`KitchenHubScreen.tsx`, `KitchenItemScreen.tsx`) renders and edits one status value; low-stock and freshness are visually intertwined.
- Docs (`README.mongodb.md`, `README.endpoints.md`, `architecture.readme.md`) still describe mixed state and need synchronized contract updates.

## Technical Approach and Reasoning
1. Add additive fields on inventory items:
   - `replenishment`: backend-owned stock state (`in_stock | low_stock | out_of_stock`)
   - `freshnessState`: freshness state (`fresh | use_soon | expired | unknown`)
   Keep current `status` temporarily as compatibility projection during migration.
2. Refactor backend logic to consume new fields directly:
   - inventory summary/read filters should derive in-stock and expiring using separate fields.
   - grocery low-stock and urgent actions should query separate states.
3. Tighten write contract:
   - stop manual low-stock authoring from clients.
   - allow freshness updates where appropriate; replenishment computed server-side from quantity/policy placeholder rules.
4. Backward compatibility:
   - lazy backfill legacy docs on read/update by translating old `status` into both new fields.
   - maintain response `status` short-term (derived) to avoid breaking frontend while frontend migration lands.
5. Frontend migration:
   - switch local types/UI logic to new fields for view routing and hints.
   - item edit should no longer expose low_stock as user-settable status.

This approach minimizes rollout risk by keeping additive schema changes first, then converging reads/writes, and only then removing legacy status coupling.

## Likely Files to Change
- `src/backend/src/data/schemas.ts` — add new inventory state fields, enums, indexes/migration defaults.
- `src/backend/src/inventory/inventory.service.ts` — summary/filter/patch validation and compatibility mapping.
- `src/backend/src/grocery/grocery.service.ts` — low-stock and urgent queries/upsert source mapping.
- `src/backend/src/data/default-data.factory.ts` — seed/test fixture state generation.
- `src/backend/src/inventory/inventory.service.spec.ts` and `src/backend/src/grocery/grocery.service.spec.ts` — behavioral coverage for split-state rules.
- `src/frontend/src/lib/types/entities.ts` and `src/frontend/src/lib/types/contracts.ts` — API/domain type updates.
- `src/frontend/src/features/kitchen/KitchenHubScreen.tsx` and `src/frontend/src/features/kitchen/KitchenItemScreen.tsx` — rendering/filter/edit behavior with split state.
- `src/backend/README.mongodb.md`, `src/backend/README.endpoints.md`, `architecture.readme.md` — contract and architectural guidance updates.

## Implementation Steps
1. Introduce new inventory schema fields and mapping helpers from legacy status.
2. Update inventory service read paths (summary/list/detail) to derive counts/views from split fields.
3. Update inventory patch logic to block manual replenishment low-stock writes and accept freshness-only edits.
4. Refactor grocery actions to query `replenishment` for low-stock and `freshnessState` for urgent-expiring.
5. Add/adjust tests for:
   - low-stock and expiring counts
   - in-stock/expiring filters
   - move-low-stock vs move-urgent behavior
   - patch validation guardrails
6. Update frontend types and screen logic to use split fields and remove mixed-status assumptions.
7. Run backend/frontend targeted tests and fix regressions.
8. Update docs and include compatibility/migration notes.

## UI and Behavior
- Kitchen chips continue to show `To Buy`, `In Stock`, `Expiring`.
- `In Stock` view should depend on replenishment state and usable quantity rules, not freshness state.
- `Expiring` view should depend on freshness state only.
- Kitchen item edit sheet should still allow freshness updates but must not ask user to manually set low stock.
- Empty/loading/error behavior remains unchanged.
- Transition behavior: after item save, list placement should reflect recalculated replenishment/freshness buckets.

## Risks
- Breaking existing clients if compatibility projection is removed too early.
- Misclassification during lazy backfill for legacy `status` values.
- Temporary ambiguity if replenishment derivation rules are incomplete before issue #15.
- Test brittleness where fixtures still rely on old single-status assumptions.

## Validation Checklist
- [ ] Backend unit tests pass for inventory and grocery modules.
- [ ] Frontend kitchen screen tests pass for view filtering and item edit behavior.
- [ ] Legacy records without new fields still render and route correctly.
- [ ] `move-low-stock-to-buy` no longer depends on freshness status.
- [ ] Docs updated to describe separate replenishment and freshness ownership.
