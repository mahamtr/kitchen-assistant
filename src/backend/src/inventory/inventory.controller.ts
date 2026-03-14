import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth/supabase-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../common/current-user';
import { InventoryService } from './inventory.service';

@Controller('inventory')
@UseGuards(SupabaseAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('summary')
  async getSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.inventoryService.getSummary(user);
  }

  @Get('items')
  async getItems(
    @CurrentUser() user: AuthenticatedUser,
    @Query('view') view: 'in-stock' | 'expiring',
    @Query('search') search = '',
  ) {
    return this.inventoryService.getItems(user, view, search);
  }

  @Get('items/:itemId')
  async getItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId') itemId: string,
  ) {
    return this.inventoryService.getItem(user, itemId);
  }

  @Patch('items/:itemId')
  async patchItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId') itemId: string,
    @Body() patch: Record<string, unknown>,
  ) {
    return this.inventoryService.patchItem(user, itemId, patch);
  }

  @Post('items/:itemId/discard')
  async discardItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId') itemId: string,
  ) {
    return this.inventoryService.discardItem(user, itemId);
  }

  @Get('events')
  async getEvents(@CurrentUser() user: AuthenticatedUser) {
    return this.inventoryService.getEvents(user);
  }

  @Get('ocr/review')
  async getOcrReview(@CurrentUser() user: AuthenticatedUser) {
    return this.inventoryService.getOcrReview(user);
  }

  @Patch('ocr/review/:lineId')
  async updateOcrLine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lineId') lineId: string,
    @Body() patch: Record<string, unknown>,
  ) {
    return this.inventoryService.updateOcrLine(user, lineId, patch as never);
  }

  @Post('ocr/apply')
  async applyOcrReview(@CurrentUser() user: AuthenticatedUser) {
    return this.inventoryService.applyOcrReview(user);
  }
}
