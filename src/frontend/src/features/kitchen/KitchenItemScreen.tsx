import { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Paragraph, Text, XStack, YStack } from 'tamagui';
import { AppTabBar } from '../../components/layout/AppScaffold';
import {
  ActionButton,
  AppIcon,
  ConfirmDialog,
  InfoLine,
  SearchField,
  SectionCard,
  TextField,
  palette,
} from '../../components/ui/primitives';
import { useKeyboardMetrics } from '../../hooks/useKeyboardVisible';
import { kitchenService } from '../../lib/services';
import { useUiStore } from '../../lib/store/uiStore';
import type { InventoryItemDetailResponse, KitchenView } from '../../lib/types/contracts';
import type { InventoryLocation, InventoryStatus } from '../../lib/types/entities';

const VIEW_LABEL: Record<KitchenView, string> = {
  'to-buy': 'To Buy',
  'in-stock': 'In Stock',
  expiring: 'Expiring',
};

function Divider() {
  return <YStack height={1} backgroundColor={palette.border} />;
}

function quantitySummary(value: string, unit: string) {
  return `${value || '0'} ${unit || 'item'}`.trim();
}

function dayDiff(dateString?: string | null) {
  if (!dateString) {
    return 'Unknown';
  }

  const today = new Date();
  const target = new Date(dateString);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const end = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));

  if (diff <= 0) {
    return 'Today';
  }

  return `${diff}d`;
}

function sourceLabel(source?: string) {
  if (source === 'ocr') {
    return 'From OCR receipt';
  }

  if (source === 'recipe') {
    return 'From recipe cooking';
  }

  return 'From To Buy (Weekly Plan)';
}

export default function KitchenItemScreen() {
  const router = useRouter();
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const pushToast = useUiStore((state) => state.pushToast);
  const [detail, setDetail] = useState<InventoryItemDetailResponse | null>(null);
  const [previewNames, setPreviewNames] = useState<string[]>([]);
  const [quantityValue, setQuantityValue] = useState('');
  const [quantityUnit, setQuantityUnit] = useState('');
  const [location, setLocation] = useState<InventoryLocation>('pantry');
  const [status, setStatus] = useState<InventoryStatus>('fresh');
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { keyboardHeight, keyboardVisible } = useKeyboardMetrics();

  useEffect(() => {
    const load = async () => {
      try {
        const nextDetail = await kitchenService.getInventoryItem(itemId);
        setDetail(nextDetail);
        setQuantityValue(String(nextDetail.item.quantity?.value ?? ''));
        setQuantityUnit(nextDetail.item.quantity?.unit ?? '');
        setLocation(nextDetail.item.location);
        setStatus(nextDetail.item.status);

        const previewView: KitchenView =
          nextDetail.item.status === 'use_soon' || nextDetail.item.status === 'expired' ? 'expiring' : 'in-stock';
        const previewList = await kitchenService.getInventoryItems(previewView);
        setPreviewNames(previewList.items.slice(0, 5).map((item) => item.name));
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : 'Unable to load inventory item.');
      }
    };

    void load();
  }, [itemId]);

  const previewView = useMemo<KitchenView>(() => {
    if (!detail) {
      return 'in-stock';
    }

    return detail.item.status === 'use_soon' || detail.item.status === 'expired' ? 'expiring' : 'in-stock';
  }, [detail]);

  const save = async () => {
    if (!detail) {
      return;
    }
    await kitchenService.patchInventoryItem(detail.item.id, {
      quantity: {
        value: Number(quantityValue || 0),
        unit: quantityUnit || null,
      },
      location,
      status,
    });
    pushToast({
      title: 'Kitchen item updated',
      description: `${detail.item.name} was saved with the new details.`,
      tone: 'success',
    });
    router.back();
  };

  if (!detail) {
    return (
      <YStack flex={1} backgroundColor={palette.background} justifyContent="center" alignItems="center" padding={20}>
        <Text color={error ? palette.danger : palette.text} fontSize={14} fontWeight="700">
          {error ?? 'Loading item detail...'}
        </Text>
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor={palette.background}>
        <YStack paddingHorizontal={20} paddingTop={20} paddingBottom={12} gap={6}>
          <Text color={palette.text} fontSize={34} lineHeight={36} fontWeight="700">
            Kitchen Hub
          </Text>
          <Paragraph color={palette.textSecondary} fontSize={14} fontStyle="italic">
            Tap any item to open the edit sheet
          </Paragraph>
        </YStack>

        <YStack flex={1}>
          <YStack paddingHorizontal={20} gap={10}>
            <SearchField value="" onChangeText={() => {}} placeholder="Search items..." />
            <Paragraph color={palette.textSecondary} fontSize={12}>
              {VIEW_LABEL[previewView]} ({previewNames.length || 1} items) - scrollable full list
            </Paragraph>
            <SectionCard>
              <YStack gap={0}>
                {(previewNames.length ? previewNames : [detail.item.name]).map((name, index) => (
                  <YStack key={`${name}-${index}`}>
                    {index > 0 ? <Divider /> : null}
                    <XStack justifyContent="space-between" alignItems="center" paddingVertical={12}>
                      <Text color={name === detail.item.name ? palette.textStrong : palette.text} fontSize={14} fontWeight={name === detail.item.name ? '700' : '500'}>
                        {name}
                      </Text>
                      <Text color={palette.textStrong} fontSize={13} fontWeight="700">
                        {name === detail.item.name
                          ? quantitySummary(quantityValue, quantityUnit)
                          : quantitySummary(String(detail.item.quantity?.value ?? ''), detail.item.quantity?.unit ?? '')}
                      </Text>
                    </XStack>
                  </YStack>
                ))}
              </YStack>
            </SectionCard>
          </YStack>

          <YStack position="absolute" top={0} right={0} bottom={0} left={0} backgroundColor={palette.overlay} />

          <YStack
            position="absolute"
            left={0}
            right={0}
            bottom={keyboardHeight}
            maxHeight="82%"
            backgroundColor={palette.surface}
            borderTopLeftRadius={18}
            borderTopRightRadius={18}
            borderWidth={1}
            borderColor={palette.border}
          >
            <ScrollView
              automaticallyAdjustKeyboardInsets
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                paddingTop: 10,
                paddingHorizontal: 14,
                paddingBottom: 14,
              }}
            >
              <YStack gap={10}>
                <YStack alignItems="center">
                  <YStack width={48} height={4} borderRadius={999} backgroundColor={palette.border} />
                </YStack>

                <XStack justifyContent="space-between" alignItems="center" gap={10}>
                  <Text color={palette.textStrong} fontSize={28} fontWeight="700" flex={1}>
                    {detail.item.name}
                  </Text>
                  <ActionButton variant="ghost" size="sm" onPress={() => router.back()}>
                    <AppIcon name="close" size={16} color={palette.textMuted} />
                  </ActionButton>
                </XStack>

                <Text color={palette.primary} fontSize={13} fontWeight="700">
                  {sourceLabel(detail.item.source)}
                </Text>

                <YStack gap={6}>
                  <Text color={palette.textSecondary} fontSize={12} fontWeight="700">
                    Quantity & Unit
                  </Text>
                  <XStack gap={10}>
                    <YStack flex={1}>
                      <TextField label="Quantity" value={quantityValue} onChangeText={setQuantityValue} placeholder="300" />
                    </YStack>
                    <YStack flex={1}>
                      <TextField label="Unit" value={quantityUnit} onChangeText={setQuantityUnit} placeholder="g" />
                    </YStack>
                  </XStack>
                </YStack>

                <InfoLine label="Expiry" value={dayDiff(detail.item.dates?.expiresAt)} valueTone="warning" />
                <InfoLine label="Location" value={location[0].toUpperCase() + location.slice(1)} />
                <InfoLine label="Status" value={status.replace('_', ' ')} />

                <YStack gap={8}>
                  <ActionButton onPress={save}>Save Changes</ActionButton>
                  <ActionButton
                    variant="success"
                    onPress={async () => {
                      setStatus('fresh');
                      await kitchenService.patchInventoryItem(detail.item.id, {
                        status: 'fresh',
                      });
                      pushToast({
                        title: 'Item refreshed',
                        description: `${detail.item.name} is marked as fresh.`,
                        tone: 'success',
                      });
                      router.back();
                    }}
                  >
                    Mark Purchased
                  </ActionButton>
                  <ActionButton variant="danger" onPress={() => setShowDiscardConfirm(true)}>
                    Remove Item
                  </ActionButton>
                </YStack>
              </YStack>
            </ScrollView>
          </YStack>
        </YStack>

        {!keyboardVisible ? <AppTabBar activeTab="kitchen" /> : null}

        <ConfirmDialog
          visible={showDiscardConfirm}
          title="Remove this item?"
          description="This creates a DISCARD inventory event and removes the item from the current inventory."
          confirmLabel="Remove"
          onCancel={() => setShowDiscardConfirm(false)}
          onConfirm={async () => {
            await kitchenService.discardItem(detail.item.id);
            pushToast({
              title: 'Item discarded',
              description: `${detail.item.name} was removed from current inventory.`,
              tone: 'warning',
            });
            router.replace('/kitchen/expiring');
          }}
        />
    </YStack>
  );
}
