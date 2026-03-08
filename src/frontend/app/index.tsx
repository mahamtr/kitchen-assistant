import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { YStack, Text } from 'tamagui';
import { useAuthStore } from '../src/lib/store/authStore';
import { getIndexRedirectRoute } from '../src/lib/authRouting';

export default function IndexRoute() {
  const router = useRouter();
  const { session, isInitializing } = useAuthStore();

  useEffect(() => {
    const redirect = getIndexRedirectRoute(isInitializing, session);
    if (redirect) router.replace(redirect);
  }, [isInitializing, session, router]);

  return (
    <YStack flex={1} justifyContent="center" alignItems="center">
      <Text fontSize="$6">Redirecting…</Text>
    </YStack>
  );
}
