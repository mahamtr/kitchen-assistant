import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { YStack, Button, Text } from 'tamagui';
import supabase from '../src/lib/supacase';
import api from '../src/lib/api';
import { useThemeContext } from '../src/theme';

export async function signOutAndRoute(signOut: () => Promise<{ error: { message: string } | null }>, replace: (path: string) => void) {
  const { error } = await signOut();
  if (error) return error.message;
  replace('/login');
  return null;
}

export default function HomeScreen() {
  const router = useRouter();
  const { themeName, toggleTheme } = useThemeContext();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace('/login');
    });

    (async () => {
      try {
        const res = await api.fetch('/');
        console.log('Backend response:', res);
      } catch (err) {
        console.warn('Backend request failed:', err);
      }
    })();
  }, []);

  const signOut = async () => {
    setSignOutError(null);
    setIsSigningOut(true);

    const errorMessage = await signOutAndRoute(() => supabase.auth.signOut(), router.replace);

    setIsSigningOut(false);

    if (errorMessage) {
      setSignOutError(errorMessage);
    }
  };

  return (
    <YStack flex={1} justifyContent="center" alignItems="center" gap="$4" padding="$4">
      <Text fontSize="$8">Home</Text>
      <Button onPress={signOut} disabled={isSigningOut}>
        {isSigningOut ? 'Logging out…' : 'Logout'}
      </Button>
      {signOutError ? <Text color="$orange10">{signOutError}</Text> : null}
      <Button onPress={toggleTheme} themeInverse>
        Switch to {themeName === 'light' ? 'Dark' : 'Light'} Mode
      </Button>
    </YStack>
  );
}
