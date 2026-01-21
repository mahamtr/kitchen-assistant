import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { YStack, Button, Text } from 'tamagui';
import supabase from '../src/lib/supacase';
import { useThemeContext } from '../src/theme';

export default function HomeScreen() {
  const router = useRouter();
  const { themeName, toggleTheme } = useThemeContext();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace('/login');
    });
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  return (
    <YStack flex={1} justifyContent="center" alignItems="center" gap="$4" padding="$4">
      <Text fontSize="$8">Home</Text>
      <Button onPress={signOut}>Logout</Button>
      <Button onPress={toggleTheme} themeInverse>
        Switch to {themeName === 'light' ? 'Dark' : 'Light'} Mode
      </Button>
    </YStack>
  );
}
