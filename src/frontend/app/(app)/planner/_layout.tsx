import { Stack } from 'expo-router';
import { mainStackScreenOptions, pushStackScreenOptions } from '../../routeOptions';

export default function PlannerRoutesLayout() {
  return (
    <Stack screenOptions={mainStackScreenOptions}>
      <Stack.Screen name="index" options={mainStackScreenOptions} />
      <Stack.Screen name="chat" options={pushStackScreenOptions} />
    </Stack>
  );
}
