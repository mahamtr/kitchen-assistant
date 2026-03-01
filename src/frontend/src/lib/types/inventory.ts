// Generated from backend schema: src/backend/src/inventory/schemas/inventory-item.schema.ts
// Keep this in sync with the backend schema; adjust types as needed.

export type Location = 'fridge' | 'pantry';
export type Status = 'fresh' | 'use_soon' | 'expired' | 'unknown';
export type Confidence = 'low' | 'medium' | 'high';

export interface Quantity {
    value: number | null;
    unit: string | null;
}

export interface Dates {
    addedAt?: string | Date;
    openedAt?: string | Date | null;
    expiresAt?: string | Date | null;
}

export interface Freshness {
    estimatedDaysLeft?: number | null;
    confidence?: Confidence;
}

export interface InventoryItem {
    // Mongo document id (frontend often receives this as `_id`)
    _id?: string;

    userId: string; // serialized ObjectId
    name: string;
    category: string;
    location: Location;
    quantity?: Quantity;
    status?: Status;
    dates?: Dates;
    freshness?: Freshness;

    // Timestamps
    lastUpdatedAt?: string | Date;
    createdAt?: string | Date;
}

// Helper: map server InventoryItem to a minimal client-friendly shape
export function toClientItem(raw: any): InventoryItem {
    return {
        _id: raw._id || raw.id,
        userId: String(raw.userId),
        name: String(raw.name),
        category: raw.category ?? 'unspecified',
        location: raw.location,
        quantity: raw.quantity ?? { value: null, unit: null },
        status: raw.status ?? 'unknown',
        dates: raw.dates,
        freshness: raw.freshness,
        lastUpdatedAt: raw.lastUpdatedAt,
        createdAt: raw.createdAt,
    };
}

// Notes:
// - Dates may be ISO strings from the API; convert to Date objects if you need date math.
// - Keep this file synchronized with backend schema changes.
