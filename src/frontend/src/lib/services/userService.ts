import { getMockDataSnapshot, useMockAppStore } from '../mock/mockStore';
import { requireAppUserId, withDelay } from './utils';
import type { BootstrapSummary, SessionUserSummary, UserPreferenceResponse, UserProfileResponse } from '../types/contracts';

function bootstrapFromSession(authUser: SessionUserSummary): string {
  return useMockAppStore.getState().ensureUserFromSession(authUser);
}

async function getMe(): Promise<UserProfileResponse> {
  const userId = requireAppUserId();
  const user = getMockDataSnapshot().users[userId];
  if (!user) {
    throw new Error('User not found.');
  }

  return withDelay({
    id: user.id,
    supabaseUserId: user.supabaseUserId,
    email: user.email ?? null,
    displayName: user.displayName ?? null,
    status: user.status,
  });
}

async function getPreferences(): Promise<UserPreferenceResponse | null> {
  const userId = requireAppUserId();
  const preference = getMockDataSnapshot().preferences[userId];
  if (!preference) {
    return withDelay(null);
  }

  return withDelay({
    id: preference.id,
    version: preference.version,
    source: preference.source,
    profile: preference.profile,
  });
}

async function getBootstrapSummary(): Promise<BootstrapSummary> {
  const userId = requireAppUserId();
  const snapshot = getMockDataSnapshot();
  const user = snapshot.users[userId];
  if (!user) {
    throw new Error('User not found.');
  }

  return withDelay({
    user,
    preference: snapshot.preferences[userId],
    currentPlan: snapshot.currentWeeklyPlanByUserId[userId]
      ? snapshot.weeklyPlans[snapshot.currentWeeklyPlanByUserId[userId]]
      : undefined,
  });
}

export const userService = {
  bootstrapFromSession,
  getBootstrapSummary,
  getMe,
  getPreferences,
};

export default userService;
