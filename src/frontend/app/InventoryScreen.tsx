import React, { useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { YStack, XStack, ScrollView, Text, Button } from 'tamagui';
import InventoryGrid from './components/InventoryGrid';
import UseSoonCarousel from './components/UseSoonCarousel';
import AddEventModal from './components/AddEventModal';
import type { InventoryItem } from '../src/lib/types/inventory';
import { toClientItem } from '../src/lib/types/inventory';
import inventoryService from '../src/lib/services/inventoryService';
import supabase from '../src/lib/supacase';
import { useUserStore } from '../src/lib/store/userStore';

// Stateful inventory arrays will be loaded from the backend `/inventory/home` endpoint.
// The backend returns `{ useSoon, fridge, pantry }` (arrays of inventory items).

export default function InventoryScreen() {
    const { width } = useWindowDimensions();
    const isSmall = width < 900;
    const { UserId } = useUserStore();
    const [useSoonItems, setUseSoonItems] = useState<InventoryItem[]>([]);
    const [fridgeItems, setFridgeItems] = useState<InventoryItem[]>([]);
    const [pantryItems, setPantryItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadHome = async () => {
        setLoading(true);
        setError(null);
        try {
            const session = await supabase.auth.getSession();
            const userId = session?.data?.session?.user?.id || undefined;
            const res = await inventoryService.getHome(userId);

            setUseSoonItems(Array.isArray(res?.useSoon) ? res.useSoon.map(toClientItem) : []);
            setFridgeItems(Array.isArray(res?.fridge) ? res.fridge.map(toClientItem) : []);
            setPantryItems(Array.isArray(res?.pantry) ? res.pantry.map(toClientItem) : []);
        } catch (err: any) {
            console.warn('Failed to load inventory home:', err);
            setError(err?.message ?? String(err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let mounted = true;
        if (mounted) loadHome();
        return () => {
            mounted = false;
        };
    }, []);

    const handleItemPress = (it: InventoryItem) => {
        // TODO: navigate to item details or open a modal
        console.log('Pressed', it);
    };

    // Primary action handlers
    const [showAddModal, setShowAddModal] = useState(false);
    const onAdd = () => setShowAddModal(true);
    const onScan = () => console.log('Scan');
    const onFilters = () => console.log('Filters');

    return (
        <YStack flex={1} padding="$4" space="$4">
            {UserId + "Asdf"}
            {/* Web: top search bar */}
            {!isSmall && (
                <YStack>
                    <Text accessibilityRole="search" fontSize="$4" color="$color" borderWidth={1} borderColor="$borderColor" padding="$3" borderRadius="$3">
                        Search inventory...
                    </Text>
                </YStack>
            )}

            {/* Use Soon */}
            <UseSoonCarousel items={useSoonItems} onItemPress={handleItemPress} />

            {loading && (
                <Text fontSize="$3" color="$color">Loading inventory…</Text>
            )}
            {error && (
                <Text fontSize="$3" color="$red">Error: {error}</Text>
            )}

            {/* Main content area */}
            {isSmall ? (
                // Mobile: stacked sections
                <ScrollView contentContainerStyle={{ paddingBottom: 120 }} accessibilityLabel="Inventory scroll">
                    <InventoryGrid title="Fridge" items={fridgeItems} onItemPress={handleItemPress} />
                    <InventoryGrid title="Pantry" items={pantryItems} onItemPress={handleItemPress} />
                </ScrollView>
            ) : (
                // Web / large: two columns side-by-side
                <XStack gap="$4" alignItems="flex-start">
                    <YStack flex={1} minWidth={0}>
                        <InventoryGrid title="Fridge" items={fridgeItems} onItemPress={handleItemPress} />
                    </YStack>
                    <YStack flex={1} minWidth={0}>
                        <InventoryGrid title="Pantry" items={pantryItems} onItemPress={handleItemPress} />
                    </YStack>
                </XStack>
            )}

            {/* Action buttons: sticky bottom on mobile, centered below on web */}
            {isSmall ? (
                <YStack position="absolute" left={0} right={0} bottom={0} padding="$3" backgroundColor="$transparent">
                    <XStack justifyContent="space-around" alignItems="center">
                        <Button accessibilityLabel="Add item" onPress={onAdd}>
                            Add
                        </Button>
                        <Button accessibilityLabel="Scan item" onPress={onScan}>
                            Scan
                        </Button>
                        <Button accessibilityLabel="Filters" onPress={onFilters}>
                            Filters
                        </Button>
                    </XStack>
                </YStack>
            ) : (
                <XStack justifyContent="center" gap="$3" paddingTop="$2">
                    <Button accessibilityLabel="Add item" onPress={onAdd}>
                        Add
                    </Button>
                    <Button accessibilityLabel="Scan item" onPress={onScan}>
                        Scan
                    </Button>
                    <Button accessibilityLabel="Filters" onPress={onFilters}>
                        Filters
                    </Button>
                </XStack>
            )}

            <AddEventModal
                visible={showAddModal}
                onClose={() => setShowAddModal(false)}
                onCreated={() => {
                    // Refresh home data after creating an event
                    loadHome();
                }}
            />
        </YStack>
    );
}

// Accessibility & customization notes:
// - Replace the mock data with hooks that fetch real inventory.
// - For keyboard and screen-reader users, ensure proper focus management when opening item details.
// - Use Tamagui tokens for colors, spacing, and typography to match your theme.
