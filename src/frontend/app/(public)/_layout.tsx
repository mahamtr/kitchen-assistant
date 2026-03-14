import { Stack } from 'expo-router';
import { rootStackScreenOptions } from '../../navigation/routeOptions';

export default function PublicRoutesLayout() {
  return <Stack screenOptions={rootStackScreenOptions} />;
}
