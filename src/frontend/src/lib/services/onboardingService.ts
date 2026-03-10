import { getMockDataSnapshot, useMockAppStore } from '../mock/mockStore';
import { requireAppUserId, withDelay } from './utils';
import type { OnboardingDraft, OnboardingQuestionKey } from '../types/entities';
import type { OnboardingStateResponse, UserPreferenceResponse } from '../types/contracts';

async function getState(): Promise<OnboardingStateResponse> {
  const userId = requireAppUserId();
  const snapshot = getMockDataSnapshot();

  return withDelay({
    questions: snapshot.onboardingQuestions.filter((question) => question.isEnabled).sort((left, right) => left.order - right.order),
    draft: snapshot.onboardingDrafts[userId],
  });
}

async function getQuestions() {
  const state = await getState();
  return state.questions;
}

async function getDraft() {
  const state = await getState();
  return state.draft;
}

async function saveAnswer(key: OnboardingQuestionKey, value: string | string[]): Promise<OnboardingDraft> {
  const userId = requireAppUserId();
  const draft = useMockAppStore.getState().setOnboardingAnswer(userId, key, value);
  return withDelay(draft);
}

async function complete(): Promise<UserPreferenceResponse> {
  const userId = requireAppUserId();
  const preference = useMockAppStore.getState().completeOnboarding(userId);

  return withDelay({
    id: preference.id,
    version: preference.version,
    source: preference.source,
    profile: preference.profile,
  });
}

export const onboardingService = {
  complete,
  getDraft,
  getQuestions,
  getState,
  saveAnswer,
};

export default onboardingService;
