import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { YStack, Text } from 'tamagui';
import { useUserStore } from '../src/lib/store/userStore';
import { palette } from '../src/components/ui/primitives';

export default function IndexRoute() {
  const router = useRouter();
  const status = useUserStore((state) => state.status);
  const hasCompletedOnboarding = useUserStore(
    (state) => state.hasCompletedOnboarding,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading') {
      return;
    }

    if (status === 'unauthenticated') {
      router.replace('/login');
      setLoading(false);
      return;
    }

    router.replace(hasCompletedOnboarding ? '/home' : '/onboarding/1');
    setLoading(false);
  }, [hasCompletedOnboarding, router, status]);

  return (
    <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={palette.background}>
      <Text fontSize="$6">{loading ? 'Redirecting…' : 'Redirecting…'}</Text>
    </YStack>
  );
}
