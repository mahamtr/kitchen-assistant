import { create } from 'zustand';
import type { SessionUserSummary } from '../types/contracts';

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

type UserState = {
  status: SessionStatus;
  authUser: SessionUserSummary | null;
  appUserId: string | null;
  setAuthenticated: (authUser: SessionUserSummary, appUserId: string) => void;
  setUnauthenticated: () => void;
};

export const useUserStore = create<UserState>((set) => ({
  status: 'loading',
  authUser: null,
  appUserId: null,
  setAuthenticated: (authUser, appUserId) =>
    set({
      status: 'authenticated',
      authUser,
      appUserId,
    }),
  setUnauthenticated: () =>
    set({
      status: 'unauthenticated',
      authUser: null,
      appUserId: null,
    }),
}));

export default useUserStore;
