import { Stack } from 'expo-router';
import { rootStackScreenOptions } from '../routeOptions';

export default function PublicRoutesLayout() {
  return <Stack screenOptions={rootStackScreenOptions} />;
}
