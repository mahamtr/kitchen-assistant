# Implementation Plan — Issue #2

## Context
- Issue: [#2](https://github.com/mahamtr/kitchen-assistant/issues/2)
- Title: Implement Login screen with Supabase OAuth (Google/Apple/Facebook)
- Repo: mahamtr/kitchen-assistant

## Problem Statement
Goal
Users can sign in/out using Supabase Auth social providers.

Tasks
	•	Build LoginScreen with Tamagui components:
	•	App title + short subtitle
	•	Buttons: Continue with Google / Apple / Facebook
	•	Implement OAuth flow for:
	•	Web: signInWithOAuth({ provider }) redirect
	•	Mobile (Expo): use AuthSession / deep linking redirect
	•	Implement session listener + store session
	•	Add logout action (temporary button in Home or settings placeholder)
	•	Handle edge cases:
	•	cancel login
	•	errors shown as toast/banner

Acceptance Criteria
	•	User can login and session persists after app restart
	•	User can logout and returns to Login screen
	•	Works on web + mobile builds

## Implementation Steps
1. Review existing auth/session architecture across web and Expo mobile targets.
2. Build/LoginScreen UI with Tamagui components (title, subtitle, Google/Apple/Facebook buttons).
3. Implement provider OAuth flows:
   - Web redirect via Supabase `signInWithOAuth({ provider })`.
   - Mobile flow via Expo AuthSession/deep-link redirect handling.
4. Add session bootstrap and listener to persist and hydrate session state on app launch.
5. Add logout entry point (temporary Home/settings placeholder) that clears session and returns to Login.
6. Handle UX edge cases:
   - cancelled auth flow,
   - provider/API failures surfaced with user-friendly toast/banner feedback.
7. Validate on web and mobile builds with smoke checks for login persistence and logout behavior.

## Risks
- OAuth callback/deep-link configuration mismatch between web and native environments.
- Provider-specific behavior differences (Apple/Facebook availability by platform).
- Session persistence race conditions during app startup/hydration.
- Incomplete error-state UX if Supabase returns provider-specific errors.

## Validation Checklist
- [ ] Google login succeeds and navigates into authenticated app state.
- [ ] Apple login path works where supported.
- [ ] Facebook login path works where configured.
- [ ] Session persists across app restart/reload.
- [ ] Logout clears session and returns user to Login screen.
- [ ] Auth cancellation is handled without app crash.
- [ ] Auth errors are visible to the user via toast/banner.
- [ ] Flow verified on web + mobile.
