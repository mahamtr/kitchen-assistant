# Context
Issue #12 requests canonical item-name normalization across inventory, grocery, planner, and recipe matching so variants like "spinach", "fresh spinach", and "spinach leaves" aggregate together while preserving user-facing display labels.

# Problem Statement
Current name matching in backend modules relies mostly on lowercase+trim (`normalizeName`) with no shared alias/synonym mapping, which causes duplicate grocery entries, weaker inventory matching, and inconsistent cross-workflow behavior.

# Repository Analysis Summary
- Repo-wide scan completed (`git ls-files`, 254 tracked files) with backend domain modules in `src/backend/src/*` and Expo frontend in `src/frontend/src/*`.
- Guidance reviewed: root `AGENTS.md`, architecture contracts in `architecture.readme.md`, and module behavior in service/handler code.
- Name matching hotspots confirmed:
  - `src/backend/src/planner/planner.shared.ts` has local `normalizeName` utility.
  - `src/backend/src/grocery/grocery.service.ts` uses local `normalizeName` for upsert/purchase merge logic.
  - `src/backend/src/inventory/inventory.service.ts` writes `normalizedName` based on lowercase+trim.
- Entity and API contract docs (`src/backend/README.mongodb.md`, `src/backend/README.endpoints.md`) already define inventory/grocery structures and will need synchronized updates if canonical fields/alias metadata are added.

# Technical Approach and Reasoning
Adopt a hybrid approach with a deterministic canonicalization core plus a small curated synonym map.

1. Introduce a shared canonicalization module in backend common/domain utilities (e.g., `src/backend/src/common/item-canonicalization.ts`) that exposes a pure function to derive:
   - `displayName` (original/friendly label)
   - `normalizedName` (deterministic normalization output)
   - `canonicalKey` (authoritative grouping/matching key)
   - optional metadata such as `matchedBy` (`synonym_map` | `fallback`)
2. Deterministic normalization (always runs):
   - Unicode normalization + lowercase + trim/space collapse
   - punctuation normalization
   - conservative token cleanup (e.g., remove non-semantic marketing adjectives only)
   - conservative morphology handling where safe
3. Curated synonym map (targeted, small):
   - map high-impact aliases to canonical keys (e.g., `spring onion` -> `green onion`)
   - if no mapping exists, fallback to `normalizedName` as `canonicalKey`
4. Add additive canonical-key fields for inventory and grocery-record-level matching while preserving display name fields.
5. Update planner grocery projection and grocery merge flows to group by `canonicalKey` + compatible unit instead of raw/normalized display text.
6. Update purchased-item reconciliation and ingredient-vs-inventory matching to prefer `canonicalKey`.
7. Apply additive migration strategy:
   - lazy backfill on read/write touch paths for existing documents
   - optional one-time migration script for full historical data

Why this fits current codebase:
- Existing services already centralize business rules (`grocery.service.ts`, `planner-grocery-projector.service.ts`, `inventory.service.ts`), so introducing one shared canonicalization entrypoint reduces duplicate normalization logic.
- Current schema supports additive fields and backward-compatible reads.
- CQRS/service flow can adopt canonical keys without requiring a full module rewrite.
- Deterministic canonicalization remains stable/testable without relying on model prompt consistency.

Tradeoffs:
- Full static taxonomy is out of scope; synonym coverage starts small and expands based on observed collisions.
- Conservative normalization avoids harmful merges but leaves some near-duplicates until map entries are added.
- Lazy backfill lowers migration risk but means mixed historical data during transition.

# Likely Files to Change
- `src/backend/src/common/item-canonicalization.ts` (new): shared canonicalization + synonym resolution.
- `src/backend/src/data/schemas.ts`: additive canonical key fields for inventory/grocery related records.
- `src/backend/src/inventory/inventory.service.ts`: set/update canonical key on create/patch flows.
- `src/backend/src/grocery/grocery.service.ts`: merge/group/match using canonical keys.
- `src/backend/src/planner/planner-grocery-projector.service.ts`: canonical grouping during accepted-plan grocery projection.
- `src/backend/src/planner/planner.shared.ts`: remove/replace duplicated local name normalization usage where needed.
- `src/backend/src/recipes/recipes.service.ts` (and relevant matching helpers): canonical matching when subtracting inventory from ingredient demand.
- `src/backend/README.mongodb.md`, `src/backend/README.endpoints.md`, `architecture.readme.md`: contract/architecture updates.
- Backend tests in:
  - `src/backend/src/grocery/grocery.service.spec.ts`
  - `src/backend/src/planner/planner-grocery-projector.service.spec.ts`
  - `src/backend/src/inventory/inventory.service.spec.ts`
  - recipe/planner matching tests where canonical behavior is used

# Implementation Steps
1. Implement shared canonicalization utility with deterministic normalization pipeline and a small in-code curated synonym map.
2. Add schema fields and serialization support for `canonicalKey` (and any needed normalization metadata) in inventory/grocery records.
3. Refactor grocery merge + purchase reconciliation to canonical matching, preserving unit compatibility checks.
4. Refactor planner grocery projector and recipe inventory matching to canonical matching.
5. Add lazy backfill in write paths and defensive fallback (`canonicalKey ?? normalizedName`) in read/grouping paths.
6. Add observability hooks/log notes for unmatched/near-duplicate names so synonym map growth is data-driven.
7. Update docs/contracts and add regression tests for deterministic normalization, synonym-map hits, and fallback behavior.
8. Validate with focused backend test runs for grocery/planner/inventory/recipes modules.

# UI and Behavior
No UI changes.
User-visible names remain friendly display labels. Behavioral change is dedupe and grouping correctness in existing Grocery/Inventory/Planner flows.

# Risks
- Over-aggressive normalization or synonym mapping could wrongly merge distinct items.
- Under-aggressive rules may leave some duplicates until synonyms are curated.
- Incomplete canonical adoption in one path can reintroduce duplicates.
- Migration/backfill gaps could produce temporary mixed matching outcomes.

# Validation Checklist
- [ ] Variants like spinach/fresh spinach/spinach leaves collapse to one canonical grouping key.
- [ ] Weekly-plan projection + low-stock merge do not duplicate same canonical item+unit rows.
- [ ] Purchase flow merges into correct inventory item by canonical key.
- [ ] Recipe ingredient-vs-inventory matching uses canonical keys.
- [ ] Display labels remain user-friendly and not forced to canonical form.
- [ ] Docs updated (`README.mongodb.md`, `README.endpoints.md`, `architecture.readme.md` as needed).
- [ ] Unit tests cover at least a few synonym cases and merge behavior.
