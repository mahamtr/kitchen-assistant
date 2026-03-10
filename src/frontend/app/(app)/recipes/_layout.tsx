import { Stack } from 'expo-router';
import { mainStackScreenOptions, pushStackScreenOptions } from '../../routeOptions';

export default function RecipesRoutesLayout() {
  return (
    <Stack screenOptions={mainStackScreenOptions}>
      <Stack.Screen name="index" options={mainStackScreenOptions} />
      <Stack.Screen name="[recipeId]" options={pushStackScreenOptions} />
      <Stack.Screen name="chat/[generationId]" options={pushStackScreenOptions} />
    </Stack>
  );
}
