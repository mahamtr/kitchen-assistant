import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth/supabase-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../common/current-user';
import { GroceryService } from './grocery.service';

@Controller('grocery-lists')
@UseGuards(SupabaseAuthGuard)
export class GroceryController {
  constructor(private readonly groceryService: GroceryService) {}

  @Get('current')
  async getCurrentList(@CurrentUser() user: AuthenticatedUser) {
    return this.groceryService.getCurrentList(user);
  }

  @Post('current/sync-from-plan')
  async syncFromPlan(@CurrentUser() user: AuthenticatedUser) {
    return this.groceryService.syncFromPlan(user);
  }

  @Post('current/items/:itemId/mark-purchased')
  async markPurchased(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId') itemId: string,
  ) {
    return this.groceryService.markPurchased(user, [itemId]);
  }

  @Post('current/items/mark-purchased')
  async markPurchasedBulk(
    @CurrentUser() user: AuthenticatedUser,
    @Body('itemIds') itemIds: string[],
  ) {
    return this.groceryService.markPurchased(user, itemIds ?? []);
  }

  @Post('current/items/mark-all-purchased')
  async markAllPurchased(@CurrentUser() user: AuthenticatedUser) {
    return this.groceryService.markAllPurchased(user);
  }

  @Post('current/actions/move-low-stock-to-buy')
  async moveLowStockToBuy(@CurrentUser() user: AuthenticatedUser) {
    return this.groceryService.moveLowStockToBuy(user);
  }

  @Post('current/actions/move-urgent-to-buy')
  async moveUrgentToBuy(@CurrentUser() user: AuthenticatedUser) {
    return this.groceryService.moveUrgentToBuy(user);
  }
}
