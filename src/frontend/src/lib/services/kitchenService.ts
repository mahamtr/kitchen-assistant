import { apiGet, apiPatch, apiPost } from '../api';
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

async function getSummary(): Promise<InventorySummaryResponse> {
  return apiGet('/inventory/summary');
}

async function getCurrentGroceryList(): Promise<GroceryListResponse> {
  return apiGet('/grocery-lists/current');
}

async function syncFromPlan(): Promise<GroceryListResponse> {
  return apiPost('/grocery-lists/current/sync-from-plan');
}

async function markPurchased(itemId: string): Promise<GroceryListResponse> {
  return apiPost(`/grocery-lists/current/items/${itemId}/mark-purchased`);
}

async function markPurchasedBulk(itemIds: string[]): Promise<GroceryListResponse> {
  return apiPost('/grocery-lists/current/items/mark-purchased', { itemIds });
}

async function markAllPurchased(): Promise<GroceryListResponse> {
  return apiPost('/grocery-lists/current/items/mark-all-purchased');
}

async function moveLowStockToBuy(): Promise<GroceryListResponse> {
  return apiPost('/grocery-lists/current/actions/move-low-stock-to-buy');
}

async function moveUrgentToBuy(): Promise<GroceryListResponse> {
  return apiPost('/grocery-lists/current/actions/move-urgent-to-buy');
}

async function getInventoryItems(view: KitchenView, search = ''): Promise<InventoryListResponse> {
  const normalizedView = view === 'to-buy' ? 'in-stock' : view;
  return apiGet(`/inventory/items?view=${normalizedView}&search=${encodeURIComponent(search)}`);
}

async function getInventoryItem(itemId: string): Promise<InventoryItemDetailResponse> {
  return apiGet(`/inventory/items/${itemId}`);
}

async function patchInventoryItem(itemId: string, patch: UpdateInventoryItemPayload): Promise<InventoryItem> {
  return apiPatch(`/inventory/items/${itemId}`, patch);
}

async function discardItem(itemId: string) {
  return apiPost(`/inventory/items/${itemId}/discard`);
}

async function getInventoryEvents(): Promise<InventoryEventsResponse> {
  return apiGet('/inventory/events');
}

async function getOcrReview(): Promise<OcrReviewResponse> {
  return apiGet('/inventory/ocr/review');
}

async function updateOcrLine(lineId: string, patch: OcrLineUpdatePayload): Promise<OcrReviewResponse> {
  return apiPatch(`/inventory/ocr/review/${lineId}`, patch);
}

async function applyOcrReview(): Promise<OcrApplyResponse> {
  return apiPost('/inventory/ocr/apply');
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
