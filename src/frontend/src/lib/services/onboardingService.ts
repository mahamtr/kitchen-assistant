import { apiGet, apiPatch, apiPost } from '../api';
import type { OnboardingDraft, OnboardingQuestionKey } from '../types/entities';
import type { OnboardingStateResponse, UserPreferenceResponse } from '../types/contracts';

async function getState(): Promise<OnboardingStateResponse> {
  return apiGet('/onboarding/state');
}

async function getQuestions() {
  return apiGet('/onboarding/questions?enabled=true');
}

async function getDraft() {
  const state = await getState();
  return state.draft;
}

async function saveAnswer(key: OnboardingQuestionKey, value: string | string[]): Promise<OnboardingDraft> {
  return apiPatch('/onboarding/draft', { key, value });
}

async function complete(): Promise<UserPreferenceResponse> {
  return apiPost('/onboarding/complete');
}

export const onboardingService = {
  complete,
  getDraft,
  getQuestions,
  getState,
  saveAnswer,
};

export default onboardingService;
