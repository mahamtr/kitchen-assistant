# Issue #2 Implementation Plan — Login screen with Supabase OAuth (Google only)

## Context
- Issue: https://github.com/mahamtr/kitchen-assistant/issues/2
- Goal: deliver Google social login, preserve existing email/password auth, and ensure login persistence + logout works across web and Expo mobile.
- Scope constraint from latest thread decision: **Google OAuth only** for this implementation cycle (Apple/Facebook deferred).
- Current state: frontend auth screen supports email/password only; social CTA is intentionally hidden. Backend has `/auth/oauth/google` endpoint stubbed as not implemented.

## Problem Statement
Users cannot authenticate with Google today. The app already has a unified auth service and session persistence, but Google OAuth flow is missing both server support and client-side OAuth launch/redirect handling. We need to add this in a way that fits existing NestJS auth endpoints and Expo Router lifecycle on web + mobile without broadening scope to Apple/Facebook.

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
Implement backend Google token exchange that returns the existing normalized session payload (`accessToken`, `refreshToken`, `expiresIn`, `tokenType`), then wire Expo client Google OAuth launch + callback handling to call that endpoint.

Why this fits current codebase:
- Reuses existing backend-auth abstraction (`AuthService.supabaseRequest` + token response mapper) and avoids client-side direct Supabase coupling.
- Reuses existing frontend session pipeline (`setStoredAuthSession` -> `restoreSession`) so Google and password login converge to one persistence path.
- Keeps contract-aligned with documented `/auth/oauth/google` endpoint and architecture rule that backend is auth integration boundary.

### Scope decision
- This iteration implements **Google only** end-to-end.
- Apple/Facebook UI and API additions are explicitly out of scope and not added in this branch.

### Tradeoffs / alternatives
- Direct Supabase auth in frontend would be faster, but violates current architecture contract and duplicates token/session behavior.
- Implementing all providers now would increase setup/test matrix and delivery risk; Google-only scope keeps change smaller and decision-ready while enabling future provider extension later.

## Likely Files to Change
- `src/backend/src/auth/auth.service.ts` — implement Google token exchange logic.
- `src/backend/src/auth/auth.controller.ts` — ensure `/auth/oauth/google` request handling/validation is complete.
- `src/backend/src/auth/auth.service.spec.ts` — add tests for Google OAuth success/failure and response mapping.
- `src/backend/README.endpoints.md` — clarify Google request payload/behavior if needed.
- `src/frontend/src/lib/services/authService.ts` — implement `signInWithGoogle()`.
- `src/frontend/src/features/auth/AuthScreen.tsx` — render and handle **Google-only** CTA + loading/error states.
- `src/frontend/src/features/auth/AuthScreen.test.tsx` — update tests for Google CTA visibility, success, cancel, and error behavior.

## Implementation Steps
1. Backend Google OAuth implementation
   - Implement `/auth/oauth/google` in `AuthService` by exchanging provider token/code with Supabase Auth and mapping to current token response shape.
   - Add clear error mapping for invalid/expired/cancelled Google auth results.
2. Frontend Google auth service
   - Implement Google sign-in flow in `authService` to launch OAuth, receive token/code, post to backend endpoint, persist session, and run `restoreSession()`.
3. AuthScreen UI updates
   - Add **Continue with Google** button in login/signup surfaces.
   - Keep loading/error behavior consistent with existing auth UX.
4. Logout and persistence verification
   - Confirm Google session path and email/password path both persist across app restart and both clear session correctly on logout.
5. Tests
   - Backend unit tests for Google oauth handler/service and token mapping.
   - Frontend screen tests for Google CTA visibility, success, cancellation, and error branch behavior.
6. Docs alignment
   - Update endpoint documentation for Google payload expectations and flow notes.

## UI and Behavior
- Login and signup screens should show one social CTA:
  - Continue with Google
- Interaction behavior:
  - Tapping CTA opens Google auth flow.
  - Success: session is established; user is routed to app root (`/`) then normal onboarding/auth bootstrap behavior applies.
  - Cancel: non-fatal, no session mutation.
  - Error: inline danger banner/toast with actionable text.
- Loading states:
  - Disable auth submit buttons while Google request is in progress.
  - Show existing “Working...” style feedback.
- Responsive behavior:
  - Preserve current scroll + keyboard avoidance behavior.
  - Keep CTA layout readable on narrow mobile widths and web.
- Accessibility:
  - Google button has clear accessible label and remains keyboard/screen-reader reachable.

## Risks
- Google credential/redirect misconfiguration across Supabase, Expo, and platform manifests.
- Web vs mobile OAuth callback differences causing incomplete token handoff.
- Regressions in existing email/password login flow if auth loading/error state management is not unified.

## Validation Checklist
- [ ] Backend: `/auth/oauth/google` returns normalized session payload for valid Google login.
- [ ] Backend: invalid Google token returns clear non-500 auth error.
- [ ] Frontend: Google CTA triggers auth flow on web and mobile.
- [ ] Frontend: successful Google auth persists session across app restart.
- [ ] Frontend: logout clears session and returns user to login screen.
- [ ] Frontend tests updated for Google CTA + flow branches.
- [ ] Backend tests updated for Google oauth service/controller behavior.
- [ ] Docs updated for final Google payload/flow contract.
