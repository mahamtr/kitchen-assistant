import { useEffect, useMemo, useState } from 'react';
import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Paragraph, Text, XStack, YStack } from 'tamagui';
import AppScaffold from '../../components/layout/AppScaffold';
import {
  ActionButton,
  EmptyState,
  SearchField,
  SectionCard,
  SectionHeading,
  StatChip,
  StickyFooter,
  palette,
} from '../../components/ui/primitives';
import { kitchenService } from '../../lib/services';
import { useUiStore } from '../../lib/store/uiStore';
import type {
  GroceryListResponse,
  InventoryListResponse,
  InventorySummaryResponse,
  KitchenView,
} from '../../lib/types/contracts';
import type { InventoryItem } from '../../lib/types/entities';
import { formatMeasurement } from '../../lib/utils/measurement';

const VIEW_TO_LABEL: Record<KitchenView, string> = {
  'to-buy': 'To Buy',
  'in-stock': 'In Stock',
  expiring: 'Expiring',
};

function Divider() {
  return <YStack height={1} backgroundColor={palette.border} />;
}

function quantityLabel(value: number | null | undefined, unit: string | null | undefined) {
  return formatMeasurement(value, unit, '1 piece');
}

function dayDiff(dateString?: string | null) {
  if (!dateString) {
    return null;
  }

  const today = new Date();
  const target = new Date(dateString);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const end = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

function inventoryHint(item: InventoryItem) {
  if (item.replenishmentState === 'low_stock' || item.replenishmentState === 'out_of_stock') {
    return { text: 'low', color: palette.danger };
  }

  const daysLeft = item.freshness?.estimatedDaysLeft ?? dayDiff(item.dates?.expiresAt);

  if (daysLeft == null) {
    return {
      text:
        item.freshnessState === 'expired'
          ? 'expired'
          : item.freshnessState === 'use_soon'
            ? 'soon'
            : item.freshnessState,
      color:
        item.freshnessState === 'expired'
          ? palette.danger
          : item.freshnessState === 'use_soon'
            ? palette.warning
            : palette.success,
    };
  }

  if (daysLeft <= 0) {
    return { text: 'today', color: palette.danger };
  }

  return {
    text: `${daysLeft}d`,
    color: daysLeft <= 3 ? palette.warning : palette.success,
  };
}

export default function KitchenHubScreen({ view }: { view: KitchenView }) {
  const router = useRouter();
  const pushToast = useUiStore((state) => state.pushToast);
  const [activeView, setActiveView] = useState<KitchenView>(view);
  const [summary, setSummary] = useState<InventorySummaryResponse | null>(null);
  const [groceryList, setGroceryList] = useState<GroceryListResponse | null>(null);
  const [inventoryList, setInventoryList] = useState<InventoryListResponse | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (nextSearch = search) => {
    try {
      setLoading(true);
      setError(null);
      const [nextSummary, nextGrocery, nextInventory] = await Promise.all([
        kitchenService.getSummary(),
        kitchenService.getCurrentGroceryList(),
        activeView === 'to-buy' ? Promise.resolve(null) : kitchenService.getInventoryItems(activeView, nextSearch),
      ]);
      setSummary(nextSummary);
      setGroceryList(nextGrocery);
      setInventoryList(nextInventory);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to load kitchen view.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setActiveView(view);
  }, [view]);

  useEffect(() => {
    void load();
  }, [activeView]);

  const navigateToView = (targetView: KitchenView) => {
    if (targetView === activeView) {
      return;
    }

    setSelectedIds([]);
    setActiveView(targetView);
  };

  const filteredToBuyItems = useMemo(() => {
    const normalized = search.toLowerCase().trim();
    const items = groceryList?.items.filter((item) => item.status === 'to_buy') ?? [];

    if (!normalized) {
      return items;
    }

    return items.filter((item) => item.name.toLowerCase().includes(normalized));
  }, [groceryList, search]);

  const footer =
    activeView === 'to-buy' ? (
      <StickyFooter>
        <ActionButton
          onPress={async () => {
            if (selectedIds.length === 0) {
              await kitchenService.markAllPurchased();
              pushToast({
                title: 'All items purchased',
                description: 'The full To Buy list was moved into stock.',
                tone: 'success',
              });
            } else {
              await kitchenService.markPurchasedBulk(selectedIds);
              pushToast({
                title: 'Selected items purchased',
                description: 'Kitchen inventory was updated from the To Buy list.',
                tone: 'success',
              });
            }
            setSelectedIds([]);
            await load();
          }}
        >
          {selectedIds.length > 0 ? 'Mark Selected Purchased' : 'Mark All Purchased'}
        </ActionButton>
        <ActionButton variant="secondary" onPress={() => router.push('/kitchen/ocr/review')}>
          Scan Receipt (OCR)
        </ActionButton>
      </StickyFooter>
    ) : (
      <StickyFooter>
        <XStack gap={10}>
          <ActionButton
            fullWidth
            onPress={async () => {
              if (activeView === 'in-stock') {
                await kitchenService.moveLowStockToBuy();
                pushToast({
                  title: 'Low stock moved',
                  description: 'Low stock items were added to your To Buy list.',
                  tone: 'success',
                });
              } else {
                await kitchenService.moveUrgentToBuy();
                pushToast({
                  title: 'Urgent items moved',
                  description: 'Expiring items were added to your To Buy list.',
                  tone: 'warning',
                });
              }
              await load();
            }}
          >
            {activeView === 'in-stock' ? 'Mark Low Stock -> To Buy' : 'Move Urgent to Buy'}
          </ActionButton>
          <ActionButton
            variant="secondary"
            fullWidth
            onPress={() => (activeView === 'in-stock' ? navigateToView('expiring') : router.push('/kitchen/ocr/review'))}
          >
            {activeView === 'in-stock' ? 'View Expiring Soon' : 'Open OCR Review'}
          </ActionButton>
        </XStack>
      </StickyFooter>
    );

  return (
    <AppScaffold
      title="Kitchen Hub"
      subtitle={
        activeView === 'to-buy'
          ? 'Manage To Buy, In Stock, and Expiring in one place'
          : 'One place for To Buy, In Stock, and Expiring Soon'
      }
      activeTab="kitchen"
      footer={footer}
    >
      <SearchField
        value={search}
        onChangeText={(nextValue) => {
          setSearch(nextValue);
          if (activeView !== 'to-buy') {
            void load(nextValue);
          }
        }}
        placeholder={
          activeView === 'to-buy'
            ? 'Search items...'
            : activeView === 'in-stock'
              ? 'Search in-stock items...'
              : 'Search expiring items...'
        }
      />

      {summary ? (
        <XStack gap={8}>
          <StatChip
            label="To Buy"
            value={summary.toBuyCount}
            active={activeView === 'to-buy'}
            onPress={() => navigateToView('to-buy')}
          />
          <StatChip
            label="In Stock"
            value={summary.inStockCount}
            active={activeView === 'in-stock'}
            onPress={() => navigateToView('in-stock')}
          />
          <StatChip
            label="Expiring"
            value={summary.expiringCount}
            active={activeView === 'expiring'}
            onPress={() => navigateToView('expiring')}
          />
        </XStack>
      ) : null}

      <Paragraph color={palette.textSecondary} fontSize={12} lineHeight={18}>
        {activeView === 'to-buy'
          ? 'Purchase-only list • use row buttons to mark items purchased'
          : 'Scrollable full list. Tap an item to edit quantity and unit.'}
      </Paragraph>

      {loading ? (
        <SectionCard>
          <Text color={palette.text} fontSize={14} fontWeight="700">
            Loading Kitchen Hub...
          </Text>
        </SectionCard>
      ) : error ? (
        <SectionCard tone="danger">
          <Text color={palette.danger} fontSize={14} fontWeight="700">
            {error}
          </Text>
        </SectionCard>
      ) : activeView === 'to-buy' ? (
        <>
          <SectionCard>
            <SectionHeading
              title="To Buy (From Weekly Plan)"
              accessory={
                <Text color={palette.primary} fontSize={12} fontWeight="700">
                  {filteredToBuyItems.length} items
                </Text>
              }
            />
            {filteredToBuyItems.length === 0 ? (
              <EmptyState
                title="Everything is stocked"
                description="There are no remaining items in your To Buy list."
              />
            ) : (
              <YStack gap={0}>
                {filteredToBuyItems.map((item, index) => {
                  const selected = selectedIds.includes(item.itemId);
                  return (
                    <YStack key={item.itemId}>
                      {index > 0 ? <Divider /> : null}
                      <XStack alignItems="center" gap={10} paddingVertical={10}>
                        <Pressable
                          style={{ flex: 1 }}
                          onPress={() =>
                            setSelectedIds((current) =>
                              current.includes(item.itemId)
                                ? current.filter((entry) => entry !== item.itemId)
                                : [...current, item.itemId],
                            )
                          }
                        >
                          <YStack
                            gap={2}
                            borderRadius={8}
                            backgroundColor={selected ? palette.primarySoft : 'transparent'}
                            paddingHorizontal={selected ? 8 : 0}
                            paddingVertical={selected ? 8 : 0}
                          >
                            <Text color={palette.text} fontSize={14} fontWeight="700">
                              {item.name}
                            </Text>
                            <Paragraph color={palette.textSecondary} fontSize={12}>
                              {item.notes ?? 'Needed for this week'}
                            </Paragraph>
                          </YStack>
                        </Pressable>
                        <Text color={palette.text} fontSize={13} fontWeight="700">
                          {item.quantity.value} {item.quantity.unit}
                        </Text>
                        <ActionButton
                          variant="success"
                          size="sm"
                          onPress={async () => {
                            await kitchenService.markPurchased(item.itemId);
                            pushToast({
                              title: `${item.name} purchased`,
                              description: 'Inventory was updated from the To Buy list.',
                              tone: 'success',
                            });
                            await load();
                          }}
                        >
                          Mark purchased
                        </ActionButton>
                      </XStack>
                    </YStack>
                  );
                })}
              </YStack>
            )}
          </SectionCard>

          <SectionCard tone="accent">
            <Text color={palette.primary} fontSize={13} fontWeight="700">
              To Buy is auto-generated from Weekly Plan
            </Text>
          </SectionCard>
        </>
      ) : (
        <SectionCard>
          <SectionHeading
            title={VIEW_TO_LABEL[activeView]}
            accessory={
              <Text color={activeView === 'in-stock' ? palette.success : palette.warning} fontSize={12} fontWeight="700">
                {inventoryList?.items.length ?? 0} items
              </Text>
            }
          />
          {inventoryList?.items.length ? (
            <YStack gap={0}>
              {inventoryList.items.map((item, index) => {
                const meta = inventoryHint(item);
                return (
                  <YStack key={item.id}>
                    {index > 0 ? <Divider /> : null}
                    <Pressable onPress={() => router.push(`/kitchen/item/${item.id}`)}>
                      <XStack justifyContent="space-between" alignItems="center" gap={12} paddingVertical={12}>
                        <YStack flex={1} gap={2}>
                          <Text color={palette.text} fontSize={14} fontWeight="700">
                            {item.name}
                          </Text>
                          {item.location !== 'unknown' || item.category ? (
                            <Paragraph color={palette.textSecondary} fontSize={12}>
                              {[item.category, item.location !== 'unknown' ? item.location : null].filter(Boolean).join(' • ')}
                            </Paragraph>
                          ) : null}
                        </YStack>
                        <YStack alignItems="flex-end" gap={2}>
                          <Text color={palette.text} fontSize={13} fontWeight="700">
                            {quantityLabel(item.quantity?.value, item.quantity?.unit)}
                          </Text>
                          <Text color={meta.color} fontSize={12} fontWeight="700">
                            {meta.text}
                          </Text>
                        </YStack>
                      </XStack>
                    </Pressable>
                  </YStack>
                );
              })}
            </YStack>
          ) : (
            <EmptyState title="No items match this view" description="Try a different search or switch Kitchen tabs." />
          )}
        </SectionCard>
      )}
    </AppScaffold>
  );
}
