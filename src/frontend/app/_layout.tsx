import React from 'react';
import { Slot } from 'expo-router';
import { TamaguiProvider, Theme, YStack } from 'tamagui';
import tamaguiConfig from '../tamagui.config';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <TamaguiProvider config={tamaguiConfig}>
      <Theme name="light">
        <SafeAreaProvider>
          <SafeAreaView style={{ flex: 1 }}>
            <YStack flex={1} px="$4" py="$3" backgroundColor="$background">
              <StatusBar style="auto" />
              <Slot />
            </YStack>
          </SafeAreaView>
        </SafeAreaProvider>
      </Theme>
    </TamaguiProvider>
  );
}
