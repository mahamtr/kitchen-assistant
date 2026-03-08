import React, { useEffect } from 'react';
import { Slot } from 'expo-router';
import ThemeProvider from '../src/theme';
import { supabase } from '../src/lib/supacase';
import { useUserStore } from '../src/lib/store/userStore';
import { useAuthStore } from '../src/lib/store/authStore';

export default function RootLayout() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      useUserStore.setState({ UserId: data.session?.user?.id ?? null });
      useAuthStore.getState().setSession(data.session ?? null);
      useAuthStore.getState().setInitializing(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      useUserStore.setState({ UserId: session?.user?.id ?? null });
      useAuthStore.getState().setSession(session ?? null);
      useAuthStore.getState().setInitializing(false);
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
