import { create } from 'zustand';
import type { SessionUserSummary } from '../types/contracts';

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

type UserState = {
  status: SessionStatus;
  authUser: SessionUserSummary | null;
  appUserId: string | null;
  hasCompletedOnboarding: boolean;
  setAuthenticated: (
    authUser: SessionUserSummary,
    appUserId: string,
    hasCompletedOnboarding: boolean,
  ) => void;
  setOnboardingCompleted: (hasCompletedOnboarding: boolean) => void;
  setUnauthenticated: () => void;
};

export const useUserStore = create<UserState>((set) => ({
  status: 'loading',
  authUser: null,
  appUserId: null,
  hasCompletedOnboarding: false,
  setAuthenticated: (authUser, appUserId, hasCompletedOnboarding) =>
    set({
      status: 'authenticated',
      authUser,
      appUserId,
      hasCompletedOnboarding,
    }),
  setOnboardingCompleted: (hasCompletedOnboarding) =>
    set({
      hasCompletedOnboarding,
    }),
  setUnauthenticated: () =>
    set({
      status: 'unauthenticated',
      authUser: null,
      appUserId: null,
      hasCompletedOnboarding: false,
    }),
}));

export default useUserStore;
