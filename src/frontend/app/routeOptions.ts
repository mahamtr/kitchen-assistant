import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

export const rootStackScreenOptions = {
  headerShown: false,
  animation: 'fade',
  animationDuration: 160,
} satisfies NativeStackNavigationOptions;

export const mainStackScreenOptions = {
  headerShown: false,
  animation: 'fade',
  animationDuration: 160,
} satisfies NativeStackNavigationOptions;

export const pushStackScreenOptions = {
  headerShown: false,
  animation: 'slide_from_right',
  animationTypeForReplace: 'push',
} satisfies NativeStackNavigationOptions;

export const sheetStackScreenOptions = {
  headerShown: false,
  animation: 'slide_from_bottom',
  presentation: 'modal',
  gestureEnabled: true,
} satisfies NativeStackNavigationOptions;
