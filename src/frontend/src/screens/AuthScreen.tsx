import React, { useState } from 'react'
import { Button, Input, Text, YStack } from 'tamagui'
import { supabase } from '../lib/supacase'

export function AuthScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signUp = async () => {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (error) setError(error.message)
  }

  const signIn = async () => {
    setLoading(true)
    setError(null)
    const { error, data } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setError(error.message)
    const token = data.session?.access_token;
    console.log("Access Token:", token);

  }

  return (
    <YStack flex={1} justifyContent="center" padding="$4" gap="$3">
      <Text fontSize="$8">Sign in</Text>

      <Input
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <Input
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error ? <Text color="$red10">{error}</Text> : null}

      <Button onPress={signIn} disabled={loading || !email || !password}>
        {loading ? 'Loading...' : 'Sign in'}
      </Button>

      <Button variant="outlined" onPress={signUp} disabled={loading || !email || !password}>
        Create account
      </Button>
    </YStack>
  )
}