# Frontend Fix Handoff

Last checked: March 10, 2026

## Current Status

- Expo Go tunnel startup is working from Docker.
- The frontend container reaches:
  - `Tunnel connected.`
  - `Tunnel ready.`
  - `Metro waiting on exp://...`
- The current runtime blocker is not tunnel startup. It is a React Native render error in the app UI.

## Reproduce

From the repository root:

```bash
docker compose up frontend
```

Then scan the QR code in Expo Go on Android.

To inspect logs:

```bash
docker compose logs --tail=250 frontend
```

## Latest Runtime Error

From the latest frontend container logs:

- `ERROR Text strings must be rendered within a <Text> component.`
- Source file: `src/frontend/src/components/ui/primitives.tsx`
- Stack:
  - `ActionButton (src/components/ui/primitives.tsx:343:5)`
  - `map$argument_0 (src/features/recipes/RecipeDetailScreen.tsx:118:21)`
  - `RecipeDetailScreen (src/features/recipes/RecipeDetailScreen.tsx:117:39)`
  - `RecipeDetailRoute (app/(app)/recipes/[recipeId].tsx:4:10)`

Relevant source locations:

- [src/frontend/src/components/ui/primitives.tsx](/Users/maai/Documents/GitHub/kitchen-assistant/src/frontend/src/components/ui/primitives.tsx)
- [src/frontend/src/features/recipes/RecipeDetailScreen.tsx](/Users/maai/Documents/GitHub/kitchen-assistant/src/frontend/src/features/recipes/RecipeDetailScreen.tsx)

## Most Likely Root Cause

`ActionButton` renders Tamagui `Button` and passes `children` through directly:

- [src/frontend/src/components/ui/primitives.tsx#L326](/Users/maai/Documents/GitHub/kitchen-assistant/src/frontend/src/components/ui/primitives.tsx#L326)

The recipe detail screen passes primitive values into `ActionButton`, including numeric rating labels:

- [src/frontend/src/features/recipes/RecipeDetailScreen.tsx#L118](/Users/maai/Documents/GitHub/kitchen-assistant/src/frontend/src/features/recipes/RecipeDetailScreen.tsx#L118)

Example:

- `1`
- `2`
- `3`
- `4`
- `5`

This is likely causing raw primitive content to reach the native button tree without being wrapped in a `Text` element.

## Important Test Gap

The current Jest mock masks this bug.

In:

- [src/frontend/jest.setup.ts](/Users/maai/Documents/GitHub/kitchen-assistant/src/frontend/jest.setup.ts)

the mocked Tamagui `Button` wraps string/number children in React Native `Text`, so tests pass even though the real app crashes.

This means the current component test suite will not catch this production/runtime issue.

## Suggested Fix Direction

1. Fix `ActionButton` so primitive children are rendered inside a text component.
2. Verify the fix does not break non-primitive button content.
3. Re-run Expo Go and confirm the recipe detail screen renders.
4. Tighten tests so the runtime behavior is not hidden by the current Jest mock.

Likely implementation options:

- Wrap primitive `children` inside Tamagui `Text` inside `ActionButton`.
- Or require a dedicated `label` prop and render text internally.

The lowest-risk fix is probably in `ActionButton`, because the component is used widely across the frontend.

## Other Warnings Seen In Logs

These are not the main blocker, but they should be cleaned up later:

- Missing Expo package version alignment:
  - `expo@54.0.31` expected `~54.0.33`
  - `expo-font@14.0.10` expected `~14.0.11`
  - `expo-router@6.0.21` expected `~6.0.23`
  - `react-native-reanimated@3.17.5` expected `~4.1.1`
  - `react-native-safe-area-context@5.4.0` expected `~5.6.0`
  - `@types/jest@30.0.0` expected `29.5.14`
  - `babel-preset-expo@12.0.11` expected `~54.0.10`
- Linking warning:
  - app config needs a `scheme`
- SecureStore warning:
  - stored value may be larger than 2048 bytes
- Ngrok tunnel can reconnect intermittently:
  - `Tunnel connection has been closed...`

## Validation Checklist For Next Agent

- `docker compose up frontend`
- Scan Expo Go QR on Android
- Confirm recipe detail no longer throws `Text strings must be rendered within a <Text> component`
- Run:

```bash
cd src/frontend && npm run test
cd src/frontend && npm run lint
```

- Consider updating tests around `ActionButton` so primitive-child rendering is covered by real behavior, not only by the mock
