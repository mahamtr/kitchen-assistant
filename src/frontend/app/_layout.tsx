import React from 'react'
import { Slot } from 'expo-router'
import { TamaguiProvider, Theme } from 'tamagui'
import tamaguiConfig from '../tamagui.config'
import { StatusBar } from 'expo-status-bar'

export default function RootLayout() {
    return (
        <TamaguiProvider config={tamaguiConfig}>
            <Theme name="light">
                <StatusBar style="auto" />
                <Slot />
            </Theme>
        </TamaguiProvider>
    )
}
