import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';

type AuthState = {
  session: Session | null;
  isInitializing: boolean;
  setSession: (session: Session | null) => void;
  setInitializing: (value: boolean) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  isInitializing: true,
  setSession: (session) => set({ session }),
  setInitializing: (value) => set({ isInitializing: value }),
}));
