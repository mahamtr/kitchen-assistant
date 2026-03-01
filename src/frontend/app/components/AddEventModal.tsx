import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { YStack, XStack, Text, Button } from 'tamagui';
import inventoryService, { EventItemDto, CreateEventRequestDto } from '../../src/lib/services/inventoryService';
import { supabase } from '../../src/lib/supacase';

type Props = {
    visible: boolean;
    onClose: () => void;
    onCreated?: () => void;
};

export default function AddEventModal({ visible, onClose, onCreated }: Props) {
    const [type, setType] = useState<CreateEventRequestDto['type']>('ADD');
    const [items, setItems] = useState<EventItemDto[]>([{ name: '', quantity: { value: null, unit: null } }]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!visible) return null;

    const updateItem = (index: number, patch: Partial<EventItemDto>) => {
        setItems((cur) => cur.map((it, i) => (i === index ? { ...it, ...patch } : it)));
    };

    const addItem = () => setItems((cur) => [...cur, { name: '', quantity: { value: null, unit: null } }]);

    const removeItem = (index: number) => setItems((cur) => cur.filter((_, i) => i !== index));

    const submit = async () => {
        setLoading(true);
        const session = await supabase.auth.getSession();
        setError(null);
        try {
            const dto: CreateEventRequestDto = {
                userId: session?.data?.session?.user?.id || '',
                type,
                items: items.map((it) => ({
                    inventoryItemId: it.inventoryItemId ?? undefined,
                    name: it.name,
                    quantity: it.quantity,
                })),
                source: 'home',
            };

            await inventoryService.createEvent(dto);
            onCreated?.();
            onClose();
        } catch (err: any) {
            setError(err?.message ?? String(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <YStack position="absolute" left={0} right={0} top={0} bottom={0} backgroundColor="rgba(0,0,0,0.4)" justifyContent="center" alignItems="center" padding="$4">
            <YStack width={360} borderRadius="$4" backgroundColor="$background" padding="$4" elevation={6}>
                <Text fontSize="$6" fontWeight="700">Add Inventory Event</Text>

                <YStack space="$2" marginTop="$3">
                    <Text fontSize="$3">Type</Text>
                    <XStack gap="$2">
                        <Button size="$2" onPress={() => setType('ADD')} theme={type === 'ADD' ? 'active' : undefined}>Add</Button>
                        <Button size="$2" onPress={() => setType('USE')} theme={type === 'USE' ? 'active' : undefined}>Use</Button>
                        <Button size="$2" onPress={() => setType('DISCARD')} theme={type === 'DISCARD' ? 'active' : undefined}>Discard</Button>
                        <Button size="$2" onPress={() => setType('ADJUST')} theme={type === 'ADJUST' ? 'active' : undefined}>Adjust</Button>
                    </XStack>

                    <Text fontSize="$3" marginTop="$2">Items</Text>
                    {items.map((it, idx) => (
                        <YStack key={idx} paddingVertical="$2">
                            <TextInput
                                placeholder="Item name"
                                value={it.name}
                                onChangeText={(v) => updateItem(idx, { name: v })}
                                style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, borderRadius: 6 }}
                                accessibilityLabel={`Item ${idx + 1} name`}
                            />
                            <XStack gap="$2" marginTop="$2">
                                <TextInput
                                    placeholder="Qty"
                                    value={it.quantity?.value != null ? String(it.quantity.value) : ''}
                                    onChangeText={(v) => updateItem(idx, { quantity: { ...(it.quantity ?? { value: null, unit: null }), value: v === '' ? null : Number(v) } })}
                                    keyboardType="numeric"
                                    style={{ flex: 1, borderWidth: 1, borderColor: '#ccc', padding: 8, borderRadius: 6 }}
                                    accessibilityLabel={`Item ${idx + 1} quantity`}
                                />
                                <TextInput
                                    placeholder="Unit"
                                    value={it.quantity?.unit ?? ''}
                                    onChangeText={(v) => updateItem(idx, { quantity: { ...(it.quantity ?? { value: null, unit: null }), unit: v } })}
                                    style={{ flex: 1, borderWidth: 1, borderColor: '#ccc', padding: 8, borderRadius: 6 }}
                                    accessibilityLabel={`Item ${idx + 1} unit`}
                                />
                            </XStack>
                            <XStack justifyContent="flex-end">
                                <Button size="$2" onPress={() => removeItem(idx)} disabled={items.length === 1} theme="red" marginTop="$2">Remove</Button>
                            </XStack>
                        </YStack>
                    ))}

                    <Button onPress={addItem} size="$2">Add another item</Button>

                    {error ? <Text color="$red">{error}</Text> : null}

                    <XStack justifyContent="flex-end" gap="$2" marginTop="$3">
                        <Button onPress={onClose} size="$2" theme="alt">Cancel</Button>
                        <Button onPress={submit} disabled={loading} size="$2">{loading ? 'Saving…' : 'Create'}</Button>
                    </XStack>
                </YStack>
            </YStack>
        </YStack>
    );
}

// Notes:
// - This is a simple modal overlay. Replace with Tamagui Dialog or Portal for more advanced behavior.
// - Accessibility: inputs have labels; ensure focus is managed when opening/closing for screen readers.
