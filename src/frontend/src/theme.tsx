import React, { createContext, useContext, useState, ReactNode } from 'react';
import { TamaguiProvider, Theme, YStack } from 'tamagui';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import tamaguiConfig from '../tamagui.config';

type ThemeName = 'light' | 'dark';

type ThemeContextType = {
    themeName: ThemeName;
    toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType>({
    themeName: 'light',
    toggleTheme: () => { },
});

export const useThemeContext = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [themeName, setThemeName] = useState<ThemeName>('light');

    const toggleTheme = () => setThemeName((t) => (t === 'light' ? 'dark' : 'light'));

    return (
        <ThemeContext.Provider value={{ themeName, toggleTheme }}>
            <TamaguiProvider config={tamaguiConfig}>
                <Theme name={themeName}>
                    <SafeAreaProvider>
                        <SafeAreaView style={{ flex: 1 }}>
                            <YStack flex={1} px="$4" py="$3" backgroundColor="$background">
                                <StatusBar style={themeName === 'dark' ? 'light' : 'auto'} />
                                {children}
                            </YStack>
                        </SafeAreaView>
                    </SafeAreaProvider>
                </Theme>
            </TamaguiProvider>
        </ThemeContext.Provider>
    );
}

export default ThemeProvider;
