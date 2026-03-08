import React, { useEffect } from 'react';
import { Slot } from 'expo-router';
import ThemeProvider from '../src/theme';
import { supabase } from '../src/lib/supacase';
import { useUserStore } from '../src/lib/store/userStore';
import { useAuthStore } from '../src/lib/store/authStore';
import type { Session } from '@supabase/supabase-js';

export function applyAuthSession(session: Session | null) {
  useUserStore.setState({ UserId: session?.user?.id ?? null });
  useAuthStore.getState().setSession(session ?? null);
  useAuthStore.getState().setInitializing(false);
}

export default function RootLayout() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      applyAuthSession(data.session ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      applyAuthSession(session ?? null);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <ThemeProvider>
      <Slot />
    </ThemeProvider>
  );
}
