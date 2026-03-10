import { Stack } from 'expo-router';
import { mainStackScreenOptions } from '../routeOptions';

export default function AppRoutesLayout() {
  return <Stack screenOptions={mainStackScreenOptions} />;
}
