import { apiGet, apiPost } from '../api';
import type { BootstrapSummary, SessionUserSummary, UserPreferenceResponse, UserProfileResponse } from '../types/contracts';

async function bootstrapFromSession(authUser: SessionUserSummary): Promise<UserProfileResponse> {
  return apiPost('/users/me/bootstrap', {
    email: authUser.email,
    displayName: authUser.displayName,
  });
}

async function getMe(): Promise<UserProfileResponse> {
  return apiGet('/users/me');
}

async function getPreferences(): Promise<UserPreferenceResponse | null> {
  return apiGet('/users/me/preferences');
}

async function getBootstrapSummary(): Promise<BootstrapSummary> {
  return apiGet('/users/me/bootstrap-summary');
}

export const userService = {
  bootstrapFromSession,
  getBootstrapSummary,
  getMe,
  getPreferences,
};

export default userService;
