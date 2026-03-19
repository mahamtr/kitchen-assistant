## Context
Issue #13 separates inventory replenishment state from freshness state so low-stock logic and expiring logic stop competing through one overloaded `status` field.

## Problem Statement
Today `InventoryItem.status` mixes two independent concerns (`low_stock` vs `fresh/use_soon/expired`). Backend workflows and UI branches consume this mixed field directly, which causes coupling in summary chips, view filtering, grocery upserts, and item editing.

Per latest product direction, we are **not** preserving legacy status compatibility in the app contract for this issue because the app is still in development and does not require legacy client/data support.

## Repository Analysis Summary
- Repo-wide scan confirms backend and frontend both model inventory state through a single `status` enum (`src/backend/src/data/schemas.ts`, `src/frontend/src/lib/types/entities.ts`).
- `inventory.service.ts` uses `status` for summary counts and view filters (`in-stock` vs `expiring`).
- `grocery.service.ts` uses `status: 'low_stock'` as source-of-truth for `move-low-stock-to-buy` and uses freshness statuses for urgent flow.
- Kitchen UI (`KitchenHubScreen.tsx`, `KitchenItemScreen.tsx`) renders and edits one status value; low-stock and freshness are visually intertwined.
- Existing tests explicitly depend on mixed status behavior:
  - backend: `inventory.service.spec.ts`, `grocery.service.spec.ts`, `planner-grocery-projector.service.spec.ts`
  - frontend: `KitchenHubScreen.test.tsx`, `KitchenItemScreen.test.tsx`
- Docs (`README.mongodb.md`, `README.endpoints.md`, `architecture.readme.md`) still describe mixed state and need synchronized contract updates.

## Technical Approach and Reasoning
1. Replace mixed inventory state with explicit fields:
   - `replenishmentState`: `in_stock | low_stock | out_of_stock`
   - `freshnessState`: `fresh | use_soon | expired | unknown`
2. Remove `InventoryItem.status` from backend model and API responses for inventory payloads.
3. Refactor backend logic to consume split fields directly:
   - inventory summary/read filters derive in-stock from `replenishmentState` and expiring from `freshnessState`
   - grocery low-stock and urgent actions query separate fields
4. Tighten write contract:
   - clients can no longer manually set low-stock as top-level status
   - freshness edits remain explicit where appropriate
   - replenishment state remains backend-owned/derived from quantity + policy hooks
5. Frontend migration in same issue:
   - update contracts/types/components to split fields only
   - remove mixed-status assumptions and related edit controls

This approach eliminates hidden coupling now rather than carrying temporary dual-mode behavior.

## Likely Files to Change
- `src/backend/src/data/schemas.ts` — replace mixed inventory status with split state fields.
- `src/backend/src/inventory/inventory.service.ts` — summary/filter/detail mapping and patch validation with split states.
- `src/backend/src/grocery/grocery.service.ts` — low-stock and urgent selection by split states.
- `src/backend/src/planner/planner-grocery-projector.service.ts` — inventory usability/coverage checks should no longer depend on mixed status semantics.
- `src/backend/src/data/default-data.factory.ts` — seed/test fixture generation for split state.
- `src/backend/src/inventory/inventory.service.spec.ts` — split-state read/write behavior.
- `src/backend/src/grocery/grocery.service.spec.ts` — low-stock/urgent flow behavior with split state.
- `src/backend/src/planner/planner-grocery-projector.service.spec.ts` — inventory subtraction expectations under split state.
- `src/frontend/src/lib/types/entities.ts` and `src/frontend/src/lib/types/contracts.ts` — split-state types and API contracts.
- `src/frontend/src/features/kitchen/KitchenHubScreen.tsx` and `src/frontend/src/features/kitchen/KitchenItemScreen.tsx` — rendering/filter/edit behavior with split state.
- `src/frontend/src/features/kitchen/KitchenHubScreen.test.tsx` and `src/frontend/src/features/kitchen/KitchenItemScreen.test.tsx` — updated assertions/mocks for split-state payloads.
- `src/backend/README.mongodb.md`, `src/backend/README.endpoints.md`, `architecture.readme.md` — contract and architecture updates.

## Implementation Steps
1. Update inventory schema/types to split fields and remove mixed `status`.
2. Update inventory service read paths (summary/list/detail) to derive counts/views from split fields.
3. Update inventory patch validation to reject mixed-status writes and accept split-state writes.
4. Refactor grocery actions to query `replenishmentState` for low-stock and `freshnessState` for urgent-expiring.
5. Refactor planner grocery projection inventory-coverage logic to consume split fields.
6. Update frontend contracts/types and kitchen screens to split-state-only rendering/editing.
7. Update backend/frontend tests for split-state-only fixtures and expectations.
8. Update docs to reflect split ownership and endpoint shapes.

## Business Cases To Update And Cover (for developer-agent)
1. **Inventory summary chip counts**
   - `In Stock` uses replenishment state only.
   - `Expiring` uses freshness state only.
   - test target: `src/backend/src/inventory/inventory.service.spec.ts`, `src/frontend/src/features/kitchen/KitchenHubScreen.test.tsx`.
2. **Inventory list filtering**
   - `/inventory/items?view=in-stock` returns replenishment-driven bucket.
   - `/inventory/items?view=expiring` returns freshness-driven bucket.
   - test target: inventory service + KitchenHub screen tests.
3. **Item edit flow contract**
   - UI does not send top-level mixed `status` anymore.
   - backend rejects/ignores mixed-status patches and accepts split-state fields per policy.
   - test target: `inventory.service.spec.ts`, `KitchenItemScreen.test.tsx`.
4. **Move low stock to buy flow**
   - selection based on `replenishmentState=low_stock|out_of_stock`, not freshness.
   - test target: `src/backend/src/grocery/grocery.service.spec.ts`.
5. **Move urgent to buy flow**
   - selection based on `freshnessState=use_soon|expired`, independent of replenishment.
   - test target: `src/backend/src/grocery/grocery.service.spec.ts` (add coverage; currently missing this case).
6. **Planner grocery projection stock subtraction**
   - only usable inventory state should offset weekly-plan grocery needs; split-state semantics must be explicit.
   - test target: `src/backend/src/planner/planner-grocery-projector.service.spec.ts`.
7. **Type-level contract safety**
   - frontend entities/contracts remove `InventoryStatus` mixed enum and use explicit split enums.
   - test target: compile-time + affected UI tests/mocks updated accordingly.
8. **Freshness classification thresholds**
   - explicit tests for date-driven state transitions (`fresh` -> `use_soon` -> `expired`) and `unknown` when dates missing.
   - test target: `inventory.service.spec.ts` (and helper-level unit tests if extracted).
9. **Same-item different-expiry behavior**
   - adding purchased quantity for an existing canonical item with a different expiry should preserve expiry visibility (separate rows or equivalent lot-safe strategy).
   - test target: `grocery.service.spec.ts` + inventory service tests around merge behavior.
10. **Replenishment threshold policy**
   - backend derives replenishment from threshold fields; tests cover default policy and edge values.
   - test target: inventory service tests (and pure policy helper tests if introduced).
11. **Docs contract alignment**
   - entity docs and endpoints docs reflect split fields and no legacy `status` contract.

## UI and Behavior
- Kitchen chips stay `To Buy`, `In Stock`, `Expiring`.
- `In Stock` depends on replenishment state and usable quantity rules, not freshness state.
- `Expiring` depends on freshness state only.
- Kitchen item edit should not expose manual `low_stock` entry.
- Freshness visibility remains explicit in UI:
  - show expiry date and/or days-left text on inventory item cards/detail
  - show freshness badge derived from `freshnessState` (`fresh`, `use soon`, `expired`, `unknown`)
- Freshness classification should be date-driven where possible:
  - `expired`: `expiresAt < today`
  - `use_soon`: `expiresAt` within a configurable near-expiry window (default proposal: 0-2 days)
  - `fresh`: `expiresAt` beyond near-expiry window
  - `unknown`: missing/insufficient date data
- Duplicate-by-lot behavior (same item purchased again with different expiry):
  - keep separate inventory rows when expiry/date context differs materially
  - avoid collapsing into one row if that would lose earliest-expiry visibility
  - UI should naturally show both entries with different expiry indicators
- Replenishment derivation ownership:
  - backend derives `replenishmentState` from `quantity` + thresholds
  - thresholds stored in backend policy fields (global/category defaults first)
  - per-item threshold overrides are optional and can be exposed in UI only if lightweight; otherwise keep UI read-only for this issue and land editing in follow-up
- Empty/loading/error behavior remains unchanged.
- After save, list placement reflects recalculated split states.

## Risks
- Missed ref paths if any module still reads `status` directly after schema update.
- Test fixture churn due to broad type migration.
- Potential temporary inconsistency between inventory and grocery flows if conversion is partially landed.

## Validation Checklist
- [ ] No inventory API payloads rely on mixed `status`.
- [ ] Backend inventory/grocery/planner tests pass with split-state fixtures.
- [ ] Frontend kitchen tests pass with split-state contracts.
- [ ] Item edit no longer sends manual low-stock mixed status.
- [ ] `move-low-stock-to-buy` and `move-urgent-to-buy` are validated independently.
- [ ] Docs updated for split-state-only contract.
