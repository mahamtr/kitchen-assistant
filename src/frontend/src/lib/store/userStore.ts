import { create } from 'zustand';
import { Session } from '@supabase/supabase-js';

type UserState = {
  UserId: string | null;
  session: Session | null;
};

export const useUserStore = create<UserState>(() => {
  return { UserId: null, session: null };
});

export default useUserStore;
