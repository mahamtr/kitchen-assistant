import React, { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { YStack, Text } from 'tamagui'
import supabase from '../src/lib/supacase'

export default function IndexRoute() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let mounted = true
        supabase.auth.getSession().then(({ data }) => {
            if (!mounted) return
            if (data.session) router.replace('/home')
            else router.replace('/login')
        }).finally(() => {
            if (mounted) setLoading(false)
        })

        return () => {
            mounted = false
        }
    }, [])

    return (
        <YStack flex={1} justifyContent="center" alignItems="center">
            <Text fontSize="$6">{loading ? 'Redirecting…' : 'Redirecting…'}</Text>
        </YStack>
    )
}
