import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PlannerModule } from '../planner/planner.module';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';

@Module({
  imports: [AuthModule, PlannerModule, InventoryModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
