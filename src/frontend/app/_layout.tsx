import React, { useEffect } from 'react';
import { Slot } from 'expo-router';
import ThemeProvider from '../src/theme';
import { supabase } from '../src/lib/supacase';
import { useUserStore } from '../src/lib/store/userStore';

export default function RootLayout() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      console.log('Initial session:', data.session?.user?.id);
      useUserStore.setState({
        UserId: data.session?.user?.id ?? null,
      });
    });

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        useUserStore.setState({
          UserId: session?.user?.id ?? null,
        });
      }
    );

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
