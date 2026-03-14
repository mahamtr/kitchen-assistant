import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DataModule } from '../data/data.module';
import { UsersModule } from '../users/users.module';
import { GroceryController } from './grocery.controller';
import { GroceryService } from './grocery.service';

@Module({
  imports: [AuthModule, DataModule, UsersModule],
  controllers: [GroceryController],
  providers: [GroceryService],
  exports: [GroceryService],
})
export class GroceryModule {}
