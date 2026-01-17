import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import React, { useEffect, useMemo, useState } from 'react'
import { TamaguiProvider, Theme, Button, YStack, Text } from 'tamagui'
import tamaguiConfig from './tamagui.config'
import { Session } from '@supabase/supabase-js';
import { AuthScreen } from './src/screens/AuthScreen';
import { supabase } from './src/lib/supacase';

export default function App() {
  const [mode, setMode] = useState<'light' | 'dark'>('light')
  const [session, setSession] = useState<Session | null>(null)

   useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  const nextMode = useMemo(() => (mode === 'light' ? 'dark' : 'light'), [mode])

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme={mode}>
      {/* Theme wrapper ensures all tokens/components use the selected theme */}
      <Theme name={mode}>
        <YStack
          flex={1}
          justifyContent="center"
          alignItems="center"
          gap="$4"
          padding="$4"
          backgroundColor="$background"
        >
          <Text fontSize="$8" color="$color">
            Kitchen Manager
          </Text>

      {session ? <Home onLogout={() => supabase.auth.signOut()} /> : <AuthScreen />}

          <Text fontSize="$4" opacity={0.8} color="$color">
            Current theme: {mode}
          </Text>

          <Button
            onPress={() => setMode(nextMode)}
            size="$5"
            themeInverse={mode === 'dark'} // optional: makes button readable
          >
            Switch to {nextMode}
          </Button>
        </YStack>
      </Theme>
    </TamaguiProvider>
  );
}

function Home({ onLogout }: { onLogout: () => void }) {
  return (
    <YStack flex={1} justifyContent="center" alignItems="center" gap="$4" padding="$4">
      <Text fontSize="$8">Home</Text>
      <Button onPress={onLogout}>Logout</Button>
    </YStack>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
