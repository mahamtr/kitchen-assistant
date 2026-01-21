import React from 'react';
import { Slot } from 'expo-router';
import ThemeProvider from '../src/theme';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <Slot />
    </ThemeProvider>
  );
}
