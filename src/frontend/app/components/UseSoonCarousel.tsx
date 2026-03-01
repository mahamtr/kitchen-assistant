import React from 'react';
import { useWindowDimensions } from 'react-native';
import { ScrollView } from 'react-native';
import { YStack, XStack, Text, Button } from 'tamagui';
import type { InventoryItem } from '../../src/lib/types/inventory';

type Props = {
    items: InventoryItem[];
    onItemPress?: (it: InventoryItem) => void;
};

export default function UseSoonCarousel({ items, onItemPress }: Props) {
    const { width } = useWindowDimensions();
    const isSmall = width < 900; // mobile/tablet breakpoint

    if (items.length === 0) return null;

    if (isSmall) {
        // Mobile: horizontally scrollable carousel
        return (
            <YStack padding="$3">
                <Text fontSize="$6" fontWeight="700">
                    Use Soon
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="Use Soon carousel">
                    <XStack space="$3" paddingVertical="$2">
                        {items.map((it) => (
                            <YStack
                                key={it._id ?? it.name}
                                width={220}
                                borderRadius="$4"
                                padding="$3"
                                backgroundColor="$background"
                                borderWidth={1}
                                borderColor="$borderColor"
                                accessibilityRole="button"
                                accessibilityLabel={`Urgent: ${it.name}`}
                                onPress={() => onItemPress?.(it)}
                            >
                                <Text fontSize="$5" fontWeight="800">
                                    {it.name}
                                </Text>
                                <Text fontSize="$3">Qty: {it.quantity?.value ?? 1}</Text>
                                {it.dates?.expiresAt ? (
                                    <Text fontSize="$2" color="$color">
                                        Expires: {new Date(it.dates.expiresAt as string).toLocaleDateString()}
                                    </Text>
                                ) : null}
                                <Text
                                    marginTop="$2"
                                    fontSize="$2"
                                    paddingHorizontal="$2"
                                    paddingVertical="$1"
                                    borderRadius="$2"
                                    backgroundColor="$danger"
                                    color="$white"
                                >
                                    Urgent
                                </Text>
                            </YStack>
                        ))}
                    </XStack>
                </ScrollView>
            </YStack>
        );
    }

    // Web / large: wide banner
    return (
        <YStack padding="$3" borderRadius="$4" borderWidth={1} borderColor="$borderColor" backgroundColor="$background">
            <Text fontSize="$6" fontWeight="700">
                Use Soon
            </Text>
            <XStack justifyContent="space-between" alignItems="center" paddingTop="$3">
                <XStack flex={1} gap="$3">
                    {items.slice(0, 4).map((it) => (
                        <YStack key={it._id} flex={1} padding="$2" borderRadius="$3" backgroundColor="$bg2">
                            <Text fontWeight="700">{it.name}</Text>
                            <Text fontSize="$2">Qty: {it.quantity?.value ?? 1}</Text>
                        </YStack>
                    ))}
                </XStack>
                <Button onPress={() => onItemPress?.(items[0])} marginLeft="$3">
                    Review
                </Button>
            </XStack>
        </YStack>
    );
}

// Notes:
// - Adjust `isSmall` breakpoint to match your design tokens.
// - The banner shows up to 4 items; customize to show more or a carousel.
