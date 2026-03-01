import React from 'react';
import { useWindowDimensions } from 'react-native';
import { YStack, XStack, Text, Button } from 'tamagui';
import type { InventoryItem } from '../../src/lib/types/inventory';

type Props = {
    title: string;
    items: InventoryItem[];
    // Optional callback when item pressed
    onItemPress?: (item: InventoryItem) => void;
};

export default function InventoryGrid({ title, items, onItemPress }: Props) {
    const { width } = useWindowDimensions();
    // Responsive columns inside the grid: 2 columns on narrow screens, 1 column on wide column containers
    const columns = width < 700 ? 2 : 1;
    const cardWidth = `${100 / columns - 2}%`;

    return (
        <YStack space="$3" flex={1} padding="$3">
            <Text accessibilityRole="header" fontSize="$6" fontWeight="600">
                {title}
            </Text>

            <XStack flexWrap="wrap" alignItems="flex-start" gap="$3">
                {items.map((it) => {
                    const qty = it.quantity?.value ?? 1;
                    const expires = it.dates?.expiresAt;
                    return (
                        <YStack
                            key={it._id ?? it.name}
                            width={cardWidth}
                            borderWidth={1}
                            borderColor="$borderColor"
                            borderRadius="$3"
                            padding="$3"
                            accessibilityRole="button"
                            accessibilityLabel={`${it.name}, quantity ${qty}`}
                            onPress={() => onItemPress?.(it)}
                        >
                            <Text fontSize="$4" fontWeight="700">
                                {it.name}
                            </Text>
                            <Text fontSize="$3" color="$color">
                                Qty: {qty}
                            </Text>
                            {expires ? (
                                <Text fontSize="$2" color="$color" marginTop="$2">
                                    Expires: {new Date(expires).toLocaleDateString()}
                                </Text>
                            ) : null}

                            <Button size="$2" marginTop="$3" onPress={() => onItemPress?.(it)}>
                                View
                            </Button>
                        </YStack>
                    );
                })}
            </XStack>
        </YStack>
    );
}

// Notes:
// - Customize card appearance using Tamagui tokens (colors, spacing) to match your theme.
// - Accessibility: each card is treated as a button with an accessible label.
