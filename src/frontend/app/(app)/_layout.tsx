import { Stack } from 'expo-router';
import { mainStackScreenOptions } from '../../navigation/routeOptions';

export default function AppRoutesLayout() {
  return <Stack screenOptions={mainStackScreenOptions} />;
}
