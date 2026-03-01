import api from '../api';
import type { InventoryItem } from '../types/inventory';

// DTOs / response shapes for inventory service
// Matches backend CreateInventoryEventDto (src/backend/src/inventory/dto/create-inventory-event.dto.ts)
export type EventItemDto = {
    inventoryItemId?: string | null;
    name: string;
    quantity?: { value: number | null; unit: string | null };
};

export type CreateEventRequestDto = {
    userId: string;
    type: 'ADD' | 'USE' | 'DISCARD' | 'ADJUST';
    items: EventItemDto[];
    source?: 'home' | 'chat' | 'grocery_list';
    metadata?: any;
};

export type CreateEventResponseDto = {
    success: boolean;
    // optional created event or item
    event?: any;
    message?: string;
};

export type HomeResponseDto = {
    useSoon: InventoryItem[];
    fridge: InventoryItem[];
    pantry: InventoryItem[];
};

export type EventsResponseDto = {
    events: any[];
};

const endpoint = '/inventory';

export async function createEvent(dto: CreateEventRequestDto): Promise<CreateEventResponseDto> {
    const res = await api.post(`${endpoint}/events`, dto);
    return res as CreateEventResponseDto;
}

export async function getHome(userId?: string): Promise<HomeResponseDto> {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    const res = await api.get(`${endpoint}/home${query}`);
    return res as HomeResponseDto;
}

export async function findEvents(userId?: string): Promise<EventsResponseDto> {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    const res = await api.get(`${endpoint}/events${query}`);
    return res as EventsResponseDto;
}

export const inventoryService = { createEvent, getHome, findEvents };

export default inventoryService;
