import React, { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { OAuthProvider } from '@supabase/supabase-js';
import { YStack, Button, Text } from 'tamagui';
import supabase from '../src/lib/supacase';

function parseAuthCode(url: string): string | null {
  const parsed = Linking.parse(url);
  if (typeof parsed.queryParams?.code === 'string') {
    return parsed.queryParams.code;
  }

  const hash = url.split('#')[1];
  if (!hash) return null;

  const hashParams = new URLSearchParams(hash);
  return hashParams.get('code');
}

export default function LoginScreen() {
  const router = useRouter();
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const mobileRedirectTo = useMemo(() => AuthSession.makeRedirectUri({ path: 'auth/callback' }), []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/home');
    });
  }, [router]);

  const loginWithProvider = async (provider: OAuthProvider) => {
    setLoadingProvider(provider);
    setBanner(null);

    try {
      if (Platform.OS === 'web') {
        const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/home` : undefined;
        const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
        if (error) throw error;
        return;
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: mobileRedirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('Unable to start OAuth flow.');

      const result = await AuthSession.startAsync({ authUrl: data.url, returnUrl: mobileRedirectTo });

      if (result.type === 'dismiss' || result.type === 'cancel') {
        setBanner('Sign-in cancelled.');
        return;
      }

      if (result.type !== 'success' || !result.url) {
        setBanner('Unable to complete sign-in. Please try again.');
        return;
      }

      const code = parseAuthCode(result.url);
      if (!code) {
        setBanner('Sign-in response was incomplete. Please try again.');
        return;
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) throw exchangeError;

      router.replace('/home');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed. Please try again.';
      setBanner(message);
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <YStack flex={1} justifyContent="center" padding="$4" gap="$4">
      <YStack gap="$2">
        <Text fontSize="$10" fontWeight="700">
          Kitchen Assistant
        </Text>
        <Text color="$gray10">Sign in to continue managing your kitchen smarter.</Text>
      </YStack>

      {banner ? (
        <YStack backgroundColor="$red3" borderColor="$red7" borderWidth={1} borderRadius="$4" padding="$3">
          <Text color="$red10">{banner}</Text>
        </YStack>
      ) : null}

      <Button
        onPress={() => loginWithProvider('google')}
        disabled={!!loadingProvider}
        backgroundColor="$blue9"
        color="white"
      >
        {loadingProvider === 'google' ? 'Loading...' : 'Continue with Google'}
      </Button>

      <Button onPress={() => loginWithProvider('apple')} disabled={!!loadingProvider}>
        {loadingProvider === 'apple' ? 'Loading...' : 'Continue with Apple'}
      </Button>

      <Button onPress={() => loginWithProvider('facebook')} disabled={!!loadingProvider}>
        {loadingProvider === 'facebook' ? 'Loading...' : 'Continue with Facebook'}
      </Button>
    </YStack>
  );
}
