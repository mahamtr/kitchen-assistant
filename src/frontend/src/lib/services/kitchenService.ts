import { getMockDataSnapshot, useMockAppStore } from '../mock/mockStore';
import { requireAppUserId, withDelay } from './utils';
import type {
  GroceryListResponse,
  InventoryEventsResponse,
  InventoryItemDetailResponse,
  InventoryListResponse,
  InventorySummaryResponse,
  KitchenView,
  OcrApplyResponse,
  OcrLineUpdatePayload,
  OcrReviewResponse,
  UpdateInventoryItemPayload,
} from '../types/contracts';
import type { InventoryItem } from '../types/entities';

function sortByName(items: InventoryItem[]): InventoryItem[] {
  return items.slice().sort((left, right) => left.name.localeCompare(right.name));
}

async function getSummary(): Promise<InventorySummaryResponse> {
  const userId = requireAppUserId();
  const snapshot = getMockDataSnapshot();
  const groceryList = snapshot.groceryLists[snapshot.currentGroceryListByUserId[userId]];
  const inventoryItems = Object.values(snapshot.inventoryItems).filter((item) => item.userId === userId);
  const urgentItems = inventoryItems
    .filter((item) => item.status === 'use_soon' || item.status === 'expired')
    .sort((left, right) => (left.dates?.expiresAt ?? '').localeCompare(right.dates?.expiresAt ?? ''))
    .slice(0, 3);

  return withDelay({
    toBuyCount: groceryList?.items.filter((item) => item.status === 'to_buy').length ?? 0,
    inStockCount: inventoryItems.length,
    expiringCount: inventoryItems.filter((item) => item.status === 'use_soon' || item.status === 'expired').length,
    lowStockCount: inventoryItems.filter((item) => item.status === 'low_stock').length,
    urgentItems: urgentItems.map((item) => ({
      inventoryItemId: item.id,
      name: item.name,
      expiresAt: item.dates?.expiresAt ?? null,
    })),
  });
}

async function getCurrentGroceryList(): Promise<GroceryListResponse> {
  const userId = requireAppUserId();
  const snapshot = getMockDataSnapshot();
  const list = snapshot.groceryLists[snapshot.currentGroceryListByUserId[userId]];
  if (!list) {
    throw new Error('No active grocery list.');
  }

  return withDelay({
    id: list.id,
    weeklyPlanId: list.weeklyPlanId,
    items: list.items,
    status: list.status,
  });
}

async function syncFromPlan(): Promise<GroceryListResponse> {
  const userId = requireAppUserId();
  const list = useMockAppStore.getState().syncGroceryFromPlan(userId);
  return withDelay({
    id: list.id,
    weeklyPlanId: list.weeklyPlanId,
    items: list.items,
    status: list.status,
  });
}

async function markPurchased(itemId: string): Promise<GroceryListResponse> {
  const userId = requireAppUserId();
  const list = useMockAppStore.getState().markGroceryPurchased(userId, [itemId]);
  return withDelay({
    id: list.id,
    weeklyPlanId: list.weeklyPlanId,
    items: list.items,
    status: list.status,
  });
}

async function markPurchasedBulk(itemIds: string[]): Promise<GroceryListResponse> {
  const userId = requireAppUserId();
  const list = useMockAppStore.getState().markGroceryPurchased(userId, itemIds);
  return withDelay({
    id: list.id,
    weeklyPlanId: list.weeklyPlanId,
    items: list.items,
    status: list.status,
  });
}

async function markAllPurchased(): Promise<GroceryListResponse> {
  const current = await getCurrentGroceryList();
  const itemIds = current.items.filter((item) => item.status === 'to_buy').map((item) => item.itemId);
  return markPurchasedBulk(itemIds);
}

async function moveLowStockToBuy(): Promise<GroceryListResponse> {
  const userId = requireAppUserId();
  const list = useMockAppStore.getState().moveLowStockToBuy(userId);
  return withDelay({
    id: list.id,
    weeklyPlanId: list.weeklyPlanId,
    items: list.items,
    status: list.status,
  });
}

async function moveUrgentToBuy(): Promise<GroceryListResponse> {
  const userId = requireAppUserId();
  const list = useMockAppStore.getState().moveUrgentToBuy(userId);
  return withDelay({
    id: list.id,
    weeklyPlanId: list.weeklyPlanId,
    items: list.items,
    status: list.status,
  });
}

async function getInventoryItems(view: KitchenView, search = ''): Promise<InventoryListResponse> {
  const userId = requireAppUserId();
  const normalized = search.toLowerCase().trim();
  const snapshot = getMockDataSnapshot();
  let items = Object.values(snapshot.inventoryItems).filter((item) => item.userId === userId);

  if (view === 'in-stock') {
    items = items.filter((item) => item.status === 'fresh' || item.status === 'low_stock');
  }

  if (view === 'expiring') {
    items = items.filter((item) => item.status === 'use_soon' || item.status === 'expired');
  }

  if (normalized) {
    items = items.filter((item) => item.name.toLowerCase().includes(normalized));
  }

  const sorted = sortByName(items);
  return withDelay({
    items: sorted,
    total: sorted.length,
  });
}

async function getInventoryItem(itemId: string): Promise<InventoryItemDetailResponse> {
  const userId = requireAppUserId();
  const snapshot = getMockDataSnapshot();
  const item = snapshot.inventoryItems[itemId];
  if (!item || item.userId !== userId) {
    throw new Error('Inventory item not found.');
  }

  return withDelay({
    item,
    recentEvents: snapshot.inventoryEvents
      .filter(
        (event) =>
          event.userId === userId &&
          event.items?.some((eventItem) => eventItem.inventoryItemId === itemId || eventItem.name === item.name),
      )
      .slice(-5)
      .reverse(),
  });
}

async function patchInventoryItem(itemId: string, patch: UpdateInventoryItemPayload): Promise<InventoryItem> {
  const userId = requireAppUserId();
  return withDelay(useMockAppStore.getState().updateInventoryItem(userId, itemId, patch));
}

async function discardItem(itemId: string) {
  const userId = requireAppUserId();
  return withDelay(useMockAppStore.getState().discardInventoryItem(userId, itemId));
}

async function getInventoryEvents(): Promise<InventoryEventsResponse> {
  const userId = requireAppUserId();
  const snapshot = getMockDataSnapshot();
  return withDelay({
    events: snapshot.inventoryEvents
      .filter((event) => event.userId === userId)
      .slice()
      .reverse(),
  });
}

async function getOcrReview(): Promise<OcrReviewResponse> {
  const userId = requireAppUserId();
  const snapshot = getMockDataSnapshot();
  const event = snapshot.inventoryEvents
    .filter((entry) => entry.userId === userId && entry.type === 'MEMORY' && entry.source === 'ocr')
    .slice()
    .reverse()[0];

  if (!event) {
    throw new Error('No OCR review available.');
  }

  return withDelay({
    eventId: event.id,
    confidence: Number(event.metadata?.confidence ?? 0.93),
    receiptLabel: String(event.metadata?.receiptLabel ?? 'Receipt review'),
    lines: (event.metadata?.lines as OcrReviewResponse['lines']) ?? [],
  });
}

async function updateOcrLine(lineId: string, patch: OcrLineUpdatePayload): Promise<OcrReviewResponse> {
  const userId = requireAppUserId();
  useMockAppStore.getState().reviewOcrLine(userId, lineId, patch);
  return getOcrReview();
}

async function applyOcrReview(): Promise<OcrApplyResponse> {
  const userId = requireAppUserId();
  const result = useMockAppStore.getState().applyOcrReview(userId);

  return withDelay({
    appliedEventId: result.event.id,
    updatedItems: result.updatedItems,
  });
}

export const kitchenService = {
  applyOcrReview,
  discardItem,
  getCurrentGroceryList,
  getInventoryEvents,
  getInventoryItem,
  getInventoryItems,
  getOcrReview,
  getSummary,
  markAllPurchased,
  markPurchased,
  markPurchasedBulk,
  moveLowStockToBuy,
  moveUrgentToBuy,
  patchInventoryItem,
  syncFromPlan,
  updateOcrLine,
};

export default kitchenService;
