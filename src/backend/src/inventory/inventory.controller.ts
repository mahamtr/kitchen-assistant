import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateInventoryEventDto } from './dto/create-inventory-event.dto';

@Controller('inventory')
export class InventoryController {
    constructor(private readonly service: InventoryService) { }

    // 1. POST /inventory/events
    @Post('events')
    createEvent(@Body() dto: CreateInventoryEventDto) {
        return this.service.createEvent(dto);
    }

    // 2. GET /inventory/home => { useSoon, fridge, pantry }
    @Get('home')
    getHome(@Query('userId') userId: string) {
        return this.service.getHome(userId);
    }

    // 3. GET /inventory/events
    @Get('events')
    findEvents(@Query('userId') userId: string) {
        return this.service.findEvents(userId);
    }
}
