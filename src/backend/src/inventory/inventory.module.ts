import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { InventoryItem, InventoryItemSchema } from './schemas/inventory-item.schema';
import { InventoryEvent, InventoryEventSchema } from './schemas/inventory-event.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: InventoryItem.name, schema: InventoryItemSchema },
            { name: InventoryEvent.name, schema: InventoryEventSchema },
        ]),
    ],
    providers: [InventoryService],
    controllers: [InventoryController],
    exports: [InventoryService],
})
export class InventoryModule { }
