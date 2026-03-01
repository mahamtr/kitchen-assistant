import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { InventoryItem, InventoryItemDocument } from './schemas/inventory-item.schema';
import { InventoryEvent, InventoryEventDocument } from './schemas/inventory-event.schema';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { CreateInventoryEventDto } from './dto/create-inventory-event.dto';

@Injectable()
export class InventoryService {
    constructor(
        @InjectModel(InventoryItem.name) private itemModel: Model<InventoryItemDocument>,
        @InjectModel(InventoryEvent.name) private eventModel: Model<InventoryEventDocument>,
    ) { }

    // Inventory item methods
    async createItem(userId: string | Types.ObjectId, dto: CreateInventoryItemDto) {
        const created = new this.itemModel({ ...dto, userId: new Types.ObjectId(userId) });
        return created.save();
    }

    async findAllByUser(userId: string | Types.ObjectId) {
        return this.itemModel.find({ userId }).exec();
    }

    async findById(id: string) {
        const doc = await this.itemModel.findById(id).exec();
        if (!doc) throw new NotFoundException('Inventory item not found');
        return doc;
    }

    async updateItem(id: string, patch: Partial<CreateInventoryItemDto>) {
        const updated = await this.itemModel.findByIdAndUpdate(id, patch, { new: true }).exec();
        if (!updated) throw new NotFoundException('Inventory item not found');
        return updated;
    }

    async removeItem(id: string) {
        const res = await this.itemModel.findByIdAndDelete(id).exec();
        if (!res) throw new NotFoundException('Inventory item not found');
        return res;
    }

    // Event methods
    async createEvent(dto: CreateInventoryEventDto) {
        // const created = new this.eventModel({ ...dto, userId: new Types.ObjectId(userId) }) 
        // return created.save();

        // Save the incoming event
        const savedEvent = await this.eventModel.create(dto);

        // Process each item in the event
        const updatedItems = [];

        for (const item of dto.items) {
            // 1) If inventoryItemId exists, find item
            // 2) Otherwise, resolve by name/location
            const existing = item.inventoryItemId
                ? await this.itemModel.findById(item.inventoryItemId)
                : await this.itemModel.findOne({ name: item.name });

            if (dto.type === 'ADD') {
                // either create new or update
                if (existing) {
                    existing.quantity.value =
                        (existing.quantity.value || 0) +
                        (item.quantity?.value || 0);
                    await existing.save();
                    updatedItems.push(existing);
                } else {
                    const newItem = await this.itemModel.create({
                        ...item,
                        userId: new Types.ObjectId(dto.UserId),
                        dates: { addedAt: new Date() },
                    });
                    updatedItems.push(newItem);
                }
            }

            if (dto.type === 'USE' || dto.type === 'DISCARD') {
                if (existing) {
                    // subtract quantity; if <= 0, remove
                    const remaining = (existing.quantity.value || 0) -
                        (item.quantity?.value || 0);

                    if (remaining > 0) {
                        existing.quantity.value = remaining;
                        await existing.save();
                        updatedItems.push(existing);
                    } else {
                        await this.itemModel.findByIdAndDelete(existing._id);
                    }
                }
            }

            if (dto.type === 'ADJUST') {
                // Set to the specified state
                if (existing) {
                    existing.quantity = item.quantity || existing.quantity;
                    await existing.save();
                    updatedItems.push(existing);
                }
            }
        }

        return { savedEvent, updatedItems };
    }

    async findEvents(userId: string | Types.ObjectId) {
        return this.eventModel.find().exec();
    }

    // Home DTO: { useSoon: [], fridge: [], pantry: [] }
    async getHome(userId: string | Types.ObjectId) {
        const items = await this.itemModel.find({ userId }).exec();
        const fridge = items.filter((i) => i.location === 'fridge');
        const pantry = items.filter((i) => i.location === 'pantry');
        //TODO define how "Use Soon" is determined - for now, just filter by status
        const useSoon = items.filter((i) => i.status === 'use_soon');
        return { useSoon, fridge, pantry };
    }
}
