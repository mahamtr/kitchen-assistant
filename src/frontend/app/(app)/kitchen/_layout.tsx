import { Stack } from 'expo-router';
import { mainStackScreenOptions, pushStackScreenOptions, sheetStackScreenOptions } from '../../routeOptions';

export default function KitchenRoutesLayout() {
  return (
    <Stack screenOptions={mainStackScreenOptions}>
      <Stack.Screen name="to-buy" options={mainStackScreenOptions} />
      <Stack.Screen name="in-stock" options={mainStackScreenOptions} />
      <Stack.Screen name="expiring" options={mainStackScreenOptions} />
      <Stack.Screen name="ocr/review" options={pushStackScreenOptions} />
      <Stack.Screen name="item/[itemId]" options={sheetStackScreenOptions} />
      <Stack.Screen name="ocr/item/[lineId]" options={sheetStackScreenOptions} />
    </Stack>
  );
}
