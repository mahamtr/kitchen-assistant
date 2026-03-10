import { Stack } from 'expo-router';
import { pushStackScreenOptions } from '../routeOptions';

export default function OnboardingRoutesLayout() {
  return (
    <Stack screenOptions={pushStackScreenOptions}>
      <Stack.Screen name="onboarding/[step]" options={pushStackScreenOptions} />
    </Stack>
  );
}
