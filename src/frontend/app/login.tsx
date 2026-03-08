import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { YStack, Button, Text } from 'tamagui';
import type { Provider } from '@supabase/supabase-js';
import { authProviders, signInWithProvider } from '../src/lib/auth';
import { useAuthStore } from '../src/lib/store/authStore';
import { shouldRedirectLoginToHome } from '../src/lib/authRouting';

export default function LoginScreen() {
  const router = useRouter();
  const { session } = useAuthStore();
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (shouldRedirectLoginToHome(session)) router.replace('/home');
  }, [session, router]);

  const handleOAuthSignIn = async (provider: Provider) => {
    setMessage(null);
    setLoadingProvider(provider);

    const result = await signInWithProvider(provider);

    if (result?.error) {
      const isCancelled = (result as { resultType?: string }).resultType === 'cancel';
      setMessage(isCancelled ? 'Sign-in cancelled.' : result.error.message);
    }

    setLoadingProvider(null);
  };

  return (
    <YStack flex={1} justifyContent="center" padding="$5" gap="$4">
      <YStack gap="$2" marginBottom="$2">
        <Text fontSize="$10" fontWeight="700">
          Kitchen Assistant
        </Text>
        <Text color="$gray10">Sign in to manage your kitchen inventory.</Text>
      </YStack>

      {authProviders.map((provider) => (
        <Button
          key={provider.key}
          onPress={() => handleOAuthSignIn(provider.key)}
          disabled={loadingProvider !== null}
        >
          {loadingProvider === provider.key
            ? `Connecting to ${provider.label}...`
            : `Continue with ${provider.label}`}
        </Button>
      ))}

      {message ? <Text color="$orange10">{message}</Text> : null}
    </YStack>
  );
}
