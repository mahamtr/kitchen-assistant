import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { YStack, Text } from 'tamagui';
import { useAuthStore } from '../src/lib/store/authStore';

export default function IndexRoute() {
  const router = useRouter();
  const { session, isInitializing } = useAuthStore();

  useEffect(() => {
    if (isInitializing) return;
    router.replace(session ? '/home' : '/login');
  }, [isInitializing, session, router]);

  return (
    <YStack flex={1} justifyContent="center" alignItems="center">
      <Text fontSize="$6">Redirecting…</Text>
    </YStack>
  );
}
