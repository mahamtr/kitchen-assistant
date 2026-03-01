import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type InventoryEventDocument = InventoryEvent & Document;

@Schema({ timestamps: { createdAt: 'createdAt' } })
export class InventoryEvent {
    @Prop({ type: Types.ObjectId, required: true })
    userId: Types.ObjectId;

    @Prop({ enum: ['ADD', 'USE', 'DISCARD', 'ADJUST'], required: true })
    type: 'ADD' | 'USE' | 'DISCARD' | 'ADJUST';

    @Prop({ type: Array, default: [] })
    items: Array<any>;

    @Prop({ enum: ['home', 'chat', 'grocery_list'], default: 'home' })
    source: 'home' | 'chat' | 'grocery_list';

    @Prop({ type: Object, default: {} })
    metadata: any;

    @Prop()
    createdAt: Date;
}

export const InventoryEventSchema = SchemaFactory.createForClass(InventoryEvent);
