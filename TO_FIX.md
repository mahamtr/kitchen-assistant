
# Grocery / inventory duplication from AI ingredient naming variance:
  - OpenAI sometimes returns ingredient names like `spinach`, `fresh spinach`, and `spinach leaves` for the same item.
  - The UI currently surfaces these as separate items instead of one normalized item, which creates duplicate entries in lists like `To Buy`.
  - Fix direction:
    - add a normalization / synonym layer before rendering or grouping item names
    - ensure list aggregation uses normalized canonical names, not raw AI labels
    - verify the same issue for similar variants beyond spinach

# Inventory item edit should refresh visible state after save:
  - After updating an inventory item, the screen still shows the old values until the page is manually refreshed or revisited.
  - Fix direction:
    - refresh the item detail query/state after a successful edit
    - ensure any parent inventory list summary also revalidates if it depends on the edited item

# Low-stock logic should move from manual status to threshold-based replenishment:
  - The current `Mark Low Stock -> To Buy` flow only moves items already marked `low_stock`; it does not calculate whether something is actually low or how much should be bought.
  - Best practical rollout:
    - start with backend-owned default thresholds per item/category, for example `reorderPoint` and `targetOnHand`
    - derive `low_stock` automatically when `currentQuantity <= reorderPoint`
    - when moving to `To Buy`, add the shortage amount `targetOnHand - currentQuantity` instead of a placeholder quantity like `1`
    - allow per-item user overrides later, so users can adjust thresholds without changing the core model
  - Follow-up product decisions to implement with this:
    - treat `quantity = 0` as buy-needed and include it in `To Buy`
    - keep `In Stock` limited to items with positive quantity

# Expiring / freshness logic should be implemented separately from stock / replenishment logic:
  - This is a different workstream from the `reorderPoint` / `targetOnHand` work above and should not be mixed into the same business rule.
  - Current issue:
    - expiring status is weakly modeled and currently ends up feeding shopping behavior, even though freshness and replenishment are different concerns
    - `Move Urgent to Buy` is likely the wrong product behavior for expiring items
  - Recommended direction:
    - derive a separate freshness state such as `fresh`, `use_soon`, `expired`, `unknown`
    - use explicit package dates when available, otherwise estimate from product/category freshness policies
    - let expiring items influence alerts and weekly-plan recipe selection, not direct restocking by default
    - exclude `expired` items from usable stock when calculating weekly-plan grocery needs
    - allow `use_soon` items to remain usable stock, but prioritize them in planning
  - Scope boundary with the stock/reorder work above:
    - stock/reorder agent owns `quantity`, `reorderPoint`, `targetOnHand`, and `To Buy` replenishment rules
    - expiring/freshness agent owns date logic, freshness policies, `Expiring` behavior, and planner prioritization of soon-to-expire items

# Banners should be dismissible and use centralized copy/constants:
  - Users should be able to close banners instead of having them always remain visible.
  - Each banner should have its own intentional copy and behavior instead of reusing repeated generic strings.
  - Repeated banner text should be moved into shared constants/config so copy is easier to maintain and less likely to drift.
  - Follow-up implementation direction:
    - add dismiss state per banner or banner type
    - review banner variants and customize text per context
    - extract repeated strings into constants instead of inline literals

# Inventory / To Buy empty state should respect filtering:
  - When filtering/searching in `To Buy`, the UI currently says something like `Everything is stocked` even when the real issue is that no items match the current filter.
  - Empty-state messaging should distinguish between:
    - true empty list state
    - filtered/search no-results state
  - Expected fix:
    - show a filter-specific message such as `No items match this view` when the underlying list has items but the current filter/search hides them

# Weekly planner should not default to saving full LLM conversations:
  - Persisting raw planner chat by default will add privacy risk, noisy data, and retrieval complexity without much product value.
  - For weekly planning, the durable data should be the structured plan state and a compact summary of user preferences / constraints, not every prompt/response turn.
  - Better storage direction:
    - save the weekly plan, accepted revisions, grocery deltas, and explicit user decisions as structured records
    - keep a rolling summary for durable context such as dietary preferences, dislikes, budget, and schedule constraints
    - only keep full raw conversation when there is a clear product reason such as visible chat history, debugging, or support review
    - if raw chat is stored, make it opt-in or short-lived with a defined retention policy

# Weekly planner and Chef chat should support structured clarifying questions and suggestion chips:
  - Current issue:
    - both AI flows are effectively shaped around `return the next full draft`
    - there is no first-class response mode for the assistant to ask one targeted follow-up question when a missing answer would materially change the result
    - there is also no structured way for the assistant to suggest quick chip replies such as `Yes` / `No` or curated meal-accompaniment options
  - Product behavior needed:
    - the AI should be able to optionally return a clarification instead of a draft when the user intent is under-specified
    - the AI should also be able to return non-blocking suggestion chips alongside a draft when a few likely next actions are helpful
    - examples:
      - planner: `Do you want to prioritize expiring items this week?` with chips like `Yes` and `No`
      - recipe chat: `What would you like with the salmon?` with chips like `Rice`, `Potatoes`, `Salad`, `Bread`
      - recipe chat: after generating a draft, suggest chips like `Make it spicier`, `Higher protein`, `Use what I have`
  - Required backend contract direction:
    - extend the strict AI response schema so the assistant can return structured modes such as:
      - `draft`
      - `clarify`
      - `draft_with_suggestions`
    - include a stable `assistantMessage`
    - include an optional `clarification` object with:
      - stable `id`
      - `question`
      - `selection` mode such as `single` for the first rollout
      - `options[]` with stable `id` and user-facing `label`
      - `scope` so the answer can be treated as `session` or `profile`
    - include optional `suggestedReplies[]` for quick follow-up chips even when the assistant already returned a draft
    - keep the actual weekly-plan / recipe draft payload separate from the clarification payload so the UI can render both reliably
  - Decision rules the AI layer must follow:
    - ask a clarification only when the missing answer would materially change the output
    - ask at most one blocking clarification at a time
    - prefer generating immediately when the saved preferences, current draft, and latest user turn already give enough signal
    - do not repeatedly ask the same clarification once the user has already answered it in the current session
    - treat some answers as session-only guidance and some as durable preference candidates
  - Scope handling:
    - `session` scope means the answer only affects the current planner revision or active recipe-chat session
    - `profile` scope means the answer is a good candidate to save into the user's durable preference profile
    - if the assistant returns a `profile`-shaped clarification, the product may either:
      - save it explicitly only after user confirmation, or
      - apply it to the current session first and separately ask whether to remember it
  - Implementation guidance for stable UX:
    - prefer server-defined clarification IDs and curated chip options for common cases instead of letting the model invent arbitrary UI structures every time
    - common planner clarification types likely include:
      - prioritize expiring items
      - favor pantry / in-stock ingredients
      - faster weekday dinners
      - tighter budget this week
      - fewer new recipes / more repeats
    - common recipe-chat clarification types likely include:
      - accompaniment / side choice
      - protein swap
      - spice level
      - leftovers / serving count direction
      - appliance or cooking method choice
    - the frontend should render these as chips in chat and submit the selected chip as a structured answer, not just as an untyped free-text message
  - Storage / context direction:
    - persist structured clarification questions and answers as part of the revision/session state
    - answered clarifications should feed the next-turn AI context and rolling summary
    - this should reduce reliance on replaying full raw chat history while improving consistency of planner and recipe behavior
  - Important product boundary:
    - this is not only a prompt-tuning task; it requires a response-contract change, backend validation, and frontend chip rendering / selection flow
    - prompt optimization can improve when the model decides to ask versus generate, but the product feature itself must be implemented explicitly in the API and schema

## Test Plan To Add

- Unit tests for pure business rules:
  - measurement normalization and exact-unit validation
  - reorder logic: `quantity`, `reorderPoint`, `targetOnHand`, and shortage calculation
  - freshness classification: `fresh`, `use_soon`, `expired`, `unknown`
  - grocery merge logic so the same normalized item does not create duplicate `To Buy` rows
  - planner and recipe AI response validation, especially strict JSON schema and measurement rules
- Integration tests for backend workflows:
  - accepting a weekly plan rebuilds the grocery list correctly
  - accepted weekly-plan ingredients are reduced by usable inventory
  - expired inventory does not count as usable stock for grocery subtraction
  - low-stock inventory and weekly-plan demand do not create duplicate grocery rows
  - editing inventory updates derived state correctly for stock and expiring behavior
  - marking grocery items purchased updates inventory quantities and statuses correctly
  - accepting a recipe draft creates the recipe record and history event correctly
- Thin E2E smoke suite for critical user journeys:
  - onboarding completion generates the first weekly plan
  - accepting a weekly-plan revision updates `To Buy`
  - chef chat first prompt creates the first recipe draft, and accepting it saves the recipe
  - OCR review apply updates inventory successfully
  - editing an inventory item persists and refreshes visible state
- Coverage strategy:
  - prioritize branch coverage for pure business-rule units
  - use integration tests as the main protection for cross-module workflows
  - keep E2E small and focused on end-to-end wiring, auth, and route-level regressions
