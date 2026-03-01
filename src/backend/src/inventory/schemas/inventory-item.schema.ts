import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type InventoryItemDocument = InventoryItem & Document;

@Schema({ timestamps: { createdAt: 'createdAt', updatedAt: 'lastUpdatedAt' } })
export class InventoryItem {
    @Prop({ type: Types.ObjectId, required: true })
    userId: Types.ObjectId;

    @Prop({ required: true })
    name: string;

    @Prop({ required: true })
    category: string;

    @Prop({ required: true, enum: ['fridge', 'pantry'] })
    location: 'fridge' | 'pantry';

    @Prop({ type: Object, default: {} })
    quantity: { value: number | null; unit: string | null };

    @Prop({ enum: ['fresh', 'use_soon', 'expired', 'unknown'], default: 'unknown' })
    status: 'fresh' | 'use_soon' | 'expired' | 'unknown';

    @Prop({ type: Object, default: {} })
    dates: { addedAt: Date; openedAt?: Date | null; expiresAt?: Date | null };

    @Prop({ type: Object, default: {} })
    freshness: { estimatedDaysLeft?: number | null; confidence?: 'low' | 'medium' | 'high' };

    @Prop()
    lastUpdatedAt: Date;

    @Prop()
    createdAt: Date;
}

export const InventoryItemSchema = SchemaFactory.createForClass(InventoryItem);
