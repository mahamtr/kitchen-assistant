import React, { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { YStack, Input, Button, Text } from 'tamagui'
import supabase from '../src/lib/supacase'

export default function LoginScreen() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            if (data.session) router.replace('/home')
        })
    }, [])

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
        if (error) return setError(error.message)
        if (data.session) router.replace('/home')
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
