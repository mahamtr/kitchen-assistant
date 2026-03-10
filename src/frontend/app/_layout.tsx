import React, { useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { Text, YStack } from 'tamagui';
import ThemeProvider from '../src/theme';
import { supabase } from '../src/lib/supacase';
import { useUserStore } from '../src/lib/store/userStore';
import ToastHost from '../src/components/ui/ToastHost';
import { palette } from '../src/components/ui/primitives';
import { userService } from '../src/lib/services';
import { useMockAppStore } from '../src/lib/mock/mockStore';
import { rootStackScreenOptions } from './routeOptions';

function toSessionUser(session: Session) {
  return {
    supabaseUserId: session.user.id,
    email: session.user.email ?? null,
    displayName:
      (typeof session.user.user_metadata?.displayName === 'string' && session.user.user_metadata.displayName) ||
      (typeof session.user.user_metadata?.fullName === 'string' && session.user.user_metadata.fullName) ||
      (typeof session.user.user_metadata?.name === 'string' && session.user.user_metadata.name) ||
      session.user.email?.split('@')[0] ||
      'Kitchen Assistant User',
  };
}

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const status = useUserStore((state) => state.status);
  const appUserId = useUserStore((state) => state.appUserId);
  const setAuthenticated = useUserStore((state) => state.setAuthenticated);
  const setUnauthenticated = useUserStore((state) => state.setUnauthenticated);
  const hasCompletedOnboarding = useMockAppStore((state) =>
    appUserId ? Boolean(state.data.preferences[appUserId]) : false,
  );

  useEffect(() => {
    let mounted = true;

    const syncSession = async (session: Session | null) => {
      if (!mounted) {
        return;
      }

      if (!session) {
        setUnauthenticated();
        return;
      }

      const authUser = toSessionUser(session);
      const nextAppUserId = userService.bootstrapFromSession(authUser);
      setAuthenticated(authUser, nextAppUserId);
    };

    supabase.auth.getSession().then(({ data }) => {
      void syncSession(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncSession(session);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [setAuthenticated, setUnauthenticated]);

  useEffect(() => {
    if (status === 'loading') {
      return;
    }

    const group = segments[0];
    const leaf = segments[segments.length - 1];
    const isPublicRoute = group === '(public)';
    const isOnboardingRoute = group === '(onboarding)';
    const isResetPasswordRoute = leaf === 'reset-password';

    if (status === 'unauthenticated') {
      if (!isPublicRoute) {
        router.replace('/login');
      }
      return;
    }

    if (!appUserId) {
      return;
    }

    if (!hasCompletedOnboarding && !isOnboardingRoute && !isResetPasswordRoute) {
      router.replace('/onboarding/1');
      return;
    }

    if (hasCompletedOnboarding && isOnboardingRoute) {
      router.replace('/home');
      return;
    }

    if (isPublicRoute && !isResetPasswordRoute) {
      router.replace(hasCompletedOnboarding ? '/home' : '/onboarding/1');
    }
  }, [appUserId, hasCompletedOnboarding, router, segments, status]);

  if (status === 'loading' || (status === 'authenticated' && !appUserId)) {
    return (
      <ThemeProvider>
        <YStack flex={1} justifyContent="center" alignItems="center" gap="$3" backgroundColor={palette.background}>
          <ActivityIndicator size="large" color={palette.accent} />
          <Text color={palette.text} fontSize={16} fontWeight="700">
            Loading Kitchen Assistant...
          </Text>
        </YStack>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <Stack screenOptions={rootStackScreenOptions} />
      <ToastHost />
    </ThemeProvider>
  );
}
