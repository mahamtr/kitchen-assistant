import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { Text, YStack } from 'tamagui';
import ThemeProvider from '../src/theme';
import { useUserStore } from '../src/lib/store/userStore';
import ToastHost from '../src/components/ui/ToastHost';
import { palette } from '../src/components/ui/primitives';
import { authService } from '../src/lib/services';
import { rootStackScreenOptions } from '../navigation/routeOptions';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const status = useUserStore((state) => state.status);
  const appUserId = useUserStore((state) => state.appUserId);
  const setUnauthenticated = useUserStore((state) => state.setUnauthenticated);
  const hasCompletedOnboarding = useUserStore(
    (state) => state.hasCompletedOnboarding,
  );

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      try {
        await authService.restoreSession();
      } catch {
        if (mounted) {
          setUnauthenticated();
        }
      }
    };

    void loadSession();

    return () => {
      mounted = false;
    };
  }, [setUnauthenticated]);

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
