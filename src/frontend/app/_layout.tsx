import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { Slot } from 'expo-router';
import ThemeProvider from '../src/theme';
import { supabase } from '../src/lib/supacase';
import { useUserStore } from '../src/lib/store/userStore';

function extractCodeFromUrl(url: string): string | null {
  const parsed = Linking.parse(url);

  if (typeof parsed.queryParams?.code === 'string') {
    return parsed.queryParams.code;
  }

  const hash = url.split('#')[1];
  if (!hash) return null;

  const hashParams = new URLSearchParams(hash);
  return hashParams.get('code');
}

export default function RootLayout() {
  useEffect(() => {
    const syncSession = async () => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const code = new URL(window.location.href).searchParams.get('code');
        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
          const cleanUrl = `${window.location.origin}${window.location.pathname}`;
          window.history.replaceState({}, '', cleanUrl);
        }
      }

      const { data } = await supabase.auth.getSession();
      useUserStore.setState({
        UserId: data.session?.user?.id ?? null,
        session: data.session,
      });
    };

    syncSession();

    const urlSubscription = Linking.addEventListener('url', async ({ url }) => {
      const code = extractCodeFromUrl(url);
      if (!code) return;

      await supabase.auth.exchangeCodeForSession(code);
      const { data } = await supabase.auth.getSession();
      useUserStore.setState({
        UserId: data.session?.user?.id ?? null,
        session: data.session,
      });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      useUserStore.setState({
        UserId: session?.user?.id ?? null,
        session,
      });
    });

    return () => {
      urlSubscription.remove();
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <ThemeProvider>
      <Slot />
    </ThemeProvider>
  );
}
