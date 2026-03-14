# Issue #2 Implementation Plan — Login screen with Supabase OAuth (Google/Apple/Facebook)

## Context
- Issue: https://github.com/mahamtr/kitchen-assistant/issues/2
- Goal: deliver social login (Google/Apple/Facebook), preserve existing email/password auth, and ensure login persistence + logout works across web and Expo mobile.
- Current state: frontend auth screen supports email/password only; social CTA is intentionally hidden. Backend has `/auth/oauth/google` endpoint stubbed as not implemented.

## Problem Statement
Users cannot authenticate with social providers today. The app already has a unified auth service and session persistence, but social provider flows are missing both server support and client-side OAuth launch/redirect handling. We need to add provider-auth in a way that fits existing NestJS auth endpoints and Expo Router lifecycle on web + mobile.

## Repository Analysis Summary
Repo-wide scan covered full tracked inventory (`git ls-files`), root guidance (`AGENTS.md`, `TOOLS.md`), architecture contracts (`architecture.readme.md`, `src/backend/README.mongodb.md`, `src/backend/README.endpoints.md`), and issue-relevant code.

Key findings:
- Frontend auth entrypoint is `src/frontend/src/features/auth/AuthScreen.tsx`; it currently renders only email/password controls and an explicit note that social login is unavailable.
- Frontend auth orchestration is centralized in `src/frontend/src/lib/services/authService.ts`; `signInWithGoogle()` currently throws.
- Session persistence is already cross-platform via `src/frontend/src/lib/authSession.ts` and user bootstrap/session restore path is already working.
- Backend auth controller exposes `POST /auth/oauth/google`, but `AuthService.signInWithGoogle()` is unimplemented (`NotImplementedException`).
- Endpoint docs already define `POST /auth/oauth/google`; architecture states frontend should use backend auth endpoints only.
- No README.md at repo root; authoritative docs are AGENTS + architecture/backend docs.

## Technical Approach and Reasoning
### Chosen approach
Implement backend social token exchange endpoints that accept provider tokens and return the existing normalized session payload (`accessToken`, `refreshToken`, `expiresIn`, `tokenType`), then wire Expo client OAuth launch + callback handling to call those endpoints.

Why this fits current codebase:
- Reuses existing backend-auth abstraction (`AuthService.supabaseRequest` + token response mapper) and avoids client-side direct Supabase coupling.
- Reuses existing frontend session pipeline (`setStoredAuthSession` -> `restoreSession`) so social and password login converge to one persistence path.
- Keeps contract-aligned with documented `/auth/oauth/google` endpoint and architecture rule that backend is auth integration boundary.

### Provider handling strategy
- Phase 1 in this issue: implement Google end-to-end first (already present in API contract), while structuring backend and frontend for additive Apple/Facebook support with minimal churn.
- Add provider-generic plumbing on backend (`/auth/oauth/:provider` handler/service branch) if practical, but keep API backwards-compatible by preserving `/auth/oauth/google`.
- On mobile, use Expo `AuthSession` with deep-link redirect URI; on web, use provider popup/redirect compatible with Expo web runtime.

### Tradeoffs / alternatives
- Direct Supabase auth in frontend would be faster, but violates current architecture contract and duplicates token/session behavior.
- Full three-provider completion in one PR is possible but higher risk; staged Google-first plus provider-ready abstraction reduces delivery risk while keeping scope aligned.

## Likely Files to Change
- `src/backend/src/auth/auth.service.ts` — implement provider token exchange logic (Google now, provider-extensible).
- `src/backend/src/auth/auth.controller.ts` — wire request payload validation and provider endpoint(s).
- `src/backend/src/auth/auth.service.spec.ts` — add tests for oauth success/failure and response mapping.
- `src/backend/README.endpoints.md` — clarify provider payload/flow details if endpoint behavior evolves.
- `src/frontend/src/lib/services/authService.ts` — implement `signInWithGoogle()` and add optional Apple/Facebook methods.
- `src/frontend/src/features/auth/AuthScreen.tsx` — render and handle social CTA buttons + loading/error states.
- `src/frontend/src/features/auth/AuthScreen.test.tsx` — update tests for visible social buttons, trigger paths, and error/cancel behavior.
- `src/frontend/src/lib/authSession.ts` (likely no logic change, but verify for OAuth callback size/token persistence edge cases).
- `src/frontend/src/lib/services/authService` tests (if added/extended) — ensure social flow stores/restores session.

## Implementation Steps
1. Backend OAuth implementation
   - Implement `/auth/oauth/google` in `AuthService` by exchanging provider token/code with Supabase Auth and mapping to current token response shape.
   - Add robust error mapping for invalid/expired/cancelled provider tokens.
2. Frontend social auth service
   - Implement Google sign-in flow in `authService` to launch OAuth, receive token/code, post to backend endpoint, persist session, and run `restoreSession()`.
3. AuthScreen UI updates
   - Add Google/Apple/Facebook buttons in login/signup surfaces.
   - Disable buttons while request in-flight and show success/error banners consistent with existing UX.
4. Logout and persistence verification
   - Confirm social session path and email/password path both persist across app restart and both clear session correctly on logout.
5. Tests
   - Backend unit tests for oauth handler/service and token mapping.
   - Frontend screen/service tests for CTA visibility, success, cancellation, and error branch behavior.
6. Docs alignment
   - Update endpoint documentation for provider request payloads and web/mobile redirect expectations.

## UI and Behavior
- Login and signup screens should show three primary social CTAs above or near email/password fields:
  - Continue with Google
  - Continue with Apple
  - Continue with Facebook
- Interaction behavior:
  - Tapping CTA opens provider auth flow.
  - Success: session is established; user is routed to app root (`/`) then normal onboarding/auth bootstrap behavior applies.
  - Cancel: no crash, no session mutation, non-blocking message optional.
  - Error: inline danger banner/toast with actionable text.
- Loading states:
  - Disable all auth submit buttons while social request is in progress.
  - Show existing “Working...” style feedback.
- Responsive behavior:
  - Preserve current scroll + keyboard avoidance behavior.
  - Keep button layout readable on narrow mobile widths and web.
- Accessibility:
  - Buttons must have clear provider labels and remain keyboard/screen-reader reachable.

## Risks
- Provider credential/redirect misconfiguration across Supabase, Expo, and platform manifests.
- Web vs mobile OAuth callback differences causing incomplete token handoff.
- Apple/Facebook implementation details may require provider-specific setup not yet represented in env/config.
- Regressions in existing email/password login flow if auth loading/error state management is not unified.

## Validation Checklist
- [ ] Backend: OAuth endpoint returns normalized session payload for valid provider login.
- [ ] Backend: invalid provider token returns clear non-500 auth error.
- [ ] Frontend: social CTA triggers auth flow on web and mobile.
- [ ] Frontend: successful social auth persists session across app restart.
- [ ] Frontend: logout clears session and returns user to login screen.
- [ ] Frontend tests updated for social CTA + flow branches.
- [ ] Backend tests updated for oauth service/controller behavior.
- [ ] Docs updated for final provider payload/redirect contract.
