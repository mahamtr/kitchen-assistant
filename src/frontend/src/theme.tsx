import React, { createContext, useContext, useState, ReactNode } from 'react';
import { TamaguiProvider, Theme } from 'tamagui';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import tamaguiConfig from '../tamagui.config';
import { palette } from './components/ui/primitives';

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
                        <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
                            <StatusBar style={themeName === 'dark' ? 'light' : 'dark'} />
                            {children}
                        </SafeAreaView>
                    </SafeAreaProvider>
                </Theme>
            </TamaguiProvider>
        </ThemeContext.Provider>
    );
}

export default ThemeProvider;
